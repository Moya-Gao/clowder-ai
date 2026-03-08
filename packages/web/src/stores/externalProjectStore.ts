import { create } from 'zustand';
import type { ExternalProject, IntentCard, NeedAuditFrame } from '@cat-cafe/shared';

interface ExternalProjectState {
  projects: ExternalProject[];
  activeProjectId: string | null;
  intentCards: IntentCard[];
  auditFrame: NeedAuditFrame | null;
  loading: boolean;
  error: string | null;
  setProjects: (projects: ExternalProject[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setIntentCards: (cards: IntentCard[]) => void;
  setAuditFrame: (frame: NeedAuditFrame | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useExternalProjectStore = create<ExternalProjectState>((set) => ({
  projects: [],
  activeProjectId: null,
  intentCards: [],
  auditFrame: null,
  loading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setIntentCards: (intentCards) => set({ intentCards }),
  setAuditFrame: (auditFrame) => set({ auditFrame }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
