// F200 Phase A: Correlates ToolEventLog entries into RecallEvents

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ConsumedEntry, RecallCandidate, RecallEvent, TargetRef } from './f200-types.js';
import { targetMatch } from './recall-target-match.js';

const MEMORY_TOOLS = new Set(['search_evidence', 'graph_resolve', 'list_recent']);

const CONSUMED_METHODS = new Set([
  'Read',
  'Grep',
  'graph_resolve',
  'read_session_events',
  'read_session_digest',
  'read_invocation_detail',
  'get_thread_context',
]);

const MAX_TOOL_DISTANCE = 20;
const MAX_WALL_CLOCK_MS = 300_000;
const GREP_PATTERNS = ['grep', 'rg ', 'ripgrep'];

export interface RawEvent {
  invocationId: string;
  sessionId: string;
  threadId: string;
  catId: string;
  toolName: string;
  timestamp: number;
  turnIndex: number;
  status: string;
  summary: Record<string, unknown>;
}

export class RecallEventCorrelator {
  private readonly insertStmt: ReturnType<Database.Database['prepare']>;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO recall_events
        (recall_id, cat_id, invocation_id, tool_name, query, mode, scope,
         candidates_json, consumed_json, reformulated, fell_back_to_grep,
         abandoned, next_graph_resolve_after_read, token_cost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  correlateWindow(events: RawEvent[]): RecallEvent[] {
    const results: RecallEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      if (!MEMORY_TOOLS.has(event.toolName)) continue;

      const candidates = this.extractCandidates(event);
      const sameCatWindow = this.buildWindow(events, i, event);
      const consumed = this.findConsumed(candidates, sameCatWindow);
      const reformulated = this.isReformulated(events, i, event);
      const fellBackToGrep = this.hasFellBackToGrep(sameCatWindow);
      const abandoned = consumed.length === 0 && !reformulated;
      const nextGraphResolveAfterRead = this.hasGraphAfterRead(sameCatWindow);

      results.push({
        recallId: randomUUID(),
        catId: event.catId,
        invocationId: event.invocationId,
        toolName: event.toolName as RecallEvent['toolName'],
        query: this.extractQuery(event),
        mode: asString(event.summary.mode),
        scope: asString(event.summary.scope),
        candidates,
        consumed,
        reformulated,
        fellBackToGrep,
        abandoned,
        nextGraphResolveAfterRead,
        tokenCost: 0,
        timestamp: event.timestamp,
      });
    }
    return results;
  }

  persistBatch(batch: RecallEvent[]): void {
    const tx = this.db.transaction((items: RecallEvent[]) => {
      for (const e of items) {
        const params = [
          e.recallId,
          e.catId,
          e.invocationId,
          e.toolName,
          e.query,
          e.mode ?? null,
          e.scope ?? null,
          JSON.stringify(e.candidates),
          JSON.stringify(e.consumed),
          e.reformulated ? 1 : 0,
          e.fellBackToGrep ? 1 : 0,
          e.abandoned ? 1 : 0,
          e.nextGraphResolveAfterRead ? 1 : 0,
          e.tokenCost,
          e.timestamp,
        ];
        this.insertStmt.run(params);
      }
    });
    tx(batch);
  }

  private extractCandidates(event: RawEvent): RecallCandidate[] {
    const raw = event.summary._f200Candidates as
      | Array<{ anchor: string; rank: number; sourcePath?: string; docKind?: string }>
      | undefined;
    if (!raw || !Array.isArray(raw)) return [];

    return raw.map((c) => ({
      anchor: c.anchor,
      rank: c.rank,
      targetRef: this.inferTargetRef(c),
      docKind: c.docKind,
    }));
  }

  private inferTargetRef(c: {
    anchor: string;
    sourcePath?: string;
    threadId?: string;
    sessionId?: string;
    invocationId?: string;
    passageId?: string;
  }): TargetRef {
    if (c.passageId) {
      return { kind: 'passage', passageId: c.passageId, threadId: c.threadId, sessionId: c.sessionId };
    }
    if (c.invocationId && c.sessionId) {
      return { kind: 'invocation', sessionId: c.sessionId, invocationId: c.invocationId };
    }
    if (c.sessionId) return { kind: 'session', sessionId: c.sessionId };
    if (c.threadId) return { kind: 'thread', threadId: c.threadId };
    return { kind: 'doc', sourcePath: c.sourcePath ?? '', anchor: c.anchor };
  }

  private buildWindow(events: RawEvent[], startIdx: number, source: RawEvent): Array<RawEvent & { distance: number }> {
    const window: Array<RawEvent & { distance: number }> = [];
    let sameCatCount = 0;
    for (let j = startIdx + 1; j < events.length; j++) {
      const e = events[j]!;
      if (e.catId !== source.catId) continue;
      if (e.invocationId !== source.invocationId) break;
      sameCatCount++;
      const withinDistance = sameCatCount <= MAX_TOOL_DISTANCE;
      const withinWallClock = e.timestamp - source.timestamp <= MAX_WALL_CLOCK_MS;
      if (!withinDistance && !withinWallClock) break;
      window.push({ ...e, distance: sameCatCount });
    }
    return window;
  }

  private findConsumed(candidates: RecallCandidate[], window: Array<RawEvent & { distance: number }>): ConsumedEntry[] {
    const consumed: ConsumedEntry[] = [];
    const matched = new Set<string>();

    for (const wEvent of window) {
      if (!CONSUMED_METHODS.has(wEvent.toolName)) continue;

      const toolInput = wEvent.summary as Record<string, unknown>;
      for (const cand of candidates) {
        if (matched.has(cand.anchor)) continue;
        if (!targetMatch(wEvent.toolName, toolInput, cand.targetRef)) continue;

        const dwellProxy = this.computeDwell(wEvent, window);
        consumed.push({
          anchor: cand.anchor,
          rank: cand.rank,
          method: wEvent.toolName as ConsumedEntry['method'],
          dwellProxy,
        });
        matched.add(cand.anchor);
        break;
      }
    }
    return consumed;
  }

  private computeDwell(readEvent: RawEvent, window: Array<RawEvent & { distance: number }>): number | undefined {
    for (const e of window) {
      if (e.timestamp > readEvent.timestamp && e.catId === readEvent.catId) {
        return e.timestamp - readEvent.timestamp;
      }
    }
    return undefined;
  }

  private isReformulated(events: RawEvent[], idx: number, source: RawEvent): boolean {
    for (let j = idx + 1; j < events.length; j++) {
      const e = events[j]!;
      if (e.catId !== source.catId) continue;
      if (e.invocationId !== source.invocationId) break;
      if (MEMORY_TOOLS.has(e.toolName)) return true;
      break;
    }
    return false;
  }

  private hasFellBackToGrep(window: Array<RawEvent & { distance: number }>): boolean {
    for (const e of window) {
      if (e.toolName !== 'Bash') continue;
      const cmd = typeof e.summary.command === 'string' ? e.summary.command.toLowerCase() : '';
      if (GREP_PATTERNS.some((p) => cmd.includes(p))) return true;
    }
    return false;
  }

  private hasGraphAfterRead(window: Array<RawEvent & { distance: number }>): boolean {
    let sawRead = false;
    for (const e of window) {
      if (e.toolName === 'Read') sawRead = true;
      if (sawRead && e.toolName === 'graph_resolve') return true;
    }
    return false;
  }

  private extractQuery(event: RawEvent): string {
    return asString(event.summary.query) ?? '';
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
