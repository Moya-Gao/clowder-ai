/**
 * Socket.io Manager
 * 管理 WebSocket 连接和消息广播
 */

import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createCatId } from '@cat-cafe/shared';
import type { AgentMessage } from '../../domains/cats/services/types.js';
import type { InvocationTracker } from '../../domains/cats/services/InvocationTracker.js';

export class SocketManager {
  private io: Server;
  private invocationTracker: InvocationTracker | null;

  constructor(httpServer: HttpServer, invocationTracker?: InvocationTracker) {
    this.invocationTracker = invocationTracker ?? null;
    this.io = new Server(httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[ws] Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[ws] Client disconnected: ${socket.id}`);
      });

      socket.on('join_room', (room: string) => {
        socket.join(room);
        console.log(`[ws] ${socket.id} joined room: ${room}`);
      });

      socket.on('leave_room', (room: string) => {
        socket.leave(room);
        console.log(`[ws] ${socket.id} left room: ${room}`);
      });

      socket.on('cancel_invocation', (data: { threadId: string }) => {
        if (!this.invocationTracker || !data?.threadId) return;
        // Only allow cancel if the socket is in the target thread's room
        const room = `thread:${data.threadId}`;
        if (!socket.rooms.has(room)) {
          console.warn(`[ws] ${socket.id} tried to cancel thread ${data.threadId} without being in room`);
          return;
        }
        const cancelled = this.invocationTracker.cancel(data.threadId);
        if (cancelled) {
          console.log(`[ws] Cancelled invocation for thread: ${data.threadId}`);
          this.broadcastAgentMessage({
            type: 'done',
            catId: createCatId('opus'),
            isFinal: true,
            timestamp: Date.now(),
          }, data.threadId);
        }
      });
    });
  }

  /**
   * Broadcast agent message to a thread room.
   * Always scoped to a room — defaults to 'thread:default' when threadId is omitted.
   * Never broadcasts globally to prevent cross-thread message leak.
   */
  broadcastAgentMessage(message: AgentMessage, threadId?: string): void {
    const room = `thread:${threadId ?? 'default'}`;
    this.io.to(room).emit('agent_message', message);
  }

  broadcastToRoom(room: string, event: string, data: unknown): void {
    this.io.to(room).emit(event, data);
  }

  getIO(): Server {
    return this.io;
  }
}
