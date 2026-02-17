import type { CatStatusType, ThreadState } from '@/stores/chat-types';
import { compactToolResultDetail } from '@/utils/toolPreview';

export interface BackgroundAgentMessage {
  type: string;
  catId: string;
  threadId: string;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string; usage?: import('@/stores/chat-types').TokenUsage };
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
  addMessageToThread: (
    threadId: string,
    msg: {
      id: string;
      type: 'assistant' | 'system';
      catId: string;
      content: string;
      metadata?: {
        provider: string;
        model: string;
        sessionId?: string;
        usage?: import('@/stores/chat-types').TokenUsage;
      };
      timestamp: number;
      isStreaming?: boolean;
    },
  ) => void;
  appendToThreadMessage: (threadId: string, messageId: string, content: string) => void;
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

const STATUS_MAP: Record<string, CatStatusType> = {
  streaming: 'streaming',
  thinking: 'pending',
  done: 'done',
};

function getStreamKey(msg: Pick<BackgroundAgentMessage, 'threadId' | 'catId'>): string {
  return `${msg.threadId}::${msg.catId}`;
}

function shouldClearBackgroundRefOnActiveEvent(msg: ActiveRoutedAgentMessage): boolean {
  if (!msg.threadId) return false;
  if (msg.type === 'done') return true;
  if (msg.type === 'error') return msg.isFinal === true;
  if (msg.type === 'text' && msg.isFinal) return true;
  return false;
}

export function clearBackgroundStreamRefForActiveEvent(
  msg: ActiveRoutedAgentMessage,
  bgStreamRefs: Map<string, BackgroundStreamRef>,
): void {
  if (!shouldClearBackgroundRefOnActiveEvent(msg) || !msg.threadId) return;
  bgStreamRefs.delete(`${msg.threadId}::${msg.catId}`);
}

function stopTrackedStream(
  streamKey: string,
  msg: BackgroundAgentMessage,
  options: HandleBackgroundMessageOptions,
): BackgroundStreamRef | undefined {
  const existing = options.bgStreamRefs.get(streamKey);
  if (!existing) return undefined;
  options.store.setThreadMessageStreaming(msg.threadId, existing.id, false);
  options.bgStreamRefs.delete(streamKey);
  return existing;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function safeJsonPreview(value: unknown, maxLength: number): string {
  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return '[unserializable input]';
  }
}

function addBackgroundSystemMessage(
  msg: BackgroundAgentMessage,
  options: HandleBackgroundMessageOptions,
  content: string,
): void {
  options.store.addMessageToThread(msg.threadId, {
    id: `bg-sys-${msg.timestamp}-${msg.catId}-${options.nextBgSeq()}`,
    type: 'system',
    catId: msg.catId,
    content,
    timestamp: msg.timestamp,
  });
}

export function handleBackgroundAgentMessage(
  msg: BackgroundAgentMessage,
  options: HandleBackgroundMessageOptions,
): void {
  const streamKey = getStreamKey(msg);
  const existing = options.bgStreamRefs.get(streamKey);

  if (msg.type === 'text' && msg.content) {
    let messageId = existing?.id;
    if (messageId) {
      options.store.appendToThreadMessage(msg.threadId, messageId, msg.content);
    } else {
      messageId = `bg-${msg.timestamp}-${msg.catId}-${options.nextBgSeq()}`;
      options.bgStreamRefs.set(streamKey, { id: messageId, threadId: msg.threadId, catId: msg.catId });
      options.store.addMessageToThread(msg.threadId, {
        id: messageId,
        type: 'assistant',
        catId: msg.catId,
        content: msg.content,
        ...(msg.metadata ? { metadata: msg.metadata } : {}),
        timestamp: msg.timestamp,
        isStreaming: !msg.isFinal,
      });
    }

    if (msg.isFinal) {
      options.store.setThreadMessageStreaming(msg.threadId, messageId, false);
      options.bgStreamRefs.delete(streamKey);
    } else {
      options.store.setThreadMessageStreaming(msg.threadId, messageId, true);
    }

    options.store.updateThreadCatStatus(msg.threadId, msg.catId, msg.isFinal ? 'done' : 'streaming');
    if (msg.isFinal) {
      const finalMessage = options.store.getThreadState(msg.threadId).messages.find((m) => m.id === messageId);
      const preview = finalMessage?.content ?? msg.content;
      options.store.clearThreadActiveInvocation(msg.threadId);
      options.addToast({
        type: 'success',
        title: `${msg.catId} 完成`,
        message: preview.slice(0, 80) + (preview.length > 80 ? '...' : ''),
        threadId: msg.threadId,
        duration: 5000,
      });
    }
    return;
  }

  if (msg.type === 'error') {
    stopTrackedStream(streamKey, msg, options);
    options.store.addMessageToThread(msg.threadId, {
      id: `bg-err-${msg.timestamp}-${msg.catId}-${options.nextBgSeq()}`,
      type: 'system',
      catId: msg.catId,
      content: `Error: ${msg.error ?? 'Unknown error'}`,
      timestamp: msg.timestamp,
    });
    options.store.updateThreadCatStatus(msg.threadId, msg.catId, 'error');
    if (msg.isFinal) {
      options.store.clearThreadActiveInvocation(msg.threadId);
    }
    options.addToast({
      type: 'error',
      title: `${msg.catId} 出错`,
      message: msg.error ?? 'Unknown error',
      threadId: msg.threadId,
      duration: 8000,
    });
    return;
  }

  if (msg.type === 'done') {
    stopTrackedStream(streamKey, msg, options);
    const currentStatus = options.store.getThreadState(msg.threadId).catStatuses[msg.catId];
    if (currentStatus !== 'error') {
      options.store.updateThreadCatStatus(msg.threadId, msg.catId, 'done');
      options.addToast({
        type: 'success',
        title: `${msg.catId} 完成`,
        message: `${msg.catId} 已完成处理`,
        threadId: msg.threadId,
        duration: 5000,
      });
    }
    if (msg.isFinal) {
      options.store.clearThreadActiveInvocation(msg.threadId);
    }
    return;
  }

  if (msg.type === 'status') {
    const mapped = STATUS_MAP[msg.content ?? ''] ?? 'streaming';
    options.store.updateThreadCatStatus(msg.threadId, msg.catId, mapped);
    return;
  }

  if (msg.type === 'tool_use') {
    const toolName = msg.toolName ?? 'unknown';
    const detail = msg.toolInput ? safeJsonPreview(msg.toolInput, 200) : null;
    addBackgroundSystemMessage(
      msg,
      options,
      detail ? `🔧 ${msg.catId} → ${toolName}\n${detail}` : `🔧 ${msg.catId} → ${toolName}`,
    );
    options.store.updateThreadCatStatus(msg.threadId, msg.catId, 'streaming');
    return;
  }

  if (msg.type === 'tool_result') {
    const detail = compactToolResultDetail(msg.content ?? '');
    addBackgroundSystemMessage(msg, options, `🧾 ${msg.catId} ← result\n${detail}`);
    options.store.updateThreadCatStatus(msg.threadId, msg.catId, 'streaming');
    return;
  }

  if (msg.type === 'system_info' || msg.type === 'a2a_handoff') {
    if (!msg.content) return;
    addBackgroundSystemMessage(msg, options, msg.content);
  }
}
