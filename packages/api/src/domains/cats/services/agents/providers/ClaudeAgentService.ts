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
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { spawnCli, isCliError, isCliTimeout } from '../../../../../utils/cli-spawn.js';
import { formatCliExitError } from '../../../../../utils/cli-format.js';
import type { SpawnFn } from '../../../../../utils/cli-types.js';
import { extractImagePaths } from '../providers/image-paths.js';
import { appendLocalImagePathHints, collectImageAccessDirectories } from '../providers/image-cli-bridge.js';
import { getCatModel } from '../../../../../config/cat-models.js';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
  MessageMetadata,
} from '../../types.js';
import { transformClaudeEvent, isResultErrorEvent, extractClaudeUsage } from './claude-ndjson-parser.js';

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
    let effectivePrompt = prompt;
    const imagePaths = extractImagePaths(options?.contentBlocks, options?.uploadDir);
    const imageAccessDirs = collectImageAccessDirectories(imagePaths);
    // Claude CLI print mode has no direct image attach flag; provide path hints and grant dir access.
    effectivePrompt = appendLocalImagePathHints(effectivePrompt, imagePaths);

    const args: string[] = [
      '-p', effectivePrompt,
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
    for (const dir of imageAccessDirs) {
      args.push('--add-dir', dir);
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

    const metadata: MessageMetadata = { provider: CAT_CONFIGS['opus']!.provider, model: this.model };
    const streamState = {
      partialTextMessageIds: new Set<string>(),
      currentMessageId: undefined as string | undefined,
      lastTurnInputTokens: undefined as number | undefined,
    };

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
          // F24-fix: Attach per-turn input from last message_start for context health
          if (streamState.lastTurnInputTokens != null && metadata.usage) {
            metadata.usage.lastTurnInputTokens = streamState.lastTurnInputTokens;
          }
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
      // Guarantee done after error so invoke-single-cat can set isFinal correctly
      yield { type: 'done', catId: CAT_ID, metadata, timestamp: Date.now() };
    }
  }
}
