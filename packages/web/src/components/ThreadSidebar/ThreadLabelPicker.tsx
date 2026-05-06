'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ThreadLabel, useLabelStore } from '@/stores/label-store';

interface ThreadLabelPickerProps {
  threadId: string;
  currentLabels: string[];
  onSave: (threadId: string, labels: string[]) => void | Promise<void>;
}

export function ThreadLabelPicker({ threadId, currentLabels, onSave }: ThreadLabelPickerProps) {
  const { labels, fetchLabels, createLabel } = useLabelStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentLabels);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#5B8C5A');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setSelected(currentLabels);
  }, [currentLabels, isOpen]);

  useEffect(() => {
    if (isOpen && labels.length === 0) void fetchLabels();
  }, [isOpen, labels.length, fetchLabels]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelected(currentLabels);
        setShowCreate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, currentLabels]);

  const toggleLabel = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }, []);

  const [saveError, setSaveError] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(false);
    try {
      await onSave(threadId, selected);
      setIsOpen(false);
    } catch {
      setSaveError(true);
      setSelected(currentLabels);
    } finally {
      setIsSaving(false);
    }
  }, [threadId, selected, onSave, currentLabels]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const label = await createLabel(newName.trim(), newColor);
    if (label) {
      setSelected((prev) => [...prev, label.id]);
      setShowCreate(false);
      setNewName('');
    }
  }, [newName, newColor, createLabel]);

  const hasChanged = JSON.stringify([...selected].sort()) !== JSON.stringify([...currentLabels].sort());

  const getPopoverStyle = (): React.CSSProperties => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 240;
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - width),
      width,
    };
  };

  return (
    <div ref={popoverRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-0.5 rounded transition-all ${
          currentLabels.length > 0
            ? 'text-cocreator-primary'
            : 'opacity-0 group-hover:opacity-100 text-cafe-muted hover:text-cocreator-primary'
        }`}
        title="标签管理"
      >
        <LabelIcon />
      </button>
      {isOpen && (
        <div
          style={getPopoverStyle()}
          className="bg-cafe-surface rounded-lg shadow-lg border border-cafe z-50 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 overflow-y-auto max-h-[50vh]">
            {labels.length === 0 && !showCreate ? (
              <p className="text-xs text-cafe-muted text-center py-2">还没有标签</p>
            ) : (
              <div className="flex flex-col gap-1">
                {labels.map((label) => (
                  <LabelCheckbox
                    key={label.id}
                    label={label}
                    checked={selected.includes(label.id)}
                    onChange={() => toggleLabel(label.id)}
                  />
                ))}
              </div>
            )}
            {showCreate ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-6 h-6 rounded border-0 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="标签名称"
                    maxLength={20}
                    className="flex-1 text-xs px-1.5 py-1 rounded border border-cafe-subtle focus:outline-none focus:border-cocreator-primary bg-cafe-surface"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreate();
                      if (e.key === 'Escape') setShowCreate(false);
                    }}
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-[10px] px-1.5 py-0.5 text-cafe-muted hover:text-cafe-secondary"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleCreate()}
                    disabled={!newName.trim()}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-cocreator-primary text-white disabled:opacity-40"
                  >
                    创建
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 text-[10px] text-cocreator-primary hover:underline w-full text-left"
              >
                + 新建标签
              </button>
            )}
          </div>
          {saveError && <p className="text-[10px] text-red-500 px-3 mt-1">保存失败，请重试</p>}
          <div className="flex items-center justify-between px-3 pb-3 pt-2 border-t border-cafe-subtle flex-shrink-0">
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-[10px] text-cafe-muted hover:text-red-400">
                清除
              </button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelected(currentLabels);
                  setShowCreate(false);
                }}
                className="text-xs px-2 py-0.5 rounded text-cafe-secondary hover:bg-cafe-surface-elevated"
              >
                取消
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!hasChanged || isSaving}
                className="text-xs px-2 py-0.5 rounded bg-cocreator-primary text-white hover:bg-cocreator-dark disabled:opacity-40"
              >
                {isSaving ? '...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabelCheckbox({ label, checked, onChange }: { label: ThreadLabel; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-cafe-surface-elevated cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded accent-cocreator-primary" />
      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
      <span className="text-xs text-cafe-secondary truncate">{label.name}</span>
    </label>
  );
}

function LabelIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2.5 1A1.5 1.5 0 001 2.5v4.586a1.5 1.5 0 00.44 1.06l6.414 6.414a1.5 1.5 0 002.122 0l4.586-4.586a1.5 1.5 0 000-2.122L8.148 1.44A1.5 1.5 0 007.086 1H2.5zM5 4a1 1 0 11-2 0 1 1 0 012 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
