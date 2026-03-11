'use client';

import { useCallback, useRef, useState } from 'react';
import type { InteractiveOption, RichInteractiveBlock } from '@/stores/chat-types';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { getUserId } from '@/utils/userId';

// ── Pure function (exported for testing) ────────────────────

export function buildSelectionMessage(
  interactiveType: string,
  options: Array<{ id: string; label: string; emoji?: string }>,
  selectedIds: string[],
  messageTemplate?: string,
  title?: string,
): string {
  if (interactiveType === 'confirm') {
    const action = selectedIds[0] === '__confirm__' ? '确认' : '取消';
    return title ? `${action} — ${title}` : action;
  }

  const selected = selectedIds.map((id) => options.find((o) => o.id === id)).filter(Boolean) as typeof options;
  const labels = selected.map((o) => (o.emoji ? `${o.emoji} ${o.label}` : o.label));

  if (messageTemplate) {
    return messageTemplate.replace('{selection}', labels.join(', '));
  }

  const base = `我选了：${labels.join(', ')}`;
  return title ? `${base}（${title}）` : base;
}

// ── Helpers ─────────────────────────────────────────────────

function patchBlockState(messageId: string, blockId: string, patch: { disabled?: boolean; selectedIds?: string[] }) {
  return apiFetch(`/api/messages/${messageId}/block-state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: getUserId(), blockId, ...patch }),
  });
}

function dispatchInteractiveSend(text: string) {
  window.dispatchEvent(new CustomEvent('cat-cafe:interactive-send', { detail: { text } }));
}

// ── Sub-components ──────────────────────────────────────────

function SelectInteraction({
  options,
  disabled,
  selectedIds,
  onSelect,
  hideSubmit,
}: {
  options: InteractiveOption[];
  disabled: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  hideSubmit?: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const highlightId = disabled ? selectedIds[0] ?? null : pendingId;

  const handleClick = (id: string) => {
    if (disabled) return;
    setPendingId(id);
    // In group mode, immediately notify parent of pending selection
    if (hideSubmit) onSelect([id]);
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isSelected = highlightId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(opt.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border-[1.5px] text-sm transition-all flex items-center gap-2.5
              ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                  : disabled
                    ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer'
              }`}
          >
            {opt.emoji && <span className="text-lg shrink-0">{opt.emoji}</span>}
            <div className="flex-1 min-w-0">
              <span className={`font-semibold ${isSelected ? 'text-purple-600 dark:text-purple-400' : ''}`}>{opt.label}</span>
              {opt.description && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</span>}
            </div>
            {isSelected && (
              <svg className="w-4.5 h-4.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
      {!disabled && !hideSubmit && pendingId && (
        <button
          type="button"
          onClick={() => onSelect([pendingId])}
          className="mt-2 w-full py-2.5 bg-purple-500 text-white rounded-full text-sm font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          确认选择
        </button>
      )}
    </div>
  );
}

function MultiSelectInteraction({
  options,
  disabled,
  selectedIds,
  maxSelect,
  onSelect,
  hideSubmit,
}: {
  options: InteractiveOption[];
  disabled: boolean;
  selectedIds: string[];
  maxSelect?: number;
  onSelect: (ids: string[]) => void;
  hideSubmit?: boolean;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    if (disabled) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (!maxSelect || next.size < maxSelect) {
        next.add(id);
      }
      // In group mode, notify parent of every change
      if (hideSubmit) onSelect([...next]);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isChecked = checked.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt.id)}
            className={`flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border-[1.5px] text-sm transition-all text-left
              ${
                isChecked
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                isChecked ? 'bg-purple-500' : 'border-[1.5px] border-gray-300 dark:border-gray-600'
              }`}
            >
              {isChecked && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {opt.emoji && <span className="text-base">{opt.emoji}</span>}
            <span className={`font-semibold ${isChecked ? 'text-purple-600 dark:text-purple-400' : ''}`}>{opt.label}</span>
          </button>
        );
      })}
      {!disabled && !hideSubmit && checked.size > 0 && (
        <button
          type="button"
          onClick={() => onSelect([...checked])}
          className="mt-2 w-full py-2.5 bg-purple-500 text-white rounded-full text-sm font-semibold hover:bg-purple-600 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          确认选择 ({checked.size})
        </button>
      )}
    </div>
  );
}

function CardGridInteraction({
  options,
  disabled,
  selectedIds,
  allowRandom,
  onSelect,
  pendingMode,
}: {
  options: InteractiveOption[];
  disabled: boolean;
  selectedIds: string[];
  allowRandom?: boolean;
  onSelect: (ids: string[]) => void;
  pendingMode?: boolean;
}) {
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const shuffling = useRef(false);

  const handleCardClick = (id: string) => {
    if (disabled || shuffling.current) return;
    if (pendingMode) {
      setPendingId(id);
      onSelect([id]);
    } else {
      onSelect([id]);
    }
  };

  const handleRandom = useCallback(() => {
    if (disabled || shuffling.current || options.length === 0) return;
    shuffling.current = true;

    const totalSteps = 12;
    let step = 0;

    const tick = () => {
      const idx = step % options.length;
      setHighlightId(options[idx]!.id);
      step++;
      if (step < totalSteps) {
        const delay = 50 + step * 25;
        setTimeout(tick, delay);
      } else {
        const finalIdx = Math.floor(Math.random() * options.length);
        const finalId = options[finalIdx]!.id;
        setHighlightId(finalId);
        shuffling.current = false;
        if (pendingMode) {
          setPendingId(finalId);
          setTimeout(() => onSelect([finalId]), 400);
        } else {
          setTimeout(() => onSelect([finalId]), 400);
        }
      }
    };
    tick();
  }, [disabled, options, onSelect, pendingMode]);

  // Group options by group field
  const groups = new Map<string, InteractiveOption[]>();
  for (const opt of options) {
    const g = opt.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(opt);
  }

  return (
    <div>
      {[...groups.entries()].map(([groupName, groupOpts]) => (
        <div key={groupName}>
          {groupName && <div className="text-xs text-gray-500 mb-1 mt-2 font-medium">{groupName}</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {groupOpts.map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              const isPending = pendingId === opt.id;
              const isHighlighted = highlightId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleCardClick(opt.id)}
                  className={`p-4 rounded-2xl border-[1.5px] text-center text-sm transition-all
                    ${
                      isSelected || isPending
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 ring-2 ring-purple-400/50'
                        : isHighlighted
                          ? 'border-purple-400 bg-purple-50/80 dark:bg-purple-950/20 scale-105'
                          : disabled
                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-purple-300 hover:shadow-sm cursor-pointer'
                    }`}
                >
                  {opt.emoji && <div className="text-2xl mb-1.5">{opt.emoji}</div>}
                  <div className={`font-semibold ${isSelected || isPending ? 'text-purple-600 dark:text-purple-400' : ''}`}>{opt.label}</div>
                  {opt.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</div>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {allowRandom && !disabled && (
        <button
          type="button"
          onClick={handleRandom}
          className="mt-2 px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
        >
          🎲 随机抽
        </button>
      )}
    </div>
  );
}

function ConfirmInteraction({
  options,
  disabled,
  selectedIds,
  onSelect,
  pendingMode,
}: {
  options: InteractiveOption[];
  disabled: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  pendingMode?: boolean;
}) {
  const confirmOpt = options.find((o) => o.id === '__confirm__') ?? { id: '__confirm__', label: '确认' };
  const cancelOpt = options.find((o) => o.id === '__cancel__') ?? { id: '__cancel__', label: '取消' };
  const [pendingId, setPendingId] = useState<string | null>(null);
  const selectedId = disabled ? selectedIds[0] : (pendingMode ? pendingId : selectedIds[0]);

  const handleClick = (id: string) => {
    if (disabled) return;
    if (pendingMode) {
      setPendingId(id);
      onSelect([id]);
    } else {
      onSelect([id]);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleClick('__cancel__')}
        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-[1.5px] flex items-center justify-center gap-1.5
          ${
            selectedId === '__cancel__'
              ? 'bg-red-50 dark:bg-red-950/30 border-red-400 text-red-600 dark:text-red-400'
              : disabled && selectedId
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 opacity-50 cursor-not-allowed'
                : disabled
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 hover:border-red-300 cursor-pointer'
          }`}
      >
        {selectedId !== '__cancel__' && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {cancelOpt.emoji && `${cancelOpt.emoji} `}
        {cancelOpt.label}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleClick('__confirm__')}
        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-[1.5px] flex items-center justify-center gap-1.5
          ${
            selectedId === '__confirm__'
              ? 'bg-green-50 dark:bg-green-950/30 border-green-500 text-green-600 dark:text-green-400'
              : disabled && selectedId
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 opacity-50 cursor-not-allowed'
                : disabled
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800 text-green-600 hover:bg-green-50 hover:border-green-300 cursor-pointer'
          }`}
      >
        {selectedId !== '__confirm__' && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {confirmOpt.emoji && `${confirmOpt.emoji} `}
        {confirmOpt.label}
      </button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export interface InteractiveBlockProps {
  block: RichInteractiveBlock;
  messageId?: string;
  /** Phase C: pending mode — selections don't auto-submit, parent handles it */
  pendingMode?: boolean;
  /** Phase C: called when pending selection changes in group mode */
  onPendingChange?: (selectedIds: string[]) => void;
  /** Phase C: externally controlled disabled (group submitted) */
  groupDisabled?: boolean;
  /** Phase C: externally controlled selectedIds (group submitted) */
  groupSelectedIds?: string[];
}

export function InteractiveBlock({ block, messageId, pendingMode, onPendingChange, groupDisabled, groupSelectedIds }: InteractiveBlockProps) {
  const [localDisabled, setLocalDisabled] = useState(block.disabled ?? false);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(block.selectedIds ?? []);
  const isDisabled = groupDisabled ?? localDisabled;
  const displaySelectedIds = groupSelectedIds ?? localSelectedIds;

  const handleSelect = useCallback(
    async (optionIds: string[]) => {
      if (isDisabled) return;

      // Phase C: in pending mode, just notify parent — don't submit or disable
      if (pendingMode && onPendingChange) {
        onPendingChange(optionIds);
        return;
      }

      setLocalDisabled(true);
      setLocalSelectedIds(optionIds);

      // Build and send message
      const text = buildSelectionMessage(block.interactiveType, block.options, optionIds, block.messageTemplate, block.title);
      dispatchInteractiveSend(text);

      // P2-1 fix: write back to store so re-mount/thread-switch preserves state
      if (messageId) {
        useChatStore.getState().updateRichBlock(messageId, block.id, { disabled: true, selectedIds: optionIds });
        // Persist to backend
        patchBlockState(messageId, block.id, { disabled: true, selectedIds: optionIds }).catch(() => {
          // Persistence failure is non-critical — local + store state already updated
        });
      }
    },
    [isDisabled, block, messageId, pendingMode, onPendingChange],
  );

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      {block.title && <div className="font-semibold text-sm mb-1">{block.title}</div>}
      {block.description && <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{block.description}</div>}
      {block.interactiveType === 'select' && (
        <SelectInteraction
          options={block.options}
          disabled={isDisabled}
          selectedIds={displaySelectedIds}
          onSelect={handleSelect}
          hideSubmit={pendingMode}
        />
      )}
      {block.interactiveType === 'multi-select' && (
        <MultiSelectInteraction
          options={block.options}
          disabled={isDisabled}
          selectedIds={displaySelectedIds}
          maxSelect={block.maxSelect}
          onSelect={handleSelect}
          hideSubmit={pendingMode}
        />
      )}
      {block.interactiveType === 'card-grid' && (
        <CardGridInteraction
          options={block.options}
          disabled={isDisabled}
          selectedIds={displaySelectedIds}
          allowRandom={block.allowRandom}
          onSelect={handleSelect}
          pendingMode={pendingMode}
        />
      )}
      {block.interactiveType === 'confirm' && (
        <ConfirmInteraction
          options={block.options}
          disabled={isDisabled}
          selectedIds={displaySelectedIds}
          onSelect={handleSelect}
          pendingMode={pendingMode}
        />
      )}
    </div>
  );
}
