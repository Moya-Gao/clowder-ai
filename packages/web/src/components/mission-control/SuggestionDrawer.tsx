'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BacklogItem, ThreadPhase } from '@cat-cafe/shared';
import { formatCatName, useCatData } from '@/hooks/useCatData';
import { SuggestionDecisionPanel } from './SuggestionDecisionPanel';
import { SuggestionOpenForm } from './SuggestionOpenForm';

interface SuggestionDrawerProps {
  item: BacklogItem | null;
  submitting?: boolean;
  selectedPhase: ThreadPhase;
  onChangePhase: (phase: ThreadPhase) => void;
  onSuggest: (payload: {
    itemId: string;
    catId: string;
    why: string;
    plan: string;
    requestedPhase: ThreadPhase;
  }) => Promise<void>;
  onApprove: (payload: { itemId: string; threadPhase: ThreadPhase }) => Promise<void>;
  onReject: (payload: { itemId: string; note?: string }) => Promise<void>;
}

export function SuggestionDrawer({
  item,
  submitting,
  selectedPhase,
  onChangePhase,
  onSuggest,
  onApprove,
  onReject,
}: SuggestionDrawerProps) {
  const { cats } = useCatData();
  const catOptions = useMemo(
    () =>
      cats.map((cat) => ({
        id: cat.id,
        label: !cat.variantLabel && cat.nickname
          ? `${formatCatName(cat)}（${cat.nickname}）`
          : formatCatName(cat),
      })),
    [cats],
  );

  const [catId, setCatId] = useState('');
  const [why, setWhy] = useState('');
  const [plan, setPlan] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    if (catOptions.length === 0) {
      if (catId) setCatId('');
      return;
    }
    if (!catId || !catOptions.some((option) => option.id === catId)) {
      setCatId(catOptions[0].id);
    }
  }, [catOptions, catId]);

  const statusLabel = useMemo(() => {
    if (!item) return '未选择任务';
    if (item.status === 'open') return '待建议领取';
    if (item.status === 'suggested') return '等待铲屎官决策';
    if (item.status === 'dispatched') return '已派发';
    return '已批准';
  }, [item]);

  if (!item) {
    return (
      <aside className="rounded-2xl border border-[#E6DAC8] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#2A2017]">Suggestion Detail</h2>
        <p className="text-xs text-[#7C6A58]">点击左侧卡片查看详情并执行建议领取/批准流程。</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-[#E6DAC8] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#2A2017]">Suggestion Detail</h2>
      <p className="mt-1 text-xs text-[#7C6A58]">状态：{statusLabel}</p>
      <h3 className="mt-3 text-sm font-semibold text-[#34281D]">{item.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#6F5E4D]">{item.summary}</p>

      {item.status === 'open' && (
        <SuggestionOpenForm
          itemId={item.id}
          catOptions={catOptions}
          catId={catId}
          why={why}
          plan={plan}
          selectedPhase={selectedPhase}
          submitting={submitting}
          onCatIdChange={setCatId}
          onWhyChange={setWhy}
          onPlanChange={setPlan}
          onSubmit={async (payload) => {
            await onSuggest(payload);
            setWhy('');
            setPlan('');
          }}
        />
      )}

      {(item.status === 'suggested' || item.status === 'approved') && (
        <SuggestionDecisionPanel
          item={item}
          selectedPhase={selectedPhase}
          rejectNote={rejectNote}
          submitting={submitting}
          onChangePhase={onChangePhase}
          onChangeRejectNote={setRejectNote}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      {item.status === 'dispatched' && (
        <div className="mt-4 rounded-lg bg-[#EEF6FF] p-3 text-xs text-[#2F4D69]">
          <p>已派发到 Thread：{item.dispatchedThreadId}</p>
          <p>Phase：{item.dispatchedThreadPhase}</p>
          {item.dispatchedThreadId && (
            <Link
              href={`/thread/${item.dispatchedThreadId}`}
              className="mt-2 inline-flex rounded bg-[#1F1A16] px-2 py-1 text-[11px] font-semibold text-white"
              data-testid="mc-open-thread-link"
            >
              打开执行 Thread
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
