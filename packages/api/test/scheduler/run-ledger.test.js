import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Database from 'better-sqlite3';

describe('RunLedger', () => {
  let db;
  let ledger;

  beforeEach(async () => {
    db = new Database(':memory:');
    const { applyMigrations } = await import('../../dist/domains/memory/schema.js');
    const { RunLedger } = await import('../../dist/infrastructure/scheduler/RunLedger.js');
    applyMigrations(db);
    ledger = new RunLedger(db);
  });

  it('writes and reads a RUN_DELIVERED entry', () => {
    ledger.record({
      task_id: 'summary-compact',
      subject_key: 'thread-abc',
      outcome: 'RUN_DELIVERED',
      signal_summary: '20 pending messages',
      duration_ms: 1234,
      started_at: new Date().toISOString(),
    });
    const rows = ledger.query('summary-compact', 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'RUN_DELIVERED');
    assert.equal(rows[0].subject_key, 'thread-abc');
  });

  it('writes SKIP_NO_SIGNAL with null signal_summary', () => {
    ledger.record({
      task_id: 'cicd-check',
      subject_key: 'cicd-check',
      outcome: 'SKIP_NO_SIGNAL',
      signal_summary: null,
      duration_ms: 5,
      started_at: new Date().toISOString(),
    });
    const rows = ledger.query('cicd-check', 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].signal_summary, null);
  });

  it('query returns newest first, respects limit', () => {
    for (let i = 0; i < 5; i++) {
      ledger.record({
        task_id: 't1',
        subject_key: `key-${i}`,
        outcome: 'RUN_DELIVERED',
        signal_summary: null,
        duration_ms: i,
        started_at: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    const rows = ledger.query('t1', 3);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].duration_ms, 4);
  });
});
