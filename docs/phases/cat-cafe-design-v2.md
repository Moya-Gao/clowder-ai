---
feature_ids: []
topics: [phases, cat, cafe]
doc_kind: note
created: 2026-02-26
---

# Cat Café 完整设计文档

> 创建日期：2026-02-04
> 状态：设计完成，待实现
> 版本：2.0（含研究成果）
> 作者：布偶猫（Claude Opus 4.5）+ 铲屎官 + 三猫研究团队

---

## 1. 项目概述

### 1.1 一句话描述
Cat Café 是一个让三只 AI 猫猫（Claude/GPT/Gemini）能够真正协作的 Web 应用，铲屎官可以在一个界面里和所有猫聊天，猫猫们共享工作空间和记忆。

### 1.2 核心问题
- 铲屎官目前是「人肉路由器」，手动在三个 AI 服务之间复制粘贴
- 三只猫互相不知道对方干了什么
- 每次新开窗口都要重新解释上下文

### 1.3 解决方案
- 统一的 Web 聊天界面，支持 @ 召唤特定猫猫
- 使用官方 Agent SDK 程序化调用猫猫（保留完整 agent 能力）
- 共享 MCP Server 实现工具和状态共享
- Session 持久化实现上下文延续

---

## 2. 用户旅程

### 2.1 启动流程

```
铲屎官执行: ./start-cafe.sh
     │
     ▼
┌─────────────────────────────────────────┐
│           启动脚本执行                   │
│  1. 启动 MCP Server (localhost:3001)    │
│  2. 启动 API Backend (localhost:3002)   │
│  3. 启动 Next.js Frontend (:3000)       │
│  4. 初始化 Redis (Session/Queue)        │
└─────────────────────────────────────────┘
     │
     ▼
铲屎官打开浏览器 → http://localhost:3000
     │
     ▼
┌─────────────────────────────────────────┐
│           前端加载                       │
│  1. 检查是否有活跃 Session              │
│  2. 显示聊天界面                         │
│  3. WebSocket 连接 Backend              │
└─────────────────────────────────────────┘
```

### 2.2 发送消息流程（核心用户旅程）

```
用户在输入框输入: "@布偶 帮我重构这个模块"
     │
     ▼
┌─────────────────────────────────────────┐
│           前端处理                       │
│  1. 解析 @ 提及 → mentions: ['opus']    │
│  2. 通过 WebSocket 发送到 Backend       │
│  3. 显示 "发送中..." 状态               │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│           Backend Agent Router          │
│  1. 接收消息，提取 mentions             │
│  2. 查找 opus 的 Session                │
│     ├── 有活跃 Session → resume         │
│     └── 无 Session → 创建新的           │
│  3. 调用 ClaudeAgentService             │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│        ClaudeAgentService               │
│  使用 @anthropic-ai/claude-agent-sdk    │
│                                         │
│  for await (const msg of query({        │
│    prompt: "帮我重构这个模块",          │
│    options: {                           │
│      resume: sessionId,                 │
│      mcpServers: [{ name: "cat-cafe" }],│
│      allowedTools: ["Read","Edit"...]   │
│    }                                    │
│  })) {                                  │
│    // 流式返回消息                      │
│  }                                      │
└─────────────────────────────────────────┘
     │
     ├── Claude 需要读取文件
     │         │
     │         ▼
     │   ┌─────────────────────┐
     │   │  Shared MCP Server  │
     │   │  执行 read_file()   │
     │   │  返回文件内容       │
     │   └─────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│           响应流式返回                   │
│  1. Backend 通过 WebSocket 推送         │
│  2. 前端实时显示 Claude 的回复          │
│  3. 显示工具调用状态（读取文件中...）   │
│  4. 完成后更新 Session 状态             │
└─────────────────────────────────────────┘
```

### 2.3 多猫协作流程

```
用户: "@布偶 写个函数 @缅因 帮忙审查"
     │
     ▼
┌─────────────────────────────────────────┐
│           Agent Router                   │
│  mentions: ['opus', 'codex']            │
│  策略: 串行执行（opus 先，codex 后）    │
└─────────────────────────────────────────┘
     │
     ├── Step 1: 调用 Claude
     │         │
     │         ▼
     │   Claude 写代码，完成后返回
     │         │
     │         ▼
     │   将 Claude 的输出作为 Codex 的上下文
     │
     ├── Step 2: 调用 Codex
     │         │
     │         ▼
     │   Codex 审查代码，返回建议
     │
     ▼
前端显示两只猫的完整对话
```

### 2.4 Session 管理

```
┌─────────────────────────────────────────────────────────────┐
│                    Session 生命周期                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  创建 Session                                               │
│  ├── 用户第一次 @ 某只猫                                    │
│  ├── 调用 SDK 创建新 Session                                │
│  └── 存储 sessionId 到 Redis: sessions:{userId}:{catId}    │
│                                                             │
│  恢复 Session                                               │
│  ├── 用户再次 @ 同一只猫                                    │
│  ├── 从 Redis 读取 sessionId                                │
│  └── 调用 SDK 的 resume 功能                                │
│                                                             │
│  Session 过期                                               │
│  ├── 超过 24 小时未活动                                     │
│  ├── 或用户主动关闭项目                                     │
│  └── 清理 Redis 中的 Session 记录                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 系统架构（研究成果整合版）

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cat Café Frontend                             │
│                    (Next.js + Socket.io Client)                        │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  聊天界面   │  │  文件浏览器  │  │  任务看板   │  │  猫猫状态   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ WebSocket + REST API
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cat Café Backend                                 │
│                    (Fastify + Socket.io Server)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Router Service                          │   │
│  │  • 解析 @mentions (布偶猫, 缅因猫, 暹罗猫)                        │   │
│  │  • 路由到对应 Agent Service                                      │   │
│  │  • 管理 Session (创建/恢复/清理)                                 │   │
│  │  • 处理多猫协作的串行/并行策略                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                         │
│         ┌─────────────────────┼─────────────────────┐                  │
│         ▼                     ▼                     ▼                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │ ClaudeAgent     │  │ CodexAgent      │  │ GeminiAgent     │        │
│  │    Service      │  │    Service      │  │    Service      │        │
│  │                 │  │                 │  │                 │        │
│  │ SDK:            │  │ SDK:            │  │ SDK:            │        │
│  │ @anthropic-ai/  │  │ @openai/        │  │ @google/adk     │        │
│  │ claude-agent-sdk│  │ codex-sdk       │  │                 │        │
│  │                 │  │                 │  │                 │        │
│  │ 能力:           │  │ 能力:           │  │ 能力:           │        │
│  │ • 代码生成      │  │ • 代码审查      │  │ • 视觉设计      │        │
│  │ • 架构设计      │  │ • Bug 定位      │  │ • 创意发散      │        │
│  │ • 文件操作      │  │ • 测试补充      │  │ • 图片理解      │        │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│           │                    │                    │                  │
│           └────────────────────┼────────────────────┘                  │
│                                ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Shared MCP Server                             │   │
│  │           (Streamable HTTP, @modelcontextprotocol/sdk)          │   │
│  │                                                                  │   │
│  │  Tools:                         Resources:                      │   │
│  │  • read_file(path)              • agent://{id}/state           │   │
│  │  • write_file(path, content)    • workspace://{path}           │   │
│  │  • list_files(dir)              • conversation://{id}          │   │
│  │  • execute_command(cmd)                                         │   │
│  │  • post_message(content)        Inter-Agent:                    │   │
│  │  • read_new_messages()          • delegate_task(targetCat,task)│   │
│  │  • notify_cats(msg)             • get_cat_status()             │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
          ┌─────────────────────┐    ┌─────────────────────┐
          │   File Storage      │    │       Redis         │
          │   ~/.cat-cafe/      │    │                     │
          │                     │    │  • Session 状态     │
          │  ├── chat/          │    │  • 任务队列         │
          │  ├── memory/        │    │  • 猫猫状态缓存     │
          │  ├── workspace/     │    │  • 消息订阅         │
          │  ├── assets/        │    │                     │
          │  └── .state/        │    │                     │
          └─────────────────────┘    └─────────────────────┘
```

### 3.2 Agent 调用方式对比（研究结论）

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **A: 纯 API** | 直接调用 Claude/OpenAI/Gemini 的 Chat API | 简单 | 失去 agent 能力（无文件操作、命令执行） | ❌ 不满足需求 |
| **B: 子进程** | spawn claude/codex CLI 作为子进程 | 完整能力 | 进程启动开销 500ms-2s，输出解析复杂 | ⚠️ 备选 |
| **C: SDK** | 使用官方 Agent SDK | 完整能力、低延迟、流式响应、Session 管理 | 需要学习各 SDK | ✅ **推荐** |
| **D: 外部进程** | 独立运行 agent，通过 MCP 协调 | 松耦合 | 同步复杂、延迟高 | ⚠️ 特殊场景 |

**最终决策：采用方案 C（SDK 模式）**

### 3.3 三只猫的技术接入

```typescript
// === 布偶猫 (Claude) ===
// 使用: @anthropic-ai/claude-agent-sdk
import { query } from "@anthropic-ai/claude-agent-sdk";

async function invokeRagdoll(prompt: string, sessionId?: string) {
  for await (const msg of query({
    prompt,
    options: {
      model: "claude-sonnet-4-5",
      allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      resume: sessionId,
      mcpServers: [{
        name: "cat-cafe-tools",
        command: "node",
        args: ["./mcp-server/build/index.js"]
      }]
    }
  })) {
    yield msg;
  }
}

// === 缅因猫 (Codex) ===
// 使用: @openai/codex-sdk
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();

async function invokeMaineCoon(prompt: string, threadId?: string) {
  const thread = threadId
    ? codex.resumeThread(threadId)
    : codex.startThread();

  return await thread.run(prompt);
}

// === 暹罗猫 (Gemini) ===
// 使用: @google/adk
import { LlmAgent, InMemoryRunner } from '@google/adk';

const siameseAgent = new LlmAgent({
  name: 'siamese_cat',
  model: 'gemini-2.5-flash',
  instruction: 'You are the Siamese cat...',
  tools: [/* MCP tools */]
});

async function invokeSiamese(prompt: string, sessionId?: string) {
  const runner = new InMemoryRunner(siameseAgent);
  const session = sessionId
    ? await runner.sessionService().getSession(sessionId)
    : await runner.sessionService().createSession('siamese', 'user');

  return await runner.runAsync('user', session.id, prompt);
}
```

---

## 4. MCP Server 详细设计（研究成果整合）

### 4.1 多 Agent 共享 MCP 的实现

```typescript
// mcp-server/src/index.ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import Fastify from 'fastify';
import Redis from 'ioredis';

const redis = new Redis();
const server = new McpServer({ name: 'cat-cafe-mcp', version: '1.0.0' });

// === 文件操作工具 ===
server.registerTool('read_file', {
  inputSchema: z.object({ path: z.string() })
}, async ({ path }) => {
  // 安全检查：只允许访问 ~/.cat-cafe/ 和指定项目目录
  if (!isPathAllowed(path)) {
    throw new Error('Access denied: path outside allowed directories');
  }
  const content = await fs.promises.readFile(path, 'utf8');
  return { content: [{ type: 'text', text: content }] };
});

server.registerTool('write_file', {
  inputSchema: z.object({
    path: z.string(),
    content: z.string()
  })
}, async ({ path, content }) => {
  if (!isPathAllowed(path)) {
    throw new Error('Access denied');
  }
  await fs.promises.writeFile(path, content, 'utf8');
  return { content: [{ type: 'text', text: `File written: ${path}` }] };
});

// === 消息工具 ===
server.registerTool('post_message', {
  inputSchema: z.object({
    content: z.string(),
    mentions: z.array(z.string()).optional()
  })
}, async ({ content, mentions }) => {
  const message = {
    id: crypto.randomUUID(),
    content,
    mentions: mentions || [],
    timestamp: Date.now()
  };
  await appendToChatLog(message);
  await redis.publish('chat:messages', JSON.stringify(message));
  return { content: [{ type: 'text', text: `Message posted` }] };
});

// === Agent 间任务委派 ===
server.registerTool('delegate_task', {
  inputSchema: z.object({
    targetAgent: z.enum(['ragdoll', 'maine_coon', 'siamese']),
    task: z.string(),
    context: z.string().optional()
  })
}, async ({ targetAgent, task, context }) => {
  const taskId = crypto.randomUUID();
  await redis.rpush(`tasks:${targetAgent}`, JSON.stringify({
    id: taskId,
    task,
    context,
    createdAt: Date.now()
  }));
  return { content: [{ type: 'text', text: `Task ${taskId} delegated to ${targetAgent}` }] };
});

// === 共享状态资源 ===
server.registerResource(
  'agent-state',
  new ResourceTemplate('state://{agentId}', { list: undefined }),
  { title: 'Agent State' },
  async (uri, { agentId }) => ({
    contents: [{
      uri: uri.href,
      text: await redis.get(`state:${agentId}`) || '{}'
    }]
  })
);

// === HTTP 服务器（支持多 Session） ===
const app = Fastify();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req, reply) => {
  const sessionId = req.headers['mcp-session-id'] as string || crypto.randomUUID();

  let transport = transports.get(sessionId);
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => transports.set(id, transport!)
    });
    await server.connect(transport);
  }

  await transport.handleRequest(req.raw, reply.raw, req.body);
});

app.listen({ port: 3001 });
```

### 4.2 工具列表

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `read_file` | 读取文件内容 | `path: string` |
| `write_file` | 写入文件内容 | `path: string, content: string` |
| `list_files` | 列出目录内容 | `directory: string` |
| `execute_command` | 执行 shell 命令 | `command: string, cwd?: string` |
| `post_message` | 发送聊天消息 | `content: string, mentions?: string[]` |
| `read_new_messages` | 读取新消息 | `since?: LastSeenPosition` |
| `notify_cats` | 通知其他猫猫 | `message: string, targets?: CatId[]` |
| `delegate_task` | 委派任务给其他猫 | `targetAgent: CatId, task: string` |
| `get_cat_status` | 获取猫猫状态 | `catId?: CatId` |
| `get_workspace_status` | 获取工作区状态 | 无 |
| `git_status` | 获取 Git 状态 | 无 |
| `git_commit` | 提交更改 | `message: string, files: string[]` |

---

## 5. 技术栈（确定版）

### 5.1 核心依赖

```json
{
  "dependencies": {
    // === Agent SDKs ===
    "@anthropic-ai/claude-agent-sdk": "^0.2.31",
    "@openai/codex-sdk": "^1.0.0",
    "@google/adk": "^0.1.0",

    // === MCP ===
    "@modelcontextprotocol/sdk": "^1.0.0",

    // === Backend ===
    "fastify": "^4.25.0",
    "socket.io": "^4.7.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0",

    // === Frontend ===
    "next": "^14.1.0",
    "react": "^18.2.0",
    "socket.io-client": "^4.7.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### 5.2 环境变量

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

REDIS_URL=redis://localhost:6379
MCP_SERVER_PORT=3001
API_SERVER_PORT=3002
FRONTEND_PORT=3000

CAT_CAFE_DATA_DIR=~/.cat-cafe
ALLOWED_WORKSPACE_DIRS=/Users/lysander/projects
```

---

## 6. 领域模型（DDD）

### 6.1 目录结构

```
cat-cafe/
├── packages/
│   ├── shared/                 ← 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── ids.ts      (Branded types)
│   │   │   │   ├── message.ts
│   │   │   │   ├── cat.ts
│   │   │   │   └── index.ts
│   │   │   ├── schemas/        (Zod schemas)
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── mcp-server/             ← MCP Server
│   │   ├── src/
│   │   │   ├── tools/
│   │   │   │   ├── file-tools.ts
│   │   │   │   ├── chat-tools.ts
│   │   │   │   ├── git-tools.ts
│   │   │   │   └── index.ts
│   │   │   ├── resources/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/                    ← Backend API
│   │   ├── src/
│   │   │   ├── domains/
│   │   │   │   ├── chat/
│   │   │   │   │   ├── entities/
│   │   │   │   │   ├── services/
│   │   │   │   │   └── repositories/
│   │   │   │   ├── cats/
│   │   │   │   │   ├── entities/
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── AgentRouter.ts
│   │   │   │   │   │   ├── ClaudeAgentService.ts
│   │   │   │   │   │   ├── CodexAgentService.ts
│   │   │   │   │   │   └── GeminiAgentService.ts
│   │   │   │   │   └── adapters/
│   │   │   │   └── workspace/
│   │   │   ├── infrastructure/
│   │   │   │   ├── http/
│   │   │   │   ├── websocket/
│   │   │   │   └── redis/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── web/                    ← Next.js Frontend
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── hooks/
│       │   └── stores/
│       └── package.json
│
├── docs/
│   ├── VISION.md
│   ├── plans/
│   ├── tasks/
│   └── decisions/
│
├── scripts/
│   └── start-cafe.sh
│
├── CLAUDE.md
├── AGENTS.md
├── GEMINI.md
└── package.json               (pnpm workspace root)
```

### 6.2 核心服务实现

```typescript
// packages/api/src/domains/cats/services/AgentRouter.ts

import { ClaudeAgentService } from './ClaudeAgentService';
import { CodexAgentService } from './CodexAgentService';
import { GeminiAgentService } from './GeminiAgentService';
import { CatId, Message } from '@cat-cafe/shared';
import Redis from 'ioredis';

const MENTION_PATTERNS: Record<string, CatId> = {
  '@布偶猫': 'opus' as CatId,
  '@布偶': 'opus' as CatId,
  '@ragdoll': 'opus' as CatId,
  '@缅因猫': 'codex' as CatId,
  '@缅因': 'codex' as CatId,
  '@mainecoon': 'codex' as CatId,
  '@暹罗猫': 'gemini' as CatId,
  '@暹罗': 'gemini' as CatId,
  '@siamese': 'gemini' as CatId,
};

export class AgentRouter {
  private claude: ClaudeAgentService;
  private codex: CodexAgentService;
  private gemini: GeminiAgentService;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.claude = new ClaudeAgentService();
    this.codex = new CodexAgentService();
    this.gemini = new GeminiAgentService();
  }

  async route(
    userId: string,
    message: string
  ): Promise<AsyncIterable<AgentMessage>> {
    const mentions = this.extractMentions(message);
    const prompt = this.stripMentions(message);

    if (mentions.length === 0) {
      // 默认路由到布偶猫
      mentions.push('opus' as CatId);
    }

    if (mentions.length === 1) {
      return this.invokeSingle(userId, mentions[0], prompt);
    } else {
      return this.invokeMultiple(userId, mentions, prompt);
    }
  }

  private async *invokeSingle(
    userId: string,
    catId: CatId,
    prompt: string
  ): AsyncIterable<AgentMessage> {
    const sessionKey = `sessions:${userId}:${catId}`;
    const sessionId = await this.redis.get(sessionKey);

    const service = this.getService(catId);

    for await (const msg of service.invoke(prompt, sessionId || undefined)) {
      // 更新 session
      if (msg.type === 'session_init') {
        await this.redis.set(sessionKey, msg.sessionId, 'EX', 86400);
      }
      yield msg;
    }
  }

  private async *invokeMultiple(
    userId: string,
    mentions: CatId[],
    prompt: string
  ): AsyncIterable<AgentMessage> {
    // 串行执行，每只猫的输出作为下一只的上下文
    let context = prompt;

    for (const catId of mentions) {
      yield { type: 'cat_start', catId };

      let response = '';
      for await (const msg of this.invokeSingle(userId, catId, context)) {
        yield msg;
        if (msg.type === 'text') {
          response += msg.content;
        }
      }

      // 下一只猫的上下文包含前一只的回复
      context = `${prompt}\n\n[${catId} 的回复]: ${response}`;

      yield { type: 'cat_end', catId };
    }
  }

  private extractMentions(message: string): CatId[] {
    const mentions: CatId[] = [];
    for (const [pattern, catId] of Object.entries(MENTION_PATTERNS)) {
      if (message.includes(pattern) && !mentions.includes(catId)) {
        mentions.push(catId);
      }
    }
    return mentions;
  }

  private getService(catId: CatId) {
    switch (catId) {
      case 'opus': return this.claude;
      case 'codex': return this.codex;
      case 'gemini': return this.gemini;
      default: throw new Error(`Unknown cat: ${catId}`);
    }
  }
}
```

---

## 7. 前端设计

### 7.1 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│  🐱 Cat Café                            [深/浅] [设置]      │
├──────────────┬──────────────────────────────┬───────────────┤
│              │                              │               │
│   历史记录   │         聊天区域             │    状态栏     │
│              │                              │               │
│  ┌────────┐  │  ┌────────────────────────┐  │  ┌─────────┐  │
│  │ 今天   │  │  │ 🐱 布偶猫              │  │  │ 在线    │  │
│  │ 昨天   │  │  │ 这是一条消息...        │  │  │         │  │
│  │ 2/2    │  │  └────────────────────────┘  │  │ 🟣 布偶  │  │
│  │ 2/1    │  │                              │  │ 🟢 缅因  │  │
│  │ ...    │  │  ┌────────────────────────┐  │  │ 🔵 暹罗  │  │
│  │        │  │  │ 🦁 缅因猫              │  │  │         │  │
│  └────────┘  │  │ 代码审查结果...        │  │  │ ──────  │  │
│              │  └────────────────────────┘  │  │ 上下文  │  │
│   项目       │                              │  │         │  │
│  ┌────────┐  │  ┌────────────────────────┐  │  │ 📁 3文件│  │
│  │ 📁 src │  │  │ 😼 暹罗猫              │  │  │ 📊 任务 │  │
│  │ 📁 docs│  │  │ 我有一个想法！         │  │  │         │  │
│  │ 📄 ... │  │  └────────────────────────┘  │  └─────────┘  │
│  └────────┘  │                              │               │
│              ├──────────────────────────────┤               │
│              │  [📎] [😺] 输入消息...  [@] │               │
│              │                        [发送]│               │
└──────────────┴──────────────────────────────┴───────────────┘
```

### 7.2 视觉风格

**整体氛围：温馨猫咖感**

**三只猫的差异化：**

| 猫猫 | 主色 | 辅助色 | 字体 | 消息框样式 |
|------|------|--------|------|------------|
| 布偶猫 | #9B7EBD (薰衣草紫) | #E8DFF0 | 圆润无衬线 | 大圆角、柔和阴影 |
| 缅因猫 | #5B8C5A (森林绿) | #E0EBE0 | 等宽字体 | 小圆角、清晰边框 |
| 暹罗猫 | #5B9BD5 (天空蓝) | #E0ECF5 | 手写风格 | 不规则边框、活泼 |

---

## 8. 功能清单与开发顺序

### Phase 0: 地基（后端核心）
- [ ] 项目初始化（pnpm monorepo）
- [ ] 共享类型包 `@cat-cafe/shared`
- [ ] MCP Server 基础实现
- [ ] Redis 连接

### Phase 1: 单猫通信
- [ ] ClaudeAgentService 实现
- [ ] 基础 API 路由
- [ ] WebSocket 实时通信
- [ ] 前端聊天界面（无样式）

### Phase 2: 三猫接入
- [ ] CodexAgentService 实现
- [ ] GeminiAgentService 实现
- [ ] AgentRouter @ 解析
- [ ] 多猫串行调用

### Phase 3: 完整体验
- [ ] 发图片功能
- [ ] 猫猫状态显示
- [ ] 历史记录
- [ ] 视觉资产集成

### Phase 4: 高级功能
- [ ] 共享文件系统 UI
- [ ] Git 集成
- [ ] 任务看板

---

## 9. 可维护性原则

### 9.1 代码规范

1. **文件大小**：每个文件 < 200 行
2. **函数命名**：自解释，不看实现就知道干嘛
3. **模块文档**：每个领域模块有 README.md
4. **决策记录**：重要决策写 ADR 到 docs/decisions/

### 9.2 TypeScript 规范

- 使用 Branded Types 区分 ID 类型
- Zod schema 定义 API 契约
- 禁止 `any` 类型
- 严格 null 检查

### 9.3 测试要求

- 核心领域逻辑：单元测试覆盖
- API 层：集成测试
- Agent 调用：Mock SDK 测试

### 9.4 Git 规范

- 主分支：`main`
- 功能分支：`feature/<cat>/<feature-name>`
- 提交信息：`<type>(<scope>): <description>`

---

## 10. 可扩展性设计

### 10.1 新增猫猫

只需三步：

1. 实现 `AgentService` 接口
2. 创建猫猫 Profile
3. 在 `AgentRouter` 中注册

### 10.2 新增前端

后端提供标准接口：
- REST API：`/api/messages`, `/api/cats`
- WebSocket：消息推送
- MCP：Agent 工具

---

## 11. 安全考虑

### 11.1 文件访问限制

MCP Server 只允许访问：
- `~/.cat-cafe/` 目录
- 环境变量 `ALLOWED_WORKSPACE_DIRS` 指定的目录

### 11.2 命令执行限制

- 禁止 `rm -rf`、`sudo` 等危险命令
- 使用 Hooks 拦截并确认敏感操作

### 11.3 API Key 安全

- 不在前端暴露 API Key
- 通过后端代理调用 SDK

---

## 12. 已知限制和待解决问题

基于三猫研究报告，以下问题需要在开发中验证：

1. **Codex MCP 限制**：Codex 只支持 STDIO MCP，不支持 HTTP。可能需要 STDIO-to-HTTP 代理。

2. **ADK 成熟度**：Google ADK TypeScript 版本是 v0.1.0，标注"不建议用于生产"。需要实际测试稳定性。

3. **Session 恢复**：SDK Session 在后端重启后如何恢复？需要测试 Redis 备份方案。

4. **并发性能**：多用户同时使用时的 Agent 并发限制是多少？需要负载测试。

5. **Gemini CLI 认证**：首次运行需要交互式 OAuth，服务器环境如何处理？

---

## 附录 A: 参考项目

- **OpenClaw** (https://github.com/openclaw/openclaw)：Gateway 模式参考
- **VoltAgent**：TypeScript 多 agent 框架
- **LangGraph.js**：DAG 工作流
- **MCP Hub** (ravitemer/mcp-hub)：MCP 路由中心

---

## 附录 B: 研究报告

完整研究报告位于：
- `research-report/Multi-Agent "Cat Café" Research Report by gpt.md`
- `research-report/Multi-Agent Orchestration for Cat Café: Technical Feasibility Report claude.md`
- `research-report/Cat Café Agent Orchestration Research by gemini.md`

---

*文档版本：2.0*
*最后更新：2026-02-04 19:30*
*作者：布偶猫 + 铲屎官 + 三猫研究团队*
