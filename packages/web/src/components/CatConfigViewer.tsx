'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { CatTab, SystemTab, type ConfigData, type Capabilities } from './config-viewer-tabs';

interface CatConfigViewerProps {
  open: boolean;
  onClose: () => void;
}

type TabId = 'opus' | 'codex' | 'gemini' | 'system';

const TABS: { id: TabId; label: string }[] = [
  { id: 'opus', label: '布偶猫' },
  { id: 'codex', label: '缅因猫' },
  { id: 'gemini', label: '暹罗猫' },
  { id: 'system', label: '系统配置' },
];

export function CatConfigViewer({ open, onClose }: CatConfigViewerProps) {
  const [tab, setTab] = useState<TabId>('opus');
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [caps, setCaps] = useState<Record<string, Capabilities> | null>(null);

  const fetchData = useCallback(async () => {
    const [configRes, capsRes] = await Promise.all([
      apiFetch('/api/config'),
      apiFetch('/api/capabilities'),
    ]);
    if (configRes.ok) {
      const d = await configRes.json() as { config: ConfigData };
      setConfig(d.config);
    }
    if (capsRes.ok) {
      setCaps(await capsRes.json() as Record<string, Capabilities>);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const catId = tab !== 'system' ? tab : null;
  const cat = catId && config?.cats[catId];
  const budget = catId && config?.perCatBudgets[catId];
  const catCaps = catId && caps?.[catId];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-bold">猫猫配置查看器</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        <div className="flex border-b border-gray-200 px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!config ? (
            <p className="text-sm text-gray-400">加载中...</p>
          ) : catId && cat && budget ? (
            <CatTab cat={cat} budget={budget} caps={catCaps ?? undefined} />
          ) : tab === 'system' && config ? (
            <SystemTab config={config} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
