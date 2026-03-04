/**
 * DARE Agent Service
 * 通过 DARE CLI 子进程调用外部 DARE agent（headless 模式）
 *
 * CLI 调用方式:
 *   python -m client --adapter openrouter --model MODEL \
 *     run --task "prompt" --auto-approve --headless
 *   (API key passed via child process env, not CLI args)
 *
 * NDJSON 事件格式 (headless envelope v1):
 *   session.started  → session_init
 *   tool.invoke      → tool_use
 *   tool.result      → tool_result
 *   task.completed   → text (rendered_output)
 *   task.failed      → error
 */

import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../config/cat-models.js';
import { formatCliExitError } from '../../../../../utils/cli-format.js';
import { isCliError, isCliTimeout, spawnCli } from '../../../../../utils/cli-spawn.js';
import type { SpawnFn } from '../../../../../utils/cli-types.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../types.js';
import { transformDareEvent } from './dare-event-transform.js';

interface DareAgentServiceOptions {
  catId?: CatId;
  /** DARE adapter: 'openrouter' | 'openai' (default: 'openrouter') */
  adapter?: string;
  /** Model name (e.g. 'zhipu/glm-4.7') */
  model?: string;
  /** Path to DARE repo (used as cwd fallback) */
  darePath?: string;
  /** Inject a custom spawn function (for testing) */
  spawnFn?: SpawnFn;
}

export class DareAgentService implements AgentService {
  readonly catId: CatId;
  private readonly adapter: string;
  private readonly model: string;
  private readonly darePath: string | undefined;
  private readonly spawnFn: SpawnFn | undefined;

  constructor(options?: DareAgentServiceOptions) {
    this.catId = options?.catId ?? createCatId('dare');
    this.adapter = options?.adapter ?? process.env['DARE_ADAPTER'] ?? 'openrouter';
    // P1-2: Use unified model resolution chain (env CAT_*_MODEL > cat-config > fallback)
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.darePath = options?.darePath ?? process.env['DARE_PATH'];
    this.spawnFn = options?.spawnFn;
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const args = this.buildArgs(prompt, options?.workingDirectory);
    // P1-1: cwd must ALWAYS be darePath (where `python -m client` can find the module).
    // Thread's workingDirectory goes to --workspace instead.
    const cwd = this.darePath;
    // P1-3: Pass API key via child env, not CLI args (avoids ps/audit leakage)
    const childEnv = this.buildEnv(options?.callbackEnv);
    const metadata: MessageMetadata = { provider: 'dare', model: this.model };

    try {
      const events = spawnCli(
        {
          command: 'python',
          args,
          ...(cwd ? { cwd } : {}),
          env: childEnv,
          ...(options?.signal ? { signal: options.signal } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined,
      );

      for await (const event of events) {
        if (isCliTimeout(event)) {
          yield {
            type: 'error',
            catId: this.catId,
            error: `DARE CLI 响应超时 (${Math.round(event.timeoutMs / 1000)}s)`,
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }
        if (isCliError(event)) {
          yield {
            type: 'error',
            catId: this.catId,
            error: formatCliExitError('DARE CLI', event),
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }

        const result = transformDareEvent(event, this.catId);
        if (result !== null) {
          if (result.type === 'session_init' && result.sessionId) {
            metadata.sessionId = result.sessionId;
          }
          yield { ...result, metadata };
        }
      }

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error',
        catId: this.catId,
        error: err instanceof Error ? err.message : String(err),
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    }
  }

  private buildArgs(prompt: string, workspace?: string): string[] {
    const args = ['-m', 'client'];

    args.push('--adapter', this.adapter);
    args.push('--model', this.model);

    // P1-1: Pass thread's project directory as DARE workspace
    if (workspace) {
      args.push('--workspace', workspace);
    }

    // P1-3: API key is passed via child env (buildEnv), NOT CLI args

    args.push('run', '--task', prompt, '--auto-approve', '--headless');

    return args;
  }

  private buildEnv(callbackEnv?: Record<string, string>): Record<string, string> {
    const env: Record<string, string> = { ...callbackEnv };
    // P1-3: Pass API key via env vars (not CLI args) to avoid ps/audit leakage
    const apiKeyEnvName = this.adapter === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
    const apiKey = process.env[apiKeyEnvName];
    if (apiKey) {
      env[apiKeyEnvName] = apiKey;
    }
    return env;
  }
}
