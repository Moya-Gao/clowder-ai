/**
 * Gemini Agent Service
 * 使用 Gemini CLI 子进程调用暹罗猫 (Gemini)
 *
 * 双 Adapter 架构:
 *   gemini-cli (默认):  spawn 'gemini' CLI + NDJSON → 全自动 headless
 *   antigravity (opt-in): spawn Antigravity IDE → MCP 回传 → 半自动
 *
 * gemini CLI NDJSON 事件格式 (v0.27.2):
 *   init              → session_init (含 session_id)
 *   message/assistant  → text (content 字段)
 *   tool_use           → tool_use
 *   tool_result        → 跳过
 *   message/user       → 跳过 (echo)
 *   result/success     → 跳过
 *   result/error       → error
 */

import { randomUUID } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
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
} from './types.js';

const CAT_ID = createCatId('gemini');

type GeminiAdapter = 'gemini-cli' | 'antigravity';

/**
 * Options for constructing GeminiAgentService (dependency injection)
 */
interface GeminiAgentServiceOptions {
  /** Inject spawn for gemini-cli adapter (via spawnCli) */
  spawnFn?: SpawnFn;
  /** Inject spawn for antigravity adapter (direct child_process.spawn) */
  antigravitySpawnFn?: typeof nodeSpawn;
  /** Override adapter selection (default: GEMINI_ADAPTER env or 'gemini-cli') */
  adapter?: GeminiAdapter;
}

/**
 * Transform a raw Gemini CLI NDJSON event into an AgentMessage.
 * Returns null to skip events we don't care about.
 */
function transformGeminiEvent(
  event: unknown,
  catId: CatId
): AgentMessage | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  // init → session_init
  if (e['type'] === 'init') {
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

  // message with role:"assistant" → text
  if (e['type'] === 'message' && e['role'] === 'assistant') {
    const content = e['content'];
    if (typeof content === 'string') {
      return {
        type: 'text',
        catId,
        content,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  // tool_use → tool_use
  if (e['type'] === 'tool_use') {
    const toolName = e['tool_name'];
    if (typeof toolName === 'string') {
      return {
        type: 'tool_use',
        catId,
        toolName,
        toolInput: (e['parameters'] as Record<string, unknown>) ?? {},
        timestamp: Date.now(),
      };
    }
    return null;
  }

  // result with non-success status → error
  if (e['type'] === 'result' && e['status'] !== 'success') {
    return {
      type: 'error',
      catId,
      error: typeof e['error'] === 'string' ? e['error'] : 'Gemini CLI returned an error',
      timestamp: Date.now(),
    };
  }

  // Everything else (message/user, tool_result, result/success) → skip
  return null;
}

/**
 * Service for invoking Gemini via CLI subprocess (dual adapter).
 * Uses Google AI Pro/Ultra subscription instead of API key.
 */
export class GeminiAgentService implements AgentService {
  readonly catId = CAT_ID;
  private readonly spawnFn: SpawnFn | undefined;
  private readonly antigravitySpawnFn: typeof nodeSpawn;
  private readonly adapter: GeminiAdapter;
  constructor(options?: GeminiAgentServiceOptions) {
    this.spawnFn = options?.spawnFn;
    this.antigravitySpawnFn = options?.antigravitySpawnFn ?? nodeSpawn;
    this.adapter = options?.adapter
      ?? (process.env['GEMINI_ADAPTER'] as GeminiAdapter | undefined)
      ?? 'gemini-cli';
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    if (this.adapter === 'antigravity') {
      yield* this.invokeAntigravity(prompt, options);
    } else {
      yield* this.invokeGeminiCLI(prompt, options);
    }
  }

  private async *invokeGeminiCLI(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    // Note: gemini CLI --resume uses local index (not UUID), incompatible
    // with AgentRouter's sessionId mechanism. Resume not supported.
    const args: string[] = ['-p', prompt, '-o', 'stream-json', '-y'];

    // Pass image paths via -i flag (gemini CLI v0.27.2+)
    const imagePaths = extractImagePaths(options?.contentBlocks, options?.uploadDir);
    for (const imgPath of imagePaths) {
      args.push('-i', imgPath);
    }

    try {
      const events = spawnCli(
        {
          command: 'gemini',
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
            error: formatCliExitError('Gemini CLI', event),
            timestamp: Date.now(),
          };
          continue;
        }

        const result = transformGeminiEvent(event, CAT_ID);
        if (result !== null) {
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

  private async *invokeAntigravity(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    if (!options?.callbackEnv) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: 'antigravity adapter requires callbackEnv for MCP callback',
        timestamp: Date.now(),
      };
      return;
    }

    const sessionId = `antigravity-${randomUUID()}`;
    yield {
      type: 'session_init',
      catId: CAT_ID,
      sessionId,
      timestamp: Date.now(),
    };

    let spawnError: Error | null = null;

    try {
      const child = this.antigravitySpawnFn(
        'antigravity',
        ['chat', '--mode', 'agent', prompt],
        {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, ...options.callbackEnv },
        }
      );
      // Capture async spawn errors (ENOENT etc.) that fire on next tick.
      child.on('error', (err: Error) => {
        spawnError = err;
      });
      child.unref();
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: `Failed to launch Antigravity: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      return;
    }

    // Wait one tick — most spawn errors (ENOENT, EACCES) fire here.
    await new Promise((resolve) => process.nextTick(resolve));

    if (spawnError) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: `Failed to launch Antigravity: ${(spawnError as Error).message}`,
        timestamp: Date.now(),
      };
      return;
    }

    yield {
      type: 'text',
      catId: CAT_ID,
      content:
        '暹罗猫已在 Antigravity 中开始工作，结果将通过 MCP 回传到对话中。',
      timestamp: Date.now(),
    };

    yield { type: 'done', catId: CAT_ID, timestamp: Date.now() };
  }
}
