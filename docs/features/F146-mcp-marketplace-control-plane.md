---
feature_ids: [F146]
related_features: [F041, F043, F129, F142, F145]
topics: [mcp, marketplace, plugin, connector, capability-center]
doc_kind: spec
created: 2026-03-28
---

# F146: MCP Marketplace Control Plane — 一键接入 + 多生态聚合

> **Status**: spec | **Owner**: 缅因猫 + 布偶猫 | **Priority**: P1

## Why

铲屎官最新诉求（2026-03-28）是明确的：

1. 不接受继续手改 `capabilities.json` 作为 MCP 新增主流程
2. 既然我们已有能力中心看板，就要支持“一键添加 MCP / 一键下线 MCP”
3. 希望接入多生态发现与分发，不只看本地配置：
   - Claude 生态
   - Codex 生态
   - OpenClaw / ClawHub 生态
   - Antigravity 生态
4. 架构分层要清楚：`L1 MCP`（执行层）/ `L2 Skills`（方法层）/ `L3 Plugins/Connectors`（分发层）

F145 已经解决了“新机器可移植”和 `requires_mcp + doctor`，但还停在“声明式配置 + CLI 诊断”。F146 要补的是“能力中心的写路径 + 市场接入路径”。

## What

### 目标分层（固定）

- **L1: MCP 执行层（主干真相源）**
  - 统一登记 MCP server（stdio/remote）
  - 统一健康状态（ready/missing/unresolved/disabled）
  - 统一版本与来源策略（pinned/channel/source）
- **L2: Skills / workflows 方法层**
  - 只声明依赖（`requires_mcp`），不负责安装
  - 由能力中心根据 L1 状态提示“可用/缺失”
- **L3: Plugins / Connectors 分发层**
  - 负责发现、安装、认证、分发体验
  - 不是唯一真相源；最终回写 L1

### Phase R: Research Mode B（先收敛再动手）

在进入实现前，先完成一轮云端咨询调研，避免我们在“看起来相似”的生态接口上误判。

调研聚焦四个问题：

1. Claude / Codex / OpenClaw / Antigravity 的插件/连接器格式交集有多大
2. 哪些生态支持“程序化发布/安装 API”，哪些只支持 UI/CLI 手工路径
3. 能否安全地做统一 adapter（最小公共字段 + 各家扩展字段）
4. 供应链风险最小化策略（官方认证、签名、审核、安装门禁）
5. 外部文档 URL 有效性与内容一致性（防止基于失效链接立项）

产物：
- 跨生态 schema 对照矩阵
- adapter 可行性结论（直接可做 / 需降级 / 不建议）
- Phase A-B 的实现边界收敛稿

### Phase A: 能力中心写路径（One-click Add/Remove MCP）

在 Hub 能力中心新增 MCP 管理能力：

1. 新增 MCP
   - 模板添加（官方/内置推荐）
   - 自定义添加（命令/参数/env/remote URL）
2. 更新 MCP
   - 启用/禁用（已存在）
   - 升级版本（pinned → 新版本）
   - 修改 source（例如 npm → marketplace source）
3. 删除 MCP
   - 软删除（保留历史）
   - 硬删除（从声明态移除）

后端新增写 API（草案）：
- `POST /api/capabilities/mcp/preview`
- `POST /api/capabilities/mcp/install`
- `PATCH /api/capabilities/mcp/:id`
- `DELETE /api/capabilities/mcp/:id`

并发与一致性要求：
- 写入能力必须串行化（锁）或带版本号 CAS，避免双猫并发安装导致覆盖
- 所有写操作都通过同一编排入口，保证 `capabilities.json`、CLI 配置、probe 状态一致

### Phase B: Marketplace 聚合（4 生态）

新增 Marketplace Adapter 层，首期即覆盖四家：

1. **Codex plugin directory adapter**
2. **Claude plugin marketplace adapter**
3. **OpenClaw / ClawHub adapter**
4. **Antigravity adapter（首期至少完成 discovery + 与 pencil resolver 一致性约束）**

统一输出模型：
- `packageId`
- `ecosystem` (`codex`/`claude`/`openclaw`/`antigravity`)
- `kind` (`mcp`/`plugin`/`bundle`/`connector`)
- `trustLevel` (`official`/`verified`/`community`)
- `installPlan`（最终映射为 L1 MCP entry 或 L2/L3 扩展）

### Phase C: 安装治理与安全门禁

引入安装策略层（Policy Engine）：

1. 默认只允许 `official + verified` 一键安装
2. `community` 包需要二次确认（显示风险）
3. 全部安装写审计日志（who/when/what/from）
4. 所有新增 MCP 必须经过 `mcp:doctor` 验证后才标 ready

版本管理：

- 新增 `mcp-lock`（或扩展现有状态文件）记录：
  - 来源（marketplace/npm/git/local）
  - 版本（exact/range/channel）
  - 安装时间与操作者
- 避免 `@latest` 漂移造成不可复现

### Phase D: L1/L2/L3 视图联动

能力中心同时显示：

1. MCP 状态（L1）
2. Skill 依赖满足度（L2）
3. 分发来源/认证状态（L3）

并支持“从缺依赖直接补齐”：

- 当 skill 显示 `missing` MCP 时，点一下直接跳到推荐来源并安装。

### Validation Scenario（设计验证场景）

以“浏览器三后端接入”作为强制验收场景（已有手工流程的自动化替代）：

1. `agent-browser`
2. `pinchtab`
3. `claude-in-chrome`

要求：
- 全流程通过 UI 完成，不手改 `capabilities.json`
- 自动同步 `requires_mcp` 依赖状态
- `mcp:doctor` 报告正确反映 ready/missing/unresolved
- 结果可回放（有审计记录）

## Acceptance Criteria

### Phase R（Research Mode B）
- [ ] AC-R1: 形成 Claude/Codex/OpenClaw/Antigravity 四方 schema 对照表
- [ ] AC-R2: 明确三类能力边界：可自动安装 / 需人工确认 / 仅可发现
- [ ] AC-R3: 给出统一 adapter 最小字段集（必填）+ 各生态扩展字段（可选）
- [ ] AC-R4: 形成“先做什么、不做什么”的实施收敛结论并回写 F146
- [ ] AC-R5: 外部文档 URL 逐条验真（可访问 + 内容匹配），形成证据表

### Phase A（能力中心写路径）
- [ ] AC-A1: Hub 可通过 UI 新增 MCP（无需手改 `capabilities.json`）
- [ ] AC-A2: Hub 可通过 UI 删除 MCP，并触发配置重编排
- [ ] AC-A3: 新增 MCP 后自动触发 `generateCliConfigs` + `mcp:doctor` 探测
- [ ] AC-A4: 所有 MCP 写操作有审计日志（用户、时间、变更 diff）
- [ ] AC-A5: 并发写入安全（锁或 CAS）可验证，双写场景不丢配置

### Phase B（Marketplace 聚合）
- [ ] AC-B1: 支持统一搜索接口返回 Codex/Claude/OpenClaw/Antigravity 四方结果
- [ ] AC-B2: 结果带 `trustLevel`，可按 `official/verified/community` 过滤
- [ ] AC-B3: 能把 marketplace 条目映射成可执行 `installPlan`
- [ ] AC-B4: 支持统一搜索接口返回 Antigravity 结果（至少 discovery + metadata）
- [ ] AC-B5: Antigravity 结果与现有 `pencil` resolver 策略保持一致性（不互相冲突）

### Phase C（治理与版本）
- [ ] AC-C1: 默认策略阻止一键安装 `community` 包（需二次确认）
- [ ] AC-C2: 安装后写入版本锁（source/version/channel）
- [ ] AC-C3: `mcp:doctor` 能显示“已安装但未就绪”的具体原因
- [ ] AC-C4: 禁止未通过 probe 的 MCP 直接显示 ready

### Phase D（联动体验）
- [ ] AC-D1: Skills 页可从 `requires_mcp missing` 直接发起补齐
- [ ] AC-D2: 能力中心可按 `L1/L2/L3` 分层过滤
- [ ] AC-D3: UI 中可追踪每个 MCP 的来源生态（Codex/Claude/OpenClaw/Antigravity）

## Dependencies

- **Evolved from**: F145（MCP portable provisioning + doctor）
- **Evolved from**: F041（能力中心看板）
- **Related**: F043（MCP 归一化 server split）
- **Related**: F129（Pack / plugin 生态边界）
- **Related**: F142（connector 命令可发现性与扩展机制）

## Risk

| 风险 | 缓解 |
|------|------|
| Marketplace API / schema 漂移 | 每个 adapter 单独版本化；增加 contract tests |
| 三家生态概念不一致（plugin/bundle/connector） | 统一中间模型，禁止 UI 直接耦合源字段 |
| 恶意包/供应链风险 | trustLevel 策略 + 安装审批 + 审计日志 + 默认 deny community auto-install |
| 自动安装破坏本机环境 | preview/install 两阶段，先 dry-run 显示变更 |
| 把 L3 当真相源导致状态漂移 | 明确“最终真相源只写 L1 capabilities” |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Codex 官方公共 Plugin Directory 发布 API 是否开放给第三方编程接入（不只是 App/CLI 交互） | ⬜ 待确认 |
| OQ-2 | Claude marketplace 在 Team/Enterprise 下的组织级限制策略是否需要映射到我们的权限模型 | ⬜ 待确认 |
| OQ-3 | Antigravity 生态是否存在稳定公开 market API，还是只支持本地/手工模式（若无公开 API 的降级策略） | ⬜ 待确认 |
| OQ-4 | 是否把 MCP 安装审批接入现有 permission center（统一审批轨） | ⬜ 待确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立项必须覆盖 L1/L2/L3 三层，不做单层优化 | 铲屎官明确要求“完整立项，不只一层” | 2026-03-28 |
| KD-2 | 以 L1 capabilities 为唯一真相源 | 避免 marketplace 状态与本地真实可用状态漂移 | 2026-03-28 |
| KD-3 | Phase A 先解决“手改 JSON”痛点，再做多生态聚合 | 先交付立即价值（一键添加） | 2026-03-28 |
| KD-4 | 三家生态先统一 discovery，再逐步统一 install | 降低首期复杂度与安全风险 | 2026-03-28 |
| KD-5 | Antigravity 不是“可选”，首期必须纳入 discovery 与一致性约束 | 我们已有活跃 `pencil` 生态，不能与 F145 resolver 脱节 | 2026-03-28 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-28 | 立项（基于铲屎官新诉求与 F145 完成态） |

## Review Gate

- Phase A: 缅因猫 author + 布偶猫严格 review
- Phase B/C: 跨家族 review + 安全视角复核（至少一轮）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F145-mcp-portable-provisioning.md` | 当前 MCP 可移植基础能力 |
| **Feature** | `docs/features/F041-capability-dashboard.md` | 能力中心看板基础 |
| **Feature** | `docs/features/F129-pack-system-multi-agent-mod.md` | plugin/pack 生态边界 |
| **External** | https://developers.openai.com/codex/plugins | Codex plugin directory + 安装流程 |
| **External** | https://developers.openai.com/codex/plugins/build | Codex plugin 结构与发布状态 |
| **External** | https://developers.openai.com/api/docs/guides/tools-connectors-mcp | OpenAI MCP/Connectors 工具层 |
| **External** | https://code.claude.com/docs/en/plugin-marketplaces | Claude plugin marketplace 机制 |
| **External** | https://docs.openclaw.ai/plugins/bundles | OpenClaw 对 Codex/Claude/Cursor bundle 映射 |
| **External** | https://docs.openclaw.ai/tools/clawhub | ClawHub registry 与安装/更新/发布流程 |
