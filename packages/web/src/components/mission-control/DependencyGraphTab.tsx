'use client';

import type { BacklogItem, BacklogStatus } from '@cat-cafe/shared';
import dagre from '@dagrejs/dagre';
import {
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractFeatureId } from './FeatureBirdEyePanel';

interface DependencyGraphTabProps {
  items: BacklogItem[];
}

interface FeatureNodeData {
  featureId: string;
  name: string;
  status: BacklogStatus;
  evolvedFrom: string[];
  blockedBy: string[];
  related: string[];
  [key: string]: unknown;
}

const STATUS_COLORS: Record<BacklogStatus, { border: string; bg: string; dot: string }> = {
  open: { border: '#C4B5A0', bg: '#FFFDF8', dot: '#C4B5A0' },
  suggested: { border: '#E4A853', bg: '#FFFBF0', dot: '#E4A853' },
  approved: { border: '#E4A853', bg: '#FFFBF0', dot: '#E4A853' },
  dispatched: { border: '#5B9BD5', bg: '#F5F9FF', dot: '#5B9BD5' },
  done: { border: '#7CB87C', bg: '#F5FFF5', dot: '#7CB87C' },
};

const EDGE_STYLES = {
  evolved: { stroke: '#5B9BD5', strokeDasharray: undefined, label: '演化' },
  blocked: { stroke: '#E05252', strokeDasharray: '6 3', label: '阻塞' },
  related: { stroke: '#9A866F', strokeDasharray: '3 3', label: '关联' },
} as const;

const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;

function featureStatus(featureItems: BacklogItem[]): BacklogStatus {
  if (featureItems.some((i) => i.status === 'suggested' || i.status === 'approved')) return 'suggested';
  if (featureItems.some((i) => i.status === 'dispatched')) return 'dispatched';
  if (featureItems.some((i) => i.status === 'open')) return 'open';
  return 'done';
}

function featureName(featureItems: BacklogItem[]): string {
  const first = featureItems[0];
  if (!first) return '';
  return first.title.match(/^\[F\d+\]\s*(.+)/)?.[1]?.trim() ?? first.title;
}

function layoutDag(nodes: Node<FeatureNodeData>[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return { ...n, position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

function buildTooltip(data: FeatureNodeData): string {
  const lines = [`${data.featureId}: ${data.name}`];
  if (data.evolvedFrom.length) lines.push(`演化自: ${data.evolvedFrom.join(', ')}`);
  if (data.blockedBy.length) lines.push(`被阻塞: ${data.blockedBy.join(', ')}`);
  if (data.related.length) lines.push(`关联: ${data.related.join(', ')}`);
  return lines.join('\n');
}

function FeatureNode({ data }: NodeProps<Node<FeatureNodeData>>) {
  const colors = STATUS_COLORS[data.status];
  const isDone = data.status === 'done';

  return (
    <div
      className={`rounded-xl border-2 bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md ${isDone ? 'opacity-50' : ''}`}
      style={{
        borderColor: colors.border,
        backgroundColor: colors.bg,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT - 10,
      }}
      data-testid={`mc-dep-node-${data.featureId}`}
      title={buildTooltip(data)}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.dot }} />
        <span className="text-xs font-bold text-[#8B6F47]">{data.featureId}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#5A4A38]">{data.name}</p>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { feature: FeatureNode };

interface FeatureRecord {
  id: string;
  name: string;
  status: BacklogStatus;
  evolvedFrom: string[];
  blockedBy: string[];
  related: string[];
}

function collectDeps(featureItems: BacklogItem[]) {
  const evolved = new Set<string>();
  const blocked = new Set<string>();
  const related = new Set<string>();
  for (const item of featureItems) {
    for (const d of item.dependencies?.evolvedFrom ?? []) evolved.add(d.toUpperCase());
    for (const d of item.dependencies?.blockedBy ?? []) blocked.add(d.toUpperCase());
    for (const d of item.dependencies?.related ?? []) related.add(d.toUpperCase());
  }
  return { evolvedFrom: [...evolved], blockedBy: [...blocked], related: [...related] };
}

function buildFeatureRecords(items: BacklogItem[]): FeatureRecord[] {
  const groups = new Map<string, BacklogItem[]>();
  for (const item of items) {
    const fid = extractFeatureId(item.tags);
    if (fid === 'Untagged') continue;
    const list = groups.get(fid) ?? [];
    list.push(item);
    groups.set(fid, list);
  }
  const result: FeatureRecord[] = [];
  for (const [fid, fi] of groups) {
    result.push({ id: fid, name: featureName(fi), status: featureStatus(fi), ...collectDeps(fi) });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function makeEdge(src: string, tgt: string, type: keyof typeof EDGE_STYLES, width = 2): Edge {
  const s = EDGE_STYLES[type];
  const arrow = { type: MarkerType.ArrowClosed, color: s.stroke } as const;
  return {
    id: `${src}-${tgt}-${type}`,
    source: src,
    target: tgt,
    style: { stroke: s.stroke, strokeWidth: width, strokeDasharray: s.strokeDasharray },
    markerEnd: arrow,
    ...(type === 'related' && { markerStart: arrow }),
    label: s.label,
    labelStyle: { fontSize: 10, fill: s.stroke },
    interactionWidth: 20,
  };
}

function collectEdges(records: FeatureRecord[]): Edge[] {
  const nodeIds = new Set(records.map((n) => n.id));
  const seenRelated = new Set<string>();
  const edges: Edge[] = [];
  for (const node of records) {
    edges.push(...node.evolvedFrom.filter((d) => nodeIds.has(d)).map((d) => makeEdge(d, node.id, 'evolved')));
    edges.push(...node.blockedBy.filter((d) => nodeIds.has(d)).map((d) => makeEdge(d, node.id, 'blocked')));
    for (const d of node.related) {
      if (!nodeIds.has(d)) continue;
      const key = [node.id, d].sort().join(':');
      if (seenRelated.has(key)) continue;
      seenRelated.add(key);
      edges.push(makeEdge(node.id, d, 'related', 1.5));
    }
  }
  return edges;
}

function buildReactFlowGraph(records: FeatureRecord[]) {
  const rfNodes: Node<FeatureNodeData>[] = records.map((n) => ({
    id: n.id,
    type: 'feature',
    position: { x: 0, y: 0 },
    data: {
      featureId: n.id,
      name: n.name,
      status: n.status,
      evolvedFrom: n.evolvedFrom,
      blockedBy: n.blockedBy,
      related: n.related,
    },
  }));
  return layoutDag(rfNodes, collectEdges(records));
}

export function DependencyGraphTab({ items }: DependencyGraphTabProps) {
  const featureNodes = useMemo(() => buildFeatureRecords(items), [items]);
  const layouted = useMemo(() => buildReactFlowGraph(featureNodes), [featureNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);
  const [selectedNode, setSelectedNode] = useState<FeatureNodeData | null>(null);

  useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted, setNodes, setEdges]);

  // Sync selected node detail when data refreshes (avoid stale snapshot)
  useEffect(() => {
    setSelectedNode((prev) => {
      if (!prev) return null;
      const updated = featureNodes.find((n) => n.id === prev.featureId);
      if (!updated) return null;
      return {
        featureId: updated.id,
        name: updated.name,
        status: updated.status,
        evolvedFrom: updated.evolvedFrom,
        blockedBy: updated.blockedBy,
        related: updated.related,
      };
    });
  }, [featureNodes]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<FeatureNodeData>) => {
    setSelectedNode((prev) => (prev?.featureId === node.data.featureId ? null : node.data));
  }, []);

  if (featureNodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#9A866F]" data-testid="mc-dep-graph-empty">
        暂无 Feature 依赖数据
      </div>
    );
  }

  return (
    <div data-testid="mc-dep-graph">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border border-[#E7DAC7] bg-[#FFFDF8] px-3 py-2">
        <LegendDot color="#E4A853" label="待审批" />
        <LegendDot color="#5B9BD5" label="执行中" />
        <LegendDot color="#7CB87C" label="已完成" />
        <LegendDot color="#C4B5A0" label="待建议" />
        <span className="text-[11px] text-[#9A866F]">
          <span style={{ color: EDGE_STYLES.evolved.stroke }}>── 演化</span>
          {' · '}
          <span style={{ color: EDGE_STYLES.blocked.stroke }}>- - 阻塞</span>
          {' · '}
          <span style={{ color: EDGE_STYLES.related.stroke }}>··· 关联</span>
        </span>
      </div>

      {/* DAG graph — constrained to container (KD-5 fitView) */}
      <div className="h-[500px] w-full rounded-xl border border-[#E7DAC7] bg-[#FFFDF8]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={onInit}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable
          proOptions={{ hideAttribution: true }}
        />
      </div>

      {/* Node detail panel (AC-J5) */}
      {selectedNode && <NodeDetailPanel data={selectedNode} onClose={() => setSelectedNode(null)} />}
    </div>
  );
}

function NodeDetailPanel({ data, onClose }: { data: FeatureNodeData; onClose: () => void }) {
  const colors = STATUS_COLORS[data.status];
  const statusLabel = { open: '待建议', suggested: '待审批', approved: '待审批', dispatched: '执行中', done: '已完成' }[
    data.status
  ];
  return (
    <div className="mt-3 rounded-xl border border-[#E7DAC7] bg-[#FFFDF8] p-4" data-testid="mc-dep-node-detail">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.dot }} />
          <span className="text-sm font-bold text-[#8B6F47]">{data.featureId}</span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: colors.bg, color: colors.border }}
          >
            {statusLabel}
          </span>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-[#9A866F] hover:text-[#5A4A38]">
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-[#5A4A38]">{data.name}</p>
      {data.evolvedFrom.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] font-medium text-[#9A866F]">演化自：</span>
          <span className="text-[11px] text-blue-700">{data.evolvedFrom.join(', ')}</span>
        </div>
      )}
      {data.blockedBy.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] font-medium text-[#9A866F]">被阻塞：</span>
          <span className="text-[11px] text-red-700">{data.blockedBy.join(', ')}</span>
        </div>
      )}
      {data.related.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] font-medium text-[#9A866F]">关联：</span>
          <span className="text-[11px] text-gray-600">{data.related.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-[#9A866F]">{label}</span>
    </span>
  );
}
