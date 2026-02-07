/**
 * Codex Agent Service
 * 使用 Codex CLI 子进程调用缅因猫 (Codex)
 *
 * CLI 调用方式:
 *   codex exec --json --sandbox workspace-write --full-auto "prompt"
 *   codex exec resume SESSION_ID "prompt" --json --sandbox workspace-write --full-auto
 *
 * NDJSON 事件格式:
 *   thread.started  → session_init (含 thread_id)
 *   item.completed (agent_message) → text
 *   turn.started / turn.completed / item.started / command_execution / file_change → 跳过
 */

import { createCatId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import { spawnCli, isCliError } from '../../../utils/cli-spawn.js';
import { formatCliExitError } from '../../../utils/cli-format.js';
import type { SpawnFn } from '../../../utils/cli-types.js';
import { extractImagePaths } from './image-paths.js';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
  MessageMetadata,
} from './types.js';

const CAT_ID = createCatId('codex');

/** CLI flag for OS-level sandbox (statically scannable) */
const SANDBOX_MODE = 'workspace-write';

/**
 * Options for constructing CodexAgentService (dependency injection)
 */
interface CodexAgentServiceOptions {
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
}

/**
 * Transform a raw Codex CLI NDJSON event into an AgentMessage.
 * Returns null to skip events we don't care about.
 */
function transformCodexEvent(
  event: unknown,
  catId: CatId
): AgentMessage | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  // thread.started → session_init
  if (e['type'] === 'thread.started') {
    const threadId = e['thread_id'];
    if (typeof threadId === 'string') {
      return {
        type: 'session_init',
        catId,
        sessionId: threadId,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  // item.completed with agent_message → text
  if (e['type'] === 'item.completed') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (
      item &&
      item['type'] === 'agent_message' &&
      typeof item['text'] === 'string'
    ) {
      return {
        type: 'text',
        catId,
        content: item['text'],
        timestamp: Date.now(),
      };
    }
    // Non-agent_message items (command_execution, file_change) → skip
    return null;
  }

  // Everything else (turn.started, turn.completed, item.started, etc.) → skip
  return null;
}

/**
 * Service for invoking Codex via CLI subprocess.
 * Uses ChatGPT Plus/Pro subscription instead of API key.
 */
export class CodexAgentService implements AgentService {
  readonly catId = CAT_ID;
  private readonly spawnFn: SpawnFn | undefined;

  constructor(options?: CodexAgentServiceOptions) {
    this.spawnFn = options?.spawnFn;
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    // Codex CLI has no image flag; embed paths in prompt text (best effort)
    let effectivePrompt = prompt;
    const imagePaths = extractImagePaths(options?.contentBlocks, options?.uploadDir);
    if (imagePaths.length > 0) {
      const refs = imagePaths.map((p) => `[Image attached: ${p}]`).join('\n');
      effectivePrompt = `${prompt}\n\n${refs}`;
    }

    // resume 子命令不接受 --sandbox（sandbox 在创建时已锁定）
    const args: string[] = options?.sessionId
      ? ['exec', 'resume', options.sessionId, effectivePrompt, '--json', '--full-auto']
      : ['exec', '--json', '--sandbox', SANDBOX_MODE, '--full-auto', effectivePrompt];

    const metadata: MessageMetadata = { provider: 'openai', model: 'codex' };

    try {
      const events = spawnCli(
        {
          command: 'codex',
          args,
          ...(options?.workingDirectory
            ? { cwd: options.workingDirectory }
            : {}),
          ...(options?.callbackEnv ? { env: options.callbackEnv } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined
      );

      for await (const event of events) {
        if (isCliError(event)) {
          yield {
            type: 'error',
            catId: CAT_ID,
            error: formatCliExitError('Codex CLI', event),
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }

        const result = transformCodexEvent(event, CAT_ID);
        if (result !== null) {
          if (result.type === 'session_init' && result.sessionId) {
            metadata.sessionId = result.sessionId;
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
