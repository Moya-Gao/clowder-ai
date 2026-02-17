'use client';

import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '@/stores/chatStore';
import { useToastStore } from '@/stores/toastStore';
import { API_URL } from '@/utils/api-client';
import { getUserId } from '@/utils/userId';
import {
  type BackgroundAgentMessage,
  clearBackgroundStreamRefForActiveEvent,
  handleBackgroundAgentMessage,
} from './useSocket-background';

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
  onAuthorizationRequest?: (data: {
    requestId: string;
    catId: string;
    threadId: string;
    action: string;
    reason: string;
    context?: string;
    createdAt: number;
  }) => void;
  onAuthorizationResponse?: (data: { requestId: string; status: string; scope?: string; reason?: string }) => void;
  onModeChanged?: (data: { threadId: string; mode: unknown; action: 'started' | 'ended' }) => void;
}

export function useSocket(callbacks: SocketCallbacks, threadId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const bgStreamRefsRef = useRef<Map<string, { id: string; threadId: string; catId: string }>>(new Map());
  const bgSeqRef = useRef(0);
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  // Use ref to avoid socket disconnect/reconnect on every callbacks change.
  // Without this, thread switches cause socketCallbacks to rebuild (useMemo dep on threadId),
  // which triggers useEffect cleanup → socket disconnect → reconnect. During this gap,
  // events from the old thread can leak into the new thread's state.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

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
      const routeThread = threadIdRef.current;
      const storeThread = useChatStore.getState().currentThreadId;

      // Active thread requires BOTH route-level and store-level agreement.
      // This blocks a switch-window race where route already points to thread-B
      // but flat store still belongs to thread-A.
      const isActiveThreadMessage = Boolean(
        msg.threadId && routeThread && storeThread && msg.threadId === routeThread && msg.threadId === storeThread,
      );

      // Defensive fallback for malformed legacy payloads (threadId missing).
      if (!msg.threadId) {
        callbacksRef.current.onMessage(msg);
        clearBackgroundStreamRefForActiveEvent(msg, bgStreamRefsRef.current);
        return;
      }

      // Active thread → full processing via onMessage (streaming, tool events, etc.)
      if (isActiveThreadMessage) {
        callbacksRef.current.onMessage(msg);
        clearBackgroundStreamRefForActiveEvent(msg, bgStreamRefsRef.current);
        return;
      }

      // Background thread → delegated handler
      handleBackgroundAgentMessage(msg as BackgroundAgentMessage, {
        store: useChatStore.getState(),
        bgStreamRefs: bgStreamRefsRef.current,
        nextBgSeq: () => bgSeqRef.current++,
        addToast: (toast) => useToastStore.getState().addToast(toast),
      });
    });

    socket.on('thread_updated', (data: { threadId: string; title: string }) => {
      callbacksRef.current.onThreadUpdated?.(data);
    });

    socket.on('intent_mode', (data: { threadId: string; mode: string; targetCats: string[] }) => {
      // Thread guard: prevent cross-thread intent leaking into active thread state
      const currentThread = threadIdRef.current;
      if (data.threadId && currentThread && data.threadId !== currentThread) return;
      callbacksRef.current.onIntentMode?.(data);
    });

    socket.on('task_created', (task: Record<string, unknown>) => {
      callbacksRef.current.onTaskCreated?.(task);
    });

    socket.on('task_updated', (task: Record<string, unknown>) => {
      callbacksRef.current.onTaskUpdated?.(task);
    });

    socket.on('thread_summary', (summary: Record<string, unknown>) => {
      callbacksRef.current.onThreadSummary?.(summary);
    });

    socket.on('heartbeat', () => {
      callbacksRef.current.onHeartbeat?.();
    });

    socket.on('message_deleted', (data: { messageId: string; threadId: string; deletedBy: string }) => {
      callbacksRef.current.onMessageDeleted?.(data);
    });
    socket.on('message_hard_deleted', (data: { messageId: string; threadId: string; deletedBy: string }) => {
      callbacksRef.current.onMessageDeleted?.(data);
    });
    socket.on('message_restored', (data: { messageId: string; threadId: string }) => {
      callbacksRef.current.onMessageRestored?.(data);
    });
    socket.on('thread_branched', (data: { sourceThreadId: string; newThreadId: string; fromMessageId: string }) => {
      callbacksRef.current.onThreadBranched?.(data);
    });

    socket.on('authorization:request', (data: Record<string, unknown>) => {
      const currentThread = threadIdRef.current;
      if (data.threadId && currentThread && data.threadId !== currentThread) return;
      callbacksRef.current.onAuthorizationRequest?.(
        data as Parameters<NonNullable<SocketCallbacks['onAuthorizationRequest']>>[0],
      );
    });
    socket.on('authorization:response', (data: Record<string, unknown>) => {
      callbacksRef.current.onAuthorizationResponse?.(
        data as Parameters<NonNullable<SocketCallbacks['onAuthorizationResponse']>>[0],
      );
    });

    socket.on('mode_changed', (data: { threadId: string; mode: unknown; action: 'started' | 'ended' }) => {
      const currentThread = threadIdRef.current;
      if (data.threadId && currentThread && data.threadId !== currentThread) return;
      callbacksRef.current.onModeChanged?.(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks accessed via callbacksRef
  }, []);

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
