'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type { BacklogItem, ThreadPhase } from '@cat-cafe/shared';
import { ThreadSidebar } from '@/components/ThreadSidebar';
import { apiFetch } from '@/utils/api-client';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { MissionControlCard } from './MissionControlCard';
import { QuickCreateForm } from './QuickCreateForm';
import { SuggestionDrawer } from './SuggestionDrawer';

interface BacklogListResponse {
  items?: BacklogItem[];
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export function MissionControlPage() {
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
      const body = await response.json() as BacklogListResponse;
      setItems(body.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 backlog 失败');
    } finally {
      setLoading(false);
    }
  }, [setError, setItems, setLoading]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedItemId) setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId, setSelectedItemId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const openItems = useMemo(() => items.filter((item) => item.status === 'open'), [items]);
  const suggestedItems = useMemo(
    () => items.filter((item) => item.status === 'suggested' || item.status === 'approved'),
    [items],
  );
  const dispatchedItems = useMemo(() => items.filter((item) => item.status === 'dispatched'), [items]);

  const withSubmitGuard = useCallback(async (task: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await task();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '请求失败');
    } finally {
      setSubmitting(false);
    }
  }, [setError, setSubmitting]);

  const handleCreate = useCallback(async (payload: {
    title: string;
    summary: string;
    priority: BacklogItem['priority'];
    tags: string[];
  }) => withSubmitGuard(async () => {
    const response = await apiFetch('/api/backlog/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const created = await response.json() as BacklogItem;
    setSelectedItemId(created.id);
    await loadItems();
  }), [loadItems, setSelectedItemId, withSubmitGuard]);

  const handleSuggest = useCallback(async (payload: {
    itemId: string;
    catId: string;
    why: string;
    plan: string;
    requestedPhase: ThreadPhase;
  }) => withSubmitGuard(async () => {
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
  }), [loadItems, withSubmitGuard]);

  const handleApprove = useCallback(async (payload: { itemId: string; threadPhase: ThreadPhase }) => withSubmitGuard(async () => {
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
  }), [loadItems, withSubmitGuard]);

  const handleReject = useCallback(async (payload: { itemId: string; note?: string }) => withSubmitGuard(async () => {
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
  }), [loadItems, withSubmitGuard]);

  return (
    <div className="flex h-screen bg-[#F4EFE7]">
      <div className="hidden h-full md:block">
        <ThreadSidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <header className="rounded-2xl border border-[#E7DAC7] bg-[#FFFDF8] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9A866F]">Mission Control</p>
          <h1 className="mt-1 text-lg font-semibold text-[#2B2118]">Backlog 指挥中心</h1>
          <p className="mt-1 text-xs text-[#705E4C]">
            面向手机/桌面统一收集与分配。流程：Open → Suggested → Dispatched。
          </p>
        </header>

        <div className="mt-3">
          <QuickCreateForm disabled={submitting} onCreate={handleCreate} />
        </div>

        {error && (
          <div
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            data-testid="mc-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-3">
            <Lane
              title="Open"
              subtitle="待建议领取"
              items={openItems}
              selectedItemId={selectedItemId}
              onSelect={setSelectedItemId}
              testId="mc-lane-open"
            />
            <Lane
              title="Suggested"
              subtitle="待批准/已批准"
              items={suggestedItems}
              selectedItemId={selectedItemId}
              onSelect={setSelectedItemId}
              testId="mc-lane-suggested"
            />
            <Lane
              title="Dispatched"
              subtitle="执行中线程"
              items={dispatchedItems}
              selectedItemId={selectedItemId}
              onSelect={setSelectedItemId}
              testId="mc-lane-dispatched"
            />
          </section>

          <SuggestionDrawer
            item={selectedItem}
            submitting={submitting}
            selectedPhase={selectedPhase}
            onChangePhase={setSelectedPhase}
            onSuggest={handleSuggest}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>

        {(loading && items.length === 0) && (
          <p className="mt-2 text-xs text-[#8A7864]">加载 backlog 中...</p>
        )}
      </main>
    </div>
  );
}

interface LaneProps {
  title: string;
  subtitle: string;
  items: BacklogItem[];
  selectedItemId: string | null;
  onSelect: (id: string) => void;
  testId: string;
}

function Lane({ title, subtitle, items, selectedItemId, onSelect, testId }: LaneProps) {
  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-[#E6DAC8] bg-[#FFF9F0] p-3" data-testid={testId}>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-[#2C2118]">{title}</h2>
        <p className="text-[11px] text-[#7B6956]">
          {subtitle} · {items.length}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#DDCCB5] px-2 py-2 text-[11px] text-[#8B7864]">
            暂无任务
          </p>
        )}
        {items.map((item) => (
          <MissionControlCard
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
