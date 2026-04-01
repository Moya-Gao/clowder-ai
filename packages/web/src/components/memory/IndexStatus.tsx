'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

interface RawStatusResponse {
  backend: string;
  healthy: boolean;
  docs_count?: number;
  edges_count?: number;
  last_rebuild_at?: string | null;
  reason?: string;
}

export interface IndexStatusData {
  backend: string;
  healthy: boolean;
  docsCount: number;
  edgesCount: number;
  lastRebuildAt: string | null;
  reason?: string;
}

/**
 * Pure: parse raw API response into normalized status data.
 */
export function parseIndexStatus(raw: RawStatusResponse): IndexStatusData {
  return {
    backend: raw.backend,
    healthy: raw.healthy,
    docsCount: raw.docs_count ?? 0,
    edgesCount: raw.edges_count ?? 0,
    lastRebuildAt: raw.last_rebuild_at ?? null,
    reason: raw.reason,
  };
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-cafe/50 py-2 last:border-b-0">
      <span className="text-xs text-cafe-secondary">{label}</span>
      <span className="text-sm font-medium text-cafe-black">{value}</span>
    </div>
  );
}

export function IndexStatus() {
  const [status, setStatus] = useState<IndexStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/evidence/status');
      const raw = (await res.json()) as RawStatusResponse;
      setStatus(parseIndexStatus(raw));
      setError(null);
    } catch {
      setError('Failed to fetch index status');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (error) {
    return (
      <div data-testid="index-status" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={fetchStatus} className="mt-2 text-xs text-red-700 underline">
          重试
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div data-testid="index-status" className="p-4">
        <p className="text-sm text-cafe-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div data-testid="index-status" className="space-y-4">
      {/* Health badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${status.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-cafe-black">{status.healthy ? 'Healthy' : 'Unhealthy'}</span>
        {status.reason && <span className="text-xs text-cafe-secondary">({status.reason})</span>}
      </div>

      {/* Stats */}
      <div className="rounded-lg border border-cafe bg-white p-3">
        <StatusRow label="Backend" value={status.backend} />
        <StatusRow label="Documents" value={status.docsCount} />
        <StatusRow label="Edges (relations)" value={status.edgesCount} />
        <StatusRow
          label="Last rebuild"
          value={status.lastRebuildAt ? new Date(status.lastRebuildAt).toLocaleString() : 'Never'}
        />
      </div>

      {/* Refresh button */}
      <button
        type="button"
        onClick={fetchStatus}
        className="rounded-lg border border-cafe bg-white px-3 py-1.5 text-xs text-cafe-secondary transition-colors hover:bg-cafe-surface"
      >
        刷新状态
      </button>
    </div>
  );
}
