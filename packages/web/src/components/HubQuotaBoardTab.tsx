'use client';

import React, { useMemo } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { formatCatName, useCatData } from '@/hooks/useCatData';
import { classifyQuotaUtilization, collectLatestQuotaByCat } from './hub-quota-board.helpers';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
      <h3 className="text-xs font-semibold text-gray-700 mb-2">{title}</h3>
      {children}
    </section>
  );
}

const LEVEL_LABEL: Record<ReturnType<typeof classifyQuotaUtilization>, string> = {
  ok: '正常',
  warn: '注意',
  high: '高压',
  critical: '紧急',
};

const LEVEL_CLASS: Record<ReturnType<typeof classifyQuotaUtilization>, string> = {
  ok: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function formatResetAt(iso?: string, contextResetMs?: number): string | null {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    return iso;
  }
  if (typeof contextResetMs === 'number' && Number.isFinite(contextResetMs)) {
    const d = new Date(contextResetMs);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return null;
}

function formatUpdatedAt(updatedAt: number): string {
  if (!updatedAt || !Number.isFinite(updatedAt)) return '未知';
  return new Date(updatedAt).toLocaleString();
}

export function HubQuotaBoardTab() {
  const currentThreadId = useChatStore((s) => s.currentThreadId);
  const catInvocations = useChatStore((s) => s.catInvocations);
  const threadStates = useChatStore((s) => s.threadStates);
  const { cats } = useCatData();

  const snapshots = useMemo(
    () => collectLatestQuotaByCat({
      currentThreadId,
      activeCatInvocations: catInvocations,
      threadStates,
    }),
    [currentThreadId, catInvocations, threadStates],
  );

  return (
    <Section title="猫粮额度看板（Telemetry）">
      <p className="text-[11px] text-gray-500 mb-3">
        这里展示的是我们从调用链采集到的最近一次额度遥测，不是官方账单页；用于节能路由与 reviewer 排班决策。
      </p>

      <div className="space-y-3">
        {cats.map((cat) => {
          const snap = snapshots[cat.id];
          if (!snap) {
            return (
              <div key={cat.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm font-medium text-gray-800">{formatCatName(cat)}</div>
                <div className="text-[11px] text-gray-500 mt-1">暂无额度遥测（该猫最近未上报 usage/rate-limit）</div>
              </div>
            );
          }

          const utilization = snap.invocation.rateLimit?.utilization;
          const level = classifyQuotaUtilization(utilization);
          const utilizationText =
            typeof utilization === 'number' && Number.isFinite(utilization)
              ? `${Math.round(utilization * 100)}%`
              : '未知';
          const resetAt = formatResetAt(
            snap.invocation.rateLimit?.resetsAt,
            snap.invocation.usage?.contextResetsAtMs,
          );
          const sourceThreadLabel =
            snap.threadId === currentThreadId ? '当前线程' : `线程 ${snap.threadId.slice(0, 8)}`;

          return (
            <div key={cat.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-800">{formatCatName(cat)}</div>
                <span className={`text-[11px] px-2 py-0.5 rounded ${LEVEL_CLASS[level]}`}>
                  {LEVEL_LABEL[level]} · {utilizationText}
                </span>
              </div>

              <div className="text-[11px] text-gray-600">
                最近输入/输出：
                {snap.invocation.usage?.inputTokens != null ? ` ${snap.invocation.usage.inputTokens.toLocaleString()} /` : ' - /'}
                {snap.invocation.usage?.outputTokens != null ? ` ${snap.invocation.usage.outputTokens.toLocaleString()}` : ' -'}
              </div>

              {snap.invocation.usage?.contextUsedTokens != null && snap.invocation.usage?.contextWindowSize != null && (
                <div className="text-[11px] text-gray-600">
                  Context: {snap.invocation.usage.contextUsedTokens.toLocaleString()} / {snap.invocation.usage.contextWindowSize.toLocaleString()}
                </div>
              )}

              {snap.invocation.usage?.contextUsedTokens == null && snap.invocation.contextHealth && (
                <div className="text-[11px] text-gray-600">
                  上下文占用: {Math.round(snap.invocation.contextHealth.fillRatio * 100)}%
                </div>
              )}

              <div className="text-[11px] text-gray-500">
                重置时间: {resetAt ?? '未知'} · 来源: {sourceThreadLabel} · 更新时间: {formatUpdatedAt(snap.updatedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
