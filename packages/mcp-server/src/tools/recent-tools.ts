/**
 * List Recent Tool — F188 Phase F (AC-F2)
 *
 * MCP wrapper for /api/library/recent — metadata browse for "no query,
 * scan recent" use case (cold-start / "我记得最近讨论过 X").
 *
 * KD-8: same privacy contract as graph_resolve — callerCollections/collections
 * NOT in MCP schema. Visibility is server-derived from agent identity
 * (future); v1 only sees public/internal collections.
 */

import { z } from 'zod';
import type { ToolResult } from './file-tools.js';
import { errorResult, successResult } from './file-tools.js';

const API_URL = process.env['CAT_CAFE_API_URL'] ?? 'http://localhost:3002';

export const listRecentInputSchema = {
  scope: z
    .enum(['docs', 'threads', 'memory', 'all'])
    .optional()
    .describe(
      'Surface to scan, mapped via SCOPE_KIND_MAP to evidence_docs.kind filter (砚砚一审 P2 边界注意): docs = feature/decision/lesson/plan/research/spec/adr/phase docs; threads = indexed discussion docs (NOT raw thread messages — chat history is via get_thread_context); memory = indexed memory/session-digest/reflection docs (NOT raw memory store); all = no kind filter. v1 仅 query evidence_docs 一张表，没有跨 surface raw 索引；live thread messages 或 per-thread memory entries 不会出现在这里.',
    ),
  since: z.string().optional().describe('Time window: "7d" / "24h" / ISO 8601 date (default "7d")'),
  limit: z.number().int().min(1).max(100).optional().describe('Max items (default 20, max 100)'),
  kinds: z
    .array(z.string())
    .optional()
    .describe(
      'Filter by document kinds (feature / decision / lesson / plan / phase / discussion / research). Omit = all.',
    ),
};

interface RecentItem {
  anchor: string;
  title: string;
  kind: string;
  updatedAt: string;
  source: string;
}

interface RecentResponse {
  items: RecentItem[];
}

export async function handleListRecent(input: {
  scope?: string | undefined;
  since?: string | undefined;
  limit?: number | undefined;
  kinds?: readonly string[] | undefined;
}): Promise<ToolResult> {
  const params = new URLSearchParams();
  if (input.scope) params.set('scope', input.scope);
  if (input.since) params.set('since', input.since);
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.kinds && input.kinds.length > 0) params.set('kinds', input.kinds.join(','));

  const qs = params.toString();
  const url = `${API_URL}/api/library/recent${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return errorResult(`list_recent failed (${response.status}): ${text}`);
    }
    const data = (await response.json()) as RecentResponse;
    return successResult(formatRecent(data, input.since ?? '7d'));
  } catch (err) {
    return errorResult(`list_recent error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function formatRecent(data: RecentResponse, since: string): string {
  const lines: string[] = [];
  lines.push(`Recent items (last ${since}): ${data.items.length} found`);
  lines.push('');
  if (data.items.length === 0) {
    lines.push('(no items in this window)');
  } else {
    for (const item of data.items) {
      const date = item.updatedAt.slice(0, 10);
      lines.push(`  ${date} | ${item.anchor} — ${item.title} (${item.kind}) [source: ${item.source}]`);
    }
  }
  lines.push('');
  lines.push(crossReferenceFooter());
  return lines.join('\n');
}

function crossReferenceFooter(): string {
  return [
    '— Cat Café 7-tool memory family —',
    '  search_evidence: semantic / fuzzy find (lexical/semantic/hybrid)',
    '  graph_resolve: precise anchor / relations',
    '  list_recent: zero-prior / scan recent (this tool)',
    '  list_session_chain / read_session_digest / read_session_events / read_invocation_detail: drill into history',
  ].join('\n');
}

export const recentTools = [
  {
    name: 'cat_cafe_list_recent',
    description: [
      'Browse recent docs/threads by time window. NO query needed — designed for cold-start "我记得最近讨论过什么" / "压缩后扫一眼" scenarios.',
      'Use when: zero prior knowledge of what to search for; want to scan latest activity.',
      'Not for: precise anchor lookup → graph_resolve. Semantic search → search_evidence.',
      '',
      'v1 limitation (KD-8): does NOT accept collection scoping params. Sees public/internal collections only via server-side identity. Private collections excluded.',
    ].join('\n'),
    inputSchema: listRecentInputSchema,
    handler: handleListRecent,
  },
] as const;
