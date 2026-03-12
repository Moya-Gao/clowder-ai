---
feature_ids: [F099]
related_features: [F042, F089]
topics: [ux, navigation, information-architecture]
doc_kind: spec
created: 2026-03-11
---

# F099: Hub & 顶栏导航可扩展性重构

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

Hub 水平页签已有 13 个（猫猫总览→排行榜），溢出屏幕；顶栏图标 6+ 个也快满。
铲屎官原话："随着功能越来越多，页签会越来越多…不太合适。"

根因不是"页签太多"，而是用一维扁平导航承载多维异质功能，缺少分层规则。
F042 在知识架构里已证明扁平全量注入会失控——前端 UI 正在重演同一错误。

## What

### Phase A: Hub Bento Box + 顶栏精简

**Hub 首页改造**：从 13 个平铺页签 → Bento Box 网格首页 + 分组二级导航

三组分类（按用户心智模型）：

| 分组 | 页签 | 用户意图 |
|------|------|---------|
| 🐾 猫猫与协作 | 猫猫总览、能力中心、猫粮看板、排行榜 | "我要看猫" |
| ⚙️ 系统配置 | 系统配置、环境&文件、账号配置、语音设置、通知、Session 策略 | "我要改设置" |
| 📊 监控与治理 | 治理看板、健康、命令速查 | "我要查状况" |

**顶栏精简**：保留 ≤4 个高频全局动作，其余收纳或转移

**硬规则**：
- Header 常驻交互位 ≤ 4
- Hub 第一层分组 ≤ 4
- 新功能默认落 Layer 2（组内叶子），需审批才能升 Layer 0/1

### Phase B: 重页面毕业（长期）

治理看板、排行榜等重页面逐步毕业成独立路由（如 `/governance`、`/leaderboard`），
Hub 回归"控制中心 + 轻量配置"。复用 F042 三层原则：
- Layer 0 常驻（顶栏）
- Layer 1 按需展开（Hub Bento）
- Layer 2 独立承载（毕业页面）

## Acceptance Criteria

### Phase A（Bento Box + 顶栏精简）
- [ ] AC-A1: Hub 首页为 Bento Box 网格，3 个分组卡片入口
- [ ] AC-A2: 点击分组卡片进入组内页签列表，每组 ≤6 项
- [ ] AC-A3: 顶栏图标 ≤4 个，其余有替代入口
- [ ] AC-A4: 现有所有功能仍可达（无功能丢失）
- [ ] AC-A5: 铲屎官确认视觉方案（Design Gate）

### Phase B（重页面毕业）
- [ ] AC-B1: 至少 1 个重页面（治理/排行榜）毕业为独立路由
- [ ] AC-B2: Hub 内保留该页面的快捷入口（索引卡片）

## Dependencies

- **Evolved from**: F042（三层信息架构原则贯彻到前端）
- **Related**: F089（Hub Terminal — 未来可能新增的 Hub 页签，验证扩展性）

## Risk

| 风险 | 缓解 |
|------|------|
| 分组不符合用户心智 | Design Gate 让铲屎官确认 + 可调整 |
| 改动量大影响稳定性 | Phase A 先改导航结构，不动页签内容组件 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 三组还是四组？（砚砚建议四组：总览/运行时/工具/设置） | ⬜ 待铲屎官拍板 |
| OQ-2 | 顶栏保留哪 3-4 个图标？ | ⬜ 待确认 |
| OQ-3 | Phase B 哪些页面优先毕业？ | ⬜ 待确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 采用 Bento Box 网格而非侧边栏 | 暹罗猫提出：温馨调性 > B 端企业味；2D 空间利用率高 | 2026-03-11 |
| KD-2 | 复用 F042 三层导航原则 | 缅因猫 GPT-5.4 提出：前端 IA 和知识架构是同一个病 | 2026-03-11 |
| KD-3 | 新功能默认 Layer 2，需审批升级 | 缅因猫提出硬规则防止再次膨胀 | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 三猫讨论 + 立项 |

## Review Gate

- Phase A: 跨 family review（缅因猫）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-03-11-f099-nav-scalability/README.md` | 三猫讨论纪要 |
| **Feature** | `docs/features/F042-prompt-engineering-audit.md` | 三层架构原始决策 |
