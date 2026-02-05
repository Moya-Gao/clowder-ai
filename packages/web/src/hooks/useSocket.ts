'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface AgentMessage {
  type: string;
  catId: string;
  content?: string;
  sessionId?: string;
  toolName?: string;
  error?: string;
  timestamp: number;
}

export function useSocket(onMessage: (msg: AgentMessage) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[ws] Connected');
    });

    socket.on('agent_message', (msg: AgentMessage) => {
      onMessage(msg);
    });

    socket.on('disconnect', () => {
      console.log('[ws] Disconnected');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [onMessage]);

  return socketRef;
}
