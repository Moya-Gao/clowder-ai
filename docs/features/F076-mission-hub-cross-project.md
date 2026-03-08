---
feature_ids: [F076]
related_features: [F049, F058, F070]
topics: [mission-hub, cross-project, dispatch, reflux, command-center, client-governance]
doc_kind: spec
created: 2026-03-07
---

# F076: Mission Hub 跨项目作战面板 + 甲方项目治理引擎

> Status: discussing | Owner: 布偶猫 | Evolved from: F049(Mission Control MVP) + F058(Mission Hub 增强) + F070(Portable Governance)

## Why

### 核心痛点（铲屎官采访 2026-03-07）

猫猫团队不只做 cat-cafe 自己的项目，还会被派遣到外部甲方项目（如 studio-flow）。
这类项目的管理痛点与自研项目截然不同：

1. **甲方不知道自己要什么** — 给的 PRD 往往是让 AI 写的"许愿清单"，看似完整实则空洞（缺 AC、缺边界、缺优先级）
2. **需求膨胀** — 甲方把"企业管理系统"所有模块一股脑塞进来（登录、工作台、客户、审核、团队、统计...），每个"一点"的工作量天差地别
3. **没有完成确信** — 自研项目 AC 自己定，心里有数；甲方项目的 AC 在甲方脑子里，你写的可能和他想的不一样
4. **救火员困境** — "当猫猫救火员的时候如何才能高质量完成任务？"

### 铲屎官原话

> "甲方根本就不知道自己想要啥...他给了一个他的 claude 写的需求 prd...一个不懂编程的人带着大猫猫传来一份不知道如何形容的 prd"
>
> "和自己的项目那种全盘掌控的感觉完全不一样！现在就感觉乱七八糟的"

## What

### 产品定位

**甲方项目治理引擎** — 不只是看板，是"需求翻译 + 渐进交付"双引擎 + Mission Hub 可视化面板。

### 两大能力

**能力 1: 需求翻译官（Need Audit Pipeline）** — 多猫讨论收敛 2026-03-07

核心洞察（gpt52）：**第一步不是拆 feat，而是先降级。** 把 PRD 从"看起来完整的需求文档"降级为"待验证的意图包"。

关键升级（GPT Pro 外部咨询）：**"写得清楚" ≠ "是真的"。** certainty 必须拆成 clarity + groundedness，加 Source tag 硬门禁（AI 推断的不能直接进 Build Now）。

**Need Audit Pipeline v2**（6 阶段，含 GPT Pro 四刀升级）：

| 阶段 | 做什么 | 输出 |
|------|--------|------|
| 0. Frame | 谁拍板/为什么现在做/成败看什么/时间预算/现有流程/每条说法来源 | Sponsor Map + Goal Statement |
| 1. Downgrade + Intent Extraction | PRD → claim backlog（不叫 feature backlog）。6 槽 Intent Card + Source tag（Q/O/D/R/A）+ 粒度门禁 | Translation Matrix |
| 1.5 Domain Pass | 术语表 / 核心对象 / 状态机 / 数据源 / 边界 | Domain Model |
| 2. Validity Triage | 五维评分（clarity/groundedness/necessity/coupling/size-band）→ 5 类 | 分类标注 |
| 3. Resolution Design | 约束式确认题 / 证据请求 / 样本请求 / 低保真原型 / sponsor 升级 | Clarification Queue |
| 4. Slice Planning | Learning Slice（校正理解）/ Value Slice（业务闭环）/ Hardening Slice（加固） | Slice Ladder |

Triage 5 类：**Build Now** / **Clarify First** / **Validate First**（AI 推断、看似清楚但未锚定） / **Challenge** / **Later**

Source tag 硬门禁：Q=客户口述 / O=现场观察 / D=现有文档 / R=法规合同 / **A=AI 推断（不能进 Build Now）**

Intent Card 槽位（v2）：actor / context-trigger / goal / object-state / success_signal / non_goal + metadata(source_tag, decision_owner, confidence, dependency_tags)

8 类风险检测信号：动词空心 / 角色缺失 / 数据源不明 / 成功信号缺失 / 边界缺失 / 依赖隐藏 / AI 假具体 / 范围膨胀

详见：
- 多猫讨论：`docs/discussions/2026-03-07-f076-need-audit-methodology/meeting-notes.md`
- GPT Pro 咨询：`docs/discussions/2026-03-07-f076-need-audit-methodology/gpt-pro-consultation.md`

**能力 2: 渐进式交付引导（Incremental Delivery）**
- 大愿景 → 最小可验证切片（纵切业务链，不横切模块）
- 每个切片有明确 AC
- 做完给甲方看 → 甲方在实物前才知道自己真正要什么
- 反馈 → 调整 → 下一个切片

### Mission Hub 面板（三区块）

| 区块 | 功能 | 优先级 |
|------|------|--------|
| A: 治理+交付健康度 | triage 进度、Build Now 就绪数、open questions、slice 完成度、测试 | 需要 |
| B: 甲方需求追踪矩阵 | 甲方每一点 → 对应 feat → 当前状态 | 需要 |
| D: 风险预警 | 需求模糊/不合理/隐性依赖/工期不匹配 | 非常重要 |

**不做的**:
- C（猫猫派遣状态）：大概率都是布偶猫，不需要独立面板
- E（项目数据回流）：项目信息不进家门。只回流**知识工程经验**（方法论沉淀），不回流项目数据。"家不是工作的地方"

### 案例参考：studio-flow

`/Users/lysander/projects/freelance/studio-flow` — 典型甲方项目：
- 27+ features（SF-001 ~ SF-027），企业管理系统全模块
- 甲方9点验收基线 → BACKLOG feature 映射
- SF-025 Gap Fix Batch：6 个模块塞一个 feat（登录、工作台、客户、审核、团队、数据）
- 251 tests，Sprint 0/0.5/1/B 分层
- 已部署 cat-cafe governance（CLAUDE.md, AGENTS.md）
- **观察到的问题**：SF-025 是巨兽 feat、甲方"一点"粒度差异大、缺乏需求合理性挑战

## Dependencies

| 依赖 | 关系 |
|------|------|
| F049 Mission Control MVP | Evolved from — 单项目任务调度基座 |
| F058 Mission Hub 增强 | Evolved from — Feature-centric 两 Tab 架构 |
| F070 Portable Governance | Related — 治理数据 + dispatch 路径 |
| F070 Phase 3 (reflux) | Blocked by F076 — reflux 设计依赖本 feat 确定的面板和回流边界 |

## Architecture

**Definitive architecture**: `docs/plans/2026-03-07-f076-need-audit-architecture.md`

Five-layer architecture: Ingestion → Audit Workbench → Planning Bridge → Mission Hub View → Pattern Reflux

## Acceptance Criteria

- [ ] AC-1: Need Audit Pipeline — Stage 0~3 全流程可执行，输出 Intent Cards + Triage 结果
- [ ] AC-2: Translation Matrix — 甲方原文 → Intent Card → Source tag → Triage 状态实时展示
- [ ] AC-3: Risk Detection — 8 类信号自动/半自动检测 + 风险预警面板
- [ ] AC-4: Governance + Delivery Health — triage 进度/Build Now 数量/open questions/slice 完成度/测试
- [ ] AC-5: Pattern Reflux — 方法论经验沉淀（不含项目数据）。接口对齐 F070 Phase 3
- [ ] AC-6: Slice Planning — Learning/Value/Hardening 三类切片 + 纵切业务链

## Open Questions

1. ~~铲屎官想在 Mission Hub 看到什么？~~ → 已回答（A+B+D）
2. ~~"跨项目"的粒度？~~ → 项目级总览 + 甲方需求点级追踪
3. ~~回流数据的展示形式？~~ → 只回流知识工程经验，不回流项目数据
4. ~~Need Audit 的具体方法论？~~ → 已完成多猫讨论，四阶段管线 + 8 类风险信号
5. ~~风险预警的触发规则如何设计？~~ → 8 类检测信号已定义
6. 与现有 Governance Tab 的整合方式？

## Links

- Mission Hub: [F049](F049-mission-control-backlog-center.md), [F058](F058-mission-control-enhancements.md)
- Governance: [F070](F070-portable-governance.md)
- 案例项目: `/Users/lysander/projects/freelance/studio-flow`

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-07 | Kickoff + 采访铲屎官（5 轮 Q&A）|
| 2026-03-07 | 采访结论写入 spec + UX wireframe + 多猫讨论 |
| 2026-03-07 | Need Audit 方法论多猫讨论收敛（Opus + GPT-5.2）|
| 2026-03-07 | GPT Pro 外部咨询 → Pipeline v1 升级为 v2（+Stage 0/Domain Pass/clarity+groundedness/Resolution Design）|
| 2026-03-07 | 最终架构设计定稿（Opus + GPT-5.2 + GPT Pro 综合）— 5 层架构 + 对象模型 + 状态机 + 决策权矩阵 |
