# F050 Phase 3: A2A L2 Protocol Adapter

**Feature:** F050 — `docs/features/F050-a2a-external-agent-onboarding.md`
**Goal:** Cat Café 猫猫能通过标准 A2A 协议（tasks/send + tasks/sendSubscribe）和远程 Agent 通信。
**Acceptance Criteria:**
- [ ] `A2AAgentService` 设计稿 + 接口定义完成
- [ ] opencode CLI 兼容性测试清单完成
- [ ] 至少 1 个 A2A agent 通过 L2 验收
**Architecture:** 新增 `A2AAgentService` 实现 `AgentService` 接口。通过 HTTP POST 调用远程 A2A agent 的 `tasks/send`（同步）和 `tasks/sendSubscribe`（SSE 流式）端点，将 A2A Task/Artifact 响应转换为 Cat Café `AgentMessage` 流。
**Tech Stack:** TypeScript, fetch API, SSE parsing, Node test runner
**前端验证:** No — 纯后端

---

## Not Building

- 不做 A2A server（Cat Café 暴露 AgentCard 给外部——那是 ACP/future scope）
- 不做 gRPC binding（HTTP+JSON 够用，gRPC 是优化）
- 不做 OAuth 2.0 / OIDC 认证（Phase 3 用简单 API key，复杂认证是 follow-up）
- 不做 AgentCard 自动发现（手动配置 agent endpoint，auto-discover 是 follow-up）

## Terminal Schema

```typescript
// A2A 协议核心类型（最小子集）

interface A2AAgentCard {
  name: string;
  description?: string;
  url: string;                    // Agent's base URL
  supportedInterfaces: string[];  // ["jsonrpc-http"]
  capabilities?: string[];
}

interface A2ATask {
  id: string;
  status: 'submitted' | 'working' | 'completed' | 'failed' | 'canceled' | 'input-required';
  artifacts?: A2AArtifact[];
}

interface A2AArtifact {
  parts: A2APart[];
}

interface A2APart {
  type: 'text' | 'file' | 'data';
  text?: string;
  file?: { name: string; mimeType: string; bytes?: string };
  data?: unknown;
}

// Cat Café 侧配置
interface A2AAgentConfig {
  /** Agent's base URL (e.g. "https://windows-agent.local:8080") */
  url: string;
  /** API key for authentication (simple bearer token) */
  apiKey?: string;
  /** Whether to use streaming (tasks/sendSubscribe) or sync (tasks/send) */
  streaming?: boolean;
}
```

## Task 1: A2A 协议类型定义

**Files:**
- Create: `packages/shared/src/types/a2a.ts`
- Modify: `packages/shared/src/types/index.ts`

定义 A2A 协议的最小类型子集 + Cat Café 侧的 AgentConfig。

## Task 2: A2A 事件转换层

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/a2a-event-transform.ts`
- Test: `packages/api/test/a2a-event-transform.test.js`

将 A2A Task 的 parts/artifacts 转换为 Cat Café 的 `AgentMessage` 格式。

## Task 3: A2AAgentService 实现

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/A2AAgentService.ts`
- Test: `packages/api/test/a2a-agent-service.test.js`

实现 `AgentService` 接口：
1. `invoke()` → HTTP POST to `{url}/tasks/send` (JSON-RPC 2.0)
2. Transform response → yield `AgentMessage`
3. 可选 SSE streaming via `tasks/sendSubscribe`

## Task 4: Provider 注册

**Files:**
- Modify: `packages/shared/src/types/cat.ts` — CatProvider 加 `'a2a'`
- Modify: `packages/api/src/index.ts` — 注册 A2AAgentService

## Task 5: 集成测试 + 验证

对着一个 mock A2A server 跑完整流程测试。

---

## 验证检查点

1. A2AAgentService 可以被注册为一个 cat provider
2. 通过 mock server 测试 `tasks/send` 同步路径
3. `AgentMessage` 流正确产出 text/error/done
4. 事件转换覆盖 text/file/data parts
