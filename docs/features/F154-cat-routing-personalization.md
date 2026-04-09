---
feature_ids: [F154]
related_features: [F078, F032, F127, F134, F142]
topics: [routing, connector, ux, personalization]
doc_kind: spec
created: 2026-04-09
community_issue: "clowder-ai#385, clowder-ai#391"
---

# F154: Cat Routing Personalization — 全局默认猫 + 首选猫入口 + 单次定向

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2

## Why

铲屎官原话（2026-04-09）：
> "这个应该和 #385 的 issue 联合立项，是一个完整的东西"
> "他的飞书那样用，那我们应该自己思考，除了飞书呢？在猫猫咖啡里面如何设定，以及如何知道这个 thread 的首选猫是谁？"

社区 issue #385 原话：
> "把'无历史时谁来接第一棒'的全局默认回复猫做成可配置项"

社区 PR #391 解决的痛点：
> 飞书群聊里 @mention 体验差（要从列表选人、容易选错），需要 @-free 的猫猫路由方式

当前状态：
- `preferredCats` **已存在**于 Thread model（F032-b），Hub 端有 `ThreadCatSettings.tsx` popover 可设置
- `AgentRouter` 已实现完整路由链：`@mention → last-replier(scoped to preferredCats) → first preferred → default cat`
- **但**：Connector 端（飞书/微信）无法设置/查看 preferredCats；全局默认猫 hardcoded（`getDefaultCatId()` = `breeds[0]`）；Hub 端缺少明显的"当前首选猫"指示器

## What

### Phase A: Connector 首选猫入口 + 全局默认猫可配置

**A1 — Connector 命令**：
- `/focus <猫名>` — 设置当前 thread 的 preferredCats（复用现有 `threadStore.updatePreferredCats`）
- `/focus` — 查看当前 thread 的首选猫
- `/focus clear` — 清除首选猫设置
- `/ask <猫名> <消息>` — 单次定向：把这条消息发给指定猫，不改变 preferredCats

**A2 — 猫名解析**：
- 复用 `cat-config.json` 的 aliases 字段（F127 动态别名），不硬编码
- `normalizeCatId(input)` 查 catRegistry aliases + displayName partial match
- 不可路由的猫返回明确错误（"该猫当前不可用"）

**A3 — 全局默认猫可配置**：
- `GET/PUT /api/config/default-cat` — 运行时修改全局默认猫（member overview 面板入口）
- `getDefaultCatId()` 优先读运行时配置，fallback 到 `breeds[0]`
- 或 `/config set defaultCat <catId>` 从 connector 设置

### Phase B: Hub 可见性 + UX 统一

**B1 — Thread Header 首选猫指示器**：
- Thread header / 聊天区顶部显示当前首选猫（头像 + 名字）
- 点击可快速切换（复用 `ThreadCatSettings` 的 CatSelector）
- 无首选猫时不显示（不占空间）

**B2 — Member Overview 默认猫设置**：
- 在猫猫管理/member overview 页面增加"全局默认猫"选择器
- 清晰标注："新 thread 没有历史时，默认由这只猫回复"

**B3 — Connector 可见性**：
- `/status` 输出增加"首选猫"信息
- `/commands` 列表包含 `/focus` `/ask`

## Acceptance Criteria

### Phase A（Connector 入口 + 全局默认猫）
- [ ] AC-A1: 飞书/微信 connector 中 `/focus opus` 设置 thread preferredCats，`/focus` 查看，`/focus clear` 清除
- [ ] AC-A2: `/ask opus 帮我看代码` 单次定向发消息给 opus，不改变 preferredCats
- [ ] AC-A3: 猫名解析使用 catRegistry aliases，不硬编码；不可路由猫返回错误
- [ ] AC-A4: `getDefaultCatId()` 支持运行时配置覆盖 `breeds[0]` 默认值
- [ ] AC-A5: 现有路由行为无回退（@mention > preferredCats > last-active > default 链不变）
- [ ] AC-A6: `/focus` `/ask` 有单元测试覆盖（含 stale cat fallback、persistence 不可用场景）

### Phase B（Hub 可见性 + UX）
- [ ] AC-B1: Thread header 显示当前首选猫（头像 + 名字），无首选猫时不显示
- [ ] AC-B2: Member overview 有全局默认猫选择器
- [ ] AC-B3: `/status` 输出包含首选猫信息
- [ ] AC-B4: Hub 和 Connector 设置的 preferredCats 实时同步（同一个 thread model）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "在猫猫咖啡里面如何设定（首选猫）" | AC-A1, AC-B1 | connector 输入 + Hub UI 截图 | [ ] |
| R2 | "如何知道这个 thread 的首选猫是谁" | AC-B1, AC-B3 | Hub header 截图 + /status 输出 | [ ] |
| R3 | #385 "全局默认回复猫做成可配置" | AC-A4, AC-B2 | member overview 截图 + API 测试 | [ ] |
| R4 | #391 "飞书 @mention UX conflict" | AC-A1, AC-A2 | connector 端实际输入测试 | [ ] |
| R5 | "除了飞书呢？" — 跨 surface 统一 | AC-A5, AC-B4 | Hub + connector 同一 thread 状态一致 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）

## Dependencies

- **Evolved from**: F032（Agent Plugin Architecture — preferredCats 基础设施）
- **Evolved from**: F078（Smart Routing — 路由优先级链）
- **Related**: F142（Connector Slash Commands — `/focus` `/ask` 使用 F142 框架注册）
- **Related**: F127（猫猫管理重构 — 动态别名，猫名解析复用 aliases）
- **Related**: F134（飞书群聊 — @mention UX 痛点来源）

## Risk

| 风险 | 缓解 |
|------|------|
| preferredCats 存了 stale/disabled 猫 | 路由时必须过 `filterRoutableCats`（AgentRouter 已实现），UI/connector 查询时也标注状态 |
| 全局默认猫改动影响所有新 thread | UI 明确标注影响范围；设置需二次确认 |
| Hub 和 connector 设置冲突 | 同一个 thread model，最后写入者覆盖；UI 实时刷新 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `/focus` 支持多猫吗（`/focus opus sonnet`）？现有 preferredCats 是数组，技术上支持 | ⬜ 未定 |
| OQ-2 | 全局默认猫是 per-user 还是全局？#385 说"from the member overview" 暗示全局 | ⬜ 未定 |
| OQ-3 | `/ask` 的路由是走 ConnectorRouter 还是直接 invokeTrigger？（安全边界） | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不挂 F142（已关闭），独立立项 F154 | F142 是框架，F154 是产品能力；路由优先级变更超出"加命令"范畴 | 2026-04-09 |
| KD-2 | 联合 #385 + #391 概念，跨 surface 统一设计 | 铲屎官："除了飞书呢？在猫猫咖啡里面如何设定？" | 2026-04-09 |
| KD-3 | 猫名解析复用 catRegistry aliases，不硬编码 | 与 F127 动态别名方向一致；社区 PR 的硬编码方式不可维护 | 2026-04-09 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-09 | 立项，铲屎官 + 宪宪 + 砚砚讨论确认联合 #385 + #391 scope |

## Review Gate

- Phase A: 砚砚 review（路由语义 + 安全）
- Phase B: 烁烁 design review（UX）+ 砚砚 code review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F032-agent-plugin-architecture.md` | preferredCats 基础设施来源 |
| **Feature** | `docs/features/F078-smart-routing-group-mentions.md` | 路由优先级链 |
| **Feature** | `docs/features/F142-connector-slash-commands.md` | /slash 框架（/focus /ask 注册到此框架） |
| **Community** | `clowder-ai#385` | 全局默认猫可配置 |
| **Community** | `clowder-ai#391` | /focus /ask 社区 PR（概念来源） |
| **Code** | `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` | 路由核心 |
| **Code** | `packages/web/src/components/ThreadSidebar/ThreadCatSettings.tsx` | Hub 端现有 preferredCats UI |
| **Code** | `packages/api/src/config/cat-config-loader.ts` | getDefaultCatId() 需改造 |
