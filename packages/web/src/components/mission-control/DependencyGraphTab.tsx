'use client';

import type { BacklogItem, BacklogStatus } from '@cat-cafe/shared';
import { useMemo } from 'react';
import { extractFeatureId } from './FeatureBirdEyePanel';

interface DependencyGraphTabProps {
  items: BacklogItem[];
}

interface FeatureNode {
  id: string;
  name: string;
  status: BacklogStatus;
  evolvedFrom: string[];
  blockedBy: string[];
  related: string[];
}

const STATUS_COLORS: Record<BacklogStatus, { border: string; dot: string }> = {
  open: { border: 'border-[#C4B5A0]', dot: 'bg-[#C4B5A0]' },
  suggested: { border: 'border-[#E4A853]', dot: 'bg-[#E4A853]' },
  approved: { border: 'border-[#E4A853]', dot: 'bg-[#E4A853]' },
  dispatched: { border: 'border-[#5B9BD5]', dot: 'bg-[#5B9BD5]' },
  done: { border: 'border-[#7CB87C]', dot: 'bg-[#7CB87C]' },
};

function featureStatus(featureItems: BacklogItem[]): BacklogStatus {
  if (featureItems.some((i) => i.status === 'suggested' || i.status === 'approved')) return 'suggested';
  if (featureItems.some((i) => i.status === 'dispatched')) return 'dispatched';
  if (featureItems.some((i) => i.status === 'open')) return 'open';
  return 'done';
}

function featureName(featureItems: BacklogItem[]): string {
  const first = featureItems[0];
  if (!first) return '';
  const match = first.title.match(/^\[F\d+\]\s*(.+)/);
  return match?.[1]?.trim() ?? first.title;
}

export function DependencyGraphTab({ items }: DependencyGraphTabProps) {
  const nodes = useMemo(() => {
    const groups = new Map<string, BacklogItem[]>();
    for (const item of items) {
      const fid = extractFeatureId(item.tags);
      if (fid === 'Untagged') continue;
      const list = groups.get(fid) ?? [];
      list.push(item);
      groups.set(fid, list);
    }

    const result: FeatureNode[] = [];
    for (const [fid, featureItems] of groups) {
      // Aggregate dependencies across all items in this feature group
      const evolvedSet = new Set<string>();
      const blockedSet = new Set<string>();
      const relatedSet = new Set<string>();
      for (const item of featureItems) {
        for (const d of item.dependencies?.evolvedFrom ?? []) evolvedSet.add(d.toUpperCase());
        for (const d of item.dependencies?.blockedBy ?? []) blockedSet.add(d.toUpperCase());
        for (const d of item.dependencies?.related ?? []) relatedSet.add(d.toUpperCase());
      }
      result.push({
        id: fid,
        name: featureName(featureItems),
        status: featureStatus(featureItems),
        evolvedFrom: [...evolvedSet],
        blockedBy: [...blockedSet],
        related: [...relatedSet],
      });
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }, [items]);

  // Collect all edges for visualization
  const edges = useMemo(() => {
    const result: { from: string; to: string; type: 'evolved' | 'blocked' | 'related' }[] = [];
    for (const node of nodes) {
      for (const dep of node.evolvedFrom) {
        result.push({ from: dep, to: node.id, type: 'evolved' });
      }
      for (const dep of node.blockedBy) {
        result.push({ from: dep, to: node.id, type: 'blocked' });
      }
      for (const dep of node.related) {
        // Avoid duplicate related edges (A↔B and B↔A)
        if (node.id < dep) {
          result.push({ from: node.id, to: dep, type: 'related' });
        }
      }
    }
    return result;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#9A866F]" data-testid="mc-dep-graph-empty">
        暂无 Feature 依赖数据
      </div>
    );
  }

  return (
    <div data-testid="mc-dep-graph">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#E7DAC7] bg-[#FFFDF8] px-3 py-2">
        <LegendDot color="bg-[#E4A853]" label="待审批" />
        <LegendDot color="bg-[#5B9BD5]" label="执行中" />
        <LegendDot color="bg-[#7CB87C]" label="已完成" />
        <LegendDot color="bg-[#C4B5A0]" label="待建议" />
        <span className="text-[11px] text-[#9A866F]">← 演化自 &nbsp; ⊘ 被阻塞 &nbsp; ↔ 关联</span>
      </div>

      {/* Node grid — constrained to screen width (KD-5) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {nodes.map((node) => {
          const colors = STATUS_COLORS[node.status];
          const isDone = node.status === 'done';
          return (
            <div
              key={node.id}
              className={`rounded-xl border-2 ${colors.border} bg-[#FFFDF8] p-3 ${isDone ? 'opacity-50' : ''}`}
              data-testid={`mc-dep-node-${node.id}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span className="text-xs font-bold text-[#8B6F47]">{node.id}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[#5A4A38]">{node.name}</p>
              {(node.evolvedFrom.length > 0 || node.blockedBy.length > 0 || node.related.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {node.evolvedFrom.map((d) => (
                    <span
                      key={`ef-${d}`}
                      className="rounded-md border border-blue-200 bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-700"
                    >
                      ← {d}
                    </span>
                  ))}
                  {node.blockedBy.map((d) => (
                    <span
                      key={`bb-${d}`}
                      className="rounded-md border border-red-200 bg-red-50 px-1 py-0.5 text-[9px] font-medium text-red-700"
                    >
                      ⊘ {d}
                    </span>
                  ))}
                  {node.related.map((d) => (
                    <span
                      key={`rel-${d}`}
                      className="rounded-md border border-gray-200 bg-gray-50 px-1 py-0.5 text-[9px] font-medium text-gray-600"
                    >
                      ↔ {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edge list (for clarity since we can't draw SVG arrows easily) */}
      {edges.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#E7DAC7] bg-[#FFFDF8] p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A866F]">依赖关系</p>
          <div className="flex flex-wrap gap-2">
            {edges.map((e) => (
              <span
                key={`${e.from}-${e.to}-${e.type}`}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  e.type === 'evolved'
                    ? 'bg-blue-50 text-blue-700'
                    : e.type === 'blocked'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {e.from} → {e.to}
                <span className="ml-1 text-[9px] opacity-70">
                  {e.type === 'evolved' ? '演化' : e.type === 'blocked' ? '阻塞' : '关联'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[11px] text-[#9A866F]">{label}</span>
    </span>
  );
}
