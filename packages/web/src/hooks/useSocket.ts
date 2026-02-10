'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getUserId } from '@/utils/userId';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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
  metadata?: { provider: string; model: string; sessionId?: string };
  timestamp: number;
}

export interface SocketCallbacks {
  onMessage: (msg: AgentMessage) => void;
  onThreadUpdated?: (data: { threadId: string; title: string }) => void;
  onIntentMode?: (data: { threadId: string; mode: string; targetCats: string[] }) => void;
  onTaskCreated?: (task: Record<string, unknown>) => void;
  onTaskUpdated?: (task: Record<string, unknown>) => void;
  onThreadSummary?: (summary: Record<string, unknown>) => void;
  /** Called when heartbeat received (resets timeout timer) */
  onHeartbeat?: () => void;
  /** Message mutation events (ADR-008 S8) */
  onMessageDeleted?: (data: { messageId: string; threadId: string; deletedBy: string }) => void;
  onMessageRestored?: (data: { messageId: string; threadId: string }) => void;
  onThreadBranched?: (data: { sourceThreadId: string; newThreadId: string; fromMessageId: string }) => void;
}

export function useSocket(callbacks: SocketCallbacks, threadId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      query: { userId: getUserId() },
    });

    socket.on('connect', () => {
      console.log('[ws] Connected');
      const tid = threadIdRef.current;
      if (tid) {
        const room = `thread:${tid}`;
        socket.emit('join_room', room);
        currentRoomRef.current = room;
      }
    });

    socket.on('agent_message', (msg: AgentMessage) => {
      // Hard filter: discard messages from a different thread (stale room in-flight)
      const currentThread = threadIdRef.current;
      if (msg.threadId && currentThread && msg.threadId !== currentThread) return;
      callbacks.onMessage(msg);
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

    // Message mutation events (ADR-008 S8)
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

    socket.on('disconnect', () => {
      console.log('[ws] Disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [callbacks]);

  const switchRoom = useCallback((newThreadId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    const oldRoom = currentRoomRef.current;
    const newRoom = `thread:${newThreadId}`;

    if (oldRoom === newRoom) return;

    if (oldRoom) {
      socket.emit('leave_room', oldRoom);
    }
    socket.emit('join_room', newRoom);
    currentRoomRef.current = newRoom;
  }, []);

  // Automatically switch rooms when threadId changes (URL-driven routing)
  useEffect(() => {
    if (threadId) {
      switchRoom(threadId);
    }
  }, [threadId, switchRoom]);

  const cancelInvocation = useCallback((tid: string) => {
    socketRef.current?.emit('cancel_invocation', { threadId: tid });
  }, []);

  return { socketRef, switchRoom, cancelInvocation };
}
