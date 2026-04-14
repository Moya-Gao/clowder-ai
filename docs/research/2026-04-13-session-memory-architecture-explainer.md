---
feature_ids: [F065, F102]
related_features: [F033, F152]
topics: [memory, session, architecture, community, explainer]
doc_kind: research
created: 2026-04-13
participants: [opus, landy]
status: final
---

# 社区问答：猫猫的记忆是怎么存的？— Session Seal 与 ThreadMemory 架构解析

> **背景**：社区小伙伴问了一个好问题——"如果每只猫调用的是第三方 CLI（如 Claude Code、Codex CLI），猫的记忆就委托给了 CLI。那 session seal 和 ThreadMemory 里存的到底是什么？"
>
> **面向读者**：对多 Agent 系统的记忆/上下文管理感兴趣的开发者。

---

## 一、问题的本质

```
用户说 "@opus 帮我修个 bug"
  → 编排层把请求路由给 Claude Code CLI
  → CLI 有自己的 context window（工作记忆）
  → CLI 执行完毕，session 结束

问题：
CLI 的 context window 是临时的，进程退出就没了。
那编排层这边存了什么？
下一个 session 怎么知道上一个 session 做了什么？
```

这是所有"编排层 + 执行层分离"的多 Agent 系统都会遇到的问题。CLI（执行层）管当下的思考，编排层管跨 session 的记忆。

## 二、两层记忆架构

```
┌─────────────────────────────────────────┐
│            编排层（持久记忆）              │
│                                         │
│  ThreadMemory ← 滚动合并 ← Digest       │
│  （跨 session，token 预算内滚动裁剪）      │
│                                         │
│  events.jsonl ← 全量事件落盘             │
│  （可回溯，按需 drill-down）              │
└──────────────────┬──────────────────────┘
                   │ session 启动时注入
                   ↓
┌─────────────────────────────────────────┐
│           执行层（临时记忆）               │
│                                         │
│  CLI 的 context window                   │
│  （session 内有效，进程退出即消失）         │
│                                         │
└─────────────────────────────────────────┘
```

### 执行层（CLI 侧）— 临时的

每只猫对应的 CLI（Claude Code / Codex / Gemini CLI）自带 context window，这是 session 内的工作记忆。CLI 进程退出就没了。**编排层不控制这一层**，这是各家 CLI 自己的事。

### 编排层（Cat Café 侧）— 持久的

编排层在 CLI 外面包了一层 **Session 生命周期管理**。核心机制是 **Session Seal（封印）**——session 结束时，从 CLI 产生的事件流中提取关键信息，持久化存储。

## 三、Session Seal 的过程

当一个 session 结束（CLI 退出、超时、或被新 session 替换）时，触发封印：

```
活跃 session → requestSeal() → 状态变为 sealing → finalize() → sealed
```

`finalize()` 按顺序做三件事（都是 best-effort，任一失败不阻塞封印完成）：

### 步骤 1：落盘原始事件（Transcript）

```
threads/<threadId>/<catId>/sessions/<sessionId>/
  ├── events.jsonl            # 所有原始事件（工具调用、消息、错误）
  ├── index.json              # 稀疏字节偏移索引（用于快速定位）
  └── digest.extractive.json  # 结构化摘要
```

### 步骤 2：提取结构化摘要（Extractive Digest）

这是关键设计——**不依赖大模型生成摘要，而是从原始事件中用规则提取**。零 LLM 成本，确定性输出：

```json
{
  "v": 1,
  "sessionId": "abc-123",
  "threadId": "thread_xyz",
  "catId": "opus",
  "seq": 3,
  "time": {
    "createdAt": 1713000000000,
    "sealedAt":  1713001500000
  },
  "invocations": [
    {
      "invocationId": "inv-001",
      "toolNames": ["Read", "Edit", "Bash"]
    }
  ],
  "filesTouched": [
    { "path": "src/router.ts", "ops": ["read", "edit"] },
    { "path": "src/newFile.ts", "ops": ["create"] }
  ],
  "errors": [
    {
      "at": 1713001200000,
      "message": "TypeError: Cannot read property 'id' of undefined"
    }
  ]
}
```

**提取规则**：
- 扫描所有 `tool_use` 事件，从工具名映射操作类型（`write → create`，`edit → edit`，`read/grep/glob → read`）
- 从工具入参中提取 `file_path` / `path` 作为文件路径
- 从 `is_error` 标记的 tool_result 中提取错误信息（截断 500 字符）

### 步骤 3：更新 ThreadMemory（跨 session 滚动记忆）

这是让"Session 5 的猫知道 Session 1 做了什么"的核心：

```typescript
ThreadMemoryV1 {
  v: 1
  summary: string              // 滚动文本，每个 session 一行
  sessionsIncorporated: number // 已合并的 session 数
  updatedAt: number            // 最后更新时间戳

  // 结构化信号（正则提取，非 LLM）
  decisions?: string[]         // 关键决策（最多 8 条）
  openQuestions?: string[]     // 遗留问题（最多 5 条）
  artifacts?: string[]         // 涉及的文档引用，如 "ADR-12", "F065"（最多 8 条）
}
```

**滚动合并逻辑**：

1. 每次封印生成一行摘要：`Session #3 (14:20-14:45, 25min): Created: foo.ts. Modified: bar.ts. 2 errors.`
2. **新的排前面，旧的排后面**。超出 token 预算时从末尾裁剪最老的行
3. Token 预算根据猫的 context window 动态计算：`max(1200, min(3000, floor(maxPromptTokens × 0.03)))`

| 猫的 context window | ThreadMemory 预算 |
|---------------------|-------------------|
| 64k（轻量模型） | ~1920 tokens |
| 180k（Opus） | 3000 tokens |
| 350k（Gemini） | 3000 tokens（上限） |

**决策信号提取**（也是零 LLM，纯正则）：

- **决策**：扫描文本中的"决定""拍板""完成了""采用"等关键词，提取上下文句子
- **遗留问题**：扫描"待定""TODO""是否""待确认"等关键词
- **文档引用**：正则匹配 `ADR-\d+` / `F\d{2,3}` 格式

### （可选）步骤 4：生成式交接摘要

对配置了 `bootstrapDepth === 'generative'` 的猫，额外调一次轻量模型（Haiku）生成自然语言交接摘要（`digest.handoff.md`），类似会议纪要。这一步有少量 LLM 成本，但用的是最便宜的模型，且仅在需要高质量交接时启用。

## 四、下一个 Session 启动时怎么用

```
新 session 启动（SessionBootstrap）
  → 注入 ThreadMemory.summary      （"之前做了什么"，跨 session 滚动记忆）
  → 注入上一个 session 的 digest   （"上次具体做了什么"）
  → 注入当前 task snapshot          （"还有什么没做完"）
  → 这些内容被注入到 CLI 的 system prompt / context 中
  → 猫在 CLI 的 context window 里开始工作，有了历史上下文
```

## 五、完整数据流图

```
CLI 内部（临时）                 编排层（持久）
┌──────────────┐
│  context     │ ──事件流──→  TranscriptWriter.flush()
│  window      │               ├── events.jsonl（原始事件全量）
│  (工作记忆)  │               ├── index.json（字节偏移索引）
│              │               └── digest.extractive.json（结构化摘要）
└──────────────┘                        │
       ↑                                ↓
       │                       extractDecisionSignals()
       │                       （正则提取决策 / 问题 / 引用）
       │                                │
       │                                ↓
       │                       buildThreadMemory()
       │                       （与历史 ThreadMemory 滚动合并）
       │                                │
       │                                ↓
  SessionBootstrap  ←────────  ThreadMemory + Digest + Tasks
  （下一个 session 启动时）    （注入到 CLI 的 system prompt）
```

## 六、关键设计决策与取舍

| 决策 | 为什么 |
|------|--------|
| **摘要提取零 LLM** | Extractive digest 和决策信号都是规则/正则提取。成本为零、确定性高、不会幻觉 |
| **Token 预算动态适配** | 不同模型 context window 差异大，ThreadMemory 大小自适应，不浪费也不溢出 |
| **Best-effort 不阻塞** | 封印的任何一步失败，session 仍然标记为 sealed。宁可丢摘要，不能卡死生命周期 |
| **存储在编排层，不依赖 CLI** | 即使 CLI 完全没有记忆能力（如 stateless API 调用），编排层也能通过 bootstrap 注入恢复上下文 |
| **原始事件全量落盘** | digest 是压缩视图，但原始事件随时可以 drill-down 回溯。两层并存 |
| **新的排前面，旧的裁末尾** | 最近的 session 最重要。Token 不够时牺牲最远的历史 |

## 七、对其他系统的启发

如果你在搭类似的"编排层 + CLI 执行层"架构，可以借鉴的核心思路：

1. **不要依赖 CLI 的记忆**：CLI 可能随时重启、切换、升级。跨 session 记忆必须在编排层自己管
2. **零 LLM 摘要优先**：规则提取（工具名、文件路径、错误信息）已经能覆盖大部分"上次做了什么"的需求，不需要每次都调大模型
3. **滚动合并而非全量保存**：context window 有限，ThreadMemory 必须在信息量和 token 成本之间找平衡。新的优先，旧的裁剪
4. **结构化信号提取**：决策、遗留问题、文档引用——这些比"自然语言摘要"更有信息密度，也更容易被下游消费

---

> **延伸阅读**：
> - [Clowder AI](https://github.com/zts212653/clowder-ai) — 包含上述记忆架构的完整开源实现
> - 教程第八课《Session 管理》— 记录了跨 session 记忆设计中踩过的坑（"茶话会夺魂" bug）

---

*[宪宪/Opus-46 🐾]*
