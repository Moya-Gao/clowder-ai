'use client';

/**
 * F246: Approval Hub Zustand store.
 *
 * Manages pending approval items across features (F128 thread proposals,
 * F225 session handoff proposals, F193 dispatch proposals). Fetches from
 * the aggregation endpoint and re-fetches on proposal_updated /
 * proposal_created socket events (dispatched as CustomEvents by useSocket).
 *
 * Phase B: approve/reject actions for inlineApprovable items (F193).
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
  /** Map of proposalId → 'approving' | 'rejecting' for optimistic UI feedback */
  deciding: Record<string, 'approving' | 'rejecting'>;
  fetchPending: () => Promise<void>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** F246 Phase B: approve an inlineApprovable dispatch proposal */
  approveProposal: (proposalId: string) => Promise<void>;
  /** F246 Phase B: reject an inlineApprovable dispatch proposal */
  rejectProposal: (proposalId: string) => Promise<void>;
}

export const useApprovalHubStore = create<ApprovalHubState>((set, get) => ({
  items: [],
  count: 0,
  isLoading: false,
  isOpen: false,
  error: null,
  deciding: {},

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

  approveProposal: async (proposalId: string) => {
    set((s) => ({ deciding: { ...s.deciding, [proposalId]: 'approving' as const } }));
    try {
      const res = await apiFetch(`/api/dispatch-proposals/${proposalId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Approve failed: ${res.status}`);
      }
      // Optimistic remove from items list
      set((s) => ({
        items: s.items.filter((i) => i.proposalId !== proposalId),
        count: Math.max(0, s.count - 1),
        deciding: { ...s.deciding, [proposalId]: undefined as never },
      }));
    } catch (err) {
      set((s) => ({
        error: err instanceof Error ? err.message : 'Approve failed',
        deciding: { ...s.deciding, [proposalId]: undefined as never },
      }));
    }
  },

  rejectProposal: async (proposalId: string) => {
    set((s) => ({ deciding: { ...s.deciding, [proposalId]: 'rejecting' as const } }));
    try {
      const res = await apiFetch(`/api/dispatch-proposals/${proposalId}/reject`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Reject failed: ${res.status}`);
      }
      // Optimistic remove from items list
      set((s) => ({
        items: s.items.filter((i) => i.proposalId !== proposalId),
        count: Math.max(0, s.count - 1),
        deciding: { ...s.deciding, [proposalId]: undefined as never },
      }));
    } catch (err) {
      set((s) => ({
        error: err instanceof Error ? err.message : 'Reject failed',
        deciding: { ...s.deciding, [proposalId]: undefined as never },
      }));
    }
  },
}));
