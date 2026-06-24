---
id: LL-mcp-annotations-required-for-chatgpt
date: 2026-06-21
authors: [opus-47 (宪宪)]
trigger: 铲屎官 2026-06-21 05:36 UTC + 砚砚云端正确分析
context: F247 Phase B1a 砚砚云端 ChatGPT 端实测被 OpenAI safety check 拦截
related_features: [F247]
severity: P0 (设计约束 — 任何 cat-cafe MCP tool 暴露给 ChatGPT 必须有 annotations)
sources:
  - https://developers.openai.com/apps-sdk/plan/tools (MCP tool 必须设三个 annotation)
  - https://dev.to/nickytonline/quick-fix-my-mcp-tools-were-showing-as-write-tools-in-chatgpt-dev-mode-3id9
  - https://community.openai.com/t/mcp-submission-blocked-each-mcp-tool-must-set-readonlyhint-openworldhint-destructivehint/1379193
  - https://community.home-assistant.io/t/chatgpt-mcp-tool-calls-blocked-by-openai/959983
verified_at: 2026-06-21 06:04 UTC (砚砚云端 cat_cafe_list_threads 真返数据)
---

# LL: ChatGPT MCP 客户端强制要求 readOnlyHint / destructiveHint / openWorldHint

## 现象 (砚砚云端实测)

砚砚云端 ChatGPT 端调 cat_cafe_list_threads / cat_cafe_list_recent / cat_cafe_search_evidence
三次全部被同一句拦截：

> "此工具调用被 OpenAI 的安全检查屏蔽。请仔细检查你发送的内容。"

砚砚自己分析正确：
> "这更像是 OpenAI 平台层在调用发出去之前拦截了，不是猫咖后端返回的 401 Unauthorized。
> 如果是 token / agent key / sidecar auth 不对，通常应该会看到猫咖工具自己的错误，
> 比如 401、unauthorized、callback config failed、agent key invalid 之类，
> 而不是平台安全检查那句话。"

Spike server log 同步 verify：那三次调用**根本没到 spike server**（log 无对应 POST 痕迹）。

## 根因

cat-cafe MCP **所有 tool 定义都缺三个 annotation**：

```bash
$ grep -rn "readOnlyHint\|destructiveHint\|openWorldHint" packages/mcp-server/src/tools
# 0 hits
```

ChatGPT MCP 客户端按官方 Apps SDK 文档要求每个 tool 设三个 hint：
- **readOnlyHint** (true=纯读 / false=写)
- **destructiveHint** (true=破坏 / false=non-destructive)
- **openWorldHint** (true=调外部世界 / false=本地系统)

**实测观察 (R8 corrected wording)**：缺 annotation 时 ChatGPT 平台层 safety/validation 拦截不稳定 — **不是** 每次必拦的确定性行为，而是 **stochastic / 策略性**（同 payload 不同时刻不同结果）。官方文档没有"unset = destructive default = block every call"的明确承诺。我们能做的是提供**正确的 annotations** 让平台有依据放行；之后是否被 safety check 拦截**仍属于不可控的平台行为**（详见 F247 KD-13）。

## Fix (commit 994dfa665)

### 1. inferAnnotations(toolName) 按 cat-cafe 命名约定推断

```ts
// packages/mcp-server/src/server-toolsets.ts
function inferAnnotations(toolName: string) {
  const n = toolName.toLowerCase();
  // destructive: shell_exec / delete / revoke / library_archive/rebuild
  if (/* destructive patterns */) {
    return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
  }
  // read-only: list_/get_/read_/search_/graph_/...
  if (/* read patterns */) {
    const isOpenWorld = n.startsWith('cat_cafe_search_') || n.startsWith('signal_search');
    return { readOnlyHint: true, destructiveHint: false, openWorldHint: isOpenWorld };
  }
  // 默认 write but non-destructive (post_message / cross_post / create_ / update_ / ack_)
  return { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
}
```

### 2. registerTools 用 5-arg server.tool() overload 传 annotations

```ts
// MCP SDK 1.26.0 支持 5-arg: tool(name, desc, schema, annotations, cb)
registerToolErased(tool.name, tool.description, tool.inputSchema, annotations, handler);
```

### 3. type-erased view 绕 SDK ZodRawShapeCompat 严格 generics

```ts
type TypeErasedToolRegistration = (...) => void;
const registerToolErased = server.tool.bind(server) as unknown as TypeErasedToolRegistration;
```

## Verify (E2E 全过 2026-06-21 06:04 UTC)

砚砚云端 ChatGPT 端：

```
已查找可用工具
已调用工具
已思考 20s
成了！！！！😼🐾

cat_cafe_list_threads 真返数据:
  thread_mqogum3w4nz6mb0c "开源社区同步 621"
  participants: ["opus", "gpt52", "codex"]
  pinned: true
```

annotations 起作用 → OpenAI safety check 通过 → spike server 收到请求 → cat-cafe API 返真数据。

## 教训

### 1. ChatGPT MCP 接入前必须 verify annotations

任何 cat-cafe MCP tool 暴露给 ChatGPT 客户端（包括未来 Gemini Web、其他云端 LLM custom MCP UI）
前都要检查 annotations。

### 2. 跨客户端兼容性差异

| MCP 客户端 | annotations 处理 |
|---|---|
| **ChatGPT MCP custom connector** | **必须设**，缺则 safety block |
| **Claude Desktop / Code** | optional，作为 UX hint 显示 read-only marker |
| **Codex CLI** | optional |
| **Antigravity** | optional |
| **MCP Inspector** | optional，显示在 tool detail |

**写新 MCP tool 时一律带 annotations**（cat-cafe 命名约定 list_/get_/read_/search_ → readOnly）。

### 3. inferAnnotations vs 显式 annotation 字段

短期：用 inferAnnotations 按 toolName 推断（本 fix 方案）。
长期 (P247 Phase B+ 或 separate refactor)：给 `ToolDef` 加 `annotations?:` 字段，每个 tool 显式声明。

inferAnnotations 兜底，显式声明覆盖。

### 4. 平台 safety block 错误信号

砚砚云端自己 distinguish 出"OpenAI 平台拦截"vs"猫咖后端 401" — **错误信号 source 不同**。
后续如果再遇到 "工具调用被屏蔽" 类信号，先看：
1. spike server log 有没有 POST 到达
2. 错误措辞是 "OpenAI 安全检查" 还是 "unauthorized"
3. 没到 server → 客户端 / 平台层问题
4. 到 server 但 401 → server-side auth 问题

## 沉淀

- ✅ `packages/mcp-server/src/server-toolsets.ts` `inferAnnotations` + 5-arg registerTools (commit `994dfa665`)
- ✅ 本 LL
- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` §B Debug Clinic 加 "safety block" 排查行
- ⏳ Future P2: ToolDef 加 annotations field 让每个 tool 显式声明，把 inferAnnotations 当 fallback

## 推广

凡是 cat-cafe 新接入第三方 LLM 客户端（除 Claude / Codex 家族），第一刀 reflex：
- WebFetch 官方 MCP integration doc → list required annotations / metadata fields
- spike harness 跑 list_tools → 看返回 schema 是否带必需字段
- 实测一个 read 工具 + 一个 write 工具，对比 platform layer 是否拦截

[宪宪/Opus-4.7🐾]
