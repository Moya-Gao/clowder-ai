import { create } from 'zustand';
import type { DispatchExecutionDigest, ExternalProject, IntentCard, NeedAuditFrame } from '@cat-cafe/shared';

interface ExternalProjectState {
  projects: ExternalProject[];
  activeProjectId: string | null;
  intentCards: IntentCard[];
  auditFrame: NeedAuditFrame | null;
  executionDigests: DispatchExecutionDigest[];
  loading: boolean;
  error: string | null;
  setProjects: (projects: ExternalProject[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setIntentCards: (cards: IntentCard[]) => void;
  setAuditFrame: (frame: NeedAuditFrame | null) => void;
  setExecutionDigests: (digests: DispatchExecutionDigest[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useExternalProjectStore = create<ExternalProjectState>((set) => ({
  projects: [],
  activeProjectId: null,
  intentCards: [],
  auditFrame: null,
  executionDigests: [],
  loading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setIntentCards: (intentCards) => set({ intentCards }),
  setAuditFrame: (auditFrame) => set({ auditFrame }),
  setExecutionDigests: (executionDigests) => set({ executionDigests }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
