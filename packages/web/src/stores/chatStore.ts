import { create } from 'zustand';

/** Content block types matching backend MessageContent */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
}

export type MessageContent = TextContent | ImageContent;

export interface ChatMessageMetadata {
  provider: string;
  model: string;
  sessionId?: string;
}

export interface EvidenceResultData {
  title: string;
  anchor: string;
  snippet: string;
  confidence: 'high' | 'mid' | 'low';
  sourceType: 'decision' | 'phase' | 'discussion' | 'commit';
}

export interface EvidenceData {
  results: EvidenceResultData[];
  degraded: boolean;
  degradeReason?: string;
}

export interface ToolEvent {
  id: string;
  type: 'tool_use' | 'tool_result';
  label: string;
  detail?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'summary';
  /** Visual variant for system messages: 'error' (red), 'info' (blue-gray), 'tool' (gray, compact), 'evidence' (card panel), 'a2a_followup' (follow-up button) */
  variant?: 'error' | 'info' | 'tool' | 'evidence' | 'a2a_followup';
  catId?: string;
  content: string;
  contentBlocks?: MessageContent[];
  toolEvents?: ToolEvent[];
  metadata?: ChatMessageMetadata;
  timestamp: number;
  isStreaming?: boolean;
  summary?: {
    id: string;
    topic: string;
    conclusions: string[];
    openQuestions: string[];
    createdBy: string;
  };
  evidence?: EvidenceData;
  /** A2A chain group ID — messages in the same A2A chain share this ID */
  a2aGroupId?: string;
}

export interface Thread {
  id: string;
  projectPath: string;
  title: string | null;
  createdBy: string;
  participants: string[];
  lastActiveAt: number;
  createdAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  hasMore: boolean;
  intentMode: 'execute' | 'ideate' | null;

  // Per-cat status for loading indicators
  targetCats: string[];
  catStatuses: Record<string, 'pending' | 'streaming' | 'done' | 'error'>;

  // Thread state
  currentThreadId: string;
  currentProjectPath: string;
  threads: Thread[];
  isLoadingThreads: boolean;

  // Message actions
  addMessage: (msg: ChatMessage) => void;
  removeMessage: (id: string) => void;
  prependHistory: (msgs: ChatMessage[], hasMore: boolean) => void;
  appendToLastMessage: (content: string) => void;
  appendToMessage: (id: string, content: string) => void;
  appendToolEvent: (id: string, event: ToolEvent) => void;
  setStreaming: (id: string, streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingHistory: (loading: boolean) => void;
  setIntentMode: (mode: 'execute' | 'ideate' | null) => void;
  setTargetCats: (cats: string[]) => void;
  setCatStatus: (catId: string, status: 'pending' | 'streaming' | 'done' | 'error') => void;
  clearCatStatuses: () => void;
  clearMessages: () => void;

  // Thread actions
  setThreads: (threads: Thread[]) => void;
  setCurrentThread: (threadId: string) => void;
  setCurrentProject: (projectPath: string) => void;
  setLoadingThreads: (loading: boolean) => void;
  updateThreadTitle: (threadId: string, title: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  isLoadingHistory: false,
  hasMore: true,
  intentMode: null,

  targetCats: [],
  catStatuses: {},

  currentThreadId: 'default',
  currentProjectPath: 'default',
  threads: [],
  isLoadingThreads: false,

  addMessage: (msg) =>
    set((state) => {
      // Deduplicate by id (history load + realtime socket can overlap)
      if (state.messages.some((m) => m.id === msg.id)) {
        return state;
      }
      const messages = [...state.messages, msg];
      // Revoke blob URLs on oldest messages to prevent memory leak (#22)
      const MAX_BLOB_MESSAGES = 200;
      if (messages.length > MAX_BLOB_MESSAGES) {
        for (let i = 0; i < messages.length - MAX_BLOB_MESSAGES; i++) {
          const old = messages[i];
          if (old.contentBlocks) {
            for (const block of old.contentBlocks) {
              if (block.type === 'image' && block.url.startsWith('blob:')) {
                URL.revokeObjectURL(block.url);
              }
            }
          }
        }
      }
      return { messages };
    }),

  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  prependHistory: (msgs, hasMore) =>
    set((state) => {
      // Deduplicate: only prepend messages not already in store
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
      return {
        messages: [...newMsgs, ...state.messages],
        hasMore,
      };
    }),

  appendToLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.type === 'assistant') {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + content,
        };
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
        m.id === id
          ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] }
          : m
      ),
    })),

  setStreaming: (id, streaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: streaming } : m
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingHistory: (loading) => set({ isLoadingHistory: loading }),
  setIntentMode: (mode) => set({ intentMode: mode }),
  setTargetCats: (cats) => set({ targetCats: cats, catStatuses: Object.fromEntries(cats.map((c) => [c, 'pending' as const])) }),
  setCatStatus: (catId, status) => set((state) => ({ catStatuses: { ...state.catStatuses, [catId]: status } })),
  clearCatStatuses: () => set({ targetCats: [], catStatuses: {} }),
  clearMessages: () =>
    set((state) => {
      // Revoke blob URLs to prevent memory leak (P3 fix)
      for (const msg of state.messages) {
        if (msg.contentBlocks) {
          for (const block of msg.contentBlocks) {
            if (block.type === 'image' && block.url.startsWith('blob:')) {
              URL.revokeObjectURL(block.url);
            }
          }
        }
      }
      return { messages: [], hasMore: true };
    }),

  setThreads: (threads) => set({ threads }),
  setCurrentThread: (threadId) => set({ currentThreadId: threadId }),
  setCurrentProject: (projectPath) => set({ currentProjectPath: projectPath }),
  setLoadingThreads: (loading) => set({ isLoadingThreads: loading }),
  updateThreadTitle: (threadId, title) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, title } : t
      ),
    })),
}));
