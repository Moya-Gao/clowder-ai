/**
 * ACP Client — NDJSON-over-stdio transport to an ACP agent process.
 *
 * Manages the lifecycle: spawn → initialize → sessions → prompts → close.
 * Handles both request/response correlation and streaming notifications.
 *
 * This client is used by:
 *   - Phase A experiment scripts (baseline, OQ-6)
 *   - Phase B GeminiAcpAdapter (production)
 */

import type { ChildProcess } from 'node:child_process';
import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';

import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type {
  AcpAgentRequest,
  AcpContentBlock,
  AcpInitializeResult,
  AcpMcpServer,
  AcpNewSessionResult,
  AcpNotification,
  AcpPermissionRequest,
  AcpPromptResult,
  AcpResponse,
  AcpSessionUpdate,
  AcpStopReason,
} from './types.js';
import { ACP_METHODS } from './types.js';

const log = createModuleLogger('acp-client');

const KILL_GRACE_MS = 3_000;

// ─── Config ──────────────────────────────────────────────���─────

/** Callback for handling ACP permission requests. Call `respond` with the chosen option. */
export type AcpPermissionHandler = (req: AcpAgentRequest, respond: (result: { optionId: string }) => void) => void;

export interface AcpClientConfig {
  /** CLI command (e.g. 'gemini') */
  command: string;
  /** Startup args (e.g. ['--acp']) */
  args: string[];
  /** Working directory for the ACP process */
  cwd: string;
  /** Extra env vars to pass to the process */
  env?: Record<string, string>;
  /** Inject spawn function for testing */
  spawnFn?: typeof nodeSpawn;
  /** Custom permission request handler. Defaults to auto-approve (allow_once). */
  permissionHandler?: AcpPermissionHandler;
}

// ─── Errors ──────────────��─────────────────────────────────────

export class AcpProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(`ACP error ${code}: ${message}`);
    this.name = 'AcpProtocolError';
  }
}

export class AcpTimeoutError extends Error {
  constructor(
    public readonly method: string,
    public readonly timeoutMs: number,
  ) {
    super(`ACP timeout: ${method} did not respond within ${timeoutMs}ms`);
    this.name = 'AcpTimeoutError';
  }
}

// ─── Client ─────────────────────���──────────────────────────���───

/** Parsed capacity error detected from ACP process stderr. */
export interface AcpCapacitySignal {
  message: string;
  timestamp: number;
}

const CAPACITY_RE = /MODEL_CAPACITY_EXHAUSTED|No capacity available|status 429.*Retrying/i;

export class AcpClient {
  private child: ChildProcess | null = null;
  private rl: ReadlineInterface | null = null;
  private readonly pending = new Map<string, { resolve: (v: AcpResponse) => void; reject: (e: Error) => void }>();
  private readonly notificationListeners: Array<(n: AcpNotification) => void> = [];
  private initResult: AcpInitializeResult | null = null;
  private closed = false;
  private exited = false;
  private readonly capacityListeners = new Set<(signal: AcpCapacitySignal) => void>();

  constructor(private readonly config: AcpClientConfig) {}

  // ── Lifecycle ────────────────────────────────────────────────

  async initialize(): Promise<AcpInitializeResult> {
    const doSpawn = this.config.spawnFn ?? nodeSpawn;
    this.child = doSpawn(this.config.command, this.config.args, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    }) as ChildProcess;

    this.child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trimEnd();
      log.warn({ pid: this.child?.pid }, '[acp stderr] %s', text);
      if (CAPACITY_RE.test(text)) {
        const signal: AcpCapacitySignal = { message: text.slice(0, 300), timestamp: Date.now() };
        for (const fn of this.capacityListeners) fn(signal);
      }
    });

    this.child.on('error', (err) => {
      log.error('ACP process error: %s', err.message);
      this.exited = true;
      this.rejectAllPending(err);
    });

    this.child.on('exit', (code, signal) => {
      log.info('ACP process exited: code=%s signal=%s', code, signal);
      this.exited = true;
      this.rejectAllPending(new Error(`ACP process exited: code=${code} signal=${signal}`));
    });

    this.startReading();

    const resp = await this.sendRequest(ACP_METHODS.initialize, { protocolVersion: 1 });
    this.initResult = resp.result as unknown as AcpInitializeResult;
    return this.initResult;
  }

  async newSession(cwd?: string, mcpServers: AcpMcpServer[] = []): Promise<AcpNewSessionResult> {
    const resp = await this.sendRequest(ACP_METHODS.sessionNew, {
      cwd: cwd ?? this.config.cwd,
      mcpServers,
    });
    return resp.result as unknown as AcpNewSessionResult;
  }

  async loadSession(sessionId: string, cwd?: string, mcpServers: AcpMcpServer[] = []): Promise<AcpNewSessionResult> {
    const resp = await this.sendRequest(ACP_METHODS.sessionLoad, {
      sessionId,
      cwd: cwd ?? this.config.cwd,
      mcpServers,
    });
    return resp.result as unknown as AcpNewSessionResult;
  }

  /**
   * Send a prompt, collect all streaming events, return { events, stopReason }.
   *
   * Phase B will add a streaming generator variant for real-time UI updates.
   */
  async promptCollect(
    sessionId: string,
    text: string,
    options?: { timeoutMs?: number },
  ): Promise<{ events: AcpSessionUpdate[]; stopReason: AcpStopReason }> {
    const events: AcpSessionUpdate[] = [];
    const timeoutMs = options?.timeoutMs ?? 120_000;
    let notifResolve: ((n: AcpNotification) => void) | null = null;

    const listener = (notif: AcpNotification) => {
      const params = notif.params as unknown as AcpSessionUpdate;
      if (params.sessionId !== sessionId) return;
      if (notifResolve) {
        const r = notifResolve;
        notifResolve = null;
        r(notif);
      }
      events.push(params);
    };
    this.notificationListeners.push(listener);

    try {
      const promptPromise = this.sendRequest(
        ACP_METHODS.sessionPrompt,
        { sessionId, prompt: [{ type: 'text', text }] },
        timeoutMs,
      );
      const resp = await promptPromise;
      const result = resp.result as unknown as AcpPromptResult;
      return { events, stopReason: result.stopReason };
    } finally {
      const idx = this.notificationListeners.indexOf(listener);
      if (idx >= 0) this.notificationListeners.splice(idx, 1);
    }
  }

  /**
   * Stream prompt events as they arrive. Yields AcpSessionUpdate per notification.
   * The generator completes when the prompt response arrives from the agent.
   */
  async *promptStream(
    sessionId: string,
    text: string,
    options?: { timeoutMs?: number },
  ): AsyncGenerator<AcpSessionUpdate, AcpStopReason> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const queue: AcpSessionUpdate[] = [];
    let waitResolve: (() => void) | null = null;
    let done = false;
    let stopReason: AcpStopReason = 'end_turn';
    let promptError: Error | null = null;

    const listener = (notif: AcpNotification) => {
      const params = notif.params as unknown as AcpSessionUpdate;
      if (params.sessionId !== sessionId) return;
      queue.push(params);
      if (waitResolve) {
        const r = waitResolve;
        waitResolve = null;
        r();
      }
    };
    this.notificationListeners.push(listener);

    // Fire prompt request — don't await, we'll drain the queue concurrently
    this.sendRequest(ACP_METHODS.sessionPrompt, { sessionId, prompt: [{ type: 'text', text }] }, timeoutMs)
      .then((resp) => {
        const result = resp.result as unknown as AcpPromptResult;
        stopReason = result.stopReason;
      })
      .catch((err: Error) => {
        promptError = err;
      })
      .finally(() => {
        done = true;
        if (waitResolve) {
          const r = waitResolve;
          waitResolve = null;
          r();
        }
      });

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (done) break;
        await new Promise<void>((r) => {
          waitResolve = r;
        });
      }
      // Drain any remaining events that arrived between done flag and the loop check
      while (queue.length > 0) {
        yield queue.shift()!;
      }
      if (promptError) throw promptError;
      return stopReason;
    } finally {
      const idx = this.notificationListeners.indexOf(listener);
      if (idx >= 0) this.notificationListeners.splice(idx, 1);
    }
  }

  /**
   * Send session/cancel notification (fire-and-forget, no response expected).
   * Does NOT close the shared AcpClient — safe for concurrent sessions.
   */
  cancelSession(sessionId: string): void {
    if (!this.child?.stdin?.writable) return;
    const msg = { jsonrpc: '2.0', method: ACP_METHODS.sessionCancel, params: { sessionId } };
    this.child.stdin.write(`${JSON.stringify(msg)}\n`);
    log.info('Sent session/cancel for %s', sessionId);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    this.rl?.close();
    if (this.child && !this.child.killed) {
      // Register exit listener BEFORE kill to avoid race with sync emitters
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.child && !this.child.killed) {
            this.child.kill('SIGKILL');
          }
          resolve();
        }, KILL_GRACE_MS);
        this.child!.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        this.child!.kill('SIGTERM');
      });
    }
    this.rejectAllPending(new Error('ACP client closed'));
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get isAlive(): boolean {
    return this.child !== null && !this.child.killed && !this.closed && !this.exited;
  }

  /** Register a capacity-signal listener scoped to a prompt's lifetime. */
  onCapacity(fn: (signal: AcpCapacitySignal) => void): void {
    this.capacityListeners.add(fn);
  }

  /** Unregister a capacity-signal listener. */
  offCapacity(fn: (signal: AcpCapacitySignal) => void): void {
    this.capacityListeners.delete(fn);
  }

  // ── Internal ─────────────────────────────────────────────────

  private startReading(): void {
    if (!this.child?.stdout) throw new Error('ACP process has no stdout');
    this.rl = createInterface({ input: this.child.stdout });

    this.rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        log.warn('ACP stdout non-JSON: %s', trimmed.slice(0, 120));
        return;
      }

      const id = msg.id as string | undefined;
      const method = msg.method as string | undefined;

      if (id && this.pending.has(id) && !method) {
        // Response to one of our requests
        const { resolve } = this.pending.get(id)!;
        this.pending.delete(id);
        resolve(msg as unknown as AcpResponse);
      } else if (method && !id) {
        // Notification from agent (session/update)
        for (const listener of this.notificationListeners) {
          listener(msg as unknown as AcpNotification);
        }
      } else if (method && id) {
        // Request from agent (permission, fs, terminal) — needs our response
        this.handleAgentRequest(msg as unknown as AcpAgentRequest);
      }
    });
  }

  private sendRequest(method: string, params: Record<string, unknown>, timeoutMs = 60_000): Promise<AcpResponse> {
    if (!this.child?.stdin?.writable) {
      return Promise.reject(new Error('ACP process stdin not writable'));
    }

    const id = randomUUID();
    const msg = { jsonrpc: '2.0', method, id, params };
    this.child.stdin.write(JSON.stringify(msg) + '\n');

    return new Promise<AcpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // For prompt timeouts, send session/cancel to stop the agent's internal retry loop
        if (method === ACP_METHODS.sessionPrompt && params.sessionId) {
          this.cancelSession(params.sessionId as string);
        }
        reject(new AcpTimeoutError(method, timeoutMs));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (resp) => {
          clearTimeout(timer);
          if (resp.error) {
            reject(new AcpProtocolError(resp.error.code, resp.error.message, resp.error.data));
          } else {
            resolve(resp);
          }
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  private handleAgentRequest(req: AcpAgentRequest): void {
    if (req.method === ACP_METHODS.requestPermission) {
      const respond = (result: { optionId: string }) => {
        const response = { jsonrpc: '2.0' as const, id: req.id, result };
        this.child?.stdin?.write(JSON.stringify(response) + '\n');
        log.debug('Permission response for %s: %s', req.id, result.optionId);
      };

      if (this.config.permissionHandler) {
        try {
          this.config.permissionHandler(req, respond);
        } catch (err) {
          log.error('permissionHandler threw: %s', (err as Error).message);
          const errResponse = {
            jsonrpc: '2.0' as const,
            id: req.id,
            error: { code: -32603, message: `Permission handler error: ${(err as Error).message}` },
          };
          this.child?.stdin?.write(JSON.stringify(errResponse) + '\n');
        }
      } else {
        // Default: auto-approve (allow_once)
        const params = req.params as unknown as AcpPermissionRequest;
        const allowOption = params.options?.find((o) => o.kind === 'allow_once') ?? params.options?.[0];
        respond({ optionId: allowOption?.optionId ?? 'allow_once' });
      }
    } else {
      // Unknown agent request — respond with method not found
      log.warn('Unhandled agent request: %s', req.method);
      const response = {
        jsonrpc: '2.0' as const,
        id: req.id,
        error: { code: -32601, message: `Client does not handle ${req.method}` },
      };
      this.child?.stdin?.write(JSON.stringify(response) + '\n');
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, { reject }] of this.pending) {
      reject(error);
      this.pending.delete(id);
    }
  }
}
