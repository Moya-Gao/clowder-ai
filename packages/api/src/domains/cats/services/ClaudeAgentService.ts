/**
 * Claude Agent Service
 * 使用 Claude CLI 子进程调用布偶猫 (Opus)
 *
 * CLI 调用方式:
 *   claude -p "..." --output-format stream-json --verbose
 *     --permission-mode acceptEdits
 *     --model <model>
 *     [--resume <sessionId>]
 *
 * NDJSON 事件格式:
 *   system/init  → session_init (含 session_id)
 *   assistant    → text / tool_use (content blocks)
 *   result/error → error
 *   result/success → 跳过 (done 在循环后 yield)
 */

import { createCatId, CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { spawnCli, isCliError, isCliTimeout } from '../../../utils/cli-spawn.js';
import { formatCliExitError } from '../../../utils/cli-format.js';
import type { SpawnFn } from '../../../utils/cli-types.js';
import { extractImagePaths } from './image-paths.js';
import { getCatModel } from '../../../config/cat-models.js';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
  MessageMetadata,
  TokenUsage,
} from './types.js';

const CAT_ID = createCatId('opus');

const PERMISSION_MODE = 'bypassPermissions';

/**
 * Options for constructing ClaudeAgentService (dependency injection)
 */
interface ClaudeAgentServiceOptions {
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
  /** Model override (default: CLAUDE_MODEL env or 'claude-sonnet-4-5-20250929') */
  model?: string;
  /** Absolute path to MCP server entry (dist/index.js) for --mcp-config */
  mcpServerPath?: string;
}

/**
 * Resolve default MCP server path for monorepo layouts.
 * Supports API started from:
 * - repo root (cwd=.../cat-cafe)
 * - packages/api (cwd=.../cat-cafe/packages/api)
 * - API dist/src subdirs in some tooling (best-effort fallback)
 */
export function resolveDefaultClaudeMcpServerPath(cwd = process.cwd()): string | undefined {
  const candidates = [
    resolve(cwd, '../mcp-server/dist/index.js'),
    resolve(cwd, 'packages/mcp-server/dist/index.js'),
    resolve(cwd, '../../packages/mcp-server/dist/index.js'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Transform a raw Claude CLI NDJSON event into AgentMessage(s).
 * Returns null to skip events we don't care about (system/hook, result/success).
 */
function transformClaudeEvent(
  event: unknown,
  catId: CatId,
  streamState: {
    currentMessageId: string | undefined;
    partialTextMessageIds: Set<string>;
  },
): AgentMessage | AgentMessage[] | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  // stream_event/* (enabled by --include-partial-messages) → incremental text
  if (e['type'] === 'stream_event') {
    const streamEvent = e['event'];
    if (typeof streamEvent !== 'object' || streamEvent === null) return null;
    const s = streamEvent as Record<string, unknown>;

    if (s['type'] === 'message_start') {
      const message = s['message'] as Record<string, unknown> | undefined;
      const messageId = message?.['id'];
      if (typeof messageId === 'string') {
        streamState.currentMessageId = messageId;
      }
      return null;
    }

    if (s['type'] === 'message_stop') {
      streamState.currentMessageId = undefined;
      return null;
    }

    if (s['type'] === 'content_block_delta') {
      const delta = s['delta'];
      if (typeof delta !== 'object' || delta === null) return null;
      const d = delta as Record<string, unknown>;
      if (d['type'] !== 'text_delta' || typeof d['text'] !== 'string' || d['text'].length === 0) {
        return null;
      }
      if (streamState.currentMessageId) {
        streamState.partialTextMessageIds.add(streamState.currentMessageId);
      }
      return {
        type: 'text',
        catId,
        content: d['text'],
        timestamp: Date.now(),
      };
    }

    return null;
  }

  // system/init → session_init
  if (e['type'] === 'system' && e['subtype'] === 'init') {
    const sessionId = e['session_id'];
    if (typeof sessionId === 'string') {
      return {
        type: 'session_init',
        catId,
        sessionId,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  // assistant → text / tool_use (multiple content blocks possible)
  if (e['type'] === 'assistant') {
    const message = e['message'] as Record<string, unknown> | undefined;
    const messageId = typeof message?.['id'] === 'string' ? message['id'] : undefined;
    const skipFinalText = Boolean(messageId && streamState.partialTextMessageIds.has(messageId));
    const content = message?.['content'];
    if (!Array.isArray(content)) return null;

    const messages: AgentMessage[] = [];
    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      if (b['type'] === 'text' && typeof b['text'] === 'string') {
        if (skipFinalText) continue;
        messages.push({
          type: 'text',
          catId,
          content: b['text'],
          timestamp: Date.now(),
        });
      } else if (b['type'] === 'tool_use' && typeof b['name'] === 'string') {
        messages.push({
          type: 'tool_use',
          catId,
          toolName: b['name'],
          toolInput: (b['input'] as Record<string, unknown>) ?? {},
          timestamp: Date.now(),
        });
      }
    }
    if (messageId && skipFinalText) {
      streamState.partialTextMessageIds.delete(messageId);
    }
    return messages.length > 0 ? messages : null;
  }

  // result/error → error message
  if (e['type'] === 'result' && e['subtype'] !== 'success') {
    const rawErrors = Array.isArray(e['errors']) ? e['errors'] : [];
    const errors = rawErrors
      .filter((item): item is string => typeof item === 'string')
      .join('; ');
    return {
      type: 'error',
      catId,
      error: errors || 'Unknown error',
      timestamp: Date.now(),
    };
  }

  // result/success, system/hook, etc. → skip
  return null;
}

function isResultErrorEvent(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e['type'] === 'result' && e['subtype'] !== 'success';
}

/** F8: Extract token usage from Claude result/success event.
 *  Normalises inputTokens to total input (new + cache_read + cache_creation)
 *  so that the semantics match Codex/OpenAI where inputTokens = total. */
function extractClaudeUsage(e: Record<string, unknown>): TokenUsage {
  const usage = (e['usage'] ?? {}) as Record<string, unknown>;
  const result: TokenUsage = {};
  const rawInput = typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0;
  const cacheRead = typeof usage['cache_read_input_tokens'] === 'number' ? usage['cache_read_input_tokens'] : 0;
  const cacheCreate = typeof usage['cache_creation_input_tokens'] === 'number' ? usage['cache_creation_input_tokens'] : 0;
  const totalInput = rawInput + cacheRead + cacheCreate;
  if (totalInput > 0) result.inputTokens = totalInput;
  if (typeof usage['output_tokens'] === 'number') result.outputTokens = usage['output_tokens'];
  if (cacheRead > 0) result.cacheReadTokens = cacheRead;
  if (cacheCreate > 0) result.cacheCreationTokens = cacheCreate;
  if (typeof e['total_cost_usd'] === 'number') result.costUsd = e['total_cost_usd'];
  if (typeof e['duration_ms'] === 'number') result.durationMs = e['duration_ms'];
  if (typeof e['duration_api_ms'] === 'number') result.durationApiMs = e['duration_api_ms'];
  if (typeof e['num_turns'] === 'number') result.numTurns = e['num_turns'];
  return result;
}

/**
 * Service for invoking Claude via CLI subprocess.
 * Uses Max plan subscription instead of API key.
 */
export class ClaudeAgentService implements AgentService {
  readonly catId = CAT_ID;
  private readonly spawnFn: SpawnFn | undefined;
  private readonly model: string;
  private readonly mcpServerPath: string | undefined;

  constructor(options?: ClaudeAgentServiceOptions) {
    this.spawnFn = options?.spawnFn;
    // Priority: constructor option > CAT_OPUS_MODEL env > CLAUDE_MODEL env > default
    this.model = options?.model ?? getCatModel('opus');
    const configuredPath = options?.mcpServerPath ?? process.env['CAT_CAFE_MCP_SERVER_PATH'];
    if (configuredPath && configuredPath.trim().length > 0) {
      this.mcpServerPath = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
    } else {
      this.mcpServerPath = resolveDefaultClaudeMcpServerPath();
    }
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--model', this.model,
      '--permission-mode', PERMISSION_MODE,
      // Skip global user settings to prevent config pollution across sessions
      '--setting-sources', 'project,local',
    ];

    // Inject static identity via --append-system-prompt (separate from -p content)
    if (options?.systemPrompt) {
      args.push('--append-system-prompt', options.systemPrompt);
    }

    if (options?.sessionId) {
      args.push('--resume', options.sessionId);
    }

    // Add MCP server config when callback env is present
    if (options?.callbackEnv && this.mcpServerPath) {
      args.push('--mcp-config', JSON.stringify({
        mcpServers: {
          'cat-cafe': {
            command: 'node',
            args: [this.mcpServerPath],
          },
        },
      }));
    }

    // Pass image paths via --images flag (needs smoke test to confirm flag name)
    const imagePaths = extractImagePaths(options?.contentBlocks, options?.uploadDir);
    for (const imgPath of imagePaths) {
      args.push('--images', imgPath);
    }

    const metadata: MessageMetadata = { provider: CAT_CONFIGS.opus.provider, model: this.model };
    const streamState = { partialTextMessageIds: new Set<string>(), currentMessageId: undefined as string | undefined };

    try {
      let sawResultError = false;
      const events = spawnCli(
        {
          command: 'claude',
          args,
          ...(options?.workingDirectory ? { cwd: options.workingDirectory } : {}),
          ...(options?.callbackEnv ? { env: options.callbackEnv } : {}),
          ...(options?.signal ? { signal: options.signal } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined
      );

      for await (const event of events) {
        if (isCliTimeout(event)) {
          yield {
            type: 'error',
            catId: CAT_ID,
            error: `布偶猫 CLI 响应超时 (${Math.round(event.timeoutMs / 1000)}s)`,
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }
        if (isCliError(event)) {
          if (sawResultError) continue;
          yield {
            type: 'error',
            catId: CAT_ID,
            error: formatCliExitError('Claude CLI', event),
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }

        // F8: Capture usage from result/success events before transform drops them
        const rawEvt = event as Record<string, unknown>;
        if (rawEvt['type'] === 'result' && rawEvt['subtype'] === 'success') {
          metadata.usage = extractClaudeUsage(rawEvt);
        }

        const fromResultError = isResultErrorEvent(event);
        const result = transformClaudeEvent(event, CAT_ID, streamState);
        if (result === null) continue;

        if (Array.isArray(result)) {
          for (const msg of result) {
            // Capture sessionId into metadata
            if (msg.type === 'session_init' && msg.sessionId) {
              metadata.sessionId = msg.sessionId;
            }
            yield { ...msg, metadata };
          }
        } else {
          if (result.type === 'session_init' && result.sessionId) {
            metadata.sessionId = result.sessionId;
          }
          if (fromResultError && result.type === 'error') {
            sawResultError = true;
          }
          yield { ...result, metadata };
        }
      }

      yield { type: 'done', catId: CAT_ID, metadata, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        metadata,
        timestamp: Date.now(),
      };
    }
  }
}
