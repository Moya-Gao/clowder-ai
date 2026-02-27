---
feature_ids: [F037]
topics: [multi, agent, orchestration]
doc_kind: research
created: 2026-02-26
---

# Multi-Agent Orchestration for Cat Café: Technical Feasibility Report

All three AI agents—Claude (布偶猫), Codex (缅因猫), and Gemini (暹罗猫)—can be programmatically invoked in agent mode from your Node.js backend. Each vendor provides an official SDK with non-interactive execution, MCP integration, and session management. **The recommended architecture is Approach B (Subprocess Mode) combined with SDK integration**, using the official SDKs (`@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`, `@google/adk`) with a shared MCP server for inter-agent coordination.

---

## Claude Code (布偶猫) invocation mechanisms

Claude Code provides the most mature programmatic invocation capabilities through both CLI flags and the official **Claude Agent SDK**.

### Programmatic invocation options

**Option 1: Claude Agent SDK (Recommended)**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function invokeRagdoll(prompt: string, sessionId?: string) {
  const messages = [];
  
  for await (const message of query({
    prompt,
    options: {
      model: "claude-sonnet-4-5",
      allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
      permissionMode: "bypassPermissions",  // For backend automation
      maxTurns: 50,
      resume: sessionId,  // Resume previous session
      mcpServers: [{
        name: "cat-cafe-tools",
        command: "node",
        args: ["./mcp-server/build/index.js"]
      }]
    }
  })) {
    if (message.type === 'system' && message.subtype === 'init') {
      sessionId = message.session_id;  // Capture for resume
    }
    messages.push(message);
  }
  
  return { sessionId, messages };
}
```

**Option 2: CLI subprocess with `-p` flag**

```typescript
import { spawn } from 'child_process';

function spawnClaude(prompt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--allowedTools', 'Read,Edit,Bash',
      '--mcp-config', './mcp.json',
      '--dangerously-skip-permissions'
    ]);
    
    let output = '';
    claude.stdout.on('data', (data) => output += data);
    claude.on('close', (code) => {
      resolve(JSON.parse(output));
    });
  });
}
```

### Key SDK capabilities

The `@anthropic-ai/claude-agent-sdk` package (v0.2.31+, ~1.7M weekly downloads) provides full agent control including session resume via `options.resume`, MCP server configuration via `options.mcpServers`, tool approval callbacks via `options.canUseTool`, and JSON schema output validation. Sessions are stored at `~/.claude/projects/<path>/` in JSONL format and can be resumed across requests.

### MCP configuration for Claude Code

```json
{
  "mcpServers": {
    "cat-cafe": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./workspace"]
    }
  }
}
```

---

## OpenAI Codex CLI (缅因猫) invocation mechanisms

Codex provides similarly robust programmatic control through the **Codex SDK** and `codex exec` command.

### Programmatic invocation options

**Option 1: Codex SDK (Recommended)**

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();

async function invokeMaineCoon(prompt: string, threadId?: string) {
  // Resume existing thread or start new
  const thread = threadId 
    ? codex.resumeThread(threadId)
    : codex.startThread();
  
  const result = await thread.run(prompt);
  
  return {
    threadId: thread.id,
    result
  };
}
```

**Option 2: CLI subprocess with `codex exec`**

```typescript
import { spawn } from 'child_process';

function spawnCodex(prompt: string): Promise<any> {
  return new Promise((resolve) => {
    const codex = spawn('codex', [
      'exec',
      '--json',  // NDJSON streaming output
      '--full-auto',  // workspace-write + on-request approval
      '--sandbox', 'workspace-write',
      prompt
    ]);
    
    const events: any[] = [];
    codex.stdout.on('data', (data) => {
      data.toString().split('\n').filter(Boolean)
        .forEach(line => events.push(JSON.parse(line)));
    });
    codex.on('close', () => resolve(events));
  });
}
```

### Codex sandbox modes compared to Claude

| Mode | Filesystem | Network | Equivalent Claude Flag |
|------|-----------|---------|----------------------|
| `read-only` | Read anywhere | Blocked | N/A |
| `workspace-write` | Write workspace only | Blocked | Default |
| `danger-full-access` | Full access | Allowed | `--dangerously-skip-permissions` |

Codex uses OS-level sandboxing (Seatbelt on macOS, Landlock+seccomp on Linux) which is more robust than Claude's container-based approach.

### MCP configuration for Codex

Codex supports MCP via `~/.codex/config.toml`:

```toml
[mcp_servers.cat_cafe]
url = "http://localhost:3001/mcp"
startup_timeout_sec = 30

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "./workspace"]
```

**Important limitation**: Codex currently only supports local STDIO MCP servers, not remote HTTP/SSE servers. For Cat Café, you may need to proxy HTTP MCP through a local STDIO wrapper.

---

## Gemini/Antigravity (暹罗猫) invocation mechanisms

**Antigravity is an IDE, not an API**—it cannot be programmatically invoked. Instead, use the **Google Agent Development Kit (ADK)** for TypeScript or the **Gemini CLI** in headless mode.

### Google ADK for TypeScript (Recommended)

```typescript
import { LlmAgent, InMemoryRunner } from '@google/adk';
import { z } from 'zod';

const siameseAgent = new LlmAgent({
  name: 'siamese_cat',
  model: 'gemini-2.5-flash',
  instruction: 'You are the Siamese cat assistant for Cat Café.',
  tools: [
    // Custom tools
    new FunctionTool({
      name: 'read_file',
      parameters: z.object({ path: z.string() }),
      execute: async ({ path }) => fs.readFileSync(path, 'utf8')
    })
  ]
});

async function invokeSiamese(prompt: string, userId: string, sessionId?: string) {
  const runner = new InMemoryRunner(siameseAgent);
  
  // Create or resume session
  const session = sessionId 
    ? await runner.sessionService().getSession(sessionId)
    : await runner.sessionService().createSession('siamese_cat', userId);
  
  const events = await runner.runAsync(userId, session.id, prompt);
  
  return { sessionId: session.id, events };
}
```

### Gemini CLI headless mode

```typescript
import { execSync } from 'child_process';

function spawnGemini(prompt: string): string {
  return execSync(
    `gemini -p "${prompt.replace(/"/g, '\\"')}" --output-format json -y`,
    { encoding: 'utf8' }
  );
}
```

### Gemini MCP configuration

Configure via `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "cat-cafe": {
      "command": "node",
      "args": ["./mcp-server/build/index.js"]
    }
  }
}
```

**ADK also supports MCP directly** via `McpToolset`:

```typescript
import { McpToolset, StdioConnectionParams } from '@google/adk';

const mcpTools = new McpToolset({
  connectionParams: new StdioConnectionParams({
    command: 'node',
    args: ['./mcp-server/build/index.js']
  })
});

const agent = new LlmAgent({
  name: 'siamese_with_mcp',
  model: 'gemini-2.5-flash',
  tools: [mcpTools]
});
```

---

## Open source reference projects for multi-agent orchestration

### OpenClaw architecture analysis

OpenClaw (150K+ GitHub stars) is the most relevant reference. Its architecture uses a **Gateway pattern** for multi-channel routing:

```
WhatsApp/Telegram/Slack/iMessage
            │
            ▼
    ┌───────────────────┐
    │      Gateway      │  ← WebSocket control plane (ws://127.0.0.1:18789)
    │  Session routing  │
    │  Channel mapping  │
    └─────────┬─────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
  Pi Agent   CLI    WebChat
```

OpenClaw invokes Claude Code through the `claude-code-skill` MCP integration and supports Claude Agent SDK integration. It manages multiple agents through a Skills system with 3,000+ community plugins.

### TypeScript frameworks compared

| Framework | Multi-Agent | MCP Support | Session Mgmt | Best For |
|-----------|-------------|-------------|--------------|----------|
| **VoltAgent** | ✅ Supervisor pattern | ✅ Native | ✅ Memory adapters | Production apps |
| **LangGraph.js** | ✅ DAG-based | ✅ Via tools | ✅ Checkpointers | Complex workflows |
| **Mastra** | ✅ Built-in | ✅ Native | ✅ Built-in | Full-stack apps |
| **OpenClaw** | ✅ Skills system | ✅ Native | ✅ Gateway state | Messaging bots |

**For Cat Café, VoltAgent is recommended** due to its TypeScript-native design, built-in observability, and supervisor pattern for coordinating the three cats.

---

## MCP multi-agent integration patterns

### Can multiple agents share one MCP server?

**Yes, with Streamable HTTP transport.** The MCP SDK supports concurrent client connections where each client gets its own session:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
const server = new McpServer({ name: 'cat-cafe-hub', version: '1.0.0' });

// Stateful sessions for each agent
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  let transport = transports.get(sessionId);
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => transports.set(id, transport!)
    });
    await server.connect(transport);
  }
  
  await transport.handleRequest(req, res, req.body);
});
```

### Inter-agent communication via shared MCP resources

The recommended pattern is **indirect communication through shared context**:

```typescript
// Shared state resource for agent coordination
server.registerResource(
  'agent-state',
  new ResourceTemplate('agent://{agentId}/state', {}),
  { title: 'Agent State' },
  async (uri, { agentId }) => ({
    contents: [{ 
      uri: uri.href, 
      text: await redis.get(`agent:${agentId}:state`) || '{}' 
    }]
  })
);

// Task queue tool for agent-to-agent task delegation
server.registerTool('delegate_task', {
  inputSchema: { 
    targetAgent: z.enum(['ragdoll', 'maine_coon', 'siamese']),
    task: z.string()
  }
}, async ({ targetAgent, task }) => {
  await redis.rpush(`tasks:${targetAgent}`, JSON.stringify({ task, from: 'coordinator' }));
  server.notifyResourceUpdated({ uri: `agent://${targetAgent}/tasks` });
  return { content: [{ type: 'text', text: `Task delegated to ${targetAgent}` }] };
});
```

### MCP gateway options

For production multi-agent deployments, consider these gateway solutions:

- **Microsoft MCP Gateway**: Kubernetes-native, session-aware routing
- **AWS AgentCore Gateway**: Managed service with tool routing and auth
- **ContextForge** (IBM): Open-source with A2A features and federation

---

## Feasibility matrix for the four architectural approaches

| Approach | Complexity | Agent Capabilities | Latency | Scalability | Recommended? |
|----------|------------|-------------------|---------|-------------|--------------|
| **A: Pure API** | Low | Limited (no filesystem/bash) | Low | High | ❌ Doesn't meet requirements |
| **B: Subprocess Mode** | Medium | Full agent mode | Medium | Medium | ✅ **Recommended** |
| **C: SDK Mode** | Medium | Full agent mode | Low | High | ✅ **Best option** |
| **D: External Process + Shared State** | High | Full agent mode | High | Low | ⚠️ For user-controlled agents |

### Detailed assessment

**Approach A (Pure API)** cannot meet the core requirement. The Anthropic Messages API, OpenAI Chat API, and Gemini API don't provide filesystem access, command execution, or MCP tool use. Function calling exists but requires you to implement all tool execution in your backend—essentially rebuilding what Claude Code/Codex already do.

**Approach B (Subprocess Mode)** works well by spawning `claude -p`, `codex exec`, or `gemini -p` as child processes. Pros include full agent capabilities, simple implementation, and no SDK dependencies. Cons are process startup overhead per request (**~500ms-2s**) and TTY/pseudo-terminal requirements on some platforms.

**Approach C (SDK Mode)** is the best option using official SDKs (`@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`, `@google/adk`). These provide programmatic control without process spawning, session management, and streaming responses. This is **the recommended approach** for Cat Café.

**Approach D (External Process)** is useful if you want users to run their own Claude Code/Codex instances and your backend coordinates via MCP. This adds complexity but enables user-controlled agents with their own API keys.

---

## Recommended Cat Café architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cat Café Frontend                             │
│                    (Next.js + Socket.io Client)                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cat Café Backend                                 │
│                    (Fastify + Socket.io Server)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Router Service                          │   │
│  │  • Parse @mentions (布偶猫, 缅因猫, 暹罗猫)                        │   │
│  │  • Route to appropriate agent service                            │   │
│  │  • Manage sessions per user/conversation                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                               │                                         │
│         ┌─────────────────────┼─────────────────────┐                  │
│         ▼                     ▼                     ▼                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│  │ ClaudeAgent │      │ CodexAgent  │      │ GeminiAgent │            │
│  │   Service   │      │   Service   │      │   Service   │            │
│  │             │      │             │      │             │            │
│  │ SDK:        │      │ SDK:        │      │ SDK:        │            │
│  │ claude-     │      │ @openai/    │      │ @google/adk │            │
│  │ agent-sdk   │      │ codex-sdk   │      │             │            │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘            │
│         │                    │                    │                    │
│         └────────────────────┼────────────────────┘                    │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Shared MCP Server                             │   │
│  │           (Streamable HTTP, @modelcontextprotocol/sdk)          │   │
│  │                                                                  │   │
│  │  Tools:                    Resources:                           │   │
│  │  • read_file              • agent://{id}/state                  │   │
│  │  • write_file             • workspace://{path}                  │   │
│  │  • execute_command        • conversation://{id}                 │   │
│  │  • delegate_to_agent                                            │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │     Workspace (Filesystem)   │
                    │     + Redis (State/Queue)    │
                    └─────────────────────────────┘
```

### Implementation code for the agent router

```typescript
// backend/services/agent-router.ts
import { ClaudeAgentService } from './claude-agent';
import { CodexAgentService } from './codex-agent';
import { GeminiAgentService } from './gemini-agent';

type AgentType = 'ragdoll' | 'maine_coon' | 'siamese';

const MENTION_PATTERNS: Record<string, AgentType> = {
  '@布偶猫': 'ragdoll',
  '@ragdoll': 'ragdoll',
  '@缅因猫': 'maine_coon', 
  '@mainecoon': 'maine_coon',
  '@暹罗猫': 'siamese',
  '@siamese': 'siamese'
};

export class AgentRouter {
  private claude = new ClaudeAgentService();
  private codex = new CodexAgentService();
  private gemini = new GeminiAgentService();
  private sessions = new Map<string, { type: AgentType; sessionId: string }>();

  async route(userId: string, message: string): Promise<AsyncIterable<any>> {
    const agent = this.detectAgent(message);
    const prompt = this.stripMention(message);
    const sessionKey = `${userId}:${agent}`;
    const existingSession = this.sessions.get(sessionKey);

    switch (agent) {
      case 'ragdoll':
        return this.claude.invoke(prompt, existingSession?.sessionId);
      case 'maine_coon':
        return this.codex.invoke(prompt, existingSession?.sessionId);
      case 'siamese':
        return this.gemini.invoke(prompt, existingSession?.sessionId);
    }
  }

  private detectAgent(message: string): AgentType {
    for (const [pattern, agent] of Object.entries(MENTION_PATTERNS)) {
      if (message.includes(pattern)) return agent;
    }
    return 'ragdoll'; // Default to Claude
  }
}
```

### MCP server implementation for shared tools

```typescript
// mcp-server/src/index.ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import Fastify from 'fastify';
import Redis from 'ioredis';

const redis = new Redis();
const server = new McpServer({ name: 'cat-cafe-mcp', version: '1.0.0' });

// Shared file operations
server.registerTool('read_file', {
  inputSchema: { path: z.string() }
}, async ({ path }) => {
  const content = await fs.promises.readFile(path, 'utf8');
  return { content: [{ type: 'text', text: content }] };
});

// Inter-agent task delegation
server.registerTool('delegate_task', {
  inputSchema: {
    targetAgent: z.enum(['ragdoll', 'maine_coon', 'siamese']),
    task: z.string(),
    context: z.string().optional()
  }
}, async ({ targetAgent, task, context }) => {
  const taskId = crypto.randomUUID();
  await redis.rpush(`tasks:${targetAgent}`, JSON.stringify({ 
    id: taskId, task, context, createdAt: Date.now() 
  }));
  return { content: [{ type: 'text', text: `Task ${taskId} delegated to ${targetAgent}` }] };
});

// Shared agent state resource
server.registerResource(
  'agent-state',
  new ResourceTemplate('state://{agentId}', { list: undefined }),
  { title: 'Agent State' },
  async (uri, { agentId }) => ({
    contents: [{ uri: uri.href, text: await redis.get(`state:${agentId}`) || '{}' }]
  })
);

// Start HTTP server
const app = Fastify();
const transports = new Map();

app.post('/mcp', async (req, reply) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  let transport = transports.get(sessionId);
  
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => transports.set(id, transport)
    });
    await server.connect(transport);
  }
  
  await transport.handleRequest(req.raw, reply.raw, req.body);
});

app.listen({ port: 3001 });
```

---

## Unresolved questions requiring further experimentation

Several technical questions cannot be fully answered through documentation research alone:

1. **SDK stability**: The `@anthropic-ai/claude-agent-sdk` had a known `sdk.mjs` missing issue in versions 2.0.5-2.0.25. Current version stability should be verified.

2. **Codex MCP HTTP limitation**: Codex only supports STDIO MCP servers locally. Testing whether a STDIO-to-HTTP proxy works reliably is needed.

3. **ADK TypeScript maturity**: Google ADK for TypeScript is v0.1.0 with "not recommended for production" warning. Real-world stability testing required.

4. **Session persistence across restarts**: How do SDK sessions behave when the backend process restarts? Testing Redis-backed session state recovery is needed.

5. **Concurrent agent performance**: What's the practical limit for concurrent agent invocations? Load testing with 10+ simultaneous users recommended.

6. **MCP resource subscription latency**: Real-world latency for inter-agent coordination via MCP subscriptions is undocumented.

7. **Gemini CLI authentication**: The Gemini CLI requires interactive OAuth on first run. Determining how to handle this in a server environment needs investigation.

---

## Quick start implementation checklist

For rapid prototyping of Cat Café:

- [ ] Install SDKs: `npm install @anthropic-ai/claude-agent-sdk @openai/codex-sdk @google/adk`
- [ ] Install MCP SDK: `npm install @modelcontextprotocol/sdk zod`
- [ ] Set up API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
- [ ] Create shared MCP server with Streamable HTTP transport
- [ ] Implement agent services wrapping each SDK
- [ ] Build agent router with @mention parsing
- [ ] Connect Socket.io for real-time streaming to frontend
- [ ] Add Redis for session state persistence
- [ ] Test each agent individually before integration

The architecture prioritizes using official SDKs over subprocess spawning for lower latency and better error handling, with a shared MCP server enabling inter-agent coordination through tools and resources.