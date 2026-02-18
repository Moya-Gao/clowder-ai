import type {
  CatInvocationInfo,
  CatStatusType,
  ChatMessage,
  ThreadState,
  TokenUsage,
  ToolEvent,
} from '@/stores/chat-types';

export interface BackgroundAgentMessage {
  type: string;
  catId: string;
  threadId: string;
  content?: string;
  origin?: 'stream' | 'callback';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string; usage?: TokenUsage };
  timestamp: number;
}

export interface BackgroundStreamRef {
  id: string;
  threadId: string;
  catId: string;
}

export interface BackgroundToastInput {
  type: 'success' | 'error';
  title: string;
  message: string;
  threadId: string;
  duration: number;
}

export interface BackgroundStoreLike {
  addMessageToThread: (threadId: string, msg: ChatMessage) => void;
  appendToThreadMessage: (threadId: string, messageId: string, content: string) => void;
  appendToolEventToThread: (threadId: string, messageId: string, event: ToolEvent) => void;
  setThreadCatInvocation: (threadId: string, catId: string, info: Partial<CatInvocationInfo>) => void;
  setThreadMessageUsage: (threadId: string, messageId: string, usage: TokenUsage) => void;
  setThreadMessageStreaming: (threadId: string, messageId: string, streaming: boolean) => void;
  updateThreadCatStatus: (threadId: string, catId: string, status: CatStatusType) => void;
  clearThreadActiveInvocation: (threadId: string) => void;
  getThreadState: (threadId: string) => ThreadState;
}

export interface HandleBackgroundMessageOptions {
  store: BackgroundStoreLike;
  bgStreamRefs: Map<string, BackgroundStreamRef>;
  nextBgSeq: () => number;
  addToast: (toast: BackgroundToastInput) => void;
}

export type ActiveRoutedAgentMessage = {
  type: string;
  catId: string;
  threadId?: string;
  isFinal?: boolean;
};
