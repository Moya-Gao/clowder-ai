---
feature_ids: [F168]
related_features: [F141, F116, F140, F055, F122]
topics: [community, orchestration, opensource]
doc_kind: spec
created: 2026-04-18
---

# F168: Community Operations Board — 社区事务编排引擎

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官现在是人肉 dispatcher：手动 @ 猫看 issue/PR、手动分配线程、手动跟进进度、手动叮嘱"好好看 skill"、手动触发 guardian 验证。现有 F141（发现层）+ F116（ops skill）有完整的流程定义，但缺少**状态管理**和**自动编排**——流程靠铲屎官口头驱动，进度靠铲屎官脑子记。

铲屎官原话：
> "现在全看我喊你们去看有点麻烦"
> "你们得想想得做管理的啊，不然上次这个任务派发给什么线程的猫，然后他们进度如何"
> "比如 issue xxx 的 pr yyy 现在正在 xxx 线程负责"
> "猫猫们每次 intake 都会犯错，没有一次不是"

目标：把铲屎官从"人肉编排器"解放成"决策者"——猫猫自动发现、分拣、分配、跟踪、守护，铲屎官只需要在关键节点拍板。

## What

### Phase A: 定方向卡片 + Inbox 首猫分拣

把铲屎官的人肉 dispatch 话术模板化为标准流程：

1. **定方向卡片（Direction Card）**：猫猫 triage 完后，向 Inbox thread 发一张结构化 rich block：
   - 事项来源（issue/PR #、repo）
   - 是什么（一句话）
   - 关联 feat（如有）
   - Ownership 5 问结果（Q1-Q5 ✅/⚠️/❌）
   - 猫的建议（WELCOME / NEEDS-DISCUSSION / POLITELY-DECLINE）
   - 需要铲屎官决定什么（明确标注 or "猫自决"）
2. **双猫方向交叉**：首猫 triage 后自动 @ 第二只猫独立评估方向（不等铲屎官喊），两猫意见汇总后再标记是否需要铲屎官拍板
3. **路由分发**：
   - 已有 feat → 路由到该 feat thread，@ 负责猫
   - 全新事项 + 铲屎官 OK → 首猫创建新 thread 并分配
   - bugfix（猫自决）→ 首猫就地分配或自行处理

### Phase B: 社区事务台账 + 生命周期跟踪

每个社区 issue/PR 进入视野后创建一条 `CommunityItem` 记录：

1. **数据模型**：
   - `repo`: 来源仓库（多仓库支持，不 hardcode）
   - `githubRef`: issue/PR 编号 + 类型
   - `state`: `new → triaged → pending-decision → accepted → in-review → merged/closed/declined`
   - `assignedThreadId`: 工作线程
   - `assignedCatId`: 负责猫
   - `directionCard`: 定方向卡片快照
   - `ownerDecision`: 铲屎官拍板结果
   - `lastActivity`: 最后活跃时间 + 事件类型
2. **状态自动流转**：
   - F141 发现事件 → 自动创建 `CommunityItem`（state: new）
   - 首猫发定方向卡片 → state: triaged
   - 标记需要铲屎官 → state: pending-decision
   - 铲屎官拍板 → state: accepted / declined
   - PR review 开始 → state: in-review
   - PR merged / issue closed → state: merged / closed
3. **PR 更新信号**：贡献者 push 新 commit / CI 状态变化 → 通知负责猫 re-review（F140 PR tracking 信号消费）
4. **多仓库支持**：repo 是绑定参数，一个 Cat Café 实例可管理多个 repo

### Phase C: 管理视图

Workspace "社区" 模式，铲屎官一打开就看到全局：

1. **按状态分组看板**：new / triaged / pending-decision / in-review / merged
2. **每个 item 显示**：repo + issue/PR # + 标题 + 负责猫 + 线程 + 最后活跃
3. **快捷操作**：点击跳转到关联线程 / GitHub 页面
4. **筛选**：按 repo / 状态 / 负责猫 / 时间范围

### Phase D: Intake 硬门禁 + Guardian 自动触发

把铲屎官的"你去守护一下"变成系统自动触发：

1. **Intake 完成信号**：负责猫声称 intake 完成 + reviewer 放行 → 自动触发 guardian 猫
2. **Guardian 自动分配**：从 roster 中选一只（≠ author ≠ reviewer），自动 @ 并加载 intake skill
3. **Guardian sign-off 作为 merge 硬门禁**：缺 guardian 确认 → merge-gate 自动拦截
4. **Intake checklist 强制**：不是靠叮嘱"好好看 skill"，而是系统验证 checklist 每项都有证据

## Acceptance Criteria

### Phase A（定方向卡片 + Inbox 分拣）
- [ ] AC-A1: 首猫 triage 后自动向 Inbox 发结构化定方向卡片（rich block）
- [ ] AC-A2: 定方向卡片包含：事项来源、关联 feat、5 问结果、猫建议、铲屎官决策点
- [ ] AC-A3: 首猫自动 @ 第二只猫交叉评估方向（非 bugfix 场景）
- [ ] AC-A4: 两猫意见汇总后，自动标记是否需要铲屎官拍板
- [ ] AC-A5: 已有 feat 事项自动路由到该 feat thread 并 @ 负责猫
- [ ] AC-A6: 全新事项经铲屎官 OK 后，首猫创建新 thread 并分配负责猫

### Phase B（台账 + 生命周期）
- [ ] AC-B1: 每个社区 issue/PR 有持久化的 CommunityItem 记录
- [ ] AC-B2: CommunityItem 状态随流程自动流转（6 种状态）
- [ ] AC-B3: PR push / CI 变化自动通知负责猫 re-review
- [ ] AC-B4: 支持多仓库绑定，repo 是配置参数非 hardcode
- [ ] AC-B5: 台账数据持久化（TTL=0，铁律 #5）

### Phase C（管理视图）
- [ ] AC-C1: Workspace "社区" 模式可用，按状态分组展示所有 CommunityItem
- [ ] AC-C2: 每个 item 显示 repo / issue-PR # / 标题 / 负责猫 / 线程 / 最后活跃
- [ ] AC-C3: 点击 item 可跳转到关联线程或 GitHub 页面
- [ ] AC-C4: 支持按 repo / 状态 / 负责猫筛选

### Phase D（Intake 硬门禁）
- [ ] AC-D1: Intake 完成 + reviewer 放行 → 系统自动 @ guardian 猫
- [ ] AC-D2: Guardian 从 roster 自动选择（≠ author ≠ reviewer）
- [ ] AC-D3: 缺 guardian sign-off → merge-gate 自动拦截
- [ ] AC-D4: Intake checklist 每项需要证据，系统验证非人工叮嘱

## Dependencies

- **Related**: F141（GitHub Repo Inbox — 发现层，本 feature 消费其事件）
- **Related**: F116（opensource-ops skill — 流程定义，本 feature 编排其流程）
- **Related**: F140（PR Tracking — 本 feature 消费 PR 状态变化信号）
- **Related**: F055（Plan Board — 可能共享前端看板组件）
- **Related**: F122（Unified Dispatch — 可能复用调度基础设施）
- **Related**: F086（Multi-Mention — Phase A 双猫交叉依赖 multi_mention）

## Risk

| 风险 | 缓解 |
|------|------|
| Phase A 改 skill 可能影响现有 triage 流程 | 渐进式：先加卡片模板，不改现有判断逻辑 |
| 多仓库 webhook 配置复杂度 | 复用 F141 已有的 allowlist 机制，扩展为 per-repo 配置 |
| Guardian 自动触发可能产生 @ 风暴 | 限频：同一 item 最多触发一次 guardian |
| 状态机复杂度 | Phase B 先实现线性状态流转，分支/回退后续迭代 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 首猫值班是固定还是轮班？初期固定一只，事项多了再考虑 | ⬜ 待定 |
| OQ-2 | 定方向卡片的铲屎官拍板是在 Inbox thread 还是管理视图？ | ⬜ 待定 |
| OQ-3 | CommunityItem 存储用 Redis 还是 SQLite？ | ⬜ 待定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 单实例多仓库，非多租户 | 每人自建 Cat Café 实例，不做 SaaS；data model 按 repo 隔离 | 2026-04-18 |
| KD-2 | Inbox 首猫分拣制（模型 C） | 中央入口 + 分发，铲屎官只看 Inbox 就知全局 | 2026-04-18 |
| KD-3 | 方向评估必须双猫 | 单猫视角大概率有偏颇，非 bugfix 场景强制双猫交叉 | 2026-04-18 |
| KD-4 | Intake guardian 由系统自动触发 | 铲屎官"每次 intake 都出错"→ 不靠叮嘱靠门禁 | 2026-04-18 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-18 | 立项，铲屎官需求讨论 |

## Review Gate

- Phase A: 跨家族 review（skill 改动）
- Phase B: 跨家族 review（数据模型 + API）
- Phase C: 铲屎官 UX 审核（前端）
- Phase D: 跨家族 review + 铲屎官确认门禁策略

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F141-github-repo-inbox.md` | 发现层（上游） |
| **Feature** | `docs/features/F116-opensource-ops.md` | 流程定义 |
| **Feature** | `docs/features/F140-github-pr-signals.md` | PR 信号（上游） |
| **Skill** | `cat-cafe-skills/opensource-ops/SKILL.md` | 现有社区运营 skill |
| **Ref** | `cat-cafe-skills/refs/ownership-gate.md` | Ownership 5 问 |
