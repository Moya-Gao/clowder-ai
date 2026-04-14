import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, join } from 'node:path';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import { discoverAntigravityLS } from './antigravity-ls-discovery.js';

const log = createModuleLogger('antigravity-bridge');

const HARDCODED_MODEL_MAP: Record<string, string> = {
  'gemini-3.1-pro': 'MODEL_PLACEHOLDER_M37',
  'gemini-3-flash': 'MODEL_PLACEHOLDER_M47',
  'claude-opus-4-6': 'MODEL_PLACEHOLDER_M26',
  'claude-sonnet-4-6': 'MODEL_PLACEHOLDER_M35',
};

export interface BridgeConnection {
  port: number;
  csrfToken: string;
  useTls: boolean;
}

export interface TrajectoryStep {
  type: string;
  status: string;
  plannerResponse?: {
    response?: string;
    modifiedResponse?: string;
    thinking?: string;
    stopReason?: string;
  };
  errorMessage?: {
    error?: { userErrorMessage?: string; modelErrorMessage?: string };
  };
  userInput?: { items?: Array<{ text?: string }> };
  toolCall?: { toolName?: string; input?: string };
  toolResult?: { toolName?: string; success?: boolean; output?: string; error?: string };
}

export interface CascadeTrajectory {
  status: string;
  numTotalSteps: number;
  awaitingUserInput?: boolean;
  trajectory?: { steps: TrajectoryStep[] };
}

export interface DeliveryCursor {
  baselineStepCount: number;
  lastDeliveredStepCount: number;
  terminalSeen: boolean;
  lastActivityAt: number;
  awaitingUserInput?: boolean;
}

export interface StepBatch {
  steps: TrajectoryStep[];
  cursor: DeliveryCursor;
}

export interface BridgeOptions {
  sessionStorePath?: string;
}

const DEFAULT_SESSION_STORE = join(process.cwd(), 'data', 'antigravity-sessions.json');

export class AntigravityBridge {
  private conn: BridgeConnection | null = null;
  private sessionMap = new Map<string, string>();
  private deletedKeys = new Set<string>();
  private sessionMapLoaded = false;
  private readonly sessionStorePath: string;
  private modelMap: Record<string, string> = { ...HARDCODED_MODEL_MAP };
  private modelMapRefreshed = false;

  constructor(
    private readonly connection?: Partial<BridgeConnection>,
    options?: BridgeOptions,
  ) {
    this.sessionStorePath = options?.sessionStorePath ?? DEFAULT_SESSION_STORE;
  }

  async ensureConnected(): Promise<BridgeConnection> {
    if (this.conn) return this.conn;
    if (this.connection?.port && this.connection.csrfToken) {
      this.conn = {
        port: this.connection.port,
        csrfToken: this.connection.csrfToken,
        useTls: this.connection.useTls ?? true,
      };
    } else {
      this.conn = await this.discoverFromProcess();
    }
    if (!this.modelMapRefreshed) {
      this.modelMapRefreshed = true;
      await this.refreshModelMap();
    }
    return this.conn;
  }
  async startCascade(): Promise<string> {
    const conn = await this.ensureConnected();
    const resp = await this.rpc<{ cascadeId?: string }>(conn, 'StartCascade', { source: 0 });
    if (!resp.cascadeId) throw new Error('StartCascade: no cascadeId returned');
    log.debug(`cascade created: ${resp.cascadeId}`);
    return resp.cascadeId;
  }
  async sendMessage(cascadeId: string, text: string, modelName?: string): Promise<number> {
    const conn = await this.ensureConnected();
    const traj = await this.getTrajectory(cascadeId);
    const stepsBefore = traj.numTotalSteps ?? 0;
    const modelId = modelName ? this.modelMap[modelName] : undefined;
    const payload: Record<string, unknown> = {
      cascadeId,
      items: [{ text }],
      cascadeConfig: {
        plannerConfig: {
          plannerTypeConfig: { conversational: {} },
          ...(modelId ? { requestedModel: { model: modelId } } : {}),
        },
      },
    };
    await this.rpc(conn, 'SendUserCascadeMessage', payload);
    return stepsBefore;
  }
  async getTrajectorySteps(cascadeId: string): Promise<TrajectoryStep[]> {
    const conn = await this.ensureConnected();
    const resp = await this.rpc<{ steps?: TrajectoryStep[] }>(conn, 'GetCascadeTrajectorySteps', { cascadeId });
    return resp.steps ?? [];
  }

  async getTrajectory(cascadeId: string): Promise<CascadeTrajectory> {
    const conn = await this.ensureConnected();
    return this.rpc<CascadeTrajectory>(conn, 'GetCascadeTrajectory', { cascadeId });
  }

  async *pollForSteps(
    cascadeId: string,
    stepsBefore = 0,
    idleTimeoutMs = 60_000,
    pollIntervalMs = 2_000,
    signal?: AbortSignal,
  ): AsyncGenerator<StepBatch> {
    let delivered = stepsBefore;
    let lastActivityAt = Date.now();
    let waitingApprovalSignaled = false;
    let rpcRetries = 0;
    const maxRpcRetries = 3;

    while (true) {
      if (signal?.aborted) throw new Error('Aborted');

      let traj: CascadeTrajectory;
      try {
        traj = await this.getTrajectory(cascadeId);
        rpcRetries = 0;
      } catch (err) {
        rpcRetries++;
        if (rpcRetries > maxRpcRetries) throw err;
        log.warn(`poll RPC error (retry ${rpcRetries}/${maxRpcRetries}): ${err}`);
        this.invalidateConnection();
        await new Promise((r) => setTimeout(r, pollIntervalMs * rpcRetries));
        continue;
      }
      const currentSteps = traj.numTotalSteps ?? 0;
      const isTerminal = traj.status === 'CASCADE_RUN_STATUS_IDLE';
      const awaitingUserInput = traj.awaitingUserInput === true;

      if (currentSteps > delivered) {
        waitingApprovalSignaled = false;
        lastActivityAt = Date.now();
        const allSteps = traj.trajectory?.steps ?? (await this.getTrajectorySteps(cascadeId));
        const newSteps = allSteps.slice(delivered, currentSteps);
        delivered = currentSteps;
        log.debug(`cascade delivery: ${newSteps.length} new steps (total=${currentSteps}, terminal=${isTerminal})`);
        yield {
          steps: newSteps,
          cursor: {
            baselineStepCount: stepsBefore,
            lastDeliveredStepCount: delivered,
            terminalSeen: isTerminal,
            lastActivityAt,
            awaitingUserInput,
          },
        };
        if (isTerminal) return;
      } else {
        const idleMs = Date.now() - lastActivityAt;
        if (awaitingUserInput) {
          if (!waitingApprovalSignaled) {
            waitingApprovalSignaled = true;
            log.info(`cascade ${cascadeId} awaiting user input; suppressing stall timeout`);
            yield {
              steps: [],
              cursor: {
                baselineStepCount: stepsBefore,
                lastDeliveredStepCount: delivered,
                terminalSeen: false,
                lastActivityAt,
                awaitingUserInput: true,
              },
            };
          }
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }
        waitingApprovalSignaled = false;
        if (isTerminal && (delivered > stepsBefore || idleMs > idleTimeoutMs)) {
          yield {
            steps: [],
            cursor: {
              baselineStepCount: stepsBefore,
              lastDeliveredStepCount: delivered,
              terminalSeen: true,
              lastActivityAt,
              awaitingUserInput: false,
            },
          };
          return;
        }
        if (idleMs > idleTimeoutMs) {
          throw new Error(
            `Antigravity stall: no activity for ${idleMs}ms (steps=${currentSteps}, status=${traj.status})`,
          );
        }
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  async getOrCreateSession(threadId: string, catId?: string): Promise<string> {
    this.loadSessionMap();

    const key = catId ? `${threadId}:${catId}` : threadId;
    const candidates = [this.sessionMap.get(key)];
    if (catId && !candidates[0]) candidates.push(this.sessionMap.get(threadId));

    for (const cascadeId of candidates) {
      if (!cascadeId) continue;
      try {
        const traj = await this.getTrajectory(cascadeId);
        if (traj.status !== 'CASCADE_RUN_STATUS_IDLE') {
          log.info(`cascade ${cascadeId} stuck in ${traj.status} for ${key}, creating new`);
          continue;
        }
        if (this.sessionMap.get(key) !== cascadeId) {
          this.sessionMap.set(key, cascadeId);
          this.sessionMap.delete(threadId);
          this.deletedKeys.add(threadId);
          this.persistSessionMap();
          log.info(`migrated legacy key ${threadId} → ${key}`);
        }
        log.debug(`reusing cascade ${cascadeId} for ${key}`);
        return cascadeId;
      } catch {
        log.info(`cascade ${cascadeId} dead for ${key}, creating new`);
      }
    }

    const newCascadeId = await this.startCascade();
    this.sessionMap.set(key, newCascadeId);
    this.deletedKeys.delete(key);
    this.persistSessionMap();
    return newCascadeId;
  }

  resolveModelId(modelName: string): string | undefined {
    return this.modelMap[modelName];
  }
  async refreshModelMap(): Promise<void> {
    try {
      const conn = await this.ensureConnected();
      const resp = await this.rpc<{ cascadeModelConfigData?: { modelId?: string; displayName?: string }[] }>(
        conn,
        'GetUserStatus',
        {},
      );
      const configs = resp.cascadeModelConfigData ?? [];
      for (const c of configs) {
        if (c.displayName && c.modelId) this.modelMap[c.displayName] = c.modelId;
      }
      if (configs.length) log.info(`model map refreshed: ${configs.length} entries from GetUserStatus`);
    } catch (err) {
      log.warn(`failed to refresh model map, using hardcoded fallback: ${err}`);
    }
  }
  invalidateConnection(): void {
    this.conn = null;
  }
  private loadSessionMap(): void {
    if (this.sessionMapLoaded) return;
    this.sessionMapLoaded = true;
    try {
      if (existsSync(this.sessionStorePath)) {
        const raw = JSON.parse(readFileSync(this.sessionStorePath, 'utf8')) as Record<string, string>;
        for (const [k, v] of Object.entries(raw)) {
          this.sessionMap.set(k, v);
        }
        log.info(`loaded ${this.sessionMap.size} session(s) from ${this.sessionStorePath}`);
      }
    } catch (err) {
      log.warn(`failed to load session store: ${err}`);
    }
  }

  private persistSessionMap(): void {
    try {
      const dir = dirname(this.sessionStorePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      let existing: Record<string, string> = {};
      try {
        if (existsSync(this.sessionStorePath)) {
          existing = JSON.parse(readFileSync(this.sessionStorePath, 'utf8')) as Record<string, string>;
        }
      } catch {
        /* corrupt — start fresh */
      }
      const merged = { ...existing, ...Object.fromEntries(this.sessionMap) };
      for (const key of this.deletedKeys) delete merged[key];
      writeFileSync(this.sessionStorePath, JSON.stringify(merged, null, 2));
    } catch (err) {
      log.warn(`failed to persist session store: ${err}`);
    }
  }

  private rpc<T = Record<string, unknown>>(conn: BridgeConnection, method: string, payload: unknown): Promise<T> {
    const mod = conn.useTls ? https : http;
    const protocol = conn.useTls ? 'https' : 'http';
    const url = `${protocol}://127.0.0.1:${conn.port}/exa.language_server_pb.LanguageServerService/${method}`;
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      const req = mod.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-codeium-csrf-token': conn.csrfToken,
          },
          rejectUnauthorized: false,
          timeout: 30_000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data) as T);
              } catch {
                resolve(data as unknown as T);
              }
            } else {
              reject(new Error(`LS ${method}: ${res.statusCode} — ${data.substring(0, 200)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`LS ${method}: timeout`));
      });
      req.write(body);
      req.end();
    });
  }

  private discoverFromProcess(): Promise<BridgeConnection> {
    return discoverAntigravityLS();
  }
}
