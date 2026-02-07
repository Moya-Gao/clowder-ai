'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface AgentMessage {
  type: string;
  catId: string;
  content?: string;
  sessionId?: string;
  toolName?: string;
  error?: string;
  isFinal?: boolean;
  metadata?: { provider: string; model: string; sessionId?: string };
  timestamp: number;
}

export function useSocket(
  onMessage: (msg: AgentMessage) => void,
  threadId?: string,
  onThreadUpdated?: (data: { threadId: string; title: string }) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[ws] Connected');
      // Join thread room on connect
      const tid = threadIdRef.current;
      if (tid) {
        const room = `thread:${tid}`;
        socket.emit('join_room', room);
        currentRoomRef.current = room;
      }
    });

    socket.on('agent_message', (msg: AgentMessage) => {
      onMessage(msg);
    });

    socket.on('thread_updated', (data: { threadId: string; title: string }) => {
      onThreadUpdated?.(data);
    });

    socket.on('disconnect', () => {
      console.log('[ws] Disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [onMessage]);

  // Switch rooms when threadId changes
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

  const cancelInvocation = useCallback((tid: string) => {
    socketRef.current?.emit('cancel_invocation', { threadId: tid });
  }, []);

  return { socketRef, switchRoom, cancelInvocation };
}
