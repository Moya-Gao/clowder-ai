'use client';

/**
 * F246: Approval Hub Zustand store.
 *
 * Manages pending approval items across features (F128 thread proposals,
 * F225 session handoff proposals). Fetches from the aggregation endpoint
 * and re-fetches on proposal_updated / proposal_created socket events
 * (dispatched as CustomEvents by useSocket).
 */

import type { ApprovalItem } from '@cat-cafe/shared';
import { create } from 'zustand';
import { apiFetch } from '@/utils/api-client';

interface ApprovalHubState {
  items: ApprovalItem[];
  count: number;
  isLoading: boolean;
  isOpen: boolean;
  error: string | null;
  fetchPending: () => Promise<void>;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useApprovalHubStore = create<ApprovalHubState>((set, get) => ({
  items: [],
  count: 0,
  isLoading: false,
  isOpen: false,
  error: null,

  fetchPending: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/approval-hub/pending');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = (await res.json()) as { items: ApprovalItem[]; count: number };
      set({ items: data.items, count: data.count, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  open: () => {
    set({ isOpen: true });
    // Refresh on open to ensure fresh data
    get().fetchPending();
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const wasOpen = get().isOpen;
    set({ isOpen: !wasOpen });
    if (!wasOpen) get().fetchPending();
  },
}));
