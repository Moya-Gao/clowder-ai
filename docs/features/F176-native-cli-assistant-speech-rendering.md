---
feature_ids: [F176]
related_features: [F097, F167, F173]
topics: [frontend, message-rendering, semantic-classification, native-cli, assistant-speech, cli-stdout, message-pipeline]
doc_kind: spec
created: 2026-04-25
---

# F176: Native CLI Assistant-Speech vs CLI-Stdout 渲染语义分离

> **Status**: design-gate | **Owner**: 布偶猫（Opus-47） + 缅因猫（GPT-5.5，并行诊断 + intake review） | **Priority**: P1
>
> **Triggered by**: `thread_mnux2eewbo4otg17` 实测（2026-04-25 13:14），铲屎官报告"前端看到互相调用但看不到说话气泡"。@codex 砚砚（GPT-5.5）+ @opus47 宪宪（Opus-47）双独立诊断收敛到同一根因（5/5 一致）。

## Why

### 现象

铲屎官在 `thread_mnux2eewbo4otg17` 看到：
- ✅ Briefing card 正常显示（"传球 / 真相源 / 下一步"）
- ✅ A2A 状态 / DirectionPill 正常显示
- ❌ codex / opus 通过 native CLI provider 输出的**正经回复内容**（PR review、merge 报告、debug 过程）**完全看不到主气泡**——只看到一个折叠的 `CLI Output | done | N tools | XmYs` 卡片

### 根因（三层共谋）

#### Layer 1：后端将所有 stream text 染色为 `origin: 'stream'`
`packages/api/src/domains/cats/services/agents/routing/route-serial.ts:716-724`：
```ts
// Tag CLI stdout text with origin: 'stream' (thinking/internal)
yield effectiveMsg.type === 'text'
  ? { ...effectiveMsg, origin: 'stream' as const, ... }
  : effectiveMsg;
```
原意是把 CLI stdout 当 "thinking/internal"，但 native CLI provider（codex/opus）的**最终 assistant response 也走同一个 yield 通道**，全部被打成 `origin='stream'`。无法区分 "thinking output" 和 "final answer"。

#### Layer 2：前端把 stream-origin 整体交给 CliOutputBlock
`packages/web/src/components/ChatMessage.tsx:379-385`：
```tsx
{hasCliBlock && isStreamOrigin ? null : !isStreamOrigin && hasBlocks ? (
  <ContentBlocks .../>
) : !isStreamOrigin && hasTextContent ? (
  <CollapsibleMarkdown .../>
) : ...}
```
`isStreamOrigin === true` 走第一个分支 → 主文本完全不渲染，被打包进下面 `CliOutputBlock`（line 400-411）。

`packages/web/src/components/cli-output/toCliEvents.ts:84-91`：stream content 强行 push 成 1 个 `text` event。

#### Layer 2.5：CliOutputBlock 默认折叠
`packages/web/src/stores/chatStore.ts:791`：`globalBubbleDefaults.cliOutput = 'collapsed'`

→ 用户视觉上：**头部（猫名 + 时间 + DirectionPill）正常 + 正文被折叠隐藏**。展开 CLI Output 才看得到原话。

### 测试锁住了这个行为（设计冲突，不是 regression）

`packages/web/src/components/__tests__/cli-output-integration.test.ts:106` 明确 expect "stream origin with only content → 渲染为 CLI Output"。这是 F097（CLI Output Collapsible UX，2026-03-11 立项）的 intentional 设计——把 ToolEventsPanel + stream content 合并为统一 CLI Output Block。

**F097 设计 in 2026-03**：CLI provider 主要是 codex/opus 的 thinking + tool calls，stream text = thinking output。
**2026-04 现实**：codex/opus 已成为正式回复猫，stream text 包含**正经 final response**（PR review 决策、debug 结论、merge 报告）。

F097 设计前提失效，渲染层需要更精细的语义分流。

## What

### 设计核心：新增 `messageRole` 语义字段，**不动 invocation/bubble identity**

为什么不会让 F173 气泡裂开 / 重复（与 F173 共存策略）：

| F173 历史风险 | F176 改动层 | 是否触发 |
|---|---|---|
| dup-bubble（stream + callback 同一逻辑响应双写）| 渲染层 | ❌ — bubble id 仍按 F173 ledger，dedup 在 invocation 层 |
| ghost-bubble（invocationId threading）| 渲染层 | ❌ — 不改任何 invocation 链 |
| streaming partial → done 切换裂气泡 | 渲染层 | ❌ — streaming 流光圈逻辑不动 |
| split-brain（OUTER vs INNER invocation）| 渲染层 | ❌ — F173 hotfix2 已收口，不碰 |

**所有 F173 收口的代码路径都不动**，只在 ChatMessage 渲染层按新字段分流。

### 新字段定义

```ts
type MessageRole = 'final' | 'thinking' | 'cli_stdout';
// 默认 undefined → fallback 旧逻辑（向后兼容）
```

- `final`：cat 的最终回复 → 主气泡（CollapsibleMarkdown）
- `thinking`：scratchpad / 思考过程 → ThinkingContent（折叠到 thinking 块）
- `cli_stdout`：真 CLI tool execution noise → CliOutputBlock（折叠到 CLI 块）
- `undefined`：旧消息或未标记 → 走当前行为（向后兼容，零破坏）

## Phases

### Phase 1：后端语义清洗

**目标**：route-serial / route-parallel yield 时按消息 kind 标 `messageRole`。

- `packages/api/src/domains/cats/services/types.ts`：加 `messageRole?: MessageRole` 字段
- `route-serial.ts:716-724` / `route-parallel.ts:770`：
  - native CLI provider 最终 assistant text → `messageRole: 'final'`
  - 真 CLI scratchpad/tool stdout → `messageRole: 'cli_stdout'`
  - thinking blocks → `messageRole: 'thinking'`
- shared schema 同步（Zod schema + persistence + socket payload）

### Phase 2：前端渲染分流

**目标**：ChatMessage 按 `messageRole` 分流，stream 主气泡渲染恢复。

- `packages/web/src/components/ChatMessage.tsx:379-385`：改三元为基于 `messageRole`
  - `final` → CollapsibleMarkdown 主气泡（即使 `origin='stream'`）
  - `thinking` → ThinkingContent
  - `cli_stdout` 或 undefined → CliOutputBlock（向后兼容）
- `packages/web/src/components/cli-output/toCliEvents.ts:84-91`：加守卫——`messageRole === 'final'` 时**不**把 streamContent 推为 text event（避免主气泡 + CLI Output 双写）

### Phase 3：测试改造（防回归核心）

- `packages/web/src/components/__tests__/cli-output-integration.test.ts:106`：拆两 case
  - 旧 case：`messageRole: 'cli_stdout'` → 仍走 CLI Output（保留 F097 设计）
  - 新 case：`messageRole: 'final'` → 主气泡 + 不进 CLI Output
- F173 dedup 套件加 case：同 invocation 双写时 `messageRole: 'final'` 也走 dedup（确认渲染层不破坏 dedup）
- streaming-bubble fixture（F173 B-3）加 case：streaming 中渲染主气泡光圈，done 后不裂

### Phase 4：历史数据兼容（保守路径）

旧 `origin='stream'` + 无 `messageRole` 消息：保守按当前 CliOutputBlock collapsed 渲染（用户手动展开看正文，零破坏）。

**不推荐**激进路径（hydration 时启发式 promote）——启发式是 F173 历史 bug 的来源。

## Acceptance Criteria

### Phase 1（后端）
- [ ] AC-1.1: `MessageRole` type 加入 shared schema 与 backend types
- [ ] AC-1.2: `route-serial.ts` yield path 按消息 kind 标 `messageRole`
- [ ] AC-1.3: `route-parallel.ts` 同步标记
- [ ] AC-1.4: 持久化 / socket payload 携带 `messageRole`
- [ ] AC-1.5: 旧消息 `messageRole === undefined` 行为不变（向后兼容回归）

### Phase 2（前端）
- [ ] AC-2.1: `ChatMessage.tsx:379-385` 按 `messageRole` 分流，stream `final` 渲染主气泡
- [ ] AC-2.2: `toCliEvents.ts` `messageRole === 'final'` 时不 push streamContent
- [ ] AC-2.3: `messageRole === 'thinking'` 走 ThinkingContent
- [ ] AC-2.4: 旧 stream 消息（无 `messageRole`）仍走 CliOutputBlock

### Phase 3（测试）
- [ ] AC-3.1: `cli-output-integration.test.ts` 拆两 case + 全绿
- [ ] AC-3.2: F173 dedup 套件加 `messageRole: 'final'` case + 全绿
- [ ] AC-3.3: streaming-bubble fixture（F173 B-3）加 case + 全绿

### Phase 4（兼容）
- [ ] AC-4.1: 旧消息保守渲染（无破坏验证）
- [ ] AC-4.2: 用户手动展开 CliOutputBlock 仍可看历史 final response 内容

### 端到端
- [ ] AC-E1: `thread_mnux2eewbo4otg17` 现象消失——codex/opus native CLI 主回复显示主气泡
- [ ] AC-E2: F097 设计原意保留——真 CLI tool execution 仍折叠
- [ ] AC-E3: F173 dedup / ghost-bubble / split-brain 防护测试**全绿**（无回归）

## 风险与防护

### F173 共存
- **不动 invocation/bubble identity** → dedup/ghost 不可能因为 F176 复发
- ChatMessage.tsx 与 F173 Phase C 同文件**不同 hunk**，git 自动 merge
- 时序无强约束：F176 / F173 任意先后 merge 都行

### F167 A2A chain quality
- DirectionPill / 传球状态 / cross-post 标记**不动**
- final response 渲染恢复后，A2A 链可读性提升（用户看得到猫猫"说了什么"）

### Native CLI provider 多样性
- codex / opus 不同 provider 的 stream text 语义可能不一致
- Phase 1 实现需在 each provider yield path 显式标记，不靠启发式判断

## Architecture Map

```
[CLI provider stdout/tool events]
  ↓
[route-serial / route-parallel] ← Phase 1 在这里打 messageRole
  ↓
[message persistence + socket broadcast]
  ↓
[useAgentMessages / chatStore]
  ↓
[ChatMessage.tsx 渲染分流] ← Phase 2 在这里按 messageRole 分流
  ├── final → CollapsibleMarkdown 主气泡
  ├── thinking → ThinkingContent 折叠
  └── cli_stdout / undefined → CliOutputBlock 折叠
```

## Test Plan

- 单测：route-serial / route-parallel yield 标签 + ChatMessage 渲染分支 + toCliEvents 守卫
- 集成：cli-output-integration（双 case） + F173 dedup（加 case） + B-3 fixture（加 case）
- 端到端：alpha 拉新 thread 复现 thread_mnux2eewbo4otg17 场景，验证主气泡显示 + CLI 折叠保留
- 回归：跑完整 F173 测试套件，确认无气泡裂 / dup / ghost

## Owners & Review

- **Author**: 布偶猫（Opus-47）—— spec + 实现牵头
- **Co-diagnoser**: 缅因猫（GPT-5.5）—— 已独立诊断，可接 Phase 1+2 实现或 review
- **Cross-family review**: 必须缅因猫做（自家代码不自审）
- **Vision guardian**: 暹罗猫 / 第三只非作者非 reviewer 的猫

## Decision Log

- **2026-04-25 13:14** 铲屎官报告 thread_mnux2eewbo4otg17 看不到说话气泡
- **2026-04-25 13:18** 双猫并行诊断收敛同一根因（5/5 一致）
- **2026-04-25 13:22** 提出 messageRole 完整方案 + F173 共存策略
- **2026-04-25 13:36** 铲屎官 ack 立项 + 给号 F176
