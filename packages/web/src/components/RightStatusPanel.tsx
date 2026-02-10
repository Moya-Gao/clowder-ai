'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { CatInvocationInfo } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import {
  CAT_INFO, modeLabel, statusLabel, statusTone, truncateId, formatDuration,
  type IntentMode, type CatStatus,
} from './status-helpers';
import { CatConfigViewer } from './CatConfigViewer';

export interface RightStatusPanelProps {
  intentMode: IntentMode;
  targetCats: string[];
  catStatuses: Record<string, CatStatus>;
  catInvocations: Record<string, CatInvocationInfo>;
  threadId: string;
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

interface AuditData {
  logPath: string | null;
  eventCount: number;
  logFiles: string[];
}

export function RightStatusPanel({
  intentMode,
  targetCats,
  catStatuses,
  catInvocations,
  threadId,
  messageSummary,
  taskSummary,
}: RightStatusPanelProps) {
  const cats = targetCats.length > 0
    ? Array.from(new Set(targetCats))
    : ['opus', 'codex', 'gemini'];

  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/audit/thread/${threadId}`);
      if (!res.ok) return;
      const data = await res.json() as { logPath: string | null; logFiles: string[]; events: unknown[] };
      setAuditData({
        logPath: data.logPath,
        eventCount: data.events.length,
        logFiles: data.logFiles,
      });
    } catch { /* silently ignore audit fetch failures */ }
  }, [threadId]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  return (
    <aside className="hidden lg:flex w-72 border-l border-owner-light bg-white/90 px-4 py-4 flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-sm font-bold text-cafe-black">状态栏</h2>
        <p className="text-xs text-gray-500 mt-1">
          当前模式: <span className="font-medium">{modeLabel(intentMode)}</span>
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700">猫猫状态</h3>
          <button
            onClick={() => setConfigOpen(true)}
            className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
          >
            配置
          </button>
        </div>
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

      {Object.keys(catInvocations).length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">最近调用</h3>
          <div className="space-y-2">
            {cats.map((catId) => {
              const inv = catInvocations[catId];
              if (!inv) return null;
              const info = CAT_INFO[catId] ?? { name: catId, color: 'bg-gray-400' };
              return (
                <div key={catId} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${info.color}`} />
                    <span className="font-medium text-gray-700">{info.name}</span>
                    {inv.durationMs != null && (
                      <span className="text-gray-500 ml-auto">{formatDuration(inv.durationMs)}</span>
                    )}
                    {inv.startedAt && !inv.durationMs && (
                      <span className="text-green-600 ml-auto">进行中…</span>
                    )}
                  </div>
                  {inv.sessionId && (
                    <button
                      className="ml-3.5 text-[11px] text-gray-400 font-mono truncate max-w-full text-left hover:text-gray-600 cursor-pointer transition-colors"
                      title={`点击复制: ${inv.sessionId}`}
                      onClick={() => navigator.clipboard.writeText(inv.sessionId!)}
                    >
                      {truncateId(inv.sessionId, 12)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">对话信息</h3>
        <div className="text-xs text-gray-500">
          <div>
            Thread: <button
              className="text-gray-600 font-mono hover:text-gray-800 cursor-pointer transition-colors"
              title={`点击复制: ${threadId}`}
              onClick={() => navigator.clipboard.writeText(threadId)}
            >{truncateId(threadId, 12)}</button>
          </div>
        </div>
      </section>

      {auditData && (
        <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">审计日志</h3>
          <div className="text-xs space-y-1.5">
            {auditData.logPath ? (
              <a href={`vscode://file${auditData.logPath}`} className="text-blue-600 hover:text-blue-800 underline block truncate" title={auditData.logPath}>
                在 VSCode 中打开
              </a>
            ) : (
              <span className="text-gray-400">路径不可用 (生产模式)</span>
            )}
            <div className="text-gray-500">{auditData.eventCount} 条事件 · {auditData.logFiles.length} 个日志文件</div>
          </div>
        </section>
      )}
      <CatConfigViewer open={configOpen} onClose={() => setConfigOpen(false)} />
    </aside>
  );
}
