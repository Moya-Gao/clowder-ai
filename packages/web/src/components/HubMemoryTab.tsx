'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { apiFetch } from '@/utils/api-client';
import { type IndexStatusData, parseIndexStatus } from './memory/IndexStatus';

/**
 * F102 Phase J (AC-J7): Memory status tab in Hub Group 3 (监控与治理).
 * Shows index health summary + "打开 Memory" jump button.
 */
export function HubMemoryTab() {
  const router = useRouter();
  const currentThreadId = useChatStore((s) => s.currentThreadId);
  const [status, setStatus] = useState<IndexStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/evidence/status');
      const raw = (await res.json()) as Parameters<typeof parseIndexStatus>[0];
      setStatus(parseIndexStatus(raw));
      setError(null);
    } catch {
      setError('无法获取索引状态');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const openMemory = () => {
    const fromParam = currentThreadId ? `?from=${encodeURIComponent(currentThreadId)}` : '';
    router.push(`/memory${fromParam}`);
  };

  return (
    <div className="space-y-4" data-testid="hub-memory-tab">
      <h3 className="text-sm font-semibold text-cafe-black">记忆索引状态</h3>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {status && (
        <div className="rounded-lg border border-cafe bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm font-medium text-cafe-black">{status.healthy ? 'Healthy' : 'Unhealthy'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-cafe-secondary">Documents</div>
            <div className="font-medium text-cafe-black">{status.docsCount}</div>
            <div className="text-cafe-secondary">Edges</div>
            <div className="font-medium text-cafe-black">{status.edgesCount}</div>
            <div className="text-cafe-secondary">Last rebuild</div>
            <div className="font-medium text-cafe-black">
              {status.lastRebuildAt ? new Date(status.lastRebuildAt).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      )}

      {!status && !error && <p className="text-xs text-cafe-secondary">Loading...</p>}

      <button
        type="button"
        onClick={openMemory}
        className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
        data-testid="hub-memory-open"
      >
        打开 Memory Hub
      </button>
    </div>
  );
}
