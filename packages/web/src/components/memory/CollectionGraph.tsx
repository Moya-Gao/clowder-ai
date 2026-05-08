'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { forceLayout } from './graph-layout';

interface GraphNode {
  anchor: string;
  collectionId: string;
  sensitivity: string;
  kind: string;
  title: string;
  redacted: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  crossCollection: boolean;
  edgeSensitivity: string;
  provenance: string;
  redacted: boolean;
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  center?: string;
  depth: number;
}

const KIND_FILL: Record<string, string> = {
  feature: '#2563eb',
  spec: '#0891b2',
  decision: '#7c3aed',
  plan: '#4f46e5',
  session: '#d97706',
  lesson: '#059669',
  thread: '#db2777',
  discussion: '#ea580c',
  research: '#0d9488',
  lore: '#9333ea',
  unresolved: '#d1d5db',
};

const RELATION_COLOR: Record<string, string> = {
  related_to: '#6b7280',
  related: '#6b7280',
  evolved_from: '#8b5cf6',
  blocked_by: '#ef4444',
  supersedes: '#f97316',
  invalidates: '#dc2626',
  promoted_from: '#10b981',
  wikilink: '#3b82f6',
  doc_link: '#0891b2',
  feature_ref: '#d97706',
};

function compactAnchorLabel(anchor: string): string {
  const lastSegment = anchor.split(':').at(-1) ?? anchor;
  const withoutDocPrefix = lastSegment.replace(/^doc\//, '');
  return withoutDocPrefix.length > 12 ? `${withoutDocPrefix.slice(0, 10)}...` : withoutDocPrefix;
}

function renderNode(
  node: GraphNode,
  pos: { x: number; y: number },
  centerAnchor: string | undefined,
  onNodeClick: (anchor: string) => void,
  onHover: (n: GraphNode | null) => void,
) {
  const fill = KIND_FILL[node.kind] ?? '#6b7280';
  const isCenter = node.anchor === centerAnchor;
  const dimmed = node.sensitivity === 'private' || node.sensitivity === 'restricted' || node.redacted;
  const r = isCenter ? 24 : 18;
  const label = compactAnchorLabel(node.anchor);
  const textFill = node.kind === 'unresolved' ? '#374151' : 'white';
  const fontSize = label.length > 8 ? 9 : 11;
  return (
    <g
      key={node.anchor}
      data-testid={`graph-node-${node.anchor}`}
      opacity={dimmed ? 0.5 : 1}
      className="cursor-pointer"
      role="treeitem"
      tabIndex={0}
      onClick={() => onNodeClick(node.anchor)}
      ref={(el) => {
        if (!el) return;
        el.onmouseenter = () => onHover(node);
        el.onmouseleave = () => onHover(null);
        el.onfocus = () => onHover(node);
        el.onblur = () => onHover(null);
        el.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNodeClick(node.anchor);
          }
        };
      }}
    >
      <circle
        cx={pos.x}
        cy={pos.y}
        r={r}
        fill={fill}
        stroke="white"
        strokeWidth={isCenter ? 3 : 2}
        strokeDasharray={node.kind === 'unresolved' ? '4 2' : undefined}
        filter="url(#node-shadow)"
      />
      {node.redacted ? (
        <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={12} fill="white">
          🔒
        </text>
      ) : (
        <text x={pos.x} y={pos.y + 3} textAnchor="middle" fontSize={fontSize} fill={textFill} fontWeight="600">
          {label}
        </text>
      )}
    </g>
  );
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const off = Math.min(20, len * 0.12);
  const cx = (x1 + x2) / 2 + (-dy / len) * off;
  const cy = (y1 + y2) / 2 + (dx / len) * off;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

const W = 700;
const H = 500;

export function CollectionGraph() {
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [hiddenRelations, setHiddenRelations] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchGraph = useCallback((a: string) => {
    if (!a.trim()) return;
    setLoading(true);
    setError(null);
    setHovered(null);
    fetch(`/api/library/graph?anchor=${encodeURIComponent(a)}&depth=1`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => setGraph(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      fetchGraph(inputRef.current?.value ?? '');
    },
    [fetchGraph],
  );

  const handleNodeClick = useCallback(
    (anchor: string) => {
      if (inputRef.current) inputRef.current.value = anchor;
      fetchGraph(anchor);
    },
    [fetchGraph],
  );

  const toggleRelation = useCallback((rel: string) => {
    setHiddenRelations((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }, []);

  const visibleEdges = useMemo(
    () => (graph?.edges ?? []).filter((e) => !hiddenRelations.has(e.relation)),
    [graph?.edges, hiddenRelations],
  );
  const uniqueRelations = useMemo(() => [...new Set((graph?.edges ?? []).map((e) => e.relation))], [graph?.edges]);
  const uniqueKinds = useMemo(() => [...new Set((graph?.nodes ?? []).map((n) => n.kind))], [graph?.nodes]);

  const positions = graph ? forceLayout(graph.nodes, visibleEdges, graph.center, W, H) : new Map();

  return (
    <div data-testid="collection-graph">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          defaultValue=""
          placeholder="Enter anchor (e.g. F186)"
          className="flex-1 rounded border border-cafe bg-white px-3 py-1.5 text-sm text-cafe-primary"
          data-testid="graph-anchor-input"
        />
        <button
          type="submit"
          className="rounded bg-cafe-primary px-3 py-1.5 text-sm text-white"
          data-testid="graph-fetch-btn"
        >
          View Graph
        </button>
      </form>

      {loading && <div className="text-sm text-cafe-secondary">Loading graph...</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}
      {graph && graph.nodes.length === 0 && !loading && (
        <div className="text-sm text-cafe-secondary">No graph data for this anchor.</div>
      )}

      {graph && graph.nodes.length > 0 && (
        <div className="relative rounded-lg border border-cafe bg-white p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[520px] w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Knowledge graph"
            data-testid="graph-svg"
          >
            <defs>
              <filter id="node-shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
              </filter>
            </defs>

            {visibleEdges.map((edge) => {
              const fp = positions.get(edge.from);
              const tp = positions.get(edge.to);
              if (!fp || !tp) return null;
              const color = RELATION_COLOR[edge.relation] ?? '#9ca3af';
              return (
                <path
                  key={`${edge.from}-${edge.to}-${edge.relation}`}
                  d={edgePath(fp.x, fp.y, tp.x, tp.y)}
                  fill="none"
                  stroke={color}
                  strokeWidth={edge.crossCollection ? 2.5 : 1.5}
                  strokeDasharray={edge.redacted ? '6 3' : undefined}
                  opacity={0.5}
                />
              );
            })}

            {graph.nodes.map((node) => {
              const pos = positions.get(node.anchor);
              if (!pos) return null;
              return renderNode(node, pos, graph.center, handleNodeClick, setHovered);
            })}
          </svg>

          {hovered && (
            <div
              data-testid="graph-tooltip"
              className="absolute top-2 right-2 rounded-lg bg-cafe-surface p-3 text-xs shadow-lg border border-cafe pointer-events-none"
            >
              <div className="font-semibold text-cafe-primary">{hovered.title}</div>
              <div className="text-cafe-secondary">{hovered.kind}</div>
              <div className="text-cafe-secondary">{hovered.collectionId}</div>
              <div className="text-cafe-secondary">{hovered.sensitivity}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-2 px-2" data-testid="graph-legend">
            {uniqueKinds.map((k) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-cafe-secondary">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: KIND_FILL[k] ?? '#6b7280' }}
                />
                {k}
              </span>
            ))}
          </div>

          {uniqueRelations.length > 1 && (
            <div
              className="flex flex-wrap items-center gap-2 mt-1 px-2 text-[10px] text-cafe-secondary"
              data-testid="graph-edge-filter"
            >
              <span>Edges:</span>
              {uniqueRelations.map((rel) => (
                <label key={rel} className="flex items-center gap-0.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!hiddenRelations.has(rel)}
                    onChange={() => toggleRelation(rel)}
                    className="w-3 h-3 accent-cafe-primary"
                  />
                  <span style={{ color: RELATION_COLOR[rel] ?? '#9ca3af' }}>{rel.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-1 px-2 text-[10px] text-cafe-secondary">
            <span>Nodes: {graph.nodes.length}</span>
            <span>Edges: {graph.edges.length}</span>
            <span>Depth: {graph.depth}</span>
            {graph.center && <span>Center: {graph.center}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
