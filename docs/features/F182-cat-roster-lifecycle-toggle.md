---
feature_ids: [F182]
related_features: [F127, F032, F167, F086]
topics: [cat-management, roster, lifecycle, toggle, mention-routing, mcp-tools, hub-ux]
doc_kind: spec
created: 2026-04-30
---

# F182: Cat Roster Lifecycle Toggle — 成员启停的全链路降级反馈

> **Status**: spec | **Owner**: 布偶猫（宪宪/Opus 4.7） | **Reviewer**: 布偶猫（@opus 4.6）+ 缅因猫（@codex/砚砚） | **Priority**: P1

## Why

**铲屎官 2026-04-30 原话**（thread `thread_molhvy2v84woqas9`）：

> "咱 成员协助总览里面能停止 使用某些猫猫吗？或者说支持配置一个 enable disable 其实这还涉及到就是动态注入队友？比如 disable 的时候提示词或者说 harness 给你们注入队友就要不注入这些队友 避免你们调用，然后调用比如发 mcp at 他们也应该报错？这个报错就是告诉你们这个队友 disable 了换一个？"

### 现状盘点（F127 done 后的真实交付水位）

F127（done 2026-04-29）覆盖了**猫猫实例 CRUD + 别名路由**。下面四件事已经做了一半：

| 层 | 现状 | 文件证据 |
|---|---|---|
| ① UI toggle 开关 | ✅ 已有 — Hub `HubMemberOverviewCard` 的"已启用 / 未启用" badge 是个真按钮，点一下走 `onToggleAvailability` → 写入 `cat.roster.available` | `packages/web/src/components/HubMemberOverviewCard.tsx:60-73, 254-266` |
| ② 队友名册注入抑制 | ✅ 已有 — `buildTeammateRoster` 用 `isCatAvailable(id)` 过滤 disabled 猫，注入到 system prompt 的 roster 里看不到这只猫 | `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:392` |
| ③ A2A 路由层过滤 | ✅ 已有 — `analyzeA2AMentions` / `AgentRouter.isRoutableCat` 都在路由前 `isCatAvailable` 跳过 | `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts:92`, `AgentRouter.ts:275, 415` |
| ④ 调用 disabled 猫的反馈 | ❌ **当前是静默 skip** — 调用方完全不知道为什么对方没接，分不清"对方在思考"还是"对方根本没收到" | — |

也就是说，**disable 一只猫之后路由确实把她屏蔽了，但没有一个声音告诉调用方"她被屏蔽了"**。这对铲屎官、对猫、对用户都是黑箱。铲屎官的核心诉求 #③ 命中的就是这层缺口。

### 为什么单 issue 挂不上 F127

F127 已经 close（done），ledger 不该 reopen。这是 F127 完成度水位之上的**新增 lifecycle 层能力**——把"静默屏蔽"升级为"显式可观测降级反馈"，并把同一套契约推到所有 MCP 调度入口。涉及 4 个层、9 个 MCP 工具，规模超过 issue 范畴。

## What

### 一句话

把 roster `available` 字段从"路由静默 skip 的开关"升级为"全链路结构化降级契约"——所有调度入口（system prompt、A2A、MCP 写工具、Hub）在遇到 disabled 猫时返回一致的、可观测的、带 alternatives 提示的反馈。

### Phase A: 结构化错误契约 + Resolver 闸门

**新增公共类型 + Resolver 单点闸**——所有 MCP 写工具 + 前端 @ 入口共享一套：

```ts
// packages/shared/src/types/cat-routing.ts
export type CatRoutingError =
  | { kind: 'cat_not_found'; mention: string; alternatives: CatAlternative[] }
  | { kind: 'cat_disabled'; catId: CatId; displayName: string; alternatives: CatAlternative[] };
// NOTE: cat_no_quota 不在 F182 范围（KD-5），reviewer matcher 的"没猫粮"暂保留独立语义

export interface CatAlternative {
  readonly catId: CatId;
  readonly mention: string;
  readonly displayName: string;
  readonly family: string; // 同族优先排前面
}
```

**位置**：在现有 `mention-parser.ts` / `AgentRouter.isRoutableCat` 之上加一层 `resolveCatTarget(mentionOrId): { ok: CatId } | { error: CatRoutingError }`，作为所有 MCP 写工具和 A2A 调度的统一闸。

**Resolver 必须覆盖 5 个入口（KD-4，砚砚 P1-1 反馈）**——不止"消息体 @ parser"：

| 入口 | 字段 | 当前现状 |
|---|---|---|
| 文本 @ | 消息 content body 里的 `@xxx` | a2a-mentions.ts 已 skip，但需改为返回结构化 errors |
| `post_message.targetCats` | 结构化数组 | callbacks.ts:613 只做 `catRegistry.has()`，**未校验 available** ⚠️ |
| `cross_post_message.targetCats` | 同上 | 同上 ⚠️ |
| `multi_mention.targets/callbackTo` | targets 数组 + callback 字段 | 仅做 catRegistry.has，未校验 available ⚠️ |
| `start_vote.voters` | 投票 voters 数组 | 同上 ⚠️ |
| `register_scheduled_task.params.targetCatId` | 单字段 | 同上 ⚠️ |

**关键**：disabled 在文本 @ parser 被过滤但**结构化目标字段直进 enqueueA2ATargets** = disable 不是闸，只是提示词/UI 层过滤。砚砚 review 锚点：[callback-tools.ts:214](packages/mcp-server/src/tools/callback-tools.ts) + [callbacks.ts:613](packages/api/src/routes/callbacks.ts)。

### Phase B: System Prompt 降级提示（让猫自己感知）

当前 buildTeammateRoster 直接过滤掉 disabled 猫，**但调用猫不知道**自己曾经的队友被停用了——会反复 @ 不存在的人。改进（**OQ-3 拍板：单独区段**，砚砚反馈 — LLM 看不到灰色，行内标注会把 disabled 猫塞回主名册）：

- 主名册（`## 队友名册`）只放可用猫，**保持当前行为**
- 新增独立区段 `## 已停用成员`（在主名册下方），列出 disabled 猫 + **明确人话**："不要 @ 这只猫；如需她的能力请改 @ X / Y"
- 替代 mention 用 alternatives 排序：同 family + lead 优先

### Phase C: MCP 写工具接入降级反馈（修订清单）

> **砚砚 P1-2 反馈**：之前清单里 `update_task` / `register_pr_tracking` 是错的——`update_task` 没 assignee 字段，`register_pr_tracking.catId` deprecated 被服务端忽略。

**A 类（消息路由 — 软降级 best-effort）**：

| 工具 | 入口字段 | 行为 |
|---|---|---|
| `cat_cafe_post_message` | 消息体 @ + `targetCats` | 在线目标继续发，disabled 目标返回 `routing_warnings`；**结构化 targetCats 全不可路由 → `isError: true` + `routed: []`**（KD-4，避免 final-routing guard 误判"已传球"） |
| `cat_cafe_cross_post_message` | 同上 | 同上 |
| `cat_cafe_create_rich_block` | mentions 字段 | 同上 |

**A' 类（multi_mention — 契约式硬失败）**（OQ-1 拍板，砚砚反馈）：

| 工具 | 入口字段 | 行为 |
|---|---|---|
| `cat_cafe_multi_mention` | `targets` / `callbackTo` | request/response 契约，**hard fail**——disabled targets 直接 400 `cat_disabled` + alternatives，调用猫必须重发；不引入 `skipped` 状态膨胀 orchestrator |

**B 类（assignee/owner 是猫 — 契约式 400）**：

| 工具 | 入口字段 | 行为 |
|---|---|---|
| `cat_cafe_create_task` | `ownerCatId` | 400 `cat_disabled` + alternatives |
| `cat_cafe_start_vote` | `voters[]` | 400（任一 voter disabled） |
| `cat_cafe_register_scheduled_task` | `params.targetCatId` | 400 `cat_disabled` + alternatives |

**剔除（之前清单错）**：
- `cat_cafe_update_task` — 当前 schema 没 assignee 字段（[callback-tools.ts:471](packages/mcp-server/src/tools/callback-tools.ts)）
- `cat_cafe_register_pr_tracking.catId` — deprecated 字段服务端已忽略（[callbacks.ts:1269](packages/api/src/routes/callbacks.ts)）。PR tracking 涉及的"调用猫自身被 disable 但旧 invocation 还活着"是另一个问题，留独立 issue

**P2（砚砚补充）— MCP wrapper 错误前缀**：MCP 协议把 400 包装成 `Callback failed (400): <body>` 文本，LLM 解析不稳定。要求 mcp-server 对 `CatRoutingError` 生成**固定人类可读前缀** + JSON 双轨：

```
Cat routing failed [kind=cat_disabled] target=@gemini25 disabled.
Alternatives: @gemini, @opus-45.
{"kind":"cat_disabled","catId":"gemini25","alternatives":[...]}
```

### Phase D: Hub Toggle UX + Side-Effect Awareness

> **OQ-2 拍板（砚砚反馈）**：进 F182，但做 server-side impact preview endpoint，不在 useCatData 拼三套查询。

- 新增 `GET /api/cats/:catId/disable-impact` 端点 — server 端聚合该猫的进行中引用：
  - `tasks`：assignee 是该猫的开放 task（直接扫 task store）
  - `scheduledTasks`：owner 是该猫的活跃 schedule（直接扫 schedule meta）
  - PR tracking 不在 caller-replaceable scope，不聚合
- **首版不增索引**，扫描当前存储够用（量小）；响应 shape 统一，不强迁移底层模型
- Hub UI toggle disable 前先 GET 该端点，弹轻量确认："禁用 X 后，以下进行中引用会变为待重指派：[N 个 task / M 个 schedule]，是否继续？"
- 确认后 disable，引用不强迁移，**只标 "owner 已停用，等待重指派"**（AC-D2）

## Acceptance Criteria

### Phase A（错误契约 + Resolver 闸）
- [ ] AC-A1: `CatRoutingError` 类型 export 到 `@cat-cafe/shared`，**两种** kind（`cat_not_found` / `cat_disabled`）— `cat_no_quota` 不在范围（KD-5）
- [ ] AC-A2: `resolveCatTarget()` 单点 resolver 实现，单元测试覆盖两种错误路径 + alternatives 排序（同族 + lead 优先 + dedupe + 稳定排序避免竞态）
- [ ] AC-A3: Resolver 接入 **5 个入口**（KD-4）：文本 @ parser / `targetCats` / `multi_mention.targets+callbackTo` / `start_vote.voters` / `register_scheduled_task.params.targetCatId`。a2a-mentions.ts 静默 skip 改为 resolver 调用，保留向后兼容（mentions 列表不变，新增 errors 列表）

### Phase B（Prompt 降级提示）
- [ ] AC-B1: 主名册保持只列可用猫；新增独立 `## 已停用成员` 区段，列出 disabled 猫 + 明确"不要 @，请改 @ X/Y"短句
- [ ] AC-B2: `system-prompt-builder.test.js` 覆盖 disabled 猫场景：未出现在主名册、出现在停用区段、stranded mention 提示文案

### Phase C（MCP 工具降级反馈）
- [ ] AC-C1: 3 个 A 类工具（post / cross / rich）软降级 — 在线 @ 继续路由 + `routing_warnings`；**结构化目标全不可路由时 `isError: true` + `routed: []`**（防 final-routing guard 误判）
- [ ] AC-C2: 1 个 A' 类工具（`multi_mention`）+ 3 个 B 类工具（`create_task.ownerCatId` / `start_vote.voters` / `register_scheduled_task.params.targetCatId`）契约式 **400** `cat_disabled` + alternatives
- [ ] AC-C3: MCP wrapper 对 `CatRoutingError` 生成固定人类可读前缀 + JSON 双轨（KD-6），单元测试覆盖文本格式
- [ ] AC-C4: MCP 工具描述更新，让 caller LLM 知道 `routing_warnings` / 400 `cat_disabled` 含义和如何选 alternatives

### Phase D（Hub UX）
- [ ] AC-D1: 新增 `GET /api/cats/:catId/disable-impact` 端点，server-side 聚合 task / scheduledTask 引用（PR tracking 不在范围）
- [ ] AC-D2: Hub Toggle disable 前调用该端点，弹确认弹窗显示影响；确认通过后 disable 不强迁移，引用标"owner 已停用，等待重指派"
- [ ] AC-D3: Hub 上单独一行显示 disabled 成员（"已停用"灰色 badge），可一键启用

## Dependencies

- **Evolved from**: F127（猫猫管理重构 — CRUD 基建）
- **Related**: F032（CatRegistry / Roster 基础架构）
- **Related**: F167（A2A Chain Quality — KD-20 restrictions / KD-21 model surface 风格参考）
- **Related**: F086（Cat Orchestration — 元认知避免反复 @ 不在的猫）

## Risk

| 风险 | 缓解 |
|---|---|
| MCP 工具加 warning 后 LLM 解析行为变化（特别是 Codex/GPT 系列） | warning 只是 metadata，不阻断；先在 Claude 系列验证，再推 Codex |
| Resolver 单点变热路径瓶颈 | resolver 是纯内存查 `isCatAvailable` + alternatives 排序，无 IO；性能基准测试覆盖 |
| disabled 猫的进行中 task/PR 强制迁移 = 丢工作 | 选择"标记 + 等重指派"而非强迁移，AC-D2 显式约束 |
| 两猫同 alias 但一只 disabled — alternatives 排序歧义 | resolver 内部 dedupe，alternatives 按 family 同/跨 + lead 标签排 |

## Open Questions（全部已拍板 — 砚砚 review 2026-04-30）

| # | 原问题 | 拍板结果 | 来源 |
|---|------|------|------|
| OQ-1 | A 类工具软降级 vs 硬阻断 | **细分**：post/cross/rich 软降级 + 结构化全失败 isError；multi_mention 是契约式 hard fail | 砚砚 review |
| OQ-2 | Phase D 进行中引用聚合 | **进 F182**，做 server-side impact preview endpoint（不在 useCatData 拼三套）；首版不增索引；PR tracking 不在范围 | 砚砚 review |
| OQ-3 | 已停用成员独立区段 vs 行内标注 | **独立区段**——LLM 看不到灰色，行内会把 disabled 猫塞回主名册 | 砚砚 review |
| OQ-4 | `cat_no_quota` 是否进 F182 | **不进**——避免把人工 disable 和 quota exhaustion 混成不稳定语义；reviewer matcher 文案后续可做独立 quota feature | 砚砚 review |

## Key Decisions

> 砚砚 review 2026-04-30 拍板。

| # | 决策 | 理由 |
|---|---|---|
| KD-1 | `available: false` 是 disable 的唯一真相源，不引入新字段 | 现有 `roster.available` 已贯通 UI/prompt/A2A 三层，避免双真相源 |
| KD-2 | 错误路径细分 — 三档：A 软降级 + warning / A' 结构化全失败 isError / B/A' 契约式 400 | post/cross/rich 是 best-effort 消息路由；multi_mention 是 request/response 契约；create_task/start_vote/scheduled_task 的 owner/voter 必须有效；不一刀切 |
| KD-3 | 改 buildTeammateRoster 必跑 SystemPromptBuilder 守护测试 | CLAUDE.md 布偶猫专属规则：`node --test test/system-prompt-builder.test.js` |
| KD-4 | Resolver 必须覆盖 5 个入口（不止文本 @） | 砚砚 P1-1：`post_message.targetCats` 等结构化字段当前只校验 `catRegistry.has()`，disabled 直进 enqueueA2ATargets；不修等于 disable 只是 UI 装饰 |
| KD-5 | `cat_no_quota` 不在 F182 公共类型 | 砚砚 OQ-4：人工 disable 和 quota exhaustion 是两套独立信号，混合会污染语义；reviewer matcher 现有"没猫粮"暂保留独立路径 |
| KD-6 | MCP wrapper 对 `CatRoutingError` 输出固定人类可读前缀 + JSON 双轨 | 砚砚 P2：MCP 协议把 400 包装成 `Callback failed (400): <body>` 文本，LLM 解析不稳定；前缀格式 `Cat routing failed [kind=...] target=@x ...` 让 LLM 即使 JSON 解析失败也能识别 |

## 涉及文件

### 新增
- `packages/shared/src/types/cat-routing.ts` — `CatRoutingError` + `CatAlternative` 类型
- `packages/api/src/domains/cats/services/agents/routing/cat-target-resolver.ts` — 单点 resolver
- `packages/api/test/cat-target-resolver.test.js` — resolver 单元测试

### 修改
- `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts:390` — buildTeammateRoster 增加"已停用"区段
- `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts:92` — 静默 skip → resolver 闸
- `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts:275, 415` — 同步改造
- `packages/api/src/routes/callbacks.ts` 或 9 个 MCP 写工具的 handler — 接 resolver
- `packages/web/src/components/HubMemberOverviewCard.tsx` — disabled 行 + side-effect 弹窗
- `packages/web/src/hooks/useCatData.ts` — 进行中引用聚合查询

### 测试
- `packages/api/test/system-prompt-builder.test.js` — 增加 disabled roster 注入用例
- `packages/api/test/connector-command-layer.test.js` — A 类工具 routing_warnings 用例
- `packages/api/test/callbacks.test.js`（如有） — B 类工具 400 错误用例

## Phases / Timeline

| 日期 | 事件 |
|---|---|
| 2026-04-30 | 立项 — 铲屎官 thread `thread_molhvy2v84woqas9` 提出，宪宪盘点确认 4 层水位 |
| 2026-04-30 | 砚砚（缅因猫 GPT-5.5）spec review — 提两个 P1（结构化字段缺口 / B 类清单错误）+ 拍板 4 个 OQ；spec 修订到 v2 |
| TBD | @opus 4.6 spec review（multi_mention 首轮未返回，待补） |
| TBD | Design Gate 收尾 — opus 4.6 review 回来后整合，进 worktree |
| TBD | Phase A 实施 — 错误契约 + 5-入口 resolver |
| TBD | Phase B 实施 — prompt 降级（独立区段） |
| TBD | Phase C 实施 — 7 个 MCP 工具接入（A=3 软 + A'=1 硬 + B=3 硬）+ wrapper 前缀 |
| TBD | Phase D 实施 — Hub UX + impact preview endpoint |

## Review Gate

- **Spec review**：@opus 4.6 + @codex 砚砚（2026-04-30 拉起）
- **Design Gate**：4 个 OQ 拍板后才进 worktree
- **Phase 独立 review**：A → B → C → D，每 Phase squash merge 一次
- **愿景守护**：merge 后由非作者非 reviewer 的猫做（候选：@gemini25 / @gpt52）

## Links

| 类型 | 路径 | 说明 |
|---|---|---|
| **立项 thread** | `thread_molhvy2v84woqas9` | 铲屎官原始问题 + 宪宪盘点 |
| **Evolved from** | `docs/features/F127-cat-instance-management.md` | F127 CRUD 基建 |
| **Routing 参考** | `docs/features/F167-a2a-chain-quality.md` | KD-20/21 设计语言（restrictions / model surface） |
