---
capsule_id: "F087-2026-03-12"
context: "F087 CVO Bootcamp — 游戏化新手 onboarding 全流程实现"
feature_ids: [F087]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- Phase 分拆（A-E）节奏好：每个 phase 聚焦一件事，codex 3 轮 review 密度高但每轮修改量可控
- Forward-only 状态机设计在 codex R1 就被 P1 逼出来了——reviewer 驱动架构比自己想更快到位
- `app.inject()` 走 F075 events pipeline 统一契约，避免了 achievementStore 直调的耦合
- AC-A12 线程发现用 `GET /api/bootcamp/thread` + `list()` filter，最简方案够用

## What Failed
- Phase D 第一版直接调 `achievementStore.unlock()`，绕过了 F075 event 契约，被 codex P2 打回——应该一开始就查 F075 spec 的接入方式
- `bootcamp-first-rejection` 成就定义了但无触发路径，死代码被 codex P1 抓到——定义成就前应该先确认触发事件是否已存在
- Phase E 写完忘记同步 `bootcamp-guide` skill 里的 F075 TODO 注释（GPT-5.4 愿景守护抓到）
- F087 spec 标了 `done` 但 BACKLOG 没同步、反思胶囊没写——completion gate 流程不够肌肉记忆

## Trigger Missed
- feat-lifecycle completion checklist 应该在标 `done` 时自动触发，但我标完 Phase E 就直接说"done"了，没走 Step 0-6
- 愿景守护应该我主动 @ 其他猫，而不是等铲屎官指派——CLAUDE.md 明确写了"feat close 前主动 @ 其他猫做愿景守护"

## Doc Links
- [F087 spec](../features/F087-cvo-bootcamp.md)
- [F075 leaderboard spec](../features/F075-cat-leaderboard.md)
- [bootcamp-guide skill](../../cat-cafe-skills/bootcamp-guide/SKILL.md)
- [feat-lifecycle completion](../../cat-cafe-skills/feat-lifecycle/SKILL.md)

## Rule Update Target
- `MEMORY.md`: 补"标 done 前必须走完 feat-lifecycle Step 0-6，不要提前改 Status"
- `cat-cafe-skills/feat-lifecycle/SKILL.md`: 考虑在 Step 2 加一个检查"是否已写反思胶囊"的 guard
