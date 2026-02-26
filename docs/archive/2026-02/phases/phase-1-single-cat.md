---
feature_ids: []
topics: [phases, single, cat]
doc_kind: note
created: 2026-02-26
---

# Phase 1: 单猫通信 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现布偶猫（Claude）的完整通信链路：前端输入 → API → Claude Agent SDK → 流式响应 → WebSocket → 前端显示

**Architecture:** Fastify 后端 + Socket.io 实时通信 + Next.js 前端。使用 @anthropic-ai/claude-agent-sdk 调用 Claude，Session 持久化到 Redis。DDD 架构分层：domain/infrastructure/application。

**Tech Stack:**
- Backend: Fastify + Socket.io + TypeScript
- Agent: @anthropic-ai/claude-agent-sdk
- Frontend: Next.js 14 (App Router) + Tailwind
- State: Zustand + React Query

---

## Task 1: Backend Package 初始化

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/index.ts`
- Delete: `packages/api/src/.gitkeep`

**Step 1: Create package.json**

```json
{
  "name": "@cat-cafe/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@cat-cafe/shared": "workspace:*",
    "fastify": "^4.25.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/websocket": "^10.0.0",
    "socket.io": "^4.7.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create minimal src/index.ts**

```typescript
/**
 * Cat Café API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[api] Server running on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
```

**Step 4: Delete .gitkeep and install deps**

Run: `rm packages/api/src/.gitkeep && pnpm install`
Expected: Dependencies installed

**Step 5: Verify build**

Run: `pnpm -r run build`
Expected: All packages build successfully

**Step 6: Test dev server**

Run: `cd packages/api && pnpm run dev &`
Then: `curl http://localhost:3002/health`
Expected: `{"status":"ok","timestamp":...}`

**Step 7: Commit**

```bash
git add packages/api
git commit -m "feat(api): initialize fastify backend package"
```

---

## Task 2: ClaudeAgentService 实现

**Files:**
- Create: `packages/api/src/domains/cats/services/ClaudeAgentService.ts`
- Create: `packages/api/src/domains/cats/services/types.ts`
- Create: `packages/api/src/domains/cats/services/index.ts`
- Modify: `packages/api/package.json` (add claude-agent-sdk)

**Step 1: Add claude-agent-sdk dependency**

Add to `packages/api/package.json` dependencies:
```json
"@anthropic-ai/claude-agent-sdk": "^0.2.31"
```

Run: `pnpm install`

**Step 2: Create service types**

Create `packages/api/src/domains/cats/services/types.ts`:

```typescript
/**
 * Agent Service Types
 * Agent 服务的共享类型定义
 */

import type { CatId } from '@cat-cafe/shared';

export type AgentMessageType =
  | 'session_init'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done';

export interface AgentMessage {
  type: AgentMessageType;
  catId: CatId;
  content?: string;
  sessionId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: string;
  timestamp: number;
}

export interface AgentServiceOptions {
  sessionId?: string;
  workingDirectory?: string;
}

export interface AgentService {
  invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage>;
}
```

**Step 3: Create ClaudeAgentService**

Create `packages/api/src/domains/cats/services/ClaudeAgentService.ts`:

```typescript
/**
 * Claude Agent Service
 * 使用 @anthropic-ai/claude-agent-sdk 调用布偶猫
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { createCatId } from '@cat-cafe/shared';
import type { AgentMessage, AgentService, AgentServiceOptions } from './types.js';

const CAT_ID = createCatId('opus');

export class ClaudeAgentService implements AgentService {
  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    const startTime = Date.now();

    try {
      const stream = query({
        prompt,
        options: {
          model: 'claude-sonnet-4-5',
          allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
          permissionMode: 'bypassPermissions',
          resume: options?.sessionId,
          cwd: options?.workingDirectory,
        },
      });

      for await (const event of stream) {
        // Handle different event types from SDK
        if (event.type === 'system' && event.subtype === 'init') {
          yield {
            type: 'session_init',
            catId: CAT_ID,
            sessionId: event.sessionId,
            timestamp: Date.now(),
          };
        } else if (event.type === 'assistant' && event.message) {
          // Extract text content
          for (const block of event.message.content) {
            if (block.type === 'text') {
              yield {
                type: 'text',
                catId: CAT_ID,
                content: block.text,
                timestamp: Date.now(),
              };
            } else if (block.type === 'tool_use') {
              yield {
                type: 'tool_use',
                catId: CAT_ID,
                toolName: block.name,
                toolInput: block.input as Record<string, unknown>,
                timestamp: Date.now(),
              };
            }
          }
        } else if (event.type === 'result') {
          // Tool results
          yield {
            type: 'tool_result',
            catId: CAT_ID,
            content: JSON.stringify(event.result),
            timestamp: Date.now(),
          };
        }
      }

      yield {
        type: 'done',
        catId: CAT_ID,
        timestamp: Date.now(),
      };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
```

**Step 4: Create index export**

Create `packages/api/src/domains/cats/services/index.ts`:

```typescript
export { ClaudeAgentService } from './ClaudeAgentService.js';
export * from './types.js';
```

**Step 5: Verify build**

Run: `pnpm -r run build`
Expected: Build succeeds (may have type issues if SDK types differ, adjust as needed)

**Step 6: Commit**

```bash
git add packages/api
git commit -m "feat(api): add ClaudeAgentService with claude-agent-sdk"
```

---

## Task 3: API 路由实现

**Files:**
- Create: `packages/api/src/routes/messages.ts`
- Create: `packages/api/src/routes/cats.ts`
- Create: `packages/api/src/routes/index.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create messages route**

Create `packages/api/src/routes/messages.ts`:

```typescript
/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ClaudeAgentService } from '../domains/cats/services/index.js';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  const claudeService = new ClaudeAgentService();

  // POST /api/messages - 发送消息（SSE 流式响应）
  app.post('/api/messages', async (request, reply) => {
    const body = sendMessageSchema.parse(request.body);

    // Set up SSE
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    try {
      for await (const msg of claudeService.invoke(body.content)) {
        const data = JSON.stringify(msg);
        reply.raw.write(`data: ${data}\n\n`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
    }

    reply.raw.end();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    // TODO: Implement message history from file/redis
    return { messages: [], total: 0 };
  });
};
```

**Step 2: Create cats route**

Create `packages/api/src/routes/cats.ts`:

```typescript
/**
 * Cats API Routes
 * GET /api/cats - 获取所有猫猫信息
 * GET /api/cats/:id/status - 获取猫猫状态
 */

import type { FastifyPluginAsync } from 'fastify';
import { CAT_CONFIGS } from '@cat-cafe/shared';

export const catsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/cats - 获取所有猫猫配置
  app.get('/api/cats', async () => {
    return {
      cats: Object.values(CAT_CONFIGS).map((cat) => ({
        id: cat.id,
        displayName: cat.displayName,
        color: cat.color,
        mentionPatterns: cat.mentionPatterns,
      })),
    };
  });

  // GET /api/cats/:id/status - 获取猫猫状态
  app.get<{ Params: { id: string } }>('/api/cats/:id/status', async (request) => {
    const { id } = request.params;
    const cat = CAT_CONFIGS[id];

    if (!cat) {
      return { error: 'Cat not found', statusCode: 404 };
    }

    // TODO: Get actual status from Redis
    return {
      id: cat.id,
      displayName: cat.displayName,
      status: 'idle',
      lastActive: Date.now(),
    };
  });
};
```

**Step 3: Create routes index**

Create `packages/api/src/routes/index.ts`:

```typescript
export { messagesRoutes } from './messages.js';
export { catsRoutes } from './cats.js';
```

**Step 4: Update main index.ts**

Replace `packages/api/src/index.ts`:

```typescript
/**
 * Cat Café API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes } from './routes/index.js';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  // CORS for frontend
  await app.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Register routes
  await app.register(messagesRoutes);
  await app.register(catsRoutes);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[api] Server running on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
```

**Step 5: Verify build**

Run: `pnpm -r run build`
Expected: Build succeeds

**Step 6: Test endpoints**

Run: `cd packages/api && pnpm run dev &`
Then:
```bash
curl http://localhost:3002/api/cats
curl http://localhost:3002/api/cats/opus/status
```
Expected: JSON responses with cat info

**Step 7: Commit**

```bash
git add packages/api
git commit -m "feat(api): add messages and cats API routes"
```

---

## Task 4: WebSocket (Socket.io) 集成

**Files:**
- Create: `packages/api/src/infrastructure/websocket/SocketManager.ts`
- Create: `packages/api/src/infrastructure/websocket/index.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create SocketManager**

Create `packages/api/src/infrastructure/websocket/SocketManager.ts`:

```typescript
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
        origin: ['http://localhost:3000'],
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
```

**Step 2: Create websocket index**

Create `packages/api/src/infrastructure/websocket/index.ts`:

```typescript
export { SocketManager } from './SocketManager.js';
```

**Step 3: Update main index.ts to use Socket.io**

Replace `packages/api/src/index.ts`:

```typescript
/**
 * Cat Café API Server
 * 后端 API 入口
 */

import { createServer } from 'node:http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes } from './routes/index.js';
import { SocketManager } from './infrastructure/websocket/index.js';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

// Global socket manager for broadcasting
let socketManager: SocketManager | null = null;

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    throw new Error('SocketManager not initialized');
  }
  return socketManager;
}

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  // Create HTTP server for Socket.io
  const httpServer = createServer(app.server);

  // Initialize Socket.io
  socketManager = new SocketManager(httpServer);

  // CORS for frontend
  await app.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Register routes
  await app.register(messagesRoutes);
  await app.register(catsRoutes);

  // Start server
  await app.ready();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] Server running on http://localhost:${PORT}`);
    console.log(`[api] WebSocket ready`);
  });
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
```

**Step 4: Update messages route to broadcast via WebSocket**

Update `packages/api/src/routes/messages.ts`:

```typescript
/**
 * Messages API Routes
 * POST /api/messages - 发送消息
 * GET /api/messages - 获取历史消息
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ClaudeAgentService } from '../domains/cats/services/index.js';
import { getSocketManager } from '../index.js';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

export const messagesRoutes: FastifyPluginAsync = async (app) => {
  const claudeService = new ClaudeAgentService();

  // POST /api/messages - 发送消息
  app.post('/api/messages', async (request, reply) => {
    const body = sendMessageSchema.parse(request.body);
    const socketManager = getSocketManager();

    // Return immediately, process async
    reply.send({ status: 'processing', timestamp: Date.now() });

    // Process in background and broadcast via WebSocket
    (async () => {
      try {
        for await (const msg of claudeService.invoke(body.content)) {
          socketManager.broadcastAgentMessage(msg);
        }
      } catch (err) {
        socketManager.broadcastAgentMessage({
          type: 'error',
          catId: 'opus' as any,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: Date.now(),
        });
      }
    })();
  });

  // GET /api/messages - 获取历史消息（placeholder）
  app.get('/api/messages', async () => {
    return { messages: [], total: 0 };
  });
};
```

**Step 5: Verify build**

Run: `pnpm -r run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add packages/api
git commit -m "feat(api): add Socket.io for real-time messaging"
```

---

## Task 5: Frontend Package 初始化

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/next.config.js`
- Create: `packages/web/tailwind.config.js`
- Create: `packages/web/postcss.config.js`
- Create: `packages/web/src/app/layout.tsx`
- Create: `packages/web/src/app/page.tsx`
- Create: `packages/web/src/app/globals.css`
- Delete: `packages/web/src/.gitkeep`

**Step 1: Create package.json**

```json
{
  "name": "@cat-cafe/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
```

**Step 4: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        opus: { primary: '#9B7EBD', secondary: '#E8DFF0' },
        codex: { primary: '#5B8C5A', secondary: '#E0EBE0' },
        gemini: { primary: '#5B9BD5', secondary: '#E0ECF5' },
      },
    },
  },
  plugins: [],
};
```

**Step 5: Create postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 6: Create globals.css**

Create `packages/web/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

**Step 7: Create layout.tsx**

Create `packages/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cat Café',
  description: '三只 AI 猫猫的协作空间',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
```

**Step 8: Create page.tsx (placeholder)**

Create `packages/web/src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-opus-primary mb-4">
        Cat Café
      </h1>
      <p className="text-gray-600">三只 AI 猫猫的协作空间</p>
    </main>
  );
}
```

**Step 9: Delete .gitkeep and install deps**

Run: `rm packages/web/src/.gitkeep && pnpm install`

**Step 10: Test dev server**

Run: `cd packages/web && pnpm run dev`
Expected: Next.js starts on http://localhost:3000

**Step 11: Commit**

```bash
git add packages/web
git commit -m "feat(web): initialize Next.js frontend with Tailwind"
```

---

## Task 6: 前端聊天组件

**Files:**
- Create: `packages/web/src/hooks/useSocket.ts`
- Create: `packages/web/src/stores/chatStore.ts`
- Create: `packages/web/src/components/ChatMessage.tsx`
- Create: `packages/web/src/components/ChatInput.tsx`
- Create: `packages/web/src/components/ChatContainer.tsx`
- Modify: `packages/web/src/app/page.tsx`

**Step 1: Create useSocket hook**

Create `packages/web/src/hooks/useSocket.ts`:

```typescript
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
```

**Step 2: Create chatStore**

Create `packages/web/src/stores/chatStore.ts`:

```typescript
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  catId?: string;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  appendToLastMessage: (content: string) => void;
  setStreaming: (id: string, streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

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
}));
```

**Step 3: Create ChatMessage component**

Create `packages/web/src/components/ChatMessage.tsx`:

```tsx
'use client';

import type { ChatMessage as ChatMessageType } from '@/stores/chatStore';

const CAT_COLORS: Record<string, { bg: string; border: string; name: string }> = {
  opus: { bg: 'bg-opus-secondary', border: 'border-opus-primary', name: '布偶猫' },
  codex: { bg: 'bg-codex-secondary', border: 'border-codex-primary', name: '缅因猫' },
  gemini: { bg: 'bg-gemini-secondary', border: 'border-gemini-primary', name: '暹罗猫' },
};

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.type === 'user';
  const cat = message.catId ? CAT_COLORS[message.catId] : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'bg-gray-200 text-gray-900'
            : cat
            ? `${cat.bg} border-l-4 ${cat.border}`
            : 'bg-white border border-gray-200'
        }`}
      >
        {!isUser && cat && (
          <div className="text-sm font-medium mb-1 text-gray-600">
            {cat.name}
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create ChatInput component**

Create `packages/web/src/components/ChatInput.tsx`:

```tsx
'use client';

import { useState, useCallback, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (@ 可召唤猫猫)"
          className="flex-1 resize-none rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-opus-primary"
          rows={2}
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-6 py-2 bg-opus-primary text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

**Step 5: Create ChatContainer component**

Create `packages/web/src/components/ChatContainer.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function ChatContainer() {
  const { messages, isLoading, addMessage, appendToLastMessage, setLoading } =
    useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const handleAgentMessage = useCallback(
    (msg: { type: string; catId: string; content?: string }) => {
      if (msg.type === 'text' && msg.content) {
        if (!currentMessageIdRef.current) {
          // First text chunk - create new message
          const id = `msg-${Date.now()}`;
          currentMessageIdRef.current = id;
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            timestamp: Date.now(),
            isStreaming: true,
          });
        } else {
          // Append to existing message
          appendToLastMessage(msg.content);
        }
      } else if (msg.type === 'done') {
        currentMessageIdRef.current = null;
        setLoading(false);
      } else if (msg.type === 'error') {
        currentMessageIdRef.current = null;
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Error: ${msg.content || 'Unknown error'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, appendToLastMessage, setLoading]
  );

  useSocket(handleAgentMessage);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (content: string) => {
      // Add user message
      addMessage({
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      });

      setLoading(true);

      // Send to API
      try {
        await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      } catch (err) {
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, setLoading]
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-gray-200 p-4 bg-white">
        <h1 className="text-xl font-bold text-opus-primary">Cat Café</h1>
        <p className="text-sm text-gray-500">三只 AI 猫猫的协作空间</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-2">欢迎来到 Cat Café！</p>
            <p>输入 @布偶 召唤布偶猫开始聊天</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
```

**Step 6: Update page.tsx**

Replace `packages/web/src/app/page.tsx`:

```tsx
import { ChatContainer } from '@/components/ChatContainer';

export default function Home() {
  return <ChatContainer />;
}
```

**Step 7: Verify build**

Run: `pnpm -r run build`
Expected: All packages build (may need to adjust for Next.js)

**Step 8: Commit**

```bash
git add packages/web
git commit -m "feat(web): add chat components with Socket.io integration"
```

---

## Task 7: 端到端测试

**Files:** None (manual testing)

**Step 1: Start all services**

Terminal 1: `cd packages/api && pnpm run dev`
Terminal 2: `cd packages/web && pnpm run dev`

**Step 2: Open browser**

Navigate to http://localhost:3000

**Step 3: Test flow**

1. Type "@布偶 你好！" and press Enter
2. Observe WebSocket connection in DevTools Network tab
3. Observe streaming response from Claude
4. Verify message appears with opus styling

**Step 4: Verify error handling**

1. Stop API server
2. Try to send message
3. Verify error message appears

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 single-cat communication"
```

---

## Verification Checklist

- [ ] `pnpm -r run build` succeeds
- [ ] API server starts on :3002
- [ ] Frontend starts on :3000
- [ ] WebSocket connects successfully
- [ ] Messages flow: Input → API → Claude SDK → WebSocket → UI
- [ ] Error states handled gracefully
- [ ] Cat styling (opus purple) applied correctly

---

*Plan created: 2026-02-04*
*Author: 布偶猫 (Claude Opus 4.5)*
