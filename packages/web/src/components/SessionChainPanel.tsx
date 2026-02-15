'use client';

import React, { useEffect, useState } from 'react';
import type { CatInvocationInfo, ContextHealthData } from '@/stores/chat-types';
import { apiFetch } from '@/utils/api-client';
import { truncateId } from './status-helpers';
import { ContextHealthBar } from './ContextHealthBar';
import { TokenCacheBar } from './TokenCacheBar';

/** Minimal session record from API GET /api/threads/:id/sessions */
interface SessionSummary {
  id: string;
  catId: string;
  seq: number;
  status: 'active' | 'sealing' | 'sealed';
  messageCount: number;
  sealReason?: string;
  createdAt: number;
  sealedAt?: number;
  contextHealth?: {
    usedTokens: number;
    windowTokens: number;
    fillRatio: number;
    source: 'exact' | 'approx';
  };
}

export interface SessionChainPanelProps {
  threadId: string;
  catInvocations: Record<string, CatInvocationInfo>;
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function sealReasonLabel(reason?: string): string {
  if (!reason) return '';
  if (reason.includes('compact')) return 'compact';
  if (reason === 'threshold') return 'threshold';
  if (reason === 'manual') return 'manual';
  return reason;
}

function SessionIdTag({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      className="text-[9px] font-mono text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
      title={`点击复制: ${id}`}
      onClick={handleCopy}
    >
      {copied ? 'copied!' : truncateId(id, 10)}
    </button>
  );
}

function cachePercent(cacheRead?: number, input?: number): number {
  if (!cacheRead || !input) return 0;
  return Math.round((cacheRead / input) * 100);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function SessionChainPanel({ threadId, catInvocations }: SessionChainPanelProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Re-fetch when any cat's sessionSealed changes
  const sealSignal = Object.values(catInvocations)
    .map(inv => `${inv.sessionSeq ?? ''}:${inv.sessionSealed ?? ''}`)
    .join(',');

  // Fetch sessions with stale-response guard: if threadId or sealSignal
  // changes before the response arrives, discard the stale result.
  useEffect(() => {
    let cancelled = false;
    setSessions([]);
    setLoading(true);
    apiFetch(`/api/threads/${threadId}/sessions`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) { setSessions([]); return; }
        const data = await res.json() as { sessions: SessionSummary[] };
        if (!cancelled) setSessions(data.sessions);
      })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threadId, sealSignal]);

  if (sessions.length === 0 && !loading) return null;

  const activeSessions = sessions.filter(s => s.status === 'active');
  const sealedSessions = sessions
    .filter(s => s.status === 'sealed' || s.status === 'sealing')
    .sort((a, b) => (b.sealedAt ?? b.createdAt) - (a.sealedAt ?? a.createdAt));

  // Check if any cat recently had a compact (from hooks)
  const hasRecentCompact = Object.values(catInvocations).some(inv => inv.sessionSealed);

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-700">Session Chain</h3>
        <span className="text-[10px] text-gray-400">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Post-compact safety alert */}
      {hasRecentCompact && (
        <div className="mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-600 text-xs">&#9888;</span>
            <span className="text-[10px] font-medium text-amber-700">
              Post-compact safety active
            </span>
          </div>
          <p className="text-[9px] text-amber-600 mt-0.5 ml-4">
            High-risk ops may be blocked after context compression
          </p>
        </div>
      )}

      {/* Active sessions */}
      {activeSessions.map(session => {
        const inv = catInvocations[session.catId];
        const health: ContextHealthData | undefined = inv?.contextHealth ?? (
          session.contextHealth ? {
            ...session.contextHealth,
            measuredAt: session.createdAt,
          } : undefined
        );
        const cachePct = cachePercent(inv?.usage?.cacheReadTokens, inv?.usage?.inputTokens);

        return (
          <div key={session.id} className="mb-2">
            <div className="flex items-center gap-1 mb-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">
                Active
              </span>
            </div>
            <div className="rounded-md border-[1.5px] border-opus-primary/40 bg-white p-2.5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-800">
                    Session #{session.seq + 1}
                  </span>
                  <SessionIdTag id={session.id} />
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-opus-light text-opus-dark font-medium">
                  {session.catId}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mb-1.5">
                Started {timeAgo(session.createdAt)}{session.messageCount > 0 ? ` · ${session.messageCount} msgs` : ''}
              </div>
              {/* Token counts + cache from invocation */}
              {inv?.usage && (inv.usage.inputTokens != null || inv.usage.outputTokens != null) && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] font-mono mb-1">
                  {inv.usage.inputTokens != null && (
                    <span className="text-gray-600">{fmtTokens(inv.usage.inputTokens)}<span className="text-gray-400 ml-0.5">↓</span></span>
                  )}
                  {inv.usage.outputTokens != null && (
                    <span className="text-gray-500">{fmtTokens(inv.usage.outputTokens)}<span className="text-gray-400 ml-0.5">↑</span></span>
                  )}
                  {cachePct > 0 && (
                    <span className="text-green-600">cached {cachePct}%</span>
                  )}
                </div>
              )}
              {/* Context health bar (already shows % internally, no duplicate text) */}
              {health && (
                <ContextHealthBar catId={session.catId} health={health} />
              )}
            </div>
          </div>
        );
      })}

      {/* Sealed sessions */}
      {sealedSessions.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Sealed
            </span>
          </div>
          <div className="space-y-1">
            {sealedSessions.map(session => (
              <div
                key={session.id}
                className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-1.5"
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  session.sealReason?.includes('compact')
                    ? 'bg-amber-100' : 'bg-gray-100'
                }`}>
                  <span className={`text-[10px] ${
                    session.sealReason?.includes('compact')
                      ? 'text-amber-500' : 'text-gray-400'
                  }`}>&#128274;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-gray-700">
                      Session #{session.seq + 1}
                    </span>
                    <SessionIdTag id={session.id} />
                  </div>
                  <div className="text-[9px] text-gray-400 truncate">
                    {session.sealedAt ? timeAgo(session.sealedAt) : 'sealing'}
                    {session.contextHealth ? ` · ${Math.round(session.contextHealth.fillRatio * 100)}%` : ''}
                    {' · '}{session.messageCount} msgs
                    {session.sealReason ? ` · ${sealReasonLabel(session.sealReason)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && sessions.length === 0 && (
        <div className="text-[10px] text-gray-400 text-center py-2">Loading sessions...</div>
      )}
    </section>
  );
}
