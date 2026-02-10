'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/utils/api-client';

export interface AuthPendingRequest {
  requestId: string;
  catId: string;
  threadId: string;
  action: string;
  reason: string;
  context?: string;
  createdAt: number;
}

export type RespondScope = 'once' | 'thread' | 'global';

export function useAuthorization(threadId: string) {
  const [pending, setPending] = useState<AuthPendingRequest[]>([]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/authorization/pending?threadId=${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setPending(data.pending ?? []);
      }
    } catch {
      // Best-effort — don't crash on network error
    }
  }, [threadId]);

  // Fetch on mount and thread change
  useEffect(() => {
    void fetchPending();
  }, [fetchPending]);

  const respond = useCallback(async (
    requestId: string,
    granted: boolean,
    scope: RespondScope,
    reason?: string,
  ) => {
    try {
      const res = await apiFetch('/api/authorization/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, granted, scope, ...(reason ? { reason } : {}) }),
      });
      if (res.ok) {
        // Optimistically remove from local list
        setPending((prev) => prev.filter((r) => r.requestId !== requestId));
      }
    } catch {
      // Best-effort
    }
  }, []);

  // Socket event: new authorization request
  const handleAuthRequest = useCallback((data: AuthPendingRequest) => {
    setPending((prev) => {
      if (prev.some((r) => r.requestId === data.requestId)) return prev;
      return [...prev, data];
    });
  }, []);

  // Socket event: authorization resolved (by another client or tab)
  const handleAuthResponse = useCallback((data: { requestId: string }) => {
    setPending((prev) => prev.filter((r) => r.requestId !== data.requestId));
  }, []);

  return { pending, respond, handleAuthRequest, handleAuthResponse, fetchPending };
}
