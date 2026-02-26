---
feature_ids: []
topics: [phases, foundation]
doc_kind: note
created: 2026-02-26
---

# Phase 0: 地基 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建 Cat Café 的 pnpm monorepo 基础设施，包括共享类型包、MCP Server 骨架、Redis 连接。

**Architecture:** DDD 领域驱动设计，使用 Branded Types 确保类型安全，Zod schemas 定义 API 契约。参考 pangu-doer-router 的强类型和兜底机制设计。

**Tech Stack:** pnpm workspace, TypeScript 5.3+, Zod, @modelcontextprotocol/sdk, ioredis, Fastify

---

## 前置条件

- Node.js 20+
- pnpm 8+
- Redis 运行中 (`redis-server` 或 Docker)

---

## Task 1: 初始化 pnpm Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.npmrc`

**Step 1: 创建 root package.json**

```json
{
  "name": "cat-cafe",
  "version": "0.1.0",
  "private": true,
  "description": "三只 AI 猫猫的协作空间",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "clean": "pnpm -r run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

**Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Step 4: 创建 .npmrc**

```ini
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
```

**Step 5: 创建 packages 目录结构**

```bash
mkdir -p packages/shared/src
mkdir -p packages/mcp-server/src
mkdir -p packages/api/src
mkdir -p packages/web/src
```

**Step 6: 安装依赖并验证**

Run: `pnpm install`
Expected: 成功安装，无错误

**Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .npmrc packages/
git commit -m "chore: initialize pnpm monorepo structure"
```

---

## Task 2: 创建共享类型包 @cat-cafe/shared

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/ids.ts` (Branded Types)
- Create: `packages/shared/src/types/message.ts`
- Create: `packages/shared/src/types/cat.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/schemas/message.schema.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: 创建 packages/shared/package.json**

```json
{
  "name": "@cat-cafe/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./types": {
      "import": "./dist/types/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./schemas": {
      "import": "./dist/schemas/index.js",
      "types": "./dist/schemas/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**Step 2: 创建 packages/shared/tsconfig.json**

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

**Step 3: 创建 Branded Types - packages/shared/src/types/ids.ts**

```typescript
/**
 * Branded Types - 编译时类型安全的 ID 类型
 * 防止不同类型的 ID 混用
 */

declare const __brand: unique symbol;

type Brand<T, B> = T & { readonly [__brand]: B };

// === ID Types ===
export type MessageId = Brand<string, 'MessageId'>;
export type CatId = Brand<string, 'CatId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type UserId = Brand<string, 'UserId'>;

// === ID Factories ===
export function createMessageId(id: string): MessageId {
  return id as MessageId;
}

export function createCatId(id: string): CatId {
  const validCats = ['opus', 'codex', 'gemini'] as const;
  if (!validCats.includes(id as typeof validCats[number])) {
    throw new Error(`Invalid CatId: ${id}. Must be one of: ${validCats.join(', ')}`);
  }
  return id as CatId;
}

export function createThreadId(id: string): ThreadId {
  return id as ThreadId;
}

export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

export function createUserId(id: string): UserId {
  return id as UserId;
}

// === Utility ===
export function generateId(): string {
  return crypto.randomUUID();
}

export function generateMessageId(): MessageId {
  return createMessageId(generateId());
}

export function generateThreadId(): ThreadId {
  return createThreadId(generateId());
}

export function generateSessionId(): SessionId {
  return createSessionId(generateId());
}
```

**Step 4: 创建 Cat 类型 - packages/shared/src/types/cat.ts**

```typescript
import type { CatId } from './ids.js';

/**
 * 猫猫状态枚举
 */
export type CatStatus = 'idle' | 'thinking' | 'working' | 'error' | 'offline';

/**
 * 猫猫配置
 */
export interface CatConfig {
  readonly id: CatId;
  readonly name: string;
  readonly displayName: string;
  readonly avatar: string;
  readonly color: {
    readonly primary: string;
    readonly secondary: string;
  };
  readonly mentionPatterns: readonly string[];
}

/**
 * 猫猫运行时状态
 */
export interface CatState {
  readonly id: CatId;
  readonly status: CatStatus;
  readonly currentTask?: string;
  readonly lastActiveAt: number;
  readonly sessionId?: string;
}

/**
 * 三只猫的静态配置
 */
export const CAT_CONFIGS: Record<string, CatConfig> = {
  opus: {
    id: 'opus' as CatId,
    name: 'opus',
    displayName: '布偶猫',
    avatar: '/assets/avatars/opus.png',
    color: {
      primary: '#9B7EBD',
      secondary: '#E8DFF0',
    },
    mentionPatterns: ['@布偶猫', '@布偶', '@ragdoll', '@opus'],
  },
  codex: {
    id: 'codex' as CatId,
    name: 'codex',
    displayName: '缅因猫',
    avatar: '/assets/avatars/codex.png',
    color: {
      primary: '#5B8C5A',
      secondary: '#E0EBE0',
    },
    mentionPatterns: ['@缅因猫', '@缅因', '@mainecoon', '@codex'],
  },
  gemini: {
    id: 'gemini' as CatId,
    name: 'gemini',
    displayName: '暹罗猫',
    avatar: '/assets/avatars/gemini.png',
    color: {
      primary: '#5B9BD5',
      secondary: '#E0ECF5',
    },
    mentionPatterns: ['@暹罗猫', '@暹罗', '@siamese', '@gemini'],
  },
} as const;

/**
 * 根据提及文本查找猫猫
 */
export function findCatByMention(mention: string): CatConfig | undefined {
  for (const cat of Object.values(CAT_CONFIGS)) {
    if (cat.mentionPatterns.some(p => mention.includes(p))) {
      return cat;
    }
  }
  return undefined;
}

/**
 * 获取所有猫猫 ID
 */
export function getAllCatIds(): CatId[] {
  return Object.values(CAT_CONFIGS).map(c => c.id);
}
```

**Step 5: 创建 Message 类型 - packages/shared/src/types/message.ts**

```typescript
import type { MessageId, CatId, ThreadId, UserId } from './ids.js';

/**
 * 消息发送者类型
 */
export type MessageSender =
  | { type: 'user'; userId: UserId }
  | { type: 'cat'; catId: CatId };

/**
 * 消息内容类型
 */
export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'tool_call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; result: unknown };

/**
 * 消息实体
 */
export interface Message {
  readonly id: MessageId;
  readonly threadId: ThreadId;
  readonly sender: MessageSender;
  readonly content: MessageContent[];
  readonly mentions: CatId[];
  readonly createdAt: number;
  readonly updatedAt?: number;
}

/**
 * Agent 消息流类型（用于流式响应）
 */
export type AgentStreamMessage =
  | { type: 'session_init'; sessionId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_end'; toolName: string; result: unknown }
  | { type: 'cat_start'; catId: CatId }
  | { type: 'cat_end'; catId: CatId }
  | { type: 'error'; error: string }
  | { type: 'done' };

/**
 * 创建用户消息的工厂函数
 */
export function createUserMessage(params: {
  id: MessageId;
  threadId: ThreadId;
  userId: UserId;
  text: string;
  mentions?: CatId[];
}): Message {
  return {
    id: params.id,
    threadId: params.threadId,
    sender: { type: 'user', userId: params.userId },
    content: [{ type: 'text', text: params.text }],
    mentions: params.mentions ?? [],
    createdAt: Date.now(),
  };
}

/**
 * 创建猫猫消息的工厂函数
 */
export function createCatMessage(params: {
  id: MessageId;
  threadId: ThreadId;
  catId: CatId;
  content: MessageContent[];
}): Message {
  return {
    id: params.id,
    threadId: params.threadId,
    sender: { type: 'cat', catId: params.catId },
    content: params.content,
    mentions: [],
    createdAt: Date.now(),
  };
}
```

**Step 6: 创建类型入口 - packages/shared/src/types/index.ts**

```typescript
export * from './ids.js';
export * from './cat.js';
export * from './message.js';
```

**Step 7: 创建 Zod Schemas - packages/shared/src/schemas/message.schema.ts**

```typescript
import { z } from 'zod';

/**
 * 消息发送者 Schema
 */
export const MessageSenderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user'),
    userId: z.string().min(1),
  }),
  z.object({
    type: z.literal('cat'),
    catId: z.enum(['opus', 'codex', 'gemini']),
  }),
]);

/**
 * 消息内容 Schema
 */
export const MessageContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    url: z.string().url(),
    alt: z.string().optional(),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    code: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    toolName: z.string(),
    args: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolName: z.string(),
    result: z.unknown(),
  }),
]);

/**
 * 消息 Schema
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  sender: MessageSenderSchema,
  content: z.array(MessageContentSchema).min(1),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive().optional(),
});

/**
 * 发送消息请求 Schema（API 用）
 */
export const SendMessageRequestSchema = z.object({
  threadId: z.string().uuid().optional(),
  content: z.string().min(1).max(10000),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
});

/**
 * 类型推断
 */
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
```

**Step 8: 创建 Schema 入口 - packages/shared/src/schemas/index.ts**

```typescript
export * from './message.schema.js';
```

**Step 9: 创建包入口 - packages/shared/src/index.ts**

```typescript
export * from './types/index.js';
export * from './schemas/index.js';
```

**Step 10: 构建并验证**

Run: `cd packages/shared && pnpm install && pnpm build`
Expected: 编译成功，dist/ 目录生成

**Step 11: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add branded types and zod schemas"
```

---

## Task 3: 创建 MCP Server 基础

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/tools/file-tools.ts`
- Create: `packages/mcp-server/src/tools/index.ts`
- Create: `packages/mcp-server/src/utils/path-validator.ts`
- Create: `packages/mcp-server/src/index.ts`

**Step 1: 创建 packages/mcp-server/package.json**

```json
{
  "name": "@cat-cafe/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "cat-cafe-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@cat-cafe/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fastify": "^4.25.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: 创建 packages/mcp-server/tsconfig.json**

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

**Step 3: 创建路径验证器 - packages/mcp-server/src/utils/path-validator.ts**

```typescript
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

/**
 * 允许访问的目录配置
 */
interface PathValidatorConfig {
  catCafeDir: string;
  allowedWorkspaceDirs: string[];
}

/**
 * 获取默认配置
 */
function getDefaultConfig(): PathValidatorConfig {
  const homeDir = os.homedir();
  const catCafeDir = process.env['CAT_CAFE_DATA_DIR']
    ? path.resolve(process.env['CAT_CAFE_DATA_DIR'].replace('~', homeDir))
    : path.join(homeDir, '.cat-cafe');

  const allowedDirs = process.env['ALLOWED_WORKSPACE_DIRS']
    ?.split(',')
    .map(d => path.resolve(d.trim().replace('~', homeDir)))
    .filter(Boolean) ?? [];

  return {
    catCafeDir,
    allowedWorkspaceDirs: allowedDirs,
  };
}

const config = getDefaultConfig();

/**
 * 验证路径是否在允许的目录内
 */
export function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);

  // 检查是否在 cat-cafe 数据目录
  if (resolved.startsWith(config.catCafeDir)) {
    return true;
  }

  // 检查是否在允许的工作区目录
  for (const allowedDir of config.allowedWorkspaceDirs) {
    if (resolved.startsWith(allowedDir)) {
      return true;
    }
  }

  return false;
}

/**
 * 获取 cat-cafe 数据目录
 */
export function getCatCafeDir(): string {
  return config.catCafeDir;
}

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * 初始化 cat-cafe 目录结构
 */
export async function initCatCafeDir(): Promise<void> {
  const dirs = [
    config.catCafeDir,
    path.join(config.catCafeDir, 'chat'),
    path.join(config.catCafeDir, 'memory'),
    path.join(config.catCafeDir, 'workspace'),
    path.join(config.catCafeDir, 'assets'),
    path.join(config.catCafeDir, '.state'),
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }

  console.log(`[MCP] Initialized cat-cafe directory at ${config.catCafeDir}`);
}
```

**Step 4: 创建文件工具 - packages/mcp-server/src/tools/file-tools.ts**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { isPathAllowed } from '../utils/path-validator.js';

/**
 * 工具定义类型
 */
export interface ToolDefinition<T extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: T;
  handler: (args: z.infer<T>) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * 创建错误结果
 */
function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * 创建成功结果
 */
function successResult(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

// === read_file ===
export const readFileTool: ToolDefinition<typeof ReadFileSchema> = {
  name: 'read_file',
  description: '读取文件内容。只能访问 ~/.cat-cafe/ 和配置的工作区目录。',
  inputSchema: z.object({
    path: z.string().describe('文件路径'),
  }),
  handler: async ({ path: filePath }) => {
    if (!isPathAllowed(filePath)) {
      return errorResult(`Access denied: ${filePath} is outside allowed directories`);
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return successResult(content);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return errorResult(`File not found: ${filePath}`);
      }
      return errorResult(`Failed to read file: ${error.message}`);
    }
  },
};

const ReadFileSchema = readFileTool.inputSchema;

// === write_file ===
export const writeFileTool: ToolDefinition<typeof WriteFileSchema> = {
  name: 'write_file',
  description: '写入文件内容。只能访问 ~/.cat-cafe/ 和配置的工作区目录。',
  inputSchema: z.object({
    path: z.string().describe('文件路径'),
    content: z.string().describe('文件内容'),
  }),
  handler: async ({ path: filePath, content }) => {
    if (!isPathAllowed(filePath)) {
      return errorResult(`Access denied: ${filePath} is outside allowed directories`);
    }

    try {
      // 确保父目录存在
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      await fs.promises.writeFile(filePath, content, 'utf8');
      return successResult(`File written: ${filePath}`);
    } catch (err) {
      const error = err as Error;
      return errorResult(`Failed to write file: ${error.message}`);
    }
  },
};

const WriteFileSchema = writeFileTool.inputSchema;

// === list_files ===
export const listFilesTool: ToolDefinition<typeof ListFilesSchema> = {
  name: 'list_files',
  description: '列出目录内容。只能访问 ~/.cat-cafe/ 和配置的工作区目录。',
  inputSchema: z.object({
    directory: z.string().describe('目录路径'),
    recursive: z.boolean().optional().default(false).describe('是否递归列出'),
  }),
  handler: async ({ directory, recursive }) => {
    if (!isPathAllowed(directory)) {
      return errorResult(`Access denied: ${directory} is outside allowed directories`);
    }

    try {
      const entries = await fs.promises.readdir(directory, { withFileTypes: true });

      const results: string[] = [];
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        const prefix = entry.isDirectory() ? '[DIR]' : '[FILE]';
        results.push(`${prefix} ${entry.name}`);

        if (recursive && entry.isDirectory()) {
          // 递归时简化输出
          const subResult = await listFilesTool.handler({
            directory: entryPath,
            recursive: true,
          });
          if (!subResult.isError) {
            const subLines = subResult.content[0]?.text
              .split('\n')
              .map(line => `  ${line}`)
              .join('\n');
            if (subLines) {
              results.push(subLines);
            }
          }
        }
      }

      return successResult(results.join('\n') || '(empty directory)');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        return errorResult(`Directory not found: ${directory}`);
      }
      if (error.code === 'ENOTDIR') {
        return errorResult(`Not a directory: ${directory}`);
      }
      return errorResult(`Failed to list directory: ${error.message}`);
    }
  },
};

const ListFilesSchema = listFilesTool.inputSchema;

/**
 * 导出所有文件工具
 */
export const fileTools = [
  readFileTool,
  writeFileTool,
  listFilesTool,
] as const;
```

**Step 5: 创建工具入口 - packages/mcp-server/src/tools/index.ts**

```typescript
export * from './file-tools.js';
```

**Step 6: 创建 MCP Server 入口 - packages/mcp-server/src/index.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileTools } from './tools/index.js';
import { initCatCafeDir, getCatCafeDir } from './utils/path-validator.js';

const SERVER_NAME = 'cat-cafe-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * 创建并配置 MCP Server
 */
async function createServer(): Promise<McpServer> {
  // 初始化数据目录
  await initCatCafeDir();

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // 注册文件工具
  for (const tool of fileTools) {
    server.tool(
      tool.name,
      tool.description,
      {
        // 转换 Zod schema 为 JSON Schema
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.shape).map(([key, schema]) => [
            key,
            {
              type: 'string',
              description: (schema as { description?: string }).description,
            },
          ])
        ),
        required: Object.keys(tool.inputSchema.shape).filter(
          key => !(tool.inputSchema.shape as Record<string, { isOptional?: () => boolean }>)[key]?.isOptional?.()
        ),
      },
      async (args) => {
        const parsed = tool.inputSchema.safeParse(args);
        if (!parsed.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `Invalid arguments: ${parsed.error.message}`,
            }],
            isError: true,
          };
        }
        return tool.handler(parsed.data);
      }
    );
  }

  console.error(`[${SERVER_NAME}] Server initialized`);
  console.error(`[${SERVER_NAME}] Data directory: ${getCatCafeDir()}`);
  console.error(`[${SERVER_NAME}] Registered ${fileTools.length} tools`);

  return server;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error(`[${SERVER_NAME}] Connected via STDIO transport`);
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
```

**Step 7: 构建并验证**

Run: `cd packages/mcp-server && pnpm install && pnpm build`
Expected: 编译成功

**Step 8: 测试 MCP Server 启动**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node packages/mcp-server/dist/index.js 2>&1 | head -20`
Expected: 看到初始化日志和 JSON-RPC 响应

**Step 9: Commit**

```bash
git add packages/mcp-server/
git commit -m "feat(mcp-server): add file tools with path validation"
```

---

## Task 4: 添加 Redis 连接模块

**Files:**
- Create: `packages/shared/src/utils/redis.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

**Step 1: 更新 packages/shared/package.json 添加 ioredis**

在 dependencies 中添加：

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0"
  }
}
```

**Step 2: 创建 Redis 工具 - packages/shared/src/utils/redis.ts**

```typescript
import Redis from 'ioredis';

/**
 * Redis 配置
 */
export interface RedisConfig {
  url: string;
  keyPrefix?: string;
}

/**
 * 获取默认 Redis 配置
 */
export function getDefaultRedisConfig(): RedisConfig {
  return {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    keyPrefix: 'cat-cafe:',
  };
}

/**
 * 创建 Redis 客户端
 */
export function createRedisClient(config?: Partial<RedisConfig>): Redis {
  const finalConfig = { ...getDefaultRedisConfig(), ...config };

  const client = new Redis(finalConfig.url, {
    keyPrefix: finalConfig.keyPrefix,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] Max retry attempts reached');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  return client;
}

/**
 * Session 存储 Key 生成
 */
export const SessionKeys = {
  /**
   * 用户-猫猫的 Session ID
   */
  session: (userId: string, catId: string) => `sessions:${userId}:${catId}`,

  /**
   * 猫猫状态
   */
  catState: (catId: string) => `state:${catId}`,

  /**
   * 任务队列
   */
  taskQueue: (catId: string) => `tasks:${catId}`,

  /**
   * 消息通道
   */
  messageChannel: () => 'chat:messages',
} as const;

/**
 * Session 存储操作
 */
export class SessionStore {
  constructor(private redis: Redis) {}

  async getSessionId(userId: string, catId: string): Promise<string | null> {
    return this.redis.get(SessionKeys.session(userId, catId));
  }

  async setSessionId(
    userId: string,
    catId: string,
    sessionId: string,
    ttlSeconds = 86400 // 24 hours
  ): Promise<void> {
    await this.redis.set(
      SessionKeys.session(userId, catId),
      sessionId,
      'EX',
      ttlSeconds
    );
  }

  async deleteSession(userId: string, catId: string): Promise<void> {
    await this.redis.del(SessionKeys.session(userId, catId));
  }

  async getCatState(catId: string): Promise<Record<string, unknown> | null> {
    const state = await this.redis.get(SessionKeys.catState(catId));
    return state ? JSON.parse(state) : null;
  }

  async setCatState(catId: string, state: Record<string, unknown>): Promise<void> {
    await this.redis.set(SessionKeys.catState(catId), JSON.stringify(state));
  }
}
```

**Step 3: 更新入口导出 - packages/shared/src/index.ts**

```typescript
export * from './types/index.js';
export * from './schemas/index.js';
export * from './utils/redis.js';
```

**Step 4: 重新构建 shared 包**

Run: `cd packages/shared && pnpm install && pnpm build`
Expected: 编译成功

**Step 5: 测试 Redis 连接（需要 Redis 运行）**

创建测试脚本临时验证：

```bash
cd packages/shared
node --experimental-specifier-resolution=node -e "
import { createRedisClient } from './dist/utils/redis.js';
const client = createRedisClient();
await client.ping();
console.log('Redis ping successful');
await client.quit();
"
```

Expected: "Redis ping successful"

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add redis connection and session store"
```

---

## Task 5: 创建初始化脚本

**Files:**
- Create: `scripts/init-cafe.sh`
- Create: `scripts/start-dev.sh`
- Modify: `package.json` (root)

**Step 1: 创建初始化脚本 - scripts/init-cafe.sh**

```bash
#!/bin/bash
set -e

echo "🐱 Initializing Cat Café..."

# 创建数据目录
CAT_CAFE_DIR="${CAT_CAFE_DATA_DIR:-$HOME/.cat-cafe}"
mkdir -p "$CAT_CAFE_DIR"/{chat,memory,workspace,assets,.state}

echo "📁 Created data directory: $CAT_CAFE_DIR"

# 检查 Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Please start Redis first."
    fi
else
    echo "⚠️  redis-cli not found. Please install Redis."
fi

# 安装依赖
echo "📦 Installing dependencies..."
pnpm install

# 构建共享包
echo "🔨 Building packages..."
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/mcp-server build

echo ""
echo "🎉 Cat Café initialized successfully!"
echo ""
echo "Next steps:"
echo "  1. Create .env file with API keys"
echo "  2. Run: pnpm dev"
```

**Step 2: 创建开发启动脚本 - scripts/start-dev.sh**

```bash
#!/bin/bash
set -e

echo "🐱 Starting Cat Café in development mode..."

# 检查 Redis
if ! redis-cli ping &> /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start Redis first:"
    echo "   brew services start redis  # macOS"
    echo "   sudo systemctl start redis # Linux"
    exit 1
fi

echo "✅ Redis is running"

# 启动开发服务器
echo "🚀 Starting development servers..."
pnpm dev
```

**Step 3: 添加执行权限**

```bash
chmod +x scripts/init-cafe.sh scripts/start-dev.sh
```

**Step 4: 更新 root package.json scripts**

在 scripts 中添加：

```json
{
  "scripts": {
    "init": "./scripts/init-cafe.sh",
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "start": "./scripts/start-dev.sh",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "clean": "pnpm -r run clean && rm -rf node_modules"
  }
}
```

**Step 5: Commit**

```bash
git add scripts/ package.json
git commit -m "chore: add init and dev scripts"
```

---

## Task 6: 创建环境变量模板

**Files:**
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: 创建 .env.example**

```bash
# === API Keys ===
# 布偶猫 (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...

# 缅因猫 (Codex)
OPENAI_API_KEY=sk-...

# 暹罗猫 (Gemini)
GOOGLE_API_KEY=...

# === Infrastructure ===
REDIS_URL=redis://localhost:6379

# === Ports ===
MCP_SERVER_PORT=3001
API_SERVER_PORT=3002
FRONTEND_PORT=3000

# === Directories ===
# 数据目录（默认 ~/.cat-cafe）
CAT_CAFE_DATA_DIR=~/.cat-cafe

# 允许访问的工作区目录（逗号分隔）
ALLOWED_WORKSPACE_DIRS=/Users/lysander/projects
```

**Step 2: 创建 .gitignore**

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test
coverage/
.nyc_output/

# Temp
tmp/
temp/
*.tmp
```

**Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add env template and gitignore"
```

---

## 验收检查清单

Phase 0 完成后，验证以下内容：

- [ ] `pnpm install` 成功
- [ ] `pnpm build` 编译所有包成功
- [ ] `@cat-cafe/shared` 可被其他包引用
- [ ] MCP Server 能启动并响应 STDIO 请求
- [ ] Redis 连接正常（需要 Redis 运行）
- [ ] `~/.cat-cafe/` 目录结构正确创建
- [ ] 没有 TypeScript 类型错误
- [ ] 没有使用 `any` 类型

---

## 文件清单

```
cat-cafe/
├── package.json                    ← root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .npmrc
├── .env.example
├── .gitignore
├── scripts/
│   ├── init-cafe.sh
│   └── start-dev.sh
└── packages/
    ├── shared/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── types/
    │       │   ├── index.ts
    │       │   ├── ids.ts
    │       │   ├── cat.ts
    │       │   └── message.ts
    │       ├── schemas/
    │       │   ├── index.ts
    │       │   └── message.schema.ts
    │       └── utils/
    │           └── redis.ts
    └── mcp-server/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── tools/
            │   ├── index.ts
            │   └── file-tools.ts
            └── utils/
                └── path-validator.ts
```

---

*计划版本：1.0*
*创建日期：2026-02-04*
*作者：布偶猫*
