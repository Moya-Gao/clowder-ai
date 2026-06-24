---
id: LL-agent-key-vs-invocation-token-threadId
date: 2026-06-22
authors: [opus-47 (宪宪)]
trigger: F247 B1a debug 砚砚云端 post_message error 链
context: 两种 caller mode 对 threadId 的要求正好相反，没文档化
related_features: [F247, F193]
severity: P1 (设计明确性 / 文档缺口)
---

# LL: post_message 对 threadId 的要求 — agent-key 必须传 vs invocation-token 必须不传

## 现象

砚砚云端 ChatGPT 调 `cat_cafe_post_message(threadId="X", agentKeyCatId="gpt-pro")`：
- 第一次：**MCP server gate 拒**："post_message rejects threadId from invocation-token callers (F193 KD-1)"
- 修了 spike env 后再调：**cat-cafe API 拒**："threadId required for agent-key auth"

完全相反的两条规则。

## 根因

**Caller mode 决定 threadId 必填性，两个 mode 的规则正好相反**：

### invocation-token mode (cat-cafe 本地 -p 模式跑的猫)

- caller (cat invocation) **有 "current thread"**：spawn 时通过 `CAT_CAFE_THREAD_ID` env 绑定到一个 thread
- `post_message` **默认** 写到 current thread
- F193 KD-1 规则：**禁** 传 `threadId` 防止 cross-thread 偷渡攻击
  - 想跨 thread 必须走 `cross_post_message + targetCats`
- Gate: `packages/mcp-server/src/tools/callback-tools.ts:662`

### agent-key mode (砚砚云端 spike server, antigravity Persistent MCP 等)

- caller (long-lived agent) **没有 "current thread"**：agent-key 是无状态长期 key，不绑定 thread
- 每次调 `post_message` **必须明示** 目标 thread
- cat-cafe API 端校验：`packages/api/src/routes/callbacks.ts` post-message handler 要求 agent-key auth 必须传 threadId
  - 错误信息: `"threadId required for agent-key auth"`

### 矛盾点

如果你看 MCP server 端 gate (只懂 invocation-token 视角)：
> post_message rejects threadId from invocation-token callers. ... For same-thread delivery, omit threadId entirely (defaults to invocation thread).

错误信息把 agent-key caller 误导到"省略 threadId"路径 → 然后被 cat-cafe API 端 "threadId required for agent-key auth" 拒。

**两个 gate 在不同 layer，没文档说明关系**。

## 教训

### 1. 跨 mode 设计需要 explicit 文档对照表

cat-cafe 有 3 种 auth principal:
- invocation-token (本地 cat)
- agent-key (long-lived persistent, antigravity / spike server)
- (future) ChatGPT OAuth bearer (B1b)

每种 mode 对**同一工具**可能有不同的 schema / 必填规则。需要文档明示：

| Tool | invocation-token | agent-key | ChatGPT OAuth (B1b TBD) |
|---|---|---|---|
| post_message threadId | 禁 (KD-1) | 必传 | TBD |
| post_message defaultThreadSemantic | "current invocation thread" | "from threadId arg" | TBD |
| cross_post_message targetCats | optional | optional | TBD |
| search_evidence | OK | OK | OK |

### 2. Error message 必须**写清楚** caller mode

MCP server 当前 error:
> "post_message rejects threadId from invocation-token callers (F193 KD-1)."

**Agent-key caller 看到这条会困惑**："我不是 invocation-token caller 啊"。

更好的 error:
> "post_message rejects threadId when called with invocation-token credentials. Your caller appears to be invocation-token mode (CAT_CAFE_INVOCATION_ID + CAT_CAFE_CALLBACK_TOKEN are set). For agent-key callers, threadId is **required**. To switch modes, unset invocation env or use cross_post_message."

### 3. Gate 应该 detect 真实 mode，不只检查 invocation creds 存在

当前 `hasInvocationCreds = !!INVOCATION_ID && !!CALLBACK_TOKEN` 只能判断 "有 invocation creds"，**不能判断** "应该走 invocation 路径"。

如果 spike server 同时设了 INVOCATION_ID/CALLBACK_TOKEN（污染）和 AGENT_KEY_FILE，gate 误以为是 invocation caller。

**理想行为**：gate 应该看**实际**用的 auth 模式（i.e. 看 outgoing HTTP request 用哪种 auth header）—— 而不只看 env 存在性。

但这要重构 callback-tools.ts，scope 大。当前 workaround：spike 端 unset 污染 env (见 [LL-spike-server-env-contamination](LL-spike-server-env-contamination.md))。

## 沉淀

- ✅ `cat-cafe-skills/refs/chatgpt-cloud-onboarding-guide.md` §C debug clinic 加 agent-key threadId 规则说明
- ✅ `cat-cafe-skills/refs/gpt-pro-custom-instructions.md` 加一条 reminder: agent-key 模式 `post_message` 必须传 threadId
- ✅ F247 doc 加 KD: B1a agent-key caller mode 行为定义
- ⏳ Future: 改 MCP server error message + 考虑 detect 真实 mode

## 推广

新 auth mode 加入时（B1b OAuth bearer / 其他 future modes）：
1. 写 mode 对照表（matrix tool × mode → 必填/可选/禁）
2. error message 明示 detected mode + 推荐 action
3. document 在每个 mode 入口（onboarding guide / API docs）

caller 看见 error 第一反应应该是"我知道我是哪种 mode + 我知道下一步做什么"，不是"我是谁？我在哪？"

[宪宪/Opus-4.7🐾]
