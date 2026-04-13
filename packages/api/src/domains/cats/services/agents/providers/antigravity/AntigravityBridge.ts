/**
 * AntigravityBridge — ConnectRPC wrapper for Antigravity Language Server.
 *
 * Encapsulates all gRPC/HTTP communication, session mapping, and port discovery.
 * Designed to isolate ConnectRPC risk: if Antigravity changes wire format,
 * only this module breaks.
 *
 * Protocol: POST https://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/{Method}
 * Auth: x-codeium-csrf-token header
 */

import { execSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';

const log = createModuleLogger('antigravity-bridge');

/** Model name → Language Server model enum (from GetUserStatus.cascadeModelConfigData) */
const MODEL_ID_MAP: Record<string, string> = {
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
}

export interface CascadeTrajectory {
  status: string;
  numTotalSteps: number;
  trajectory?: { steps: TrajectoryStep[] };
}

export class AntigravityBridge {
  private conn: BridgeConnection | null = null;
  /** threadId → cascadeId */
  private sessionMap = new Map<string, string>();

  constructor(private readonly connection?: Partial<BridgeConnection>) {}

  async ensureConnected(): Promise<BridgeConnection> {
    if (this.conn) return this.conn;
    if (this.connection?.port && this.connection.csrfToken) {
      this.conn = {
        port: this.connection.port,
        csrfToken: this.connection.csrfToken,
        useTls: this.connection.useTls ?? true,
      };
      return this.conn;
    }
    this.conn = await this.discoverFromProcess();
    return this.conn;
  }

  async startCascade(): Promise<string> {
    const conn = await this.ensureConnected();
    const resp = await this.rpc<{ cascadeId?: string }>(conn, 'StartCascade', { source: 0 });
    if (!resp.cascadeId) throw new Error('StartCascade: no cascadeId returned');
    log.debug(`cascade created: ${resp.cascadeId}`);
    return resp.cascadeId;
  }

  /** Send message and return the step count before sending (for poll baseline). */
  async sendMessage(cascadeId: string, text: string, modelName?: string): Promise<number> {
    const conn = await this.ensureConnected();
    const traj = await this.getTrajectory(cascadeId);
    const stepsBefore = traj.numTotalSteps ?? 0;
    const modelId = modelName ? MODEL_ID_MAP[modelName] : undefined;
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

  /**
   * Poll until new steps appear after `stepsBefore` or timeout.
   * Returns only the NEW trajectory steps (after stepsBefore).
   */
  async pollForResponse(
    cascadeId: string,
    stepsBefore = 0,
    timeoutMs = 180_000,
    pollIntervalMs = 2_000,
  ): Promise<TrajectoryStep[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const traj = await this.getTrajectory(cascadeId);
      if (traj.status === 'CASCADE_RUN_STATUS_IDLE' && traj.numTotalSteps > stepsBefore) {
        const allSteps = traj.trajectory?.steps ?? (await this.getTrajectorySteps(cascadeId));
        return allSteps.slice(stepsBefore);
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Antigravity response timeout after ${timeoutMs}ms`);
  }

  /** Get or create a cascade session bound to a thread. */
  async getOrCreateSession(threadId: string): Promise<string> {
    const existing = this.sessionMap.get(threadId);
    if (existing) return existing;
    const cascadeId = await this.startCascade();
    this.sessionMap.set(threadId, cascadeId);
    return cascadeId;
  }

  resolveModelId(modelName: string): string | undefined {
    return MODEL_ID_MAP[modelName];
  }

  // ── Private ──────────────────────────────────────────────────────

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

  private async discoverFromProcess(): Promise<BridgeConnection> {
    // Allow env var override
    const envPort = process.env['ANTIGRAVITY_PORT'];
    const envCsrf = process.env['ANTIGRAVITY_CSRF_TOKEN'];
    if (envPort && envCsrf) {
      const useTls = process.env['ANTIGRAVITY_TLS'] !== 'false';
      log.info(`using env config: port=${envPort}, tls=${useTls}`);
      return { port: Number(envPort), csrfToken: envCsrf, useTls };
    }

    // Auto-discover from running Language Server process
    const psOutput = execSync('ps -eo pid,args 2>/dev/null | grep language_server | grep csrf_token | grep -v grep', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!psOutput) throw new Error('No Antigravity Language Server process found');

    const lines = psOutput.split('\n');
    for (const line of lines) {
      const csrfMatch = line.match(/--csrf_token\s+(\S+)/);
      const extPortMatch = line.match(/--extension_server_port\s+(\d+)/);
      const pidMatch = line.match(/^\s*(\d+)/);
      if (!csrfMatch || !pidMatch) continue;

      const csrf = csrfMatch[1];
      const pid = pidMatch[1];
      const extPort = extPortMatch ? Number(extPortMatch[1]) : 0;

      // Find ConnectRPC port via lsof (excluding extension_server_port)
      const lsofOutput = execSync(`lsof -a -iTCP -sTCP:LISTEN -P -n -p ${pid} 2>/dev/null | grep LISTEN`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();

      for (const lsofLine of lsofOutput.split('\n')) {
        const portMatch = lsofLine.match(/:(\d+)\s/);
        if (!portMatch) continue;
        const port = Number(portMatch[1]);
        if (port === extPort) continue;

        // Probe with GetUserStatus
        for (const useTls of [true, false]) {
          try {
            await this.rpc({ port, csrfToken: csrf, useTls }, 'GetUserStatus', {});
            log.info(`discovered LS: port=${port}, tls=${useTls}, pid=${pid}`);
            return { port, csrfToken: csrf, useTls };
          } catch {
            /* try next */
          }
        }
      }
    }
    throw new Error('Could not discover Antigravity Language Server ConnectRPC port');
  }
}
