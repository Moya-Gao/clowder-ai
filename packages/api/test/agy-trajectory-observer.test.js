// F210 Phase H1: AgyTrajectoryObserver — SQLite 增量 poll 做 progress side-channel
// 砚砚 AC：progress side-channel 不影响最终语义；SQLite 任何失败必须降级（fail-open）；
// 中性 step_type 文案（不硬标语义）。

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

const {
  AgyTrajectoryObserver,
  observeAgyProgress,
  resolveAgyTrajectoryDbPath,
  locateAgyTrajectoryDb,
  listAgyConversationDbs,
  resolveAgyAppDataDir,
} = await import('../dist/domains/cats/services/agents/providers/agy-trajectory-observer.js');

const STEPS_SCHEMA = `CREATE TABLE steps (
  idx integer, step_type integer NOT NULL DEFAULT 0, status integer NOT NULL DEFAULT 0,
  has_subtrajectory numeric, metadata blob, error_details blob, permissions blob,
  task_details blob, render_info blob, step_payload blob, step_format integer,
  PRIMARY KEY(idx));`;

function makeTrajectoryDb(steps) {
  const dir = mkdtempSync(join(tmpdir(), 'agy-traj-'));
  const dbPath = join(dir, 'conv.db');
  const db = new Database(dbPath);
  db.exec(STEPS_SCHEMA);
  const ins = db.prepare('INSERT INTO steps (idx, step_type, status) VALUES (?, ?, ?)');
  for (const s of steps) ins.run(s.idx, s.step_type, s.status);
  db.close();
  return { dbPath, dir };
}

test('poll returns steps after cursor as progress events with neutral labels', () => {
  const { dbPath, dir } = makeTrajectoryDb([
    { idx: 0, step_type: 14, status: 3 },
    { idx: 1, step_type: 9, status: 3 },
    { idx: 2, step_type: 15, status: 1 },
  ]);
  const obs = new AgyTrajectoryObserver(dbPath);
  const r = obs.poll(-1);
  assert.equal(r.enabled, true);
  assert.equal(r.events.length, 3);
  assert.equal(r.cursor, 2);
  // 中性文案：H1 不把 step_type 硬标成 tool call/思考
  assert.match(r.events[2].label, /step #2/i);
  obs.close();
  rmSync(dir, { recursive: true, force: true });
});

test('poll is incremental: cursor advances, only new steps returned', () => {
  const { dbPath, dir } = makeTrajectoryDb([
    { idx: 0, step_type: 14, status: 3 },
    { idx: 1, step_type: 9, status: 3 },
  ]);
  const obs = new AgyTrajectoryObserver(dbPath);
  const r1 = obs.poll(-1);
  assert.equal(r1.cursor, 1);
  const r2 = obs.poll(r1.cursor);
  assert.equal(r2.events.length, 0, 'no new steps after cursor');
  assert.equal(r2.cursor, 1, 'cursor unchanged when no new steps');
  obs.close();
  rmSync(dir, { recursive: true, force: true });
});

test('fail-open: missing db file → enabled=false, no throw', () => {
  const obs = new AgyTrajectoryObserver('/nonexistent/path/conv.db');
  const r = obs.poll(-1);
  assert.equal(r.enabled, false);
  assert.equal(r.events.length, 0);
  obs.close();
});

test('fail-open: db without steps table → enabled=false, no throw', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-traj-'));
  const dbPath = join(dir, 'empty.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE other (x integer);');
  db.close();
  const obs = new AgyTrajectoryObserver(dbPath);
  const r = obs.poll(-1);
  assert.equal(r.enabled, false, 'missing steps table must degrade, not crash');
  obs.close();
  rmSync(dir, { recursive: true, force: true });
});

test('fail-open: steps table missing required columns → enabled=false', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-traj-'));
  const dbPath = join(dir, 'badcols.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE steps (foo integer, bar integer);'); // 缺 idx/step_type/status
  db.close();
  const obs = new AgyTrajectoryObserver(dbPath);
  const r = obs.poll(-1);
  assert.equal(r.enabled, false, 'missing idx/step_type/status columns must degrade');
  obs.close();
  rmSync(dir, { recursive: true, force: true });
});

test('resolveAgyTrajectoryDbPath builds db path from appDataDir + conversation uuid in log', () => {
  const log = [
    'I0601 20:14:32.019 server.go:211] Creating CLI server backend: product=antigravity workspaceDirs=[/tmp/x] appDataDir=/home/u/.gemini/antigravity-cli cascadeManager=true',
    'I0601 20:14:37.099 server.go:755] Created conversation 1cf6dc43-03e7-4196-8cf7-e52b27b7d175',
  ].join('\n');
  assert.equal(
    resolveAgyTrajectoryDbPath(log),
    '/home/u/.gemini/antigravity-cli/conversations/1cf6dc43-03e7-4196-8cf7-e52b27b7d175.db',
  );
});

test('resolveAgyTrajectoryDbPath returns null when appDataDir or uuid missing', () => {
  assert.equal(resolveAgyTrajectoryDbPath('nothing useful'), null);
  assert.equal(resolveAgyTrajectoryDbPath('appDataDir=/x but no conversation line'), null);
});

test('observeAgyProgress yields new steps incrementally until agy done', async () => {
  const appDataDir = mkdtempSync(join(tmpdir(), 'agy-obs-'));
  const uuid = '12345678-1234-1234-1234-1234567890ab';
  const convDir = join(appDataDir, 'conversations');
  mkdirSync(convDir);
  const dbPath = join(convDir, `${uuid}.db`);
  const db = new Database(dbPath);
  db.exec(STEPS_SCHEMA);
  const insert = (idx, ty, st) =>
    db.prepare('INSERT INTO steps (idx, step_type, status) VALUES (?, ?, ?)').run(idx, ty, st);
  insert(0, 14, 3);
  insert(1, 9, 3);

  const log = `appDataDir=${appDataDir}\nCreated conversation ${uuid}`;
  let polls = 0;
  const gen = observeAgyProgress({
    readLog: () => log,
    isAgyDone: () => polls >= 2,
    sleep: async () => {
      polls += 1;
      if (polls === 1) insert(2, 15, 1); // mid-run: a new step appears between polls
    },
    pollIntervalMs: 1,
  });
  const events = [];
  for await (const e of gen) events.push(e);
  assert.deepEqual(
    events.map((e) => e.idx),
    [0, 1, 2],
    'yields steps incrementally across polls',
  );
  db.close();
  rmSync(appDataDir, { recursive: true, force: true });
});

test('observeAgyProgress yields nothing and does not throw when db unresolvable (fail-open)', async () => {
  let polls = 0;
  const gen = observeAgyProgress({
    readLog: () => 'no uuid, no appDataDir here',
    isAgyDone: () => (polls += 1) >= 3,
    sleep: async () => {},
    pollIntervalMs: 1,
  });
  const events = [];
  for await (const e of gen) events.push(e);
  assert.equal(events.length, 0);
});

// P1-1 (砚砚 review): DB 创建 race — AGY writes the conversation log BEFORE the SQLite store
// exists/flushes. A startup miss must be retryable, not a permanent disable.
test('observeAgyProgress recovers when DB appears after the first poll (startup race)', async () => {
  const appDataDir = mkdtempSync(join(tmpdir(), 'agy-race-'));
  const uuid = '99999999-1234-1234-1234-1234567890ab';
  const convDir = join(appDataDir, 'conversations');
  mkdirSync(convDir);
  const dbPath = join(convDir, `${uuid}.db`);
  // DB does NOT exist yet when observation starts (log already carries the uuid).
  const log = `appDataDir=${appDataDir}\nCreated conversation ${uuid}`;
  let polls = 0;
  const gen = observeAgyProgress({
    readLog: () => log,
    isAgyDone: () => polls >= 3,
    sleep: async () => {
      polls += 1;
      if (polls === 1) {
        const db = new Database(dbPath);
        db.exec(STEPS_SCHEMA);
        db.prepare('INSERT INTO steps (idx, step_type, status) VALUES (?, ?, ?)').run(0, 14, 3);
        db.close();
      }
    },
    pollIntervalMs: 1,
  });
  const events = [];
  for await (const e of gen) events.push(e);
  assert.deepEqual(
    events.map((e) => e.idx),
    [0],
    'must recover after DB appears late — startup race must not permanently disable',
  );
  rmSync(appDataDir, { recursive: true, force: true });
});

// F210 Phase H2a (B spike confirmed): resume turn 的真相 —
// (1) agy resume 不写 --log-file → log 空，resolveAgyTrajectoryDbPath 拿不到 id/appDataDir → null;
// (2) resume 另起新 cascade db（≠ 原 conversation db）。
// AgyTrajectoryLocator：fresh log 有 id 走原 path；否则扫 conversations/*.db，只接受 invocationStart
// 后新建/更新的单一候选；0 或多候选 → fail-open（不猜，避免历史/并发污染，砚砚 spec）。
test('locateAgyTrajectoryDb: fresh log with conversation id → resolver path (不扫描)', () => {
  const log = [
    'appDataDir=/home/u/.gemini/antigravity-cli',
    'Created conversation aaaaaaaa-1111-2222-3333-444444444444',
  ].join('\n');
  const got = locateAgyTrajectoryDb({
    logText: log,
    appDataDir: '/home/u/.gemini/antigravity-cli',
    invocationStartMs: 1000,
    listConversationDbs: () => {
      throw new Error('must not scan when fresh log resolves');
    },
  });
  assert.equal(got, '/home/u/.gemini/antigravity-cli/conversations/aaaaaaaa-1111-2222-3333-444444444444.db');
});

test('locateAgyTrajectoryDb: resume (empty log) + single db after invocationStart → that db', () => {
  const got = locateAgyTrajectoryDb({
    logText: '',
    appDataDir: '/p',
    invocationStartMs: 1000,
    listConversationDbs: () => [
      { path: '/p/conversations/old.db', birthtimeMs: 500, mtimeMs: 600 }, // before start → 排除
      { path: '/p/conversations/new.db', birthtimeMs: 1500, mtimeMs: 1600 }, // after start → 候选
    ],
  });
  assert.equal(got, '/p/conversations/new.db');
});

test('locateAgyTrajectoryDb: resume + multiple post-start candidates → fail-open null (不猜)', () => {
  const got = locateAgyTrajectoryDb({
    logText: '',
    appDataDir: '/p',
    invocationStartMs: 1000,
    listConversationDbs: () => [
      { path: '/p/conversations/a.db', birthtimeMs: 1500, mtimeMs: 1600 },
      { path: '/p/conversations/b.db', birthtimeMs: 1700, mtimeMs: 1800 },
    ],
  });
  assert.equal(got, null, 'ambiguous multi-candidate must fail-open, not guess');
});

test('locateAgyTrajectoryDb: resume + zero post-start candidates → fail-open null', () => {
  const got = locateAgyTrajectoryDb({
    logText: '',
    appDataDir: '/p',
    invocationStartMs: 1000,
    listConversationDbs: () => [{ path: '/p/conversations/old.db', birthtimeMs: 500, mtimeMs: 600 }],
  });
  assert.equal(got, null, 'no post-start candidate must fail-open');
});

test('locateAgyTrajectoryDb: no appDataDir → fail-open null (不扫描)', () => {
  const got = locateAgyTrajectoryDb({
    logText: '',
    appDataDir: null,
    invocationStartMs: 1000,
    listConversationDbs: () => {
      throw new Error('must not scan without appDataDir');
    },
  });
  assert.equal(got, null);
});

// F210 H2a 接入：resume turn（空 log）下 observeAgyProgress 必须靠 locator 扫描定位新 cascade db，
// 而非现有 resolveAgyTrajectoryDbPath（log 空 → null → 零 progress，正是 B spike 确认的 H1 gap）。
test('observeAgyProgress (resume, empty log) locates post-start cascade db via scan deps', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-resume-scan-'));
  const newDb = join(dir, 'cascade-new.db');
  const db = new Database(newDb);
  db.exec(STEPS_SCHEMA);
  const insert = (idx, ty, st) =>
    db.prepare('INSERT INTO steps (idx, step_type, status) VALUES (?, ?, ?)').run(idx, ty, st);
  insert(0, 14, 3);
  insert(1, 15, 1);
  db.close();
  let polls = 0;
  const gen = observeAgyProgress({
    readLog: () => '', // resume: agy 不写 log
    appDataDir: dir,
    invocationStartMs: 1000,
    listConversationDbs: () => [{ path: newDb, birthtimeMs: 1500, mtimeMs: 1600 }],
    isAgyDone: () => (polls += 1) >= 2,
    sleep: async () => {},
    pollIntervalMs: 1,
  });
  const events = [];
  for await (const e of gen) events.push(e);
  assert.deepEqual(
    events.map((e) => e.idx),
    [0, 1],
    'resume turn must locate the post-start cascade db by scanning, not fail-open',
  );
  rmSync(dir, { recursive: true, force: true });
});

// fs 生产实现：扫 <appDataDir>/conversations/*.db → 候选（path + birthtime/mtime）。
test('listAgyConversationDbs returns .db candidates with timestamps', () => {
  const appDataDir = mkdtempSync(join(tmpdir(), 'agy-list-'));
  const convDir = join(appDataDir, 'conversations');
  mkdirSync(convDir);
  new Database(join(convDir, 'a.db')).close();
  new Database(join(convDir, 'b.db')).close();
  const got = listAgyConversationDbs(appDataDir);
  assert.equal(got.length, 2);
  assert.ok(
    got.every((c) => c.path.endsWith('.db') && typeof c.birthtimeMs === 'number' && typeof c.mtimeMs === 'number'),
    'each candidate has path + birthtimeMs + mtimeMs',
  );
  rmSync(appDataDir, { recursive: true, force: true });
});

test('listAgyConversationDbs returns [] when conversations dir missing (fail-open)', () => {
  const appDataDir = mkdtempSync(join(tmpdir(), 'agy-list-empty-'));
  assert.deepEqual(listAgyConversationDbs(appDataDir), []);
  rmSync(appDataDir, { recursive: true, force: true });
});

// 云端 codex P2: appDataDir 必须用 spawn agy 的 effective child HOME（childEnv.HOME），
// 不能用进程 homedir()。无 agyProfile 但 accountEnv 提供 HOME 时，child 用 accountEnv.HOME，
// 若 scan root 用 homedir() 会扫错目录 → resume turn 永久无 progress。
test('resolveAgyAppDataDir uses childEnv HOME (account HOME, not process homedir)', () => {
  const got = resolveAgyAppDataDir({ HOME: '/account/home' });
  assert.equal(got, join('/account/home', '.gemini', 'antigravity-cli'));
});

test('resolveAgyAppDataDir falls back to process homedir when childEnv absent/no HOME', () => {
  assert.equal(resolveAgyAppDataDir(undefined), join(homedir(), '.gemini', 'antigravity-cli'));
  assert.equal(resolveAgyAppDataDir({ FOO: 'bar' }), join(homedir(), '.gemini', 'antigravity-cli'));
});
