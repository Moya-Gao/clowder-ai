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

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  catId?: string;
  content: string;
  contentBlocks?: MessageContent[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface Thread {
  id: string;
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

  // Thread state
  currentThreadId: string;
  threads: Thread[];
  isLoadingThreads: boolean;

  // Message actions
  addMessage: (msg: ChatMessage) => void;
  prependHistory: (msgs: ChatMessage[], hasMore: boolean) => void;
  appendToLastMessage: (content: string) => void;
  setStreaming: (id: string, streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingHistory: (loading: boolean) => void;
  clearMessages: () => void;

  // Thread actions
  setThreads: (threads: Thread[]) => void;
  setCurrentThread: (threadId: string) => void;
  setLoadingThreads: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  isLoadingHistory: false,
  hasMore: true,

  currentThreadId: 'default',
  threads: [],
  isLoadingThreads: false,

  addMessage: (msg) =>
    set((state) => {
      // Deduplicate by id (history load + realtime socket can overlap)
      if (state.messages.some((m) => m.id === msg.id)) {
        return state;
      }
      return { messages: [...state.messages, msg] };
    }),

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

  setStreaming: (id, streaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: streaming } : m
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingHistory: (loading) => set({ isLoadingHistory: loading }),
  clearMessages: () => set({ messages: [], hasMore: true }),

  setThreads: (threads) => set({ threads }),
  setCurrentThread: (threadId) => set({ currentThreadId: threadId }),
  setLoadingThreads: (loading) => set({ isLoadingThreads: loading }),
}));
