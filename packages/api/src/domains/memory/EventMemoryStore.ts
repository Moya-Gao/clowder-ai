/**
 * F227 PR-1 — EventMemoryStore (memory cell, SQLite-backed).
 *
 * Typed event index for cognitive-transition events. Single source of truth for
 * magic-word events (归一裁定 2026-06-06). Mirrors TaskOutcomeEpisodeStore's
 * SQLite pattern but lives in the memory domain (design gate OQ-4: a typed
 * sub-store / table, NOT a parallel memory architecture).
 *
 * `trigger` is a SQLite reserved word → stored as column `trigger_type`.
 * `relatedHarness` (string[] | null) is JSON-encoded; `cognitiveTransition`
 * (enum | null) is stored verbatim.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type {
  CognitiveTransition,
  EventConfidence,
  EventMemoryRecord,
  EventTrigger,
  StoredEventMemory,
} from '@cat-cafe/shared';
import { generateEventId, isEventMemoryRecord } from '@cat-cafe/shared';
import Database from 'better-sqlite3';

export interface EventMemoryFilter {
  trigger?: EventTrigger;
  cat?: string;
  type?: string;
  threadId?: string;
  confidence?: EventConfidence;
  cognitiveTransition?: CognitiveTransition;
  /** timestamp >= since (inclusive) */
  since?: number;
  /** timestamp <= until (inclusive) */
  until?: number;
  limit?: number;
  offset?: number;
}

export interface IEventMemoryStore {
  initialize(): Promise<void>;
  /** Write an event, mint its eventId, return the persisted record. */
  markEvent(record: EventMemoryRecord): StoredEventMemory;
  getEvent(eventId: string): StoredEventMemory | null;
  /** Newest-first, filtered + paged. */
  listEvents(filter?: EventMemoryFilter): StoredEventMemory[];
  /** Teleport reverse lookup: all events at a (threadId, messageId) coordinate. */
  getByCoord(threadId: string, messageId: string): StoredEventMemory[];
  /** P1-3 (砚砚): persist a failed write for replay so events are not lost (最终不丢). */
  appendDeadLetter(record: EventMemoryRecord, errorMessage: string): void;
  /** Read dead-lettered entries (replay / inspection). */
  listDeadLetter(): DeadLetterEntry[];
  health(): boolean;
}

export interface DeadLetterEntry {
  record: EventMemoryRecord;
  error: string;
  failedAt: number;
}

export class EventMemoryStore implements IEventMemoryStore {
  private readonly dbPath: string;
  /** P1-3: dead-letter sits BESIDE the db (separate resource) so a db-write
   * failure can still be recorded. :memory: stores keep it in memory. */
  private readonly deadLetterPath: string | null;
  private readonly inMemoryDeadLetter: string[] = [];
  private db: InstanceType<typeof Database> | undefined;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.deadLetterPath = dbPath === ':memory:' ? null : `${dbPath}.outbox.jsonl`;
  }

  async initialize(): Promise<void> {
    const db = new Database(this.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    this.migrate(db);
    this.db = db;
  }

  private migrate(db: InstanceType<typeof Database>): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS event_memory (
        eventId TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        cat TEXT NOT NULL,
        threadId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        summary TEXT NOT NULL,
        cognitiveTransition TEXT,
        relatedHarness TEXT,
        confidence TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_event_threadId ON event_memory(threadId);
      CREATE INDEX IF NOT EXISTS idx_event_coord ON event_memory(threadId, messageId);
      CREATE INDEX IF NOT EXISTS idx_event_trigger ON event_memory(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event_memory(timestamp);
      CREATE INDEX IF NOT EXISTS idx_event_confidence ON event_memory(confidence);
    `);
  }

  private ensureOpen(): InstanceType<typeof Database> {
    if (!this.db) throw new Error('EventMemoryStore not initialized — call initialize() first');
    return this.db;
  }

  markEvent(record: EventMemoryRecord): StoredEventMemory {
    // 砚砚 (non-blocking): validate untrusted payloads (backfill / tool writers)
    // with the shared guard before they hit SQLite.
    if (!isEventMemoryRecord(record)) {
      throw new Error('EventMemoryStore.markEvent: record failed isEventMemoryRecord guard');
    }
    const db = this.ensureOpen();
    const eventId = generateEventId();
    db.prepare(
      `INSERT INTO event_memory
        (eventId, type, trigger_type, cat, threadId, messageId, timestamp, summary, cognitiveTransition, relatedHarness, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      eventId,
      record.type,
      record.trigger,
      record.cat,
      record.threadId,
      record.messageId,
      record.timestamp,
      record.summary,
      record.cognitiveTransition,
      record.relatedHarness === null ? null : JSON.stringify(record.relatedHarness),
      record.confidence,
    );
    return { eventId, ...record };
  }

  getEvent(eventId: string): StoredEventMemory | null {
    const db = this.ensureOpen();
    const row = db.prepare('SELECT * FROM event_memory WHERE eventId = ?').get(eventId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToEvent(row) : null;
  }

  listEvents(filter: EventMemoryFilter = {}): StoredEventMemory[] {
    const db = this.ensureOpen();
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    const eq = (column: string, value: string | undefined): void => {
      if (value !== undefined) {
        clauses.push(`${column} = ?`);
        params.push(value);
      }
    };
    eq('trigger_type', filter.trigger);
    eq('cat', filter.cat);
    eq('type', filter.type);
    eq('threadId', filter.threadId);
    eq('confidence', filter.confidence);
    eq('cognitiveTransition', filter.cognitiveTransition);
    if (filter.since !== undefined) {
      clauses.push('timestamp >= ?');
      params.push(filter.since);
    }
    if (filter.until !== undefined) {
      clauses.push('timestamp <= ?');
      params.push(filter.until);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = filter.limit ?? -1; // SQLite: LIMIT -1 = unbounded
    const offset = filter.offset ?? 0;

    const rows = db
      .prepare(`SELECT * FROM event_memory ${where} ORDER BY timestamp DESC, rowid DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToEvent(r));
  }

  getByCoord(threadId: string, messageId: string): StoredEventMemory[] {
    const db = this.ensureOpen();
    const rows = db
      .prepare('SELECT * FROM event_memory WHERE threadId = ? AND messageId = ? ORDER BY timestamp DESC, rowid DESC')
      .all(threadId, messageId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToEvent(r));
  }

  health(): boolean {
    try {
      this.ensureOpen().prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  appendDeadLetter(record: EventMemoryRecord, errorMessage: string): void {
    const line = `${JSON.stringify({ record, error: errorMessage, failedAt: Date.now() })}\n`;
    if (this.deadLetterPath) {
      appendFileSync(this.deadLetterPath, line);
    } else {
      this.inMemoryDeadLetter.push(line);
    }
  }

  listDeadLetter(): DeadLetterEntry[] {
    let lines: string[];
    if (this.deadLetterPath) {
      lines = existsSync(this.deadLetterPath)
        ? readFileSync(this.deadLetterPath, 'utf8').split('\n').filter(Boolean)
        : [];
    } else {
      lines = this.inMemoryDeadLetter;
    }
    return lines.map((l) => JSON.parse(l) as DeadLetterEntry);
  }

  private rowToEvent(row: Record<string, unknown>): StoredEventMemory {
    return {
      eventId: row.eventId as string,
      type: row.type as string,
      trigger: row.trigger_type as EventTrigger,
      cat: row.cat as string,
      threadId: row.threadId as string,
      messageId: row.messageId as string,
      timestamp: row.timestamp as number,
      summary: row.summary as string,
      cognitiveTransition: (row.cognitiveTransition as CognitiveTransition | null) ?? null,
      relatedHarness: row.relatedHarness === null ? null : (JSON.parse(row.relatedHarness as string) as string[]),
      confidence: row.confidence as EventConfidence,
    };
  }
}
