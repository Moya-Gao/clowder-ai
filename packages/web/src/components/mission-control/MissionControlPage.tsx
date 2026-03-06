'use client';

import type { BacklogItem, CatId, MissionHubSelfClaimScope, ThreadPhase } from '@cat-cafe/shared';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreadSidebar } from '@/components/ThreadSidebar';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiFetch } from '@/utils/api-client';
import { DependencyGraphTab } from './DependencyGraphTab';
import { extractFeatureId } from './FeatureBirdEyePanel';
import { FeatureRowList } from './FeatureRowList';
import { QuickCreateForm } from './QuickCreateForm';
import { SuggestionDrawer } from './SuggestionDrawer';
import { ThreadSituationPanel } from './ThreadSituationPanel';

interface BacklogListResponse {
  items?: BacklogItem[];
}

interface SelfClaimPolicyResponse {
  scopes?: Record<string, MissionHubSelfClaimScope>;
}

interface ThreadSituationSummary {
  id: string;
  title?: string;
  lastActiveAt: number;
  participants: CatId[];
  backlogItemId?: string;
}

interface ThreadListResponse {
  threads?: ThreadSituationSummary[];
}

type SelfClaimPolicyBlocker = 'once' | 'thread' | null;

function detectSelfClaimPolicyBlocker(rawError: string): SelfClaimPolicyBlocker {
  if (rawError.includes('Self-claim once policy already consumed')) return 'once';
  if (rawError.includes('Self-claim thread policy blocked')) return 'thread';
  return null;
}

function formatMissionHubError(rawError: string): string {
  const blocker = detectSelfClaimPolicyBlocker(rawError);
  if (blocker === 'once') {
    return 'Self-claim 被 once 策略阻断：该猫的自领额度已用完。';
  }
  if (blocker === 'thread') {
    return 'Self-claim 被 thread 策略阻断：该猫已有 active lease 线程，请先释放或回收。';
  }
  return rawError;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export function MissionControlPage() {
  const threadSituationRequestSeq = useRef(0);
  const [selfClaimScopes, setSelfClaimScopes] = useState<Record<string, MissionHubSelfClaimScope>>({});
  const [selfClaimPolicyBlocker, setSelfClaimPolicyBlocker] = useState<SelfClaimPolicyBlocker>(null);
  const [threadsByBacklogId, setThreadsByBacklogId] = useState<Record<string, ThreadSituationSummary>>({});
  const [threadCountByFeature, setThreadCountByFeature] = useState<Record<string, number>>({});
  const [threadsLoading, setThreadsLoading] = useState(false);
  const {
    items,
    loading,
    submitting,
    selectedItemId,
    selectedPhase,
    error,
    setItems,
    setLoading,
    setSubmitting,
    setSelectedItemId,
    setSelectedPhase,
    setError,
  } = useMissionControlStore();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/backlog/items');
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as BacklogListResponse;
      setItems(body.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 backlog 失败');
    } finally {
      setLoading(false);
    }
  }, [setError, setItems, setLoading]);

  const loadSelfClaimScopes = useCallback(async () => {
    try {
      const response = await apiFetch('/api/backlog/self-claim-policy');
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as SelfClaimPolicyResponse;
      setSelfClaimScopes(body.scopes ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 self-claim policy 失败');
    }
  }, [setError]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadSelfClaimScopes();
  }, [loadSelfClaimScopes]);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedItemId) setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId, setSelectedItemId]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);

  const dispatchedItems = useMemo(() => items.filter((item) => item.status === 'dispatched'), [items]);
  const dispatchedBacklogIds = useMemo(() => dispatchedItems.map((item) => item.id), [dispatchedItems]);

  /** F058 Phase G: unique feature IDs from all items for thread title search */
  const uniqueFeatureIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      const fid = extractFeatureId(item.tags);
      if (fid !== 'Untagged') ids.add(fid);
    }
    return [...ids];
  }, [items]);

  const loadThreadSituations = useCallback(async (backlogItemIds: string[]) => {
    const requestSeq = ++threadSituationRequestSeq.current;
    if (backlogItemIds.length === 0) {
      setThreadsByBacklogId({});
      setThreadsLoading(false);
      return;
    }

    setThreadsLoading(true);
    try {
      const response = await apiFetch(`/api/threads?backlogItemIds=${encodeURIComponent(backlogItemIds.join(','))}`);
      if (!response.ok) throw new Error(await parseError(response));
      const body = (await response.json()) as ThreadListResponse;
      const backlogItemIdSet = new Set(backlogItemIds);
      const next: Record<string, ThreadSituationSummary> = {};
      for (const thread of body.threads ?? []) {
        if (!thread.backlogItemId || !backlogItemIdSet.has(thread.backlogItemId)) continue;
        next[thread.backlogItemId] = thread;
      }
      if (requestSeq !== threadSituationRequestSeq.current) return;
      setThreadsByBacklogId(next);
    } catch {
      if (requestSeq !== threadSituationRequestSeq.current) return;
      setThreadsByBacklogId({});
    } finally {
      if (requestSeq !== threadSituationRequestSeq.current) return;
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThreadSituations(dispatchedBacklogIds);
  }, [dispatchedBacklogIds, loadThreadSituations]);

  /** F058 Phase G: Fetch thread counts by feature ID from title matching (chunked to respect 50-ID limit) */
  useEffect(() => {
    if (uniqueFeatureIds.length === 0) {
      setThreadCountByFeature({});
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const CHUNK_SIZE = 50;
        const merged: Record<string, number> = {};
        for (let i = 0; i < uniqueFeatureIds.length; i += CHUNK_SIZE) {
          if (controller.signal.aborted) return;
          const chunk = uniqueFeatureIds.slice(i, i + CHUNK_SIZE);
          const response = await apiFetch(`/api/threads?featureIds=${encodeURIComponent(chunk.join(','))}`, {
            signal: controller.signal,
          });
          if (!response.ok || controller.signal.aborted) return;
          const body = (await response.json()) as { threadsByFeature?: Record<string, unknown[]> };
          for (const [fid, threads] of Object.entries(body.threadsByFeature ?? {})) {
            merged[fid] = (merged[fid] ?? 0) + threads.length;
          }
        }
        if (!controller.signal.aborted) setThreadCountByFeature(merged);
      } catch {
        // ignore abort / network errors
      }
    })();
    return () => controller.abort();
  }, [uniqueFeatureIds]);

  const withSubmitGuard = useCallback(
    async (task: () => Promise<void>) => {
      setSubmitting(true);
      setSelfClaimPolicyBlocker(null);
      setError(null);
      try {
        await task();
      } catch (submitError) {
        const rawError = submitError instanceof Error ? submitError.message : '请求失败';
        setSelfClaimPolicyBlocker(detectSelfClaimPolicyBlocker(rawError));
        setError(formatMissionHubError(rawError));
      } finally {
        setSubmitting(false);
      }
    },
    [setError, setSubmitting],
  );

  const handleCreate = useCallback(
    async (payload: { title: string; summary: string; priority: BacklogItem['priority']; tags: string[] }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch('/api/backlog/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await parseError(response));
        const created = (await response.json()) as BacklogItem;
        setSelectedItemId(created.id);
        await loadItems();
      }),
    [loadItems, setSelectedItemId, withSubmitGuard],
  );

  const handleSuggest = useCallback(
    async (payload: { itemId: string; catId: string; why: string; plan: string; requestedPhase: ThreadPhase }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/suggest-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catId: payload.catId,
            why: payload.why,
            plan: payload.plan,
            requestedPhase: payload.requestedPhase,
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleApprove = useCallback(
    async (payload: { itemId: string; threadPhase: ThreadPhase }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/decide-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'approve',
            threadPhase: payload.threadPhase,
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleReject = useCallback(
    async (payload: { itemId: string; note?: string }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/decide-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'reject',
            ...(payload.note ? { note: payload.note } : {}),
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleSelfClaim = useCallback(
    async (payload: { itemId: string; catId: string; why: string; plan: string; requestedPhase: ThreadPhase }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/self-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catId: payload.catId,
            why: payload.why,
            plan: payload.plan,
            requestedPhase: payload.requestedPhase,
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleAcquireLease = useCallback(
    async (payload: { itemId: string; catId: string; ttlMs?: number }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/lease/acquire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catId: payload.catId,
            ...(payload.ttlMs ? { ttlMs: payload.ttlMs } : {}),
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleHeartbeatLease = useCallback(
    async (payload: { itemId: string; catId: string; ttlMs?: number }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/lease/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catId: payload.catId,
            ...(payload.ttlMs ? { ttlMs: payload.ttlMs } : {}),
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleReleaseLease = useCallback(
    async (payload: { itemId: string; catId?: string }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/lease/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(payload.catId ? { catId: payload.catId } : {}),
          }),
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleReclaimLease = useCallback(
    async (payload: { itemId: string }) =>
      withSubmitGuard(async () => {
        const response = await apiFetch(`/api/backlog/items/${encodeURIComponent(payload.itemId)}/lease/reclaim`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  const handleImportFromDocs = useCallback(
    async () =>
      withSubmitGuard(async () => {
        const response = await apiFetch('/api/backlog/import-active-features', {
          method: 'POST',
        });
        if (!response.ok) throw new Error(await parseError(response));
        await loadItems();
      }),
    [loadItems, withSubmitGuard],
  );

  // Status summary counts
  const pendingCount = useMemo(
    () => items.filter((i) => i.status === 'suggested' || i.status === 'approved').length,
    [items],
  );
  const activeCount = useMemo(() => items.filter((i) => i.status === 'dispatched').length, [items]);
  const doneCount = useMemo(() => items.filter((i) => i.status === 'done').length, [items]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'features' | 'dependencies'>('features');

  // AC-H2: Referrer-based back button — remember where we came from
  const referrerThread = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('from') ?? null;
  }, []);

  return (
    <div className="flex h-screen bg-[#F4EFE7]">
      <div className="hidden h-full md:block">
        <ThreadSidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#E7DAC7] bg-[#FFFDF8] px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={referrerThread ? `/thread/${referrerThread}` : '/'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8C6AD] bg-[#FCF7EE] px-3 py-1.5 text-xs font-medium text-[#8B6F47] transition-colors hover:bg-[#F7EEDB]"
              data-testid="mc-back-to-chat"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              返回线程
            </Link>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-[#9A866F]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <h1 className="text-lg font-bold text-[#2B2118]">Mission Hub</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleImportFromDocs()}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8C6AD] bg-[#FCF7EE] px-3 py-1.5 text-xs font-medium text-[#7A6B5A] transition-colors hover:bg-[#F7EEDB] disabled:opacity-40"
              data-testid="mc-import-docs"
            >
              从文档导入
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-[#E7DAC7] bg-[#FFFDF8]">
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`px-5 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === 'features'
                ? 'border-b-2 border-[#8B6F47] text-[#8B6F47]'
                : 'text-[#9A866F] hover:text-[#6B5D4F]'
            }`}
            data-testid="mc-tab-features"
          >
            功能列表
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dependencies')}
            className={`px-5 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === 'dependencies'
                ? 'border-b-2 border-[#8B6F47] text-[#8B6F47]'
                : 'text-[#9A866F] hover:text-[#6B5D4F]'
            }`}
            data-testid="mc-tab-dependencies"
          >
            依赖全景
          </button>
        </div>

        {/* Status summary bar */}
        <div className="flex items-center gap-5 border-b border-[#E7DAC7] bg-[#FFFDF8] px-6 py-2.5">
          <StatusDot color="bg-[#E4A853]" label={`${pendingCount} 待审批`} textColor="text-[#9A7B3D]" />
          <StatusDot color="bg-[#5B9BD5]" label={`${activeCount} 执行中`} textColor="text-[#4A7FB5]" />
          <StatusDot color="bg-[#7CB87C]" label={`${doneCount} 已完成`} textColor="text-[#5A9A5A]" />
        </div>

        {error && (
          <div
            className="mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            data-testid="mc-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Main content area */}
        <div className="min-h-0 flex-1 overflow-auto">
          {activeTab === 'features' ? (
            <div className="grid min-h-0 grid-cols-1 gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                {/* Quick create */}
                <QuickCreateForm disabled={submitting} onCreate={handleCreate} />

                {/* Feature row list */}
                <FeatureRowList
                  items={items}
                  threadsByBacklogId={threadsByBacklogId}
                  threadCountByFeature={threadCountByFeature}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                />
              </div>

              {/* Right panel: operations */}
              <div className="space-y-3">
                <div className="max-h-[50vh] overflow-auto">
                  <SuggestionDrawer
                    item={selectedItem}
                    submitting={submitting}
                    selectedPhase={selectedPhase}
                    selfClaimScopes={selfClaimScopes}
                    selfClaimPolicyBlocker={selfClaimPolicyBlocker}
                    onChangePhase={setSelectedPhase}
                    onSuggest={handleSuggest}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onSelfClaim={handleSelfClaim}
                    onAcquireLease={handleAcquireLease}
                    onHeartbeatLease={handleHeartbeatLease}
                    onReleaseLease={handleReleaseLease}
                    onReclaimLease={handleReclaimLease}
                  />
                </div>
                <div className="max-h-[30vh] overflow-auto">
                  <ThreadSituationPanel
                    dispatchedItems={dispatchedItems}
                    loading={threadsLoading}
                    threadsByBacklogId={threadsByBacklogId}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <DependencyGraphTab items={items} />
            </div>
          )}
        </div>

        {loading && items.length === 0 && <p className="px-6 py-2 text-xs text-[#8A7864]">加载 backlog 中...</p>}
      </main>
    </div>
  );
}

function StatusDot({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className={`text-[13px] font-semibold ${textColor}`}>{label}</span>
    </span>
  );
}
