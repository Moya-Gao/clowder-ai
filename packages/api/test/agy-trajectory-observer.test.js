// F210 Phase H1: AgyTrajectoryObserver — SQLite 增量 poll 做 progress side-channel
// 砚砚 AC：progress side-channel 不影响最终语义；SQLite 任何失败必须降级（fail-open）；
// 中性 step_type 文案（不硬标语义）。

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

const { AgyTrajectoryObserver, observeAgyProgress, resolveAgyTrajectoryDbPath } = await import(
  '../dist/domains/cats/services/agents/providers/agy-trajectory-observer.js'
);

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
