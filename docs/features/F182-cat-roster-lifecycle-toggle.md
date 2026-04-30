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

**新增公共类型 + Resolver 单点闸**——所有 9 个 MCP 写工具 + 前端 @ 入口共享一套：

```ts
// packages/shared/src/types/cat.ts (or new cat-routing.ts)
export type CatRoutingError =
  | { kind: 'cat_not_found'; mention: string; alternatives: CatAlternative[] }
  | { kind: 'cat_disabled'; catId: CatId; displayName: string; alternatives: CatAlternative[] }
  | { kind: 'cat_no_quota'; catId: CatId; displayName: string; alternatives: CatAlternative[] };

export interface CatAlternative {
  readonly catId: CatId;
  readonly mention: string;
  readonly displayName: string;
  readonly family: string; // 同族优先排前面
}
```

**位置**：在现有 `mention-parser.ts` / `AgentRouter.isRoutableCat` 之上加一层 `resolveCatTarget(mentionOrId): { ok: CatId } | { error: CatRoutingError }`，作为所有 MCP 写工具和 A2A 调度的统一闸。

### Phase B: System Prompt 降级提示（让猫自己感知）

当前 buildTeammateRoster 直接过滤掉 disabled 猫，**但调用猫不知道**自己曾经的队友被停用了——会反复 @ 不存在的人。改进：

- **可见但标灰**的"暂停成员"小区段（disabled 猫单独列在 roster 末尾，标"已停用，请改 @ X / Y"）
- 配合 F167 KD-21 风格 — 显示替代 mention，避免 cargo-cult 投射

### Phase C: 9 个 MCP 写工具接入降级反馈

A 类工具（消息路由）直接接 resolver：
- `cat_cafe_post_message` / `cat_cafe_multi_mention` / `cat_cafe_cross_post_message` / `cat_cafe_create_rich_block`
- 解析消息体里的 @ → resolver 闸 → 命中 disabled 猫则在工具返回里附 `routing_warnings: [{ kind: 'cat_disabled', alternatives: [...] }]`，**不阻断**主路径（仍发送给在线的其他 @ 目标），让调用猫看到 warning 后自决换人

B 类工具（assignee/owner 是猫）显式校验：
- `cat_cafe_create_task` / `cat_cafe_update_task` (assignee) / `cat_cafe_register_pr_tracking` (guardian/reviewer) / `cat_cafe_start_vote` (candidates) / `cat_cafe_register_scheduled_task` (owner)
- 命中 disabled 猫直接 400 + `CatRoutingError`，调用猫必须换人才能继续

### Phase D: Hub Toggle UX + Side-Effect Awareness

- 当前 toggle 静默写入，铲屎官看不到副作用
- Toggle disable 时检查：这只猫是否有进行中的 task / PR tracking / scheduled task？
- 弹个轻量确认："禁用 X 后，以下进行中的引用会处于待确认状态：[列表]，是否继续？"
- 不强制阻断，只让铲屎官知情

## Acceptance Criteria

### Phase A（错误契约 + Resolver 闸）
- [ ] AC-A1: `CatRoutingError` 类型 export 到 `@cat-cafe/shared`，三种 kind 覆盖完整
- [ ] AC-A2: `resolveCatTarget()` 单点 resolver 实现，单元测试覆盖三种错误路径 + alternatives 排序（同族优先）
- [ ] AC-A3: `a2a-mentions.ts` 静默 skip 改为 resolver 调用，保留向后兼容（mentions 列表不变，新增 errors 列表）

### Phase B（Prompt 降级提示）
- [ ] AC-B1: `buildTeammateRoster` 增加"已停用成员"小区段，列出 disabled 猫 + 替代 mention 提示
- [ ] AC-B2: `system-prompt-builder.test.js` 覆盖 disabled 猫场景：在/不在 roster、stranded mention 提示文案

### Phase C（MCP 工具降级反馈）
- [ ] AC-C1: 4 个 A 类工具（post/multi/cross/rich）在消息体含 disabled @ 时返回 `routing_warnings`，主路径不阻断，单元测试覆盖
- [ ] AC-C2: 5 个 B 类工具（task/pr/vote/scheduled）在 assignee 是 disabled 猫时返回 400 `cat_disabled` + alternatives
- [ ] AC-C3: MCP 工具描述更新，让 caller LLM 知道 `routing_warnings` 含义

### Phase D（Hub UX）
- [ ] AC-D1: Toggle disable 时聚合该猫所有进行中的引用（task assignee / PR guardian / scheduled owner），列在确认弹窗
- [ ] AC-D2: 确认通过后正常 disable；进行中引用不强制迁移，只标 "owner 已停用，等待重指派"
- [ ] AC-D3: Hub 上单独一行显示 disabled 成员（标"已停用"灰色 badge），可一键启用

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

## Open Questions

| # | 问题 | 待定方 |
|---|------|------|
| OQ-1 | A 类工具的 `routing_warnings` 应否同时阻断 send 给 disabled 猫但**继续发送给在线 @**？还是全部阻断让调用猫重发？ | @opus + @codex review |
| OQ-2 | Phase D 的"进行中引用"聚合是否需要新增数据库索引？目前 task assignee 是单字段查询，PR guardian 在 PR tracking JSON 里，scheduled owner 在 schedule meta 里——三处口径要不要在 F182 范围内统一 | @codex review（性能/数据模型） |
| OQ-3 | system prompt 的"已停用成员"区段是否应该和"队友名册"合并标注（例如灰色行内标"[已停用]"），还是单独区段？两种交互信号强度不同 | 设计偏好题，铲屎官拍 |
| OQ-4 | `cat_no_quota` 是否在本 feat 范围？现有"没猫粮"语义是 reviewer matcher 内部用的，要不要顺手统一到 `CatRoutingError`？还是留给独立 follow-up | @codex review |

## Key Decisions

> Design Gate 后落定，当前留 strawman。

| # | 决策（草案） | 理由 |
|---|---|---|
| KD-1 (草) | `available: false` 是 disable 的唯一真相源，不引入新字段 | 现有 `roster.available` 已贯通 UI/prompt/A2A 三层，避免双真相源 |
| KD-2 (草) | 错误路径用 routing_warnings (软) + 400 (硬) 两档，不一刀切 | A 类消息路由是 best-effort（部分 @ 失败也应送达其他猫），B 类任务指派是契约式（assignee 必须有效） |
| KD-3 (草) | Phase B 改 buildTeammateRoster 时加 SystemPromptBuilder 守护测试 | CLAUDE.md 布偶猫专属规则：改 SystemPromptBuilder 必跑 `node --test test/system-prompt-builder.test.js` |

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
| TBD | Design Gate — @opus 4.6 + @codex 砚砚 review spec md |
| TBD | Phase A 实施 — 错误契约 + resolver |
| TBD | Phase B 实施 — prompt 降级提示 |
| TBD | Phase C 实施 — 9 个 MCP 工具接入 |
| TBD | Phase D 实施 — Hub UX |

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
