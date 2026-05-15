import type Database from 'better-sqlite3';
import { recordEdgeTraversals } from './edge-traversal.js';
import { type RawEvent, RecallEventCorrelator } from './RecallEventCorrelator.js';
import { RecallMetricsComputer } from './RecallMetricsComputer.js';

const MEMORY_TOOLS = new Set(['search_evidence', 'graph_resolve', 'list_recent']);

export async function triggerRecallCorrelation(
  db: Database.Database,
  events: Array<Partial<RawEvent> & Pick<RawEvent, 'invocationId' | 'catId' | 'toolName' | 'timestamp'>>,
  invocationId: string,
  catId: string,
): Promise<void> {
  const invEvents = events.filter((e) => e.invocationId === invocationId && e.catId === catId);
  if (!invEvents.some((e) => MEMORY_TOOLS.has(e.toolName))) return;

  const memoryEvents = invEvents.filter((e) => MEMORY_TOOLS.has(e.toolName));
  const hasPrivateHits = memoryEvents.some(
    (e) => (e.summary as Record<string, unknown> | undefined)?._f200HasPrivateHits === true,
  );
  if (hasPrivateHits) return;

  const fullEvents: RawEvent[] = invEvents.map((e, i) => ({
    sessionId: '',
    threadId: '',
    turnIndex: i,
    status: 'ok',
    summary: {},
    ...e,
  }));

  const correlator = new RecallEventCorrelator(db);
  const recallEvents = correlator.correlateWindow(fullEvents);
  if (recallEvents.length > 0) {
    correlator.persistBatch(recallEvents);
    new RecallMetricsComputer(db).refreshAnchorMetrics();
  }

  const consumedAnchors = new Set(recallEvents.flatMap((re) => re.consumed.map((c) => c.anchor)));
  if (consumedAnchors.size === 0) return;

  for (const e of invEvents) {
    const summary = e.summary as Record<string, unknown> | undefined;
    const edges = summary?._f200Edges as Array<{ from: string; to: string; relation: string }> | undefined;
    if (edges && edges.length > 0) {
      const consumedEdges = edges.filter((edge) => consumedAnchors.has(edge.to));
      if (consumedEdges.length > 0) recordEdgeTraversals(db, consumedEdges);
    }
  }
}
