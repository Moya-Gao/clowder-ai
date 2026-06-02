/**
 * F210 Phase H1: AgyTrajectoryObserver
 *
 * 旁路读 AGY cascade 的 SQLite trajectory store（`<appDataDir>/conversations/<uuid>.db` 的
 * `steps` 表），按 `idx` 游标增量 poll 出 progress events，做 side-channel 进度可见。
 *
 * 关键边界（owner 砚砚 AC，2026-06-01）：
 * - H1 只做 progress side-channel，**不替换最终 stdout 回复**（根治 resume 重放归 H2）。
 * - fail-open：SQLite 任何不可用（文件缺失 / 表或列缺失 / 锁 / 损坏）→ `enabled=false`，
 *   调用方必须降级回现有 stdout 行为，绝不影响最终答复语义。
 * - 中性文案：H1 不把 `step_type` 硬标成 tool call/思考；枚举坐实后（H3）再加语义标签。
 */

import { join } from 'node:path';
import Database from 'better-sqlite3';
import { extractAntigravityCliConversationId } from './antigravity-cli-event-parser.js';

export interface AgyProgressEvent {
  readonly idx: number;
  readonly stepType: number;
  readonly status: number;
  /** 中性进度文案（不解 step_type 语义）。 */
  readonly label: string;
}

export interface AgyPollResult {
  /** fail-open 信号：false = SQLite 不可用，调用方降级回现有 stdout 行为。 */
  readonly enabled: boolean;
  /** `idx > cursor` 的新 step（按 idx 升序）。 */
  readonly events: AgyProgressEvent[];
  /** 新游标（见过的最大 idx）；无新 step 时等于传入 cursor。 */
  readonly cursor: number;
}

const REQUIRED_COLUMNS = ['idx', 'step_type', 'status'] as const;
// F210-H1b (cloud P2): keep this small. better-sqlite3 is synchronous, so a long busy_timeout blocks
// the API event loop while AGY's writer holds the lock. Progress is optional side-channel telemetry —
// fail open fast and rely on the next poll's retry instead of stalling the event loop for seconds.
const BUSY_TIMEOUT_MS = 50;

/**
 * AGY step status 是明文 integer。实测 status=3 出现在已完成 step；H1 保守只区分
 * 完成/进行中，不依赖未坐实的完整 status 枚举。
 */
function statusWord(status: number): string {
  return status === 3 ? 'completed' : 'running';
}

function neutralLabel(idx: number, status: number): string {
  return `AGY trajectory step #${idx} ${statusWord(status)}`;
}

const APP_DATA_DIR_RE = /appDataDir=(\S+)/;

/**
 * 从 agy print-mode log 解析出 trajectory SQLite DB 路径：
 * `<appDataDir>/conversations/<cascade-uuid>.db`。appDataDir 或 cascade UUID 任一缺失
 * → null（调用方据此不启动 progress 观测，降级回现有 stdout 行为）。
 */
export function resolveAgyTrajectoryDbPath(logText: string): string | null {
  const appDataDir = logText.match(APP_DATA_DIR_RE)?.[1];
  const uuid = extractAntigravityCliConversationId(logText);
  if (!appDataDir || !uuid) return null;
  return join(appDataDir, 'conversations', `${uuid}.db`);
}

export class AgyTrajectoryObserver {
  private readonly dbPath: string;
  private db: Database.Database | null = null;
  /**
   * Permanent fail-open ONLY when the steps table exists but is schema-incompatible.
   * Transient unavailability (DB file/table not created yet, lock) is RETRYABLE — AGY can write
   * the conversation log before the SQLite store is created/flushed (startup race, 砚砚 P1-1).
   */
  private incompatible = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Open read-only connection + capability probe.
   * @returns 'ready' (open + schema ok) | 'retry' (transient: file/table not ready or locked —
   *          try again next poll) | 'incompatible' (table exists but schema mismatch — permanent).
   */
  private ensureOpen(): 'ready' | 'retry' | 'incompatible' {
    if (this.incompatible) return 'incompatible';
    if (this.db) return 'ready';
    let db: Database.Database;
    try {
      db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    } catch {
      return 'retry'; // file not created yet / cannot open → startup race, retry next poll
    }
    try {
      db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
      const cols = db.prepare('PRAGMA table_info(steps)').all() as Array<{ name: string }>;
      if (cols.length === 0) {
        db.close();
        return 'retry'; // steps table not created yet → startup race, retry
      }
      const colNames = new Set(cols.map((c) => c.name));
      if (!REQUIRED_COLUMNS.every((c) => colNames.has(c))) {
        db.close();
        this.incompatible = true;
        return 'incompatible'; // table exists but schema mismatch → permanent fail-open
      }
      this.db = db;
      return 'ready';
    } catch {
      db.close();
      return 'retry'; // lock / transient read error → retry
    }
  }

  /** 增量读取 `idx > cursor` 的新 step。SQLite 不可用降级（enabled=false），不抛。 */
  poll(cursor: number): AgyPollResult {
    if (this.ensureOpen() !== 'ready' || !this.db) {
      return { enabled: false, events: [], cursor };
    }
    try {
      const rows = this.db
        .prepare('SELECT idx, step_type, status FROM steps WHERE idx > ? ORDER BY idx')
        .all(cursor) as Array<{ idx: number; step_type: number; status: number }>;
      const events: AgyProgressEvent[] = rows.map((r) => ({
        idx: r.idx,
        stepType: r.step_type,
        status: r.status,
        label: neutralLabel(r.idx, r.status),
      }));
      const nextCursor = events.length > 0 ? events[events.length - 1]!.idx : cursor;
      return { enabled: true, events, cursor: nextCursor };
    } catch {
      // 运行中读失败（半行 / 锁超时）→ 关闭重置，下次重试（不永久放弃）。
      this.close();
      return { enabled: false, events: [], cursor };
    }
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        /* best-effort: 关闭失败不影响调用方。 */
      }
      this.db = null;
    }
  }
}

export interface ObserveAgyProgressDeps {
  /** 读 agy `--log-file` 的当前内容（解析 cascade UUID + appDataDir）。 */
  readLog: () => string;
  /** agy 进程是否已结束（结束后做一次 final poll 捞尾部 step）。 */
  isAgyDone: () => boolean;
  /** 注入 sleep（生产用真 timer；测试注入即时 resolve 以控制时序）。 */
  sleep: (ms: number) => Promise<void>;
  /** poll 间隔，默认 500ms。 */
  pollIntervalMs?: number;
  /** 取消信号（用户中断时停止观测）。 */
  signal?: AbortSignal;
}

/**
 * agy 跑期间增量观测 trajectory，yield progress events（H1 side-channel，不碰最终 stdout）。
 *
 * 每 pollIntervalMs 解析一次 DB 路径（agy 早期把 cascade UUID 写进 log），解析到就用
 * AgyTrajectoryObserver 按 idx 游标增量 poll 并 yield 新 step；agy 结束后做一次 final poll
 * 捞最后写入的 step。SQLite 不可用时 observer 自身 fail-open（不 yield、不抛），本 generator
 * 因此自然降级为零产出，绝不影响最终答复语义。
 */
export async function* observeAgyProgress(deps: ObserveAgyProgressDeps): AsyncGenerator<AgyProgressEvent> {
  const pollIntervalMs = deps.pollIntervalMs ?? 500;
  let observer: AgyTrajectoryObserver | null = null;
  let cursor = -1;

  const ensureObserver = (): AgyTrajectoryObserver | null => {
    if (!observer) {
      const dbPath = resolveAgyTrajectoryDbPath(deps.readLog());
      if (dbPath) observer = new AgyTrajectoryObserver(dbPath);
    }
    return observer;
  };

  while (!deps.isAgyDone() && !deps.signal?.aborted) {
    const obs = ensureObserver();
    if (obs) {
      const r = obs.poll(cursor);
      if (r.enabled) {
        cursor = r.cursor;
        yield* r.events;
      }
    }
    await deps.sleep(pollIntervalMs);
  }

  // final poll：agy 结束后捞最后写入但上一轮 poll 没覆盖的 step。
  const finalObs = ensureObserver();
  if (finalObs) {
    const r = finalObs.poll(cursor);
    if (r.enabled) yield* r.events;
    finalObs.close();
  }
}
