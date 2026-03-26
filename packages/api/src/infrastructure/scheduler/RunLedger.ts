import type Database from 'better-sqlite3';
import type { RunLedgerRow } from './types.js';

export class RunLedger {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  record(row: RunLedgerRow): void {
    this.db
      .prepare(
        `INSERT INTO task_run_ledger (task_id, subject_key, outcome, signal_summary, duration_ms, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.task_id, row.subject_key, row.outcome, row.signal_summary, row.duration_ms, row.started_at);
  }

  query(taskId: string, limit: number): RunLedgerRow[] {
    return this.db
      .prepare(
        `SELECT task_id, subject_key, outcome, signal_summary, duration_ms, started_at
         FROM task_run_ledger WHERE task_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(taskId, limit) as RunLedgerRow[];
  }
}
