/**
 * Claude Agent Service
 * 使用 Claude CLI 子进程调用布偶猫 (Opus)
 *
 * CLI 调用方式:
 *   claude -p "..." --output-format stream-json --verbose
 *     --allowedTools Read,Edit,Glob,Grep
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

import { createCatId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import { spawnCli, isCliError } from '../../../utils/cli-spawn.js';
import type { SpawnFn } from '../../../utils/cli-types.js';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('opus');

/** CLI flags for security boundary (statically scannable) */
const ALLOWED_TOOLS = 'Read,Edit,Glob,Grep';
const PERMISSION_MODE = 'acceptEdits';

/**
 * Options for constructing ClaudeAgentService (dependency injection)
 */
interface ClaudeAgentServiceOptions {
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
  /** Model override (default: CLAUDE_MODEL env or 'claude-sonnet-4-5-20250929') */
  model?: string;
}

/**
 * Transform a raw Claude CLI NDJSON event into AgentMessage(s).
 * Returns null to skip events we don't care about (system/hook, result/success).
 */
function transformClaudeEvent(
  event: unknown,
  catId: CatId
): AgentMessage | AgentMessage[] | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

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
    const content = message?.['content'];
    if (!Array.isArray(content)) return null;

    const messages: AgentMessage[] = [];
    for (const block of content) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      if (b['type'] === 'text' && typeof b['text'] === 'string') {
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

function formatCliExitError(event: {
  exitCode: number | null;
  signal: string | null;
  stderr: string;
}): string {
  const status = event.exitCode !== null ? `code ${event.exitCode}` : 'no exit code';
  const signalText = event.signal ? `, signal ${event.signal}` : '';
  const stderr = event.stderr.trim();
  return stderr.length > 0
    ? `Claude CLI exited (${status}${signalText}): ${stderr}`
    : `Claude CLI exited (${status}${signalText})`;
}

/**
 * Service for invoking Claude via CLI subprocess.
 * Uses Max plan subscription instead of API key.
 */
export class ClaudeAgentService implements AgentService {
  readonly catId = CAT_ID;
  private readonly spawnFn: SpawnFn | undefined;
  private readonly model: string;

  constructor(options?: ClaudeAgentServiceOptions) {
    this.spawnFn = options?.spawnFn;
    this.model = options?.model
      ?? process.env['CLAUDE_MODEL']
      ?? 'claude-sonnet-4-5-20250929';
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    const args: string[] = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--model', this.model,
      '--allowedTools', ALLOWED_TOOLS,
      '--permission-mode', PERMISSION_MODE,
    ];

    if (options?.sessionId) {
      args.push('--resume', options.sessionId);
    }

    try {
      let sawResultError = false;
      const events = spawnCli(
        {
          command: 'claude',
          args,
          ...(options?.workingDirectory ? { cwd: options.workingDirectory } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined
      );

      for await (const event of events) {
        if (isCliError(event)) {
          if (sawResultError) continue;
          yield {
            type: 'error',
            catId: CAT_ID,
            error: formatCliExitError(event),
            timestamp: Date.now(),
          };
          continue;
        }

        const fromResultError = isResultErrorEvent(event);
        const result = transformClaudeEvent(event, CAT_ID);
        if (result === null) continue;

        if (Array.isArray(result)) {
          for (const msg of result) yield msg;
        } else {
          if (fromResultError && result.type === 'error') {
            sawResultError = true;
          }
          yield result;
        }
      }

      yield { type: 'done', catId: CAT_ID, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
