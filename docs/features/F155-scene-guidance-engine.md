---
feature_ids: [F155]
related_features: [F087, F110]
topics: [guidance, onboarding, ux, interactive]
doc_kind: spec
created: 2026-04-09
community_issue: "clowder-ai#409"
community_pr: "clowder-ai#398"
---

# F155: Scene-Based Guidance Engine — 场景式交互引导

> **Status**: needs-discussion | **Source**: Community (mindfn) | **Priority**: TBD

## Why

用户使用复杂功能（如添加成员、配置 Provider）时缺乏上下文引导。F087/F110 的训练营解决了"首次入门"，但用户在日常操作中遇到具体功能时仍然需要分步交互引导。

社区贡献者 mindfn 在 clowder-ai#409 提出并实现了完整的 Phase A 方案。

## What（社区方案概要）

### Phase A（clowder-ai#398 已实现）

1. **YAML 驱动的引导流程定义** — `guides/flows/*.yaml` + `guides/registry.yaml`
2. **引导状态机** — `offered → awaiting_choice → active → completed/cancelled`（前向 DAG）
3. **前端 Overlay** — mask + spotlight + HUD（tips + progress dots + exit button）
4. **Auto-advance 引擎** — 4 种推进模式：`click` / `visible` / `input` / `confirm`
5. **后端回调路由** — guide-action routes + completion ack + one-shot consumption
6. **路由集成** — `guideOfferOwner` / `guideCompletionOwner` 注入 parallel/serial routing
7. **SystemPromptBuilder 注入** — 引导上下文写入猫猫系统提示
8. **MCP 回调工具** — 让猫猫触发引导
9. **Esc Guard** — 引导期间阻止误关 Hub
10. **Guide Authoring Skill** — 编写新引导流程的 SOP

### Phase B（社区规划，未实现）

- 更多平台内场景（Provider 配置、Hub 设置等）
- Guide Catalog UI
- 进度持久化

## Key Decisions（社区侧）

| ID | Decision |
|----|----------|
| KD-9 | v2 auto-advance: 用户操作即推进，无 next/prev/skip 按钮 |
| KD-13 | Phase B 聚焦平台内引导，外部平台配置改独立页签 |
| KD-14 | 引导期间禁用 Esc 退出，仅保留 HUD 退出按钮 |
| KD-15 | Observe substrate 拆分为独立 feature，不入 F155 Phase B |

## Intake 评估（待完成）

### 主人翁五问初判

| Q | 问题 | 判定 |
|---|------|------|
| Q1 | 方向与愿景一致？ | PASS — 提升复杂功能可用性 |
| Q2 | 与现有 Feature 冲突/重叠？ | 不冲突 — F087/F110 是入门训练营，F155 是操作级上下文引导 |
| Q3 | 技术栈 fit？ | PASS — TS/React/MCP/Socket 全栈 |
| Q4 | 维护能力？ | PASS — 社区持续迭代 13 天，72 commits，多轮 review |
| Q5 | 技术负债？ | **HIGH** — 深度修改 routing core（route-parallel/serial/invoke-single-cat/SystemPromptBuilder），非隔离模块 |

### 待讨论

- [ ] 路由层改动是否接受？是否需要重构为更松耦合的注入方式？
- [ ] 社区自建的 `guide-authoring` / `guide-interaction` skill 与我们的 skill 体系如何对齐？
- [ ] `guides/` 顶层目录是否符合我们的目录结构？
- [ ] 上游 issue clowder-ai#409 需先过 triage 门禁（补 `triaged` 标签）
- [ ] 上游 PR 中 `docs/ROADMAP.md` 存在未解决的 `<<<<<<< HEAD` 冲突标记

## Upstream Links

- Issue: [clowder-ai#409](https://github.com/zts212653/clowder-ai/issues/409)
- PR: [clowder-ai#398](https://github.com/zts212653/clowder-ai/pull/398)
