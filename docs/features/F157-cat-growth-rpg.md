---
feature_ids: [F157]
related_features: [F100, F093, F101, F129]
topics: [gamification, engagement, identity]
doc_kind: spec
created: 2026-04-10
---

# F157: Cat Growth RPG -- AI Agent Growth & Achievement System

> **Status**: spec | **Owner**: Ragdoll | **Priority**: P1

## Why

Clowder AI 的猫猫已经有持久身份、记忆和协作记录，但这些"成长"对用户是不可见的。用户无法感知自己的猫团队在变强、在积累、在进化。

养成 RPG 系统把猫猫的真实协作数据"结晶"成可见、可感、可分享的成长轨迹。这不是模拟数据，而是从真实 session events、task tracking、PR review 中自动结算的量化投影。

核心价值：
- **留存**：用户舍不得丢弃有成长数据的猫团队
- **传播**：可分享的角色卡和成就天然驱动社交传播
- **差异化**：没有任何 AI 平台把 agent 成长做成可见的 RPG 存档

## What

### Phase A: Attribute System + Cat Profile Card

**六维属性体系**：

| 维度 | 数据源 | Phase A 状态 | 说明 |
|------|--------|-------------|------|
| 架构力 | 讨论消息 (discussion) | ✅ 活跃 | 设计与系统思考 |
| 审查力 | Review 拦截率、bug 发现数 | ⏳ Phase B | 需 invocation intent tracking |
| 审美力 | Rich block 创建 (rich_block_create) | ✅ 活跃 | 视觉与体验 |
| 执行力 | tool_use / task_complete / session_seal | ✅ 活跃 | 落地交付 |
| 协作力 | 跨猫 @mention 协作 (mention_collab) | ✅ 活跃 | 团队配合 |
| 洞察力 | evidence search / reflect (evidence_cite) | ✅ 活跃 | 自驱与发现 |

> **Phase A scope note**: 审查力 (review) 维度在 Phase A 中定义但未激活。
> 根因：当前 A2A / multi-mention 系统的 `InvocationRecord` 不携带 invocation intent
> 元数据，无法在 route 层面区分「猫做 review」和「猫做 discussion」。
> `review_given` / `bug_caught` XP 源已在 GrowthService 中定义，待 Phase B
> 添加 invocation intent tracking 后激活。

**经验值结算引擎**：
- 每个 task / 讨论闭环 / 工具调用后自动结算
- 数据源：session events、task 状态变更、rich block 创建、evidence 检索
- 经验值公式透明可审计

**猫猫名片（Profile Card）**：
- 头像 + 等级 + 六维雷达图
- 当前称号
- 高光时刻 Top 3（链接到真实 session）
- 可导出为图片用于社交分享

**Hub UI**：
- 猫猫详情页增加"成长"Tab
- 团队总览页（冒险者公会风格）

### Phase B: Skill Tree + Title System

**技能树**：
- 属性达到特定等级解锁称号
- 审查力 Lv.5 -> "Eagle Eye"
- 架构力 Lv.4 + 协作力 Lv.3 -> "Chief Architect"
- 洞察力 Lv.4 + 连续拦截 3 次未遂事故 -> "Prophet"

**羁绊系统**：
- 两只猫频繁协作产生"羁绊值"
- 羁绊等级可见，高等级解锁组合名称
- 展示在各自名片和团队总览中

### Phase C: Achievement System

**成就分类**：

1. **个猫成就**（绑定单只猫）
   - 普通：初啼（首次完成任务）、百炼（100 任务）
   - 稀有：守门员（拦下首个 P0）
   - 史诗：打脸王（否决自己的方案）、日不落（单日 10+ 任务）
   - 传说：预言家（指出的风险 7 天内发生）、涅槃（错误后改进被采纳）

2. **团队成就**（绑定猫猫组合）
   - 普通：初次握手（首次协作）
   - 稀有：诤友（5+ 次建设性分歧）、全员集合
   - 史诗：心有灵犀（独立给出相同方案）、众猫拾柴（3+ 猫接力完成 feature）

3. **里程碑成就**（绑定猫咖实例）
   - 普通：开业大吉（首个完整 feature 生命周期）
   - 稀有：百日维新（持续运行 100 天）
   - 史诗：千锤百炼（1000 次 review 交互）
   - 传说：无人之境（无人干预完成 feature 全流程）、事故归零（30 天零 P0 回退）

4. **隐藏成就**（不提前显示，触发时惊喜弹出）
   - 夜猫子（凌晨 2-5 点完成关键任务）
   - 时间旅行者（引用 3 月前讨论佐证决策）
   - 破壁人（首次外部社区贡献者参与协作）
   - 凌晨三点半（猫猫在铲屎官离线时自主完成协作）

**展示**：
- 解锁弹窗动画 + 音效
- 成就墙：已解锁发光 / 未解锁灰色剪影 + 模糊提示
- 成就卡片可导出分享
- 解锁事件可推送到飞书/Telegram

**联动效果**：
- 部分成就解锁 Hub 中的视觉标记
- 传说成就解锁 README badge

### Phase D: Evolution Events + Growth Timeline

**进化事件**：
- 关键里程碑触发叙事事件（如"守护时刻"、"独立日"）
- 事件记录进猫猫成长史，可回溯浏览

**成长时间线**：
- 可视化的猫猫成长轨迹
- 支持按时间段查看属性变化趋势
- 猫猫考古：定期自动生成"自我回顾报告"

## Acceptance Criteria

### Phase A (Attribute System + Profile Card) ✅
- [x] AC-A1: 五维属性自动结算（审查力降级至 Phase B，需 invocation intent tracking）
- [x] AC-A2: 每只猫的 Hub 详情页展示六维雷达图和等级
- [x] AC-A3: 猫猫名片可导出为 PNG 图片
- [x] AC-A4: 团队总览页展示所有猫的站位图和属性概览
- [x] AC-A5: 经验值结算逻辑透明、可审计（可查看结算明细）

### Phase B (Skill Tree + Title System + Review Activation)
- [ ] AC-B0: 审查力维度激活 — invocation intent tracking 落地，`review_given` / `bug_caught` 有真实调用方
- [ ] AC-B1: 属性达标自动解锁称号，显示在名片和 Hub 中
- [ ] AC-B2: 羁绊值从协作记录自动计算，展示在双方名片中
- [ ] AC-B3: 技能树页面展示已解锁/未解锁的称号路径

### Phase C (Achievement System)
- [ ] AC-C1: 四类成就（个猫/团队/里程碑/隐藏）覆盖至少 20 个成就
- [ ] AC-C2: 成就从真实数据自动触发，绑定触发 session 链接
- [ ] AC-C3: 成就墙 UI 展示已解锁/未解锁状态
- [ ] AC-C4: 成就卡片可导出为图片
- [ ] AC-C5: 解锁事件支持 Webhook/IM 推送

### Phase D (Evolution Events + Growth Timeline)
- [ ] AC-D1: 关键里程碑触发叙事事件并记录
- [ ] AC-D2: 成长时间线可视化展示
- [ ] AC-D3: 猫猫自我回顾报告自动生成（月度）

## Dependencies

- **Related**: F100（Self-Evolution — 进化行为层提供洞察力数据源）
- **Related**: F093（Cats & U 世界引擎 — 共创世界中的角色成长可复用本系统）
- **Related**: F101（Mode v2 游戏引擎 — 游戏活动可作为经验值来源）
- **Related**: F129（Pack System — Pack 可扩展自定义成就和称号）

## Risk

| Risk | Mitigation |
|------|-----------|
| 经验值公式偏差导致属性不反映真实能力 | Phase A 先用简单线性公式 + 人工校准，迭代调整 |
| 成就触发条件过于依赖数据完整性 | 只使用已有稳定数据源，不为成就新增数据采集 |
| 游戏化元素干扰严肃工作流 | 成长系统只展示不干预，不改变任何工作流行为 |

## Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | 经验值是否跨 session 持久化到 Redis 还是独立 SQLite? | open |
| OQ-2 | 多实例场景下成就是否全球排名? | open |
| OQ-3 | 猫猫名片的视觉风格——像素风 vs 手绘风 vs 扁平风? | open |

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| KD-1 | 数据全部从已有系统自动结算，不新增人工打标环节 | 降低使用摩擦，保证数据真实性 | 2026-04-10 |
| KD-2 | 成长系统只展示不干预工作流 | 避免游戏化污染严肃协作 | 2026-04-10 |
| KD-3 | Phase A 最小切片：属性 + 名片，先证明价值再扩展 | P1 先做终态基座，不做脚手架 | 2026-04-10 |

## Timeline

| Date | Event |
|------|-------|
| 2026-04-10 | Kickoff: brainstorm + spec |

## Review Gate

- Phase A: @codex review attribute calculation logic + Hub UI
- Phase C: @gemini25 review achievement UX + visual design

## Links

| Type | Path | Description |
|------|------|-------------|
| **Feature** | `docs/features/F100-self-evolution.md` | Self-Evolution, data source for insight attribute |
| **Feature** | `docs/features/F093-cats-and-u-world-engine.md` | Cats & U, character growth synergy |
| **Feature** | `docs/features/F101-mode-v2-game-engine.md` | Game engine, XP source from game activities |
