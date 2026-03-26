---
feature_ids: [F139]
related_features: [F102, F122, F048]
topics: [scheduler, heartbeat, task-runner, multi-agent]
doc_kind: spec
created: 2026-03-25
---

# F139: Unified Schedule Abstraction — 统一调度抽象

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官问："我们现有的能力是不是已经功能上满足小龙虾的 heartbeat 覆盖的能力？"

**宪宪 × 砚砚共识**：事件驱动场景（GitHub webhook/邮件/消息唤醒猫）我们已经比龙虾 heartbeat polling 做得更好——秒级响应 vs 30 分钟轮询。但"没人找你但该主动检查"的自省能力（定时巡检、文档过期检查、stale issue 清理）还没有统一抽象。F102 的 TaskRunner 是 setInterval MVP，硬编码、不可配置、gate 返回 boolean 造成二次扫描。

铲屎官原话："不建议你这个可配置是编辑到什么 Markdown 文档里……能让人类跟你直接说自然语言，你帮别人去编辑，或者你有个 UI 去把东西呈现出来"。

**核心定位**：connector = 被动响应（有人找我），统一调度 = 主动巡检（没人找我但该看看）。前者已有且更好，后者是本 feature 要补的。

## What

### Phase 1a: 统一内部 Poller（纯后端，无前端 UI）

将现有 TaskRunner 升级为六维度 TaskSpec 模型（ADR-022）。**纯后端交付**——Phase 1a 落地后社区和其他猫可以直接基于 TaskSpec_P1 注册新 consumer（不需要等前端）。前端展示（Workspace 调度 Tab）在 Phase 2 统一做，届时把所有已注册任务 + run ledger 展示出来：

- **TaskSpec_P1 interface**：Trigger / Admission / Run / State / Outcome 五维度（Context Phase 2 实现）
- **typed signal gate**：gate 返回结构化 signal（不再 boolean），消除 F102 的二次扫描
- **subjectKey 统一锚点**：lease / cursor / dedupe / dispatch / run-ledger 共用主键
- **run ledger**：SQLite 记录每次调度结果（SKIP_NO_SIGNAL / RUN_DELIVERED / RUN_FAILED）
- **Task profiles**：`awareness`（宽松）/ `poller`（精确）预设，防组合爆炸
- **具体 consumer（铲屎官要求统一，不再加独立 setInterval）**：
  - `summary-compact` — 迁移 F102 SummaryCompactionTask（boolean → typed signal）
  - `cicd-check` — 迁移 F133 CiCdCheckPoller（第一个验证用例）
  - `conflict-check` — 新增 PR 冲突检测（push to main → mergeable 状态变化）
  - `review-comments` — 新增 PR comments 检测（人类 + 猫的 GitHub comments）

### Phase 1b: Actor + Cat Wake

- **actor.role 能力命名空间**：memory-curator / repo-watcher / health-monitor（非 roster 身份角色）
- **MCP async dispatch**：post_message → receipt tracking（assignedCatId / leaseKey / invocationId / completionState）
- **costTier hint**：cheap → Sonnet，deep → Opus

### Phase 2: Cron + Persistence + UI + Context

- **Workspace 调度 Tab（KD-7）**：和"开发""知识"平齐的顶级 Tab，展示所有 Phase 1a/1b 已注册的任务 + run ledger + 状态。Phase 1a 纯后端先行，Phase 2 补前端把全部任务可视化
- **Cron / event / hybrid triggers**：超越 interval-only
- **Context dimension**：session（new-thread / same-thread）× materialization（light / full）
- **自然语言配置**：用户说"每天早上 9 点检查 stale issue"→ 猫翻译成 TaskSpec
- **Task profiles 扩展**：`precise` 预设（cron 精度）

### Phase 3: Governance + Pack Ecosystem

- **电闸/备忘录分离**：task.spec.ts（人类审批）vs checklist.md（agent 可编辑）
- **anti-feedback-loop**：originTaskId + suppressionTTL 防事件回声
- **Pack marketplace 集成**：第三方任务模板发布/安装

## Acceptance Criteria

### Phase 1a（统一内部 Poller）
- [ ] AC-A1: TaskSpec_P1 interface 实现，含 typed signal gate
- [ ] AC-A2: subjectKey 贯穿 lease/cursor/dedupe/ledger 全链路
- [ ] AC-A3: run ledger SQLite 表结构 + 写入逻辑
- [ ] AC-A4: SummaryCompactionTask 迁移到新 TaskSpec（红→绿）
- [ ] AC-A5: CiCdCheckPoller 迁移到新 TaskSpec（红→绿）
- [ ] AC-A6: conflict-check + review-comments TaskSpec 注册可用
- [ ] AC-A7: awareness / poller 两种 profile 可用
- [ ] AC-A8: 现有 TaskRunner 行为不回归，三套独立 setInterval 收敛为统一调度

### Phase 1b（Actor + Cat Wake）
- [ ] AC-B1: actor.role resolver 从 cat-config.json 匹配猫
- [ ] AC-B2: MCP dispatch + receipt tracking 端到端
- [ ] AC-B3: costTier hint 影响选猫策略

### Phase 2（Cron + UI + Context）
- [ ] AC-C1: cron/event trigger 可用
- [ ] AC-C2: Context dimension（session × materialization）可配置
- [ ] AC-C3: Hub panel 展示任务列表 + 运行状态
- [ ] AC-C4: 自然语言→TaskSpec 转换可用

### Phase 3（Governance + Pack）
- [ ] AC-D1: 电闸/备忘录分离权限模型
- [ ] AC-D2: anti-feedback-loop 防回声
- [ ] AC-D3: Pack 任务模板安装/卸载

## Dependencies

- **Evolved from**: F102（TaskRunner MVP + SummaryCompactionTask 是现有调度基座）
- **Related**: F122（统一调度队列 — invocation dispatch，不同关注面）
- **Related**: F048（Restart Recovery — 调度持久化需要的基础设施）
- **Related**: F129（Pack System — Phase 3 的生态集成目标）

## Risk

| 风险 | 缓解 |
|------|------|
| 过度抽象：8 个任务用六维度模型 overkill | Phase 1a 只实现核心 5 维度 + 2 profile，按需展开 |
| TaskRunner 迁移回归 | 红→绿 TDD，先有失败测试再改 |
| MCP dispatch 异步丢消息 | Phase 1b receipt tracking + run ledger 双重记录 |
| UI 配置复杂度 | 自然语言兜底，用户不需要理解 TaskSpec 细节 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | event trigger 是否复用现有 connector webhook 还是新建通道？ | ⬜ Phase 2 再定 |
| OQ-2 | Pack 任务模板的安全沙箱如何实现？ | ⬜ Phase 3 再定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 六维度 TaskSpec 模型（Trigger/Admission/Context/Run/State/Outcome + Actor + Governance） | 三猫调研 + GPT Pro 审阅 + 砚砚 review 收敛 | 2026-03-25 |
| KD-2 | typed signal gate 替代 boolean | 消除 F102 二次扫描 | 2026-03-25 |
| KD-3 | subjectKey 统一锚点 | 防主键分裂，砚砚 review P1 | 2026-03-25 |
| KD-4 | actor.role = 能力命名空间 | 砚砚 review open question 收敛 | 2026-03-25 |
| KD-5 | UI + 自然语言配置（非 markdown 编辑） | 铲屎官明确要求 | 2026-03-25 |
| KD-6 | 龙虾兼容但不照搬 | 事件驱动我们更好，只学主动自省语义 | 2026-03-25 |
| KD-7 | 调度面板 = Workspace 顶级 Tab（和"开发""知识"平齐） | 铲屎官确认，不是子 Tab；展示在 Workspace，配置在对话区自然语言；Tab 图标用 SVG 不用 emoji | 2026-03-25 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-25 | 三猫调研 OpenClaw heartbeat（宪宪 × 砚砚 × 金渐层） |
| 2026-03-25 | GPT Pro 外部咨询 → 六维度模型成型 |
| 2026-03-25 | ADR-022 起草 + 砚砚两轮 review + 图审通过 |
| 2026-03-25 | 立项 F139 |
| 2026-03-25 | 跨线程通知：三套 setInterval 技术债 + 社区需求（冲突/comments 检测）→ Phase 1a 紧迫 |

## Review Gate

- Phase A: 砚砚 review（跨 family 优先）
- Phase B: 砚砚 review + MCP dispatch 集成测试

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **ADR** | `docs/decisions/022-unified-schedule-abstraction.md` | 六维度模型 + 五步流水线 + 龙虾兼容 |
| **架构图** | `designs/F-schedule-abstraction.pen` | 高保真六维度架构图 |
| **调研** | `docs/research/2026-03-25-schedule-abstraction-gpt-pro-consult.md` | 三猫调研 + GPT Pro 咨询 + 综合 |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | TaskRunner MVP 来源 |
| **Feature** | `docs/features/F122-unified-dispatch-queue.md` | 相关：invocation dispatch |
