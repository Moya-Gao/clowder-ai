'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useBrakeStore } from '@/stores/brakeStore';

export function BrakeSettingsPanel() {
  const { settingsEnabled, settingsThreshold, settingsLoading, loadSettings, saveSettings } = useBrakeStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = useCallback(() => {
    saveSettings({ enabled: !settingsEnabled });
  }, [settingsEnabled, saveSettings]);

  const handleThresholdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      // Optimistic UI update via store
      useBrakeStore.setState({ settingsThreshold: value });
      // Debounce API save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveSettings({ thresholdMinutes: value });
      }, 500);
    },
    [saveSettings],
  );

  if (settingsLoading) {
    return <p className="text-sm text-gray-500 py-4">加载中…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">🐾 健康守护</h3>
        <p className="text-sm text-gray-500 mt-1">三猫会在你连续工作一段时间后提醒你休息</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">启用健康守护</span>
          <button
            type="button"
            role="switch"
            aria-checked={settingsEnabled}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              settingsEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                settingsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Threshold slider */}
        <div className={settingsEnabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">提醒间隔</span>
            <span className="text-sm font-mono font-semibold text-gray-900">{settingsThreshold} 分钟</span>
          </div>
          <input
            type="range"
            min={30}
            max={240}
            step={15}
            value={settingsThreshold}
            onChange={handleThresholdChange}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>30 min</span>
            <span>240 min</span>
          </div>
        </div>

        {/* Night mode info */}
        <div className="rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2">
          <p className="text-xs text-indigo-600">💡 夜间模式 (23:00–06:00) 自动启用 — 提醒更温柔，配色更柔和</p>
        </div>
      </div>
    </div>
  );
}
