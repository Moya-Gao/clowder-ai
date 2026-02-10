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
 *   item.started (command_execution) → tool_use
 *   item.completed (agent_message) → text
 *   item.completed (command_execution) → tool_result
 *   item.completed (file_change) → tool_use
 *   turn.started / turn.completed / 其余 item 事件 → 跳过
 */

import { createCatId, CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import { spawnCli, isCliError, isCliTimeout } from '../../../utils/cli-spawn.js';
import { getCodexIsolatedHome } from '../../../utils/cli-config-isolation.js';
import { formatCliExitError } from '../../../utils/cli-format.js';
import type { SpawnFn } from '../../../utils/cli-types.js';
import { extractImagePaths } from './image-paths.js';
import { getCatModel } from '../../../config/cat-models.js';
import { getEventAuditLog, AuditEventTypes } from './EventAuditLog.js';
import type { AuditEventInput } from './EventAuditLog.js';
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
  /** Inject audit log sink (for testing) */
  auditLog?: AuditLogSink;
}

interface AuditLogSink {
  append(input: AuditEventInput): Promise<unknown>;
}

interface CommandExecutionLifecycle {
  phase: 'started' | 'completed';
  command: string;
  status?: string;
  exitCode?: number | null;
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

  // item.started with command_execution → tool_use
  if (e['type'] === 'item.started') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] === 'command_execution') {
      const command = item['command'];
      if (typeof command === 'string') {
        return {
          type: 'tool_use',
          catId,
          toolName: 'command_execution',
          toolInput: { command },
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  // item.completed with agent_message → text
  if (e['type'] === 'item.completed') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] === 'agent_message' && typeof item['text'] === 'string') {
      return {
        type: 'text',
        catId,
        content: item['text'],
        timestamp: Date.now(),
      };
    }

    // item.completed with command_execution → tool_result
    if (item?.['type'] === 'command_execution') {
      const command = typeof item['command'] === 'string' ? item['command'] : '';
      const status = typeof item['status'] === 'string' ? item['status'] : 'completed';
      const exitCode = typeof item['exit_code'] === 'number' ? item['exit_code'] : null;
      const output = typeof item['aggregated_output'] === 'string'
        ? item['aggregated_output']
        : '';

      const sections: string[] = [];
      if (command) sections.push(`command: ${command}`);
      sections.push(`status: ${status}`);
      if (exitCode !== null) sections.push(`exit_code: ${exitCode}`);
      const trimmedOutput = output.trimEnd();
      if (trimmedOutput) sections.push(trimmedOutput);

      return {
        type: 'tool_result',
        catId,
        content: sections.join('\n'),
        timestamp: Date.now(),
      };
    }

    // item.completed with file_change → tool_use (for visual trace in UI)
    if (item?.['type'] === 'file_change') {
      const changes = Array.isArray(item['changes']) ? item['changes'] : [];
      const status = typeof item['status'] === 'string' ? item['status'] : 'completed';
      return {
        type: 'tool_use',
        catId,
        toolName: 'file_change',
        toolInput: {
          status,
          changes: changes.length,
        },
        timestamp: Date.now(),
      };
    }

    return null;
  }

  // Everything else (turn.started, turn.completed, item.started, etc.) → skip
  return null;
}

function extractCommandExecutionLifecycle(event: unknown): CommandExecutionLifecycle | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  if (e['type'] === 'item.started') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] === 'command_execution' && typeof item['command'] === 'string') {
      return {
        phase: 'started',
        command: item['command'],
        ...(typeof item['status'] === 'string' ? { status: item['status'] } : {}),
      };
    }
  }

  if (e['type'] === 'item.completed') {
    const item = e['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] === 'command_execution' && typeof item['command'] === 'string') {
      return {
        phase: 'completed',
        command: item['command'],
        ...(typeof item['status'] === 'string' ? { status: item['status'] } : {}),
        ...(typeof item['exit_code'] === 'number' ? { exitCode: item['exit_code'] } : {}),
      };
    }
  }

  return null;
}

/**
 * Service for invoking Codex via CLI subprocess.
 * Uses ChatGPT Plus/Pro subscription instead of API key.
 */
export class CodexAgentService implements AgentService {
  readonly catId = CAT_ID;
  private readonly spawnFn: SpawnFn | undefined;
  private readonly auditLog: AuditLogSink;

  constructor(options?: CodexAgentServiceOptions) {
    this.spawnFn = options?.spawnFn;
    this.auditLog = options?.auditLog ?? getEventAuditLog();
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

    const metadata: MessageMetadata = { provider: CAT_CONFIGS.codex.provider, model: getCatModel('codex') };
    const auditContext = options?.auditContext;

    try {
      // Isolate from global ~/.codex/AGENTS.md to prevent config pollution
      const isolatedEnv: Record<string, string> = {
        HOME: getCodexIsolatedHome(),
        ...(options?.callbackEnv ?? {}),
      };

      const events = spawnCli(
        {
          command: 'codex',
          args,
          ...(options?.workingDirectory
            ? { cwd: options.workingDirectory }
            : {}),
          env: isolatedEnv,
          ...(options?.signal ? { signal: options.signal } : {}),
        },
        this.spawnFn ? { spawnFn: this.spawnFn } : undefined
      );

      for await (const event of events) {
        if (isCliTimeout(event)) {
          yield {
            type: 'error',
            catId: CAT_ID,
            error: `缅因猫 CLI 响应超时 (${Math.round(event.timeoutMs / 1000)}s)`,
            metadata,
            timestamp: Date.now(),
          };
          continue;
        }
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

        if (auditContext) {
          const lifecycle = extractCommandExecutionLifecycle(event);
          if (lifecycle) {
            const type = lifecycle.phase === 'started'
              ? AuditEventTypes.CLI_TOOL_STARTED
              : AuditEventTypes.CLI_TOOL_COMPLETED;

            this.auditLog.append({
              type,
              threadId: auditContext.threadId,
              data: {
                invocationId: auditContext.invocationId,
                userId: auditContext.userId,
                catId: auditContext.catId,
                tool: 'command_execution',
                command: lifecycle.command,
                ...(lifecycle.status ? { status: lifecycle.status } : {}),
                ...(lifecycle.exitCode !== undefined ? { exitCode: lifecycle.exitCode } : {}),
              },
            }).catch((err) => {
              console.warn('[audit] Codex CLI tool lifecycle write failed', {
                threadId: auditContext.threadId,
                invocationId: auditContext.invocationId,
                err,
              });
            });
          }
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
