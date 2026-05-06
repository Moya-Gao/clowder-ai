'use client';

import React, { useCallback, useState } from 'react';

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

const SENSITIVITY_COLOR: Record<string, string> = {
  public: '#22c55e',
  internal: '#3b82f6',
  private: '#f59e0b',
  restricted: '#ef4444',
};

const RELATION_STYLE: Record<string, string> = {
  related_to: '#6b7280',
  evolved_from: '#8b5cf6',
  blocked_by: '#ef4444',
  supersedes: '#f97316',
  invalidates: '#dc2626',
  promoted_from: '#10b981',
};

function layoutNodes(nodes: GraphNode[], center?: string): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cx = 300;
  const cy = 200;
  const radius = 140;

  const centerIdx = nodes.findIndex((n) => n.anchor === center);
  if (centerIdx >= 0) {
    positions.set(nodes[centerIdx].anchor, { x: cx, y: cy });
    const others = nodes.filter((_, i) => i !== centerIdx);
    others.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1);
      positions.set(node.anchor, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  } else {
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
      positions.set(node.anchor, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  }
  return positions;
}

export function CollectionGraph() {
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [anchor, setAnchor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback((a: string) => {
    if (!a.trim()) return;
    setLoading(true);
    setError(null);
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
      fetchGraph(anchor);
    },
    [anchor, fetchGraph],
  );

  const handleNodeClick = useCallback(
    (nodeAnchor: string) => {
      setAnchor(nodeAnchor);
      fetchGraph(nodeAnchor);
    },
    [fetchGraph],
  );

  const positions = graph ? layoutNodes(graph.nodes, graph.center) : new Map();

  return (
    <div data-testid="collection-graph">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          placeholder="Enter anchor (e.g. project:cat-cafe:doc/f186)"
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
        <div className="rounded-lg border border-cafe bg-white p-2">
          <svg viewBox="0 0 600 400" className="w-full" data-testid="graph-svg">
            {graph.edges.map((edge) => {
              const fromPos = positions.get(edge.from);
              const toPos = positions.get(edge.to);
              if (!fromPos || !toPos) return null;
              const color = RELATION_STYLE[edge.relation] ?? '#9ca3af';
              const mx = (fromPos.x + toPos.x) / 2;
              const my = (fromPos.y + toPos.y) / 2;
              return (
                <g key={`${edge.from}-${edge.to}-${edge.relation}`}>
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={color}
                    strokeWidth={edge.crossCollection ? 2 : 1}
                    strokeDasharray={edge.redacted ? '4 2' : undefined}
                    opacity={0.6}
                  />
                  <text x={mx} y={my - 4} textAnchor="middle" fontSize={8} fill={color}>
                    {edge.relation}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const pos = positions.get(node.anchor);
              if (!pos) return null;
              const color = SENSITIVITY_COLOR[node.sensitivity] ?? '#6b7280';
              const isCenter = node.anchor === graph.center;
              return (
                <g
                  key={node.anchor}
                  data-testid={`graph-node-${node.anchor}`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node.anchor)}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isCenter ? 22 : 18}
                    fill="white"
                    stroke={color}
                    strokeWidth={isCenter ? 3 : 2}
                    strokeDasharray={node.redacted ? '4 2' : undefined}
                  />
                  {node.redacted && (
                    <text x={pos.x} y={pos.y + 1} textAnchor="middle" fontSize={12}>
                      🔒
                    </text>
                  )}
                  <text x={pos.x} y={pos.y + (node.redacted ? 14 : 4)} textAnchor="middle" fontSize={9} fill="#374151">
                    {node.title.length > 20 ? `${node.title.slice(0, 18)}…` : node.title}
                  </text>
                  <text x={pos.x} y={pos.y + 30} textAnchor="middle" fontSize={7} fill="#9ca3af">
                    {node.collectionId}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-3 mt-2 px-2 text-[10px] text-cafe-secondary">
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
