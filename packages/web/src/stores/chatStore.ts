import { create } from 'zustand';
import type {
  ChatMessage, Thread, CatInvocationInfo, CatStatusType,
  ModeState, ModeSwitchProposal, ToolEvent, ThreadState, TokenUsage,
} from './chat-types';
import { DEFAULT_THREAD_STATE } from './chat-types';

// Re-export types so existing consumers keep working with `import { ... } from '@/stores/chatStore'`
export type {
  TextContent, ImageContent, MessageContent, ChatMessageMetadata, TokenUsage,
  EvidenceResultData, EvidenceData, ToolEvent,
  ChatMessage, Thread, CatInvocationInfo, CatStatusType,
  ModeState, ModeSwitchProposal, ThreadState,
} from './chat-types';
export { DEFAULT_THREAD_STATE } from './chat-types';

// ── Helpers ──

/** Snapshot the flat active-thread fields into a ThreadState object */
function snapshotActive(s: ChatState): ThreadState {
  return {
    messages: s.messages,
    isLoading: s.isLoading,
    isLoadingHistory: s.isLoadingHistory,
    hasMore: s.hasMore,
    hasActiveInvocation: s.hasActiveInvocation,
    intentMode: s.intentMode,
    targetCats: s.targetCats,
    catStatuses: s.catStatuses,
    catInvocations: s.catInvocations,
    currentMode: s.currentMode,
    pendingModeSwitchProposal: s.pendingModeSwitchProposal,
    unreadCount: 0, // active thread always 0
    lastActivity: Date.now(),
  };
}

/** Flatten a ThreadState into partial ChatState fields */
function flattenThread(ts: ThreadState): Partial<ChatState> {
  return {
    messages: ts.messages,
    isLoading: ts.isLoading,
    isLoadingHistory: ts.isLoadingHistory,
    hasMore: ts.hasMore,
    hasActiveInvocation: ts.hasActiveInvocation,
    intentMode: ts.intentMode,
    targetCats: ts.targetCats,
    catStatuses: ts.catStatuses,
    catInvocations: ts.catInvocations,
    currentMode: ts.currentMode,
    pendingModeSwitchProposal: ts.pendingModeSwitchProposal,
  };
}

const MAX_BLOB_MESSAGES = 200;

function revokeBlobUrls(messages: ChatMessage[]) {
  for (const msg of messages) {
    if (msg.contentBlocks) {
      for (const block of msg.contentBlocks) {
        if (block.type === 'image' && block.url.startsWith('blob:')) {
          URL.revokeObjectURL(block.url);
        }
      }
    }
  }
}

// ── Store interface ──

interface ChatState {
  // Per-thread state (flat — reflects the active thread for backward compat)
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  hasMore: boolean;
  /** Whether the thread has an active invocation (broader than isLoading — stays true during A2A chains) */
  hasActiveInvocation: boolean;
  intentMode: 'execute' | 'ideate' | null;
  targetCats: string[];
  catStatuses: Record<string, CatStatusType>;
  catInvocations: Record<string, CatInvocationInfo>;
  currentMode: ModeState | null;
  pendingModeSwitchProposal: ModeSwitchProposal | null;

  // Multi-thread state map (preserves per-thread state across switches)
  threadStates: Record<string, ThreadState>;

  // Multi-thread UI
  viewMode: 'single' | 'split';
  splitPaneThreadIds: string[];
  splitPaneTargetId: string | null;

  // Global state
  currentThreadId: string;
  currentProjectPath: string;
  threads: Thread[];
  isLoadingThreads: boolean;

  // ── Active-thread actions (operate on flat state) ──
  addMessage: (msg: ChatMessage) => void;
  removeMessage: (id: string) => void;
  prependHistory: (msgs: ChatMessage[], hasMore: boolean) => void;
  appendToLastMessage: (content: string) => void;
  appendToMessage: (id: string, content: string) => void;
  appendToolEvent: (id: string, event: ToolEvent) => void;
  setStreaming: (id: string, streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setHasActiveInvocation: (v: boolean) => void;
  setLoadingHistory: (loading: boolean) => void;
  setIntentMode: (mode: 'execute' | 'ideate' | null) => void;
  setTargetCats: (cats: string[]) => void;
  setCatStatus: (catId: string, status: CatStatusType) => void;
  clearCatStatuses: () => void;
  setCatInvocation: (catId: string, info: Partial<CatInvocationInfo>) => void;
  setMessageUsage: (messageId: string, usage: TokenUsage) => void;
  clearMessages: () => void;
  setCurrentMode: (mode: ModeState | null) => void;
  setPendingModeSwitchProposal: (proposal: ModeSwitchProposal | null) => void;

  // ── Thread management ──
  setThreads: (threads: Thread[]) => void;
  setCurrentThread: (threadId: string) => void;
  setCurrentProject: (projectPath: string) => void;
  setLoadingThreads: (loading: boolean) => void;
  updateThreadTitle: (threadId: string, title: string) => void;

  // ── Multi-thread actions (new) ──
  addMessageToThread: (threadId: string, msg: ChatMessage) => void;
  getThreadState: (threadId: string) => ThreadState;
  incrementUnread: (threadId: string) => void;
  clearUnread: (threadId: string) => void;
  updateThreadCatStatus: (threadId: string, catId: string, status: CatStatusType) => void;
  setViewMode: (mode: 'single' | 'split') => void;
  setSplitPaneThreadIds: (ids: string[]) => void;
  setSplitPaneTarget: (threadId: string | null) => void;

  /** Clear hasActiveInvocation for a specific thread (active or background) */
  clearThreadActiveInvocation: (threadId: string) => void;

  // ── Hub modal (F12) ──
  hubState: { open: boolean; tab: string } | null;
  openHub: (tab: string) => void;
  closeHub: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isLoadingHistory: false,
  hasMore: true,
  hasActiveInvocation: false,
  intentMode: null,
  targetCats: [],
  catStatuses: {},
  catInvocations: {},
  currentMode: null,
  pendingModeSwitchProposal: null,

  threadStates: {},
  viewMode: 'single',
  splitPaneThreadIds: [],
  splitPaneTargetId: null,

  currentThreadId: 'default',
  currentProjectPath: 'default',
  threads: [],
  isLoadingThreads: false,

  hubState: null,
  openHub: (tab) => set({ hubState: { open: true, tab } }),
  closeHub: () => set({ hubState: null }),

  // ── Active-thread actions ──

  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state;
      const messages = [...state.messages, msg];
      if (messages.length > MAX_BLOB_MESSAGES) {
        revokeBlobUrls(messages.slice(0, messages.length - MAX_BLOB_MESSAGES));
      }
      return { messages };
    }),

  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  prependHistory: (msgs, hasMore) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
      return { messages: [...newMsgs, ...state.messages], hasMore };
    }),

  appendToLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.type === 'assistant') {
        messages[messages.length - 1] = { ...last, content: last.content + content };
      }
      return { messages };
    }),

  appendToMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + content } : m
      ),
    })),

  appendToolEvent: (id, event) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] } : m
      ),
    })),

  setStreaming: (id, streaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: streaming } : m
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setHasActiveInvocation: (v) => set({ hasActiveInvocation: v }),
  setLoadingHistory: (loading) => set({ isLoadingHistory: loading }),
  setIntentMode: (mode) => set({ intentMode: mode }),

  setTargetCats: (cats) =>
    set({ targetCats: cats, catStatuses: Object.fromEntries(cats.map((c) => [c, 'pending' as const])) }),

  setCatStatus: (catId, status) =>
    set((state) => ({ catStatuses: { ...state.catStatuses, [catId]: status } })),

  clearCatStatuses: () => set({ targetCats: [], catStatuses: {} }),

  setCatInvocation: (catId, info) =>
    set((state) => ({
      catInvocations: {
        ...state.catInvocations,
        [catId]: { ...state.catInvocations[catId], ...info },
      },
    })),

  setMessageUsage: (messageId, usage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.metadata
          ? { ...m, metadata: { ...m.metadata, usage } }
          : m
      ),
    })),

  clearMessages: () =>
    set((state) => {
      revokeBlobUrls(state.messages);
      return { messages: [], hasMore: true };
    }),

  setCurrentMode: (mode) => set({ currentMode: mode }),
  setPendingModeSwitchProposal: (proposal) => set({ pendingModeSwitchProposal: proposal }),

  // ── Thread management ──

  setThreads: (threads) => set({ threads }),
  setCurrentProject: (projectPath) => set({ currentProjectPath: projectPath }),
  setLoadingThreads: (loading) => set({ isLoadingThreads: loading }),

  updateThreadTitle: (threadId, title) =>
    set((state) => ({
      threads: state.threads.map((t) => (t.id === threadId ? { ...t, title } : t)),
    })),

  /**
   * Switch active thread.
   * Saves current flat state into threadStates map, then restores the target thread's state.
   * This is the key mechanism that preserves per-thread state across switches.
   */
  setCurrentThread: (threadId) =>
    set((state) => {
      if (threadId === state.currentThreadId) return state;

      // Save current flat state to map
      const saved = snapshotActive(state);
      // Load target thread state (or defaults for first visit)
      const loaded = state.threadStates[threadId] ?? { ...DEFAULT_THREAD_STATE };

      return {
        currentThreadId: threadId,
        threadStates: {
          ...state.threadStates,
          [state.currentThreadId]: saved,
        },
        ...flattenThread(loaded),
      };
    }),

  // ── Multi-thread actions ──

  /** Add a message to a specific thread (for background thread socket updates) */
  addMessageToThread: (threadId, msg) =>
    set((state) => {
      // Active thread — delegate to flat state
      if (threadId === state.currentThreadId) {
        if (state.messages.some((m) => m.id === msg.id)) return state;
        const messages = [...state.messages, msg];
        if (messages.length > MAX_BLOB_MESSAGES) {
          revokeBlobUrls(messages.slice(0, messages.length - MAX_BLOB_MESSAGES));
        }
        return { messages };
      }

      // Background thread — update map + increment unread
      const existing = state.threadStates[threadId] ?? { ...DEFAULT_THREAD_STATE };
      if (existing.messages.some((m) => m.id === msg.id)) return state;

      return {
        threadStates: {
          ...state.threadStates,
          [threadId]: {
            ...existing,
            messages: [...existing.messages, msg],
            unreadCount: existing.unreadCount + 1,
            lastActivity: Date.now(),
          },
        },
      };
    }),

  /** Get a thread's state (active thread returns flat state, others return map) */
  getThreadState: (threadId) => {
    const state = get();
    if (threadId === state.currentThreadId) return snapshotActive(state);
    return state.threadStates[threadId] ?? { ...DEFAULT_THREAD_STATE };
  },

  incrementUnread: (threadId) =>
    set((state) => {
      if (threadId === state.currentThreadId) return state;
      const ts = state.threadStates[threadId];
      if (!ts) return state;
      return {
        threadStates: {
          ...state.threadStates,
          [threadId]: { ...ts, unreadCount: ts.unreadCount + 1 },
        },
      };
    }),

  clearUnread: (threadId) =>
    set((state) => {
      const ts = state.threadStates[threadId];
      if (!ts || ts.unreadCount === 0) return state;
      return {
        threadStates: {
          ...state.threadStates,
          [threadId]: { ...ts, unreadCount: 0 },
        },
      };
    }),

  /** Update a specific cat's status in a background thread (for sidebar indicators) */
  updateThreadCatStatus: (threadId, catId, status) =>
    set((state) => {
      // Active thread — update flat catStatuses directly
      if (threadId === state.currentThreadId) {
        return { catStatuses: { ...state.catStatuses, [catId]: status } };
      }
      // Background thread — update in map
      const existing = state.threadStates[threadId] ?? { ...DEFAULT_THREAD_STATE };
      return {
        threadStates: {
          ...state.threadStates,
          [threadId]: {
            ...existing,
            catStatuses: { ...existing.catStatuses, [catId]: status },
            lastActivity: Date.now(),
          },
        },
      };
    }),

  /** Clear hasActiveInvocation for a specific thread (active or background) */
  clearThreadActiveInvocation: (threadId) =>
    set((state) => {
      // Active thread — clear flat state
      if (threadId === state.currentThreadId) {
        return { hasActiveInvocation: false };
      }
      // Background thread — update in threadStates map (no-op if unknown)
      const ts = state.threadStates[threadId];
      if (!ts) return state;
      return {
        threadStates: {
          ...state.threadStates,
          [threadId]: { ...ts, hasActiveInvocation: false },
        },
      };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSplitPaneThreadIds: (ids) => set({ splitPaneThreadIds: ids }),
  setSplitPaneTarget: (threadId) => set({ splitPaneTargetId: threadId }),
}));
