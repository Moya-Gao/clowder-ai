/**
 * Socket.io Manager
 * 管理 WebSocket 连接和消息广播
 */

import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import type { AgentMessage } from '../../domains/cats/services/types.js';

export class SocketManager {
  private io: Server;

  constructor(httpServer: HttpServer) {
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
    });
  }

  broadcastAgentMessage(message: AgentMessage): void {
    this.io.emit('agent_message', message);
  }

  broadcastToRoom(room: string, event: string, data: unknown): void {
    this.io.to(room).emit(event, data);
  }

  getIO(): Server {
    return this.io;
  }
}
