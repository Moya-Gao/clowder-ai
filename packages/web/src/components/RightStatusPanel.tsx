'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CatInvocationInfo } from '@/stores/chatStore';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import {
  CAT_INFO, modeLabel, statusLabel, statusTone, truncateId,
  type IntentMode, type CatStatus,
} from './status-helpers';
import { CatTokenUsage } from './CatTokenUsage';
import { CatInvocationTime, CollapsibleIds } from './status-panel-parts';
import { SessionChainPanel } from './SessionChainPanel';

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
}

interface AuditData {
  logPath: string | null;
  eventCount: number;
  logFiles: string[];
}

/* ── F26: Task progress checklist ──────────────────────────── */
function CatTaskProgress({ taskProgress }: { taskProgress: CatInvocationInfo['taskProgress'] }) {
  if (!taskProgress || taskProgress.tasks.length === 0) return null;
  const { tasks } = taskProgress;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="ml-3.5 mt-1.5">
      <div className="text-[10px] font-medium text-gray-500 mb-1">
        执行计划 ({completed}/{tasks.length})
      </div>
      <div className="space-y-0.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-1 text-[11px] leading-tight">
            <span className="mt-px flex-shrink-0">
              {t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬚'}
            </span>
            <span className={t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}>
              {t.status === 'in_progress' ? (t.activeForm ?? t.subject) : t.subject}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.round((completed / tasks.length) * 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Cat invocation card (shared between active/history) ──── */
function CatInvocationCard({
  catId, inv, onCopy, isActive,
}: {
  catId: string;
  inv: CatInvocationInfo;
  onCopy: (v: string) => void;
  isActive: boolean;
}) {
  const info = CAT_INFO[catId] ?? { name: catId, color: 'bg-gray-400' };
  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${info.color} ${isActive ? 'animate-pulse' : ''}`} />
        <span className="font-medium text-gray-700">{info.name}</span>
        {inv.sessionSeq !== undefined && (
          <span
            className={`text-[10px] px-1 py-0.5 rounded ${
              inv.sessionSealed ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
            }`}
            title={inv.sessionSealed ? `会话 #${inv.sessionSeq} 已封存` : `会话 #${inv.sessionSeq}`}
          >
            S#{inv.sessionSeq}{inv.sessionSealed ? ' sealed' : ''}
          </span>
        )}
        <CatInvocationTime invocation={inv} />
      </div>
      {inv.usage && (
        <div className="ml-3.5">
          <CatTokenUsage catId={catId} usage={inv.usage} contextHealth={inv.contextHealth} />
        </div>
      )}
      {isActive && inv.taskProgress && inv.taskProgress.tasks.length > 0 && (
        <CatTaskProgress taskProgress={inv.taskProgress} />
      )}
      {(inv.sessionId || inv.invocationId) && (
        <CollapsibleIds sessionId={inv.sessionId} invocationId={inv.invocationId} onCopy={onCopy} />
      )}
    </div>
  );
}

export function RightStatusPanel({
  intentMode,
  targetCats,
  catStatuses,
  catInvocations,
  threadId,
  messageSummary,
}: RightStatusPanelProps) {
  // F26: Split into active (working now) vs history (appeared before)
  const { activeCats, historyCats } = useMemo(() => {
    const allParticipants = new Set([
      ...targetCats,
      ...Object.keys(catInvocations),
    ]);
    const active = targetCats.length > 0
      ? Array.from(new Set(targetCats))
      : [];
    const history = [...allParticipants].filter((c) => !active.includes(c));
    return { activeCats: active, historyCats: history };
  }, [targetCats, catInvocations]);

  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openHub = useChatStore((s) => s.openHub);

  const copyText = useCallback((value: string) => {
    void navigator.clipboard.writeText(value);
  }, []);

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

      {/* ── Active cats: currently working ──────────────── */}
      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-700">
            {activeCats.length > 0 ? '当前调用' : '猫猫状态'}
          </h3>
          <button
            onClick={() => openHub('opus')}
            className="text-base text-gray-400 hover:text-blue-600 hover:rotate-45 transition-all duration-200"
            title="查看猫猫配置 / MCP / Skills"
          >
            &#9881;
          </button>
        </div>
        {activeCats.length > 0 ? (
          <div className="space-y-3">
            {activeCats.map((catId) => {
              const info = CAT_INFO[catId] ?? { name: catId, color: 'bg-gray-400' };
              const status = catStatuses[catId] ?? 'pending';
              const inv = catInvocations[catId];
              return (
                <div key={catId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${info.color}`} />
                      <span className="text-xs text-gray-700">{info.name}</span>
                    </div>
                    <span className={`text-xs font-medium ${statusTone(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                  {inv && (
                    <CatInvocationCard catId={catId} inv={inv} onCopy={copyText} isActive />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-400">等待调用...</div>
        )}
      </section>

      {/* ── History cats: appeared before but not in current round ── */}
      {historyCats.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            <span>历史参与 ({historyCats.length})</span>
            <span className="text-[10px]">{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-2">
              {historyCats.map((catId) => {
                const inv = catInvocations[catId];
                if (!inv) {
                  const info = CAT_INFO[catId] ?? { name: catId, color: 'bg-gray-400' };
                  return (
                    <div key={catId} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`inline-block h-2 w-2 rounded-full ${info.color} opacity-50`} />
                      {info.name}
                    </div>
                  );
                }
                return <CatInvocationCard key={catId} catId={catId} inv={inv} onCopy={copyText} isActive={false} />;
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Message stats (collapsible) ───────────────── */}
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

      <SessionChainPanel threadId={threadId} catInvocations={catInvocations} />

      <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">对话信息</h3>
        <div className="text-xs text-gray-500">
          <div>
            Thread: <button
              className="text-gray-600 font-mono hover:text-gray-800 cursor-pointer transition-colors"
              title={`点击复制: ${threadId}`}
              onClick={() => copyText(threadId)}
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
    </aside>
  );
}
