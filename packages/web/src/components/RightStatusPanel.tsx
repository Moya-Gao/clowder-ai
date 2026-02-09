'use client';

import React from 'react';

const CAT_INFO: Record<string, { name: string; color: string }> = {
  opus: { name: '布偶猫', color: 'bg-opus-primary' },
  codex: { name: '缅因猫', color: 'bg-codex-primary' },
  gemini: { name: '暹罗猫', color: 'bg-gemini-primary' },
};

type IntentMode = 'execute' | 'ideate' | null;
type CatStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface RightStatusPanelProps {
  intentMode: IntentMode;
  targetCats: string[];
  catStatuses: Record<string, CatStatus>;
  messageSummary: {
    total: number;
    assistant: number;
    system: number;
    evidence: number;
    followup: number;
  };
  taskSummary: {
    total: number;
    done: number;
  };
}

function modeLabel(mode: IntentMode): string {
  if (mode === 'ideate') return '独立观点采样';
  if (mode === 'execute') return '执行';
  return '空闲';
}

function statusLabel(status: CatStatus): string {
  switch (status) {
    case 'pending':
      return '待命';
    case 'streaming':
      return '工作中';
    case 'done':
      return '完成';
    case 'error':
      return '异常';
    default:
      return '未知';
  }
}

function statusTone(status: CatStatus): string {
  switch (status) {
    case 'pending':
      return 'text-gray-500';
    case 'streaming':
      return 'text-green-600';
    case 'done':
      return 'text-emerald-700';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

export function RightStatusPanel({
  intentMode,
  targetCats,
  catStatuses,
  messageSummary,
  taskSummary,
}: RightStatusPanelProps) {
  const cats = targetCats.length > 0
    ? Array.from(new Set(targetCats))
    : ['opus', 'codex', 'gemini'];

  return (
    <aside className="hidden lg:flex w-72 border-l border-owner-light bg-white/90 px-4 py-4 flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-sm font-bold text-cafe-black">状态栏</h2>
        <p className="text-xs text-gray-500 mt-1">
          当前模式: <span className="font-medium">{modeLabel(intentMode)}</span>
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">猫猫状态</h3>
        <div className="space-y-2">
          {cats.map((catId) => {
            const info = CAT_INFO[catId] ?? { name: catId, color: 'bg-gray-400' };
            const status = catStatuses[catId] ?? 'pending';
            return (
              <div key={catId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${info.color}`} />
                  <span className="text-xs text-gray-700">{info.name}</span>
                </div>
                <span className={`text-xs font-medium ${statusTone(status)}`}>
                  {statusLabel(status)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">消息统计</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div>总数</div>
          <div className="text-right font-medium">{messageSummary.total}</div>
          <div>猫猫消息</div>
          <div className="text-right font-medium">{messageSummary.assistant}</div>
          <div>系统消息</div>
          <div className="text-right font-medium">{messageSummary.system}</div>
          <div>Evidence</div>
          <div className="text-right font-medium">{messageSummary.evidence}</div>
          <div>Follow-up</div>
          <div className="text-right font-medium">{messageSummary.followup}</div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">任务统计</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div>总任务</div>
          <div className="text-right font-medium">{taskSummary.total}</div>
          <div>已完成</div>
          <div className="text-right font-medium">{taskSummary.done}</div>
        </div>
      </section>
    </aside>
  );
}
