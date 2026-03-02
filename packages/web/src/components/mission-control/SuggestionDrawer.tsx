'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BacklogItem, ThreadPhase } from '@cat-cafe/shared';
import { formatCatName, useCatData } from '@/hooks/useCatData';

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

  const [catId, setCatId] = useState(catOptions[0]?.id ?? 'codex');
  const [why, setWhy] = useState('');
  const [plan, setPlan] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    if (catOptions.length === 0) return;
    if (catOptions.some((option) => option.id === catId)) return;
    setCatId(catOptions[0].id);
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
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!why.trim() || !plan.trim()) return;
            void onSuggest({
              itemId: item.id,
              catId,
              why: why.trim(),
              plan: plan.trim(),
              requestedPhase: selectedPhase,
            }).then(() => {
              setWhy('');
              setPlan('');
            });
          }}
        >
          <label className="block text-[11px] font-medium text-[#5E4C3A]">
            建议领取猫猫
            <select
              value={catId}
              onChange={(event) => setCatId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E6D7C3] px-2 py-1.5 text-xs text-[#2C241B]"
              data-testid="mc-suggest-cat"
            >
              {catOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-medium text-[#5E4C3A]">
            Why
            <textarea
              value={why}
              onChange={(event) => setWhy(event.target.value)}
              className="mt-1 h-16 w-full rounded-lg border border-[#E6D7C3] px-2 py-1.5 text-xs text-[#2C241B]"
              data-testid="mc-suggest-why"
            />
          </label>
          <label className="block text-[11px] font-medium text-[#5E4C3A]">
            Plan
            <textarea
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              className="mt-1 h-16 w-full rounded-lg border border-[#E6D7C3] px-2 py-1.5 text-xs text-[#2C241B]"
              data-testid="mc-suggest-plan"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1F1A16] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            data-testid="mc-suggest-submit"
          >
            提交建议领取
          </button>
        </form>
      )}

      {(item.status === 'suggested' || item.status === 'approved') && (
        <div className="mt-4 space-y-2">
          {item.status === 'approved' && (
            <p className="rounded-lg border border-[#D4C2AA] bg-[#FCF5E9] px-2 py-1.5 text-xs text-[#7A6146]">
              该任务已批准但尚未派发，可手动重试派发。
            </p>
          )}
          <div className="rounded-lg bg-[#F8F3EA] p-2 text-xs text-[#5F4D3C]">
            <p>建议猫猫：@{item.suggestion?.catId}</p>
            <p>Why：{item.suggestion?.why}</p>
            <p>Plan：{item.suggestion?.plan}</p>
          </div>
          <label className="block text-[11px] font-medium text-[#5E4C3A]">
            Dispatch Phase
            <select
              value={selectedPhase}
              onChange={(event) => onChangePhase(event.target.value as ThreadPhase)}
              className="mt-1 w-full rounded-lg border border-[#E6D7C3] px-2 py-1.5 text-xs text-[#2C241B]"
              data-testid="mc-approve-phase"
            >
              <option value="coding">coding</option>
              <option value="research">research</option>
              <option value="brainstorm">brainstorm</option>
            </select>
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onApprove({ itemId: item.id, threadPhase: selectedPhase })}
            className="w-full rounded-lg bg-[#1F1A16] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            data-testid="mc-approve-submit"
          >
            {item.status === 'approved' ? '重试派发' : '批准并派发'}
          </button>
          {item.status === 'suggested' && (
            <>
              <label className="block text-[11px] font-medium text-[#5E4C3A]">
                驳回备注（可选）
                <input
                  value={rejectNote}
                  onChange={(event) => setRejectNote(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E6D7C3] px-2 py-1.5 text-xs text-[#2C241B]"
                  data-testid="mc-reject-note"
                />
              </label>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onReject({ itemId: item.id, note: rejectNote.trim() || undefined })}
                className="w-full rounded-lg border border-[#C9B7A1] px-3 py-2 text-xs font-semibold text-[#6C563F] disabled:opacity-40"
                data-testid="mc-reject-submit"
              >
                拒绝并回到 Open
              </button>
            </>
          )}
        </div>
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
