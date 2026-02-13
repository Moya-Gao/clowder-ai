'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getUserId } from '@/utils/userId';
import { API_URL } from '@/utils/api-client';
import { useChatStore } from '@/stores/chatStore';
import { useToastStore } from '@/stores/toastStore';

/** Monotonic counter to ensure unique IDs for background thread messages (P2 fix) */
let bgSeq = 0;

interface AgentMessage {
  type: string;
  catId: string;
  threadId?: string;
  content?: string;
  sessionId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string; usage?: import('../stores/chat-types').TokenUsage };
  timestamp: number;
}

interface SocketIoTransportLike {
  name?: string;
  ws?: WebSocket;
}

interface SocketIoEngineLike {
  transport?: SocketIoTransportLike;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

type DebugWebSocket = WebSocket & { __catCafeCloseLoggerAttached?: boolean };

export interface SocketCallbacks {
  onMessage: (msg: AgentMessage) => void;
  onThreadUpdated?: (data: { threadId: string; title: string }) => void;
  onIntentMode?: (data: { threadId: string; mode: string; targetCats: string[] }) => void;
  onTaskCreated?: (task: Record<string, unknown>) => void;
  onTaskUpdated?: (task: Record<string, unknown>) => void;
  onThreadSummary?: (summary: Record<string, unknown>) => void;
  onHeartbeat?: () => void;
  onMessageDeleted?: (data: { messageId: string; threadId: string; deletedBy: string }) => void;
  onMessageRestored?: (data: { messageId: string; threadId: string }) => void;
  onThreadBranched?: (data: { sourceThreadId: string; newThreadId: string; fromMessageId: string }) => void;
  onAuthorizationRequest?: (data: { requestId: string; catId: string; threadId: string; action: string; reason: string; context?: string; createdAt: number }) => void;
  onAuthorizationResponse?: (data: { requestId: string; status: string; scope?: string; reason?: string }) => void;
  onModeChanged?: (data: { threadId: string; mode: unknown; action: 'started' | 'ended' }) => void;
}

export function useSocket(callbacks: SocketCallbacks, threadId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      auth: { userId: getUserId() },
    });

    const getTransportName = () => {
      const engine = socket.io.engine as unknown as SocketIoEngineLike | undefined;
      return engine?.transport?.name ?? 'unknown';
    };

    const attachNativeCloseLogger = () => {
      const engine = socket.io.engine as unknown as SocketIoEngineLike | undefined;
      const transport = engine?.transport;
      if (!transport || transport.name !== 'websocket' || !transport.ws) return;
      const ws = transport.ws as DebugWebSocket;
      if (ws.__catCafeCloseLoggerAttached) return;
      ws.__catCafeCloseLoggerAttached = true;
      ws.addEventListener('close', (event) => {
        console.warn('[ws] Native close', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
      });
    };

    socket.on('connect', () => {
      console.log('[ws] Connected', {
        socketId: socket.id,
        transport: getTransportName(),
        threadId: threadIdRef.current ?? null,
        rooms: [...joinedRoomsRef.current],
      });
      attachNativeCloseLogger();

      // Rejoin all tracked rooms on reconnect
      for (const room of joinedRoomsRef.current) {
        socket.emit('join_room', room);
      }
      // Ensure active thread room is joined
      const tid = threadIdRef.current;
      if (tid) {
        const room = `thread:${tid}`;
        if (!joinedRoomsRef.current.has(room)) {
          socket.emit('join_room', room);
          joinedRoomsRef.current.add(room);
        }
      }
    });

    socket.on('agent_message', (msg: AgentMessage) => {
      const currentThread = threadIdRef.current;

      // Active thread → full processing via onMessage (streaming, tool events, etc.)
      if (!msg.threadId || !currentThread || msg.threadId === currentThread) {
        callbacks.onMessage(msg);
        return;
      }

      // Background thread → simple message accumulation + status update + toast
      const store = useChatStore.getState();
      if (msg.type === 'text' && msg.content) {
        store.addMessageToThread(msg.threadId, {
          id: `bg-${msg.timestamp}-${msg.catId}-${bgSeq++}`,
          type: 'assistant',
          catId: msg.catId,
          content: msg.content,
          ...(msg.metadata ? { metadata: msg.metadata } : {}),
          timestamp: msg.timestamp,
        });
        // Update cat status for background thread
        store.updateThreadCatStatus(msg.threadId, msg.catId, msg.isFinal ? 'done' : 'streaming');
        // Toast on final message
        if (msg.isFinal) {
          useToastStore.getState().addToast({
            type: 'success',
            title: `${msg.catId} 完成`,
            message: msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : ''),
            threadId: msg.threadId,
            duration: 5000,
          });
        }
      } else if (msg.type === 'error') {
        store.addMessageToThread(msg.threadId, {
          id: `bg-err-${msg.timestamp}-${msg.catId}-${bgSeq++}`,
          type: 'system',
          catId: msg.catId,
          content: `Error: ${msg.error ?? 'Unknown error'}`,
          timestamp: msg.timestamp,
        });
        store.updateThreadCatStatus(msg.threadId, msg.catId, 'error');
        useToastStore.getState().addToast({
          type: 'error',
          title: `${msg.catId} 出错`,
          message: msg.error ?? 'Unknown error',
          threadId: msg.threadId,
          duration: 8000,
        });
      } else if (msg.type === 'done') {
        // Don't overwrite error status with success (backend sends error then done)
        const currentStatus = store.getThreadState(msg.threadId!).catStatuses[msg.catId];
        if (currentStatus !== 'error') {
          store.updateThreadCatStatus(msg.threadId!, msg.catId, 'done');
          useToastStore.getState().addToast({
            type: 'success',
            title: `${msg.catId} 完成`,
            message: `${msg.catId} 已完成处理`,
            threadId: msg.threadId!,
            duration: 5000,
          });
        }
      } else if (msg.type === 'status') {
        // Update cat status indicator without storing a message
        const statusMap: Record<string, string> = { streaming: 'streaming', thinking: 'pending', done: 'done' };
        const mapped = statusMap[msg.content ?? ''] ?? 'streaming';
        store.updateThreadCatStatus(msg.threadId!, msg.catId, mapped as 'streaming' | 'pending' | 'done');
      }
    });

    socket.on('thread_updated', (data: { threadId: string; title: string }) => {
      callbacks.onThreadUpdated?.(data);
    });

    socket.on('intent_mode', (data: { threadId: string; mode: string; targetCats: string[] }) => {
      callbacks.onIntentMode?.(data);
    });

    socket.on('task_created', (task: Record<string, unknown>) => {
      callbacks.onTaskCreated?.(task);
    });

    socket.on('task_updated', (task: Record<string, unknown>) => {
      callbacks.onTaskUpdated?.(task);
    });

    socket.on('thread_summary', (summary: Record<string, unknown>) => {
      callbacks.onThreadSummary?.(summary);
    });

    socket.on('heartbeat', () => {
      callbacks.onHeartbeat?.();
    });

    socket.on('message_deleted', (data: { messageId: string; threadId: string; deletedBy: string }) => {
      callbacks.onMessageDeleted?.(data);
    });
    socket.on('message_hard_deleted', (data: { messageId: string; threadId: string; deletedBy: string }) => {
      callbacks.onMessageDeleted?.(data);
    });
    socket.on('message_restored', (data: { messageId: string; threadId: string }) => {
      callbacks.onMessageRestored?.(data);
    });
    socket.on('thread_branched', (data: { sourceThreadId: string; newThreadId: string; fromMessageId: string }) => {
      callbacks.onThreadBranched?.(data);
    });

    socket.on('authorization:request', (data: Record<string, unknown>) => {
      const currentThread = threadIdRef.current;
      if (data['threadId'] && currentThread && data['threadId'] !== currentThread) return;
      callbacks.onAuthorizationRequest?.(data as Parameters<NonNullable<SocketCallbacks['onAuthorizationRequest']>>[0]);
    });
    socket.on('authorization:response', (data: Record<string, unknown>) => {
      callbacks.onAuthorizationResponse?.(data as Parameters<NonNullable<SocketCallbacks['onAuthorizationResponse']>>[0]);
    });

    socket.on('mode_changed', (data: { threadId: string; mode: unknown; action: 'started' | 'ended' }) => {
      const currentThread = threadIdRef.current;
      if (data.threadId && currentThread && data.threadId !== currentThread) return;
      callbacks.onModeChanged?.(data);
    });

    socket.on('connect_error', (error: Error & { description?: unknown; context?: unknown }) => {
      console.error('[ws] connect_error', {
        message: error.message,
        name: error.name,
        transport: getTransportName(),
        description: error.description ?? null,
        context: error.context ?? null,
      });
    });

    socket.on('disconnect', (...args: unknown[]) => {
      const [reason, details] = args;
      console.warn('[ws] Disconnected', {
        reason: typeof reason === 'string' ? reason : String(reason),
        transport: getTransportName(),
        details: details ?? null,
      });
    });

    const engine = socket.io.engine as unknown as SocketIoEngineLike | undefined;
    engine?.on('upgrade', () => {
      attachNativeCloseLogger();
      console.log('[ws] Transport upgraded', { transport: getTransportName() });
    });
    engine?.on('close', (...args: unknown[]) => {
      const [reason] = args;
      console.warn('[ws] Engine close', {
        reason: typeof reason === 'string' ? reason : String(reason),
        transport: getTransportName(),
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      joinedRoomsRef.current.clear();
    };
  }, [callbacks]);

  /** Join a single room (additive — does not leave other rooms) */
  const joinRoom = useCallback((roomThreadId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    const room = `thread:${roomThreadId}`;
    if (joinedRoomsRef.current.has(room)) return;
    socket.emit('join_room', room);
    joinedRoomsRef.current.add(room);
  }, []);

  /** Leave a single room */
  const leaveRoom = useCallback((roomThreadId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    const room = `thread:${roomThreadId}`;
    if (!joinedRoomsRef.current.has(room)) return;
    socket.emit('leave_room', room);
    joinedRoomsRef.current.delete(room);
  }, []);

  /** Sync joined rooms to exactly the given set of thread IDs */
  const syncRooms = useCallback((threadIds: string[]) => {
    const socket = socketRef.current;
    if (!socket) return;

    const targetRooms = new Set(threadIds.map((id) => `thread:${id}`));

    // Leave rooms no longer needed
    for (const room of joinedRoomsRef.current) {
      if (!targetRooms.has(room)) {
        socket.emit('leave_room', room);
        joinedRoomsRef.current.delete(room);
      }
    }

    // Join new rooms
    for (const room of targetRooms) {
      if (!joinedRoomsRef.current.has(room)) {
        socket.emit('join_room', room);
        joinedRoomsRef.current.add(room);
      }
    }
  }, []);

  // Automatically ensure active thread room is joined when threadId changes
  useEffect(() => {
    if (threadId) {
      joinRoom(threadId);
    }
  }, [threadId, joinRoom]);

  const cancelInvocation = useCallback((tid: string) => {
    socketRef.current?.emit('cancel_invocation', { threadId: tid });
  }, []);

  return { socketRef, joinRoom, leaveRoom, syncRooms, cancelInvocation };
}
