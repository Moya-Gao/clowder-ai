---
capsule_id: "F075-CLOSE-2026-03-12"
context: "F075 猫猫排行榜全 Phase (A+B+C) 完成，feat close"
feature_ids: [F075]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- Port→InMemory Store pattern（GameStore, AchievementStore）提供了清晰的扩展基座，新 store 从 interface 到测试只需 30 分钟
- 云端 review 抓出 auth-before-dedup 排序 bug（P1），这是本地 review 没发现的——多层 review 确实有价值
- GPT-5.4 愿景守护严格把关 spec 自洽性，逼出了 What/AC-B3/OQ-4 三处入口命名漂移——没有他就会带着矛盾 close
- TDD 红绿循环在 leaderboard-events 路由上特别有效：先写 dedup-poisoning regression test 再修 auth 顺序

## What Failed
- Phase A merge 后没做 Step 7.5 真相源同步，导致 BACKLOG/index/Phase line 全部滞后，GPT-5.4 愿景守护时一次性翻出 6 处漂移
- 入口命名从 "Mission Hub" 悄悄变成 "Cat Café Hub" 没有显式拍板，被 GPT-5.4 连续两轮打回
- 第一次对 P1-1 的 push back 只改了 Evidence 区没改 What/AC/OQ，导致 spec 自相矛盾，被 GPT-5.4 正确拒绝

## Trigger Missed
- merge-gate Step 7.5 在 Phase A merge 时完全漏做，Phase B+C merge 时才补上
- 入口决策变更应该在 Design Gate 阶段显式记录，而不是实现时默默改了代码落点
- 第一轮愿景守护 push back 时应该先做 spec 自查（What/AC/OQ 一致性），而不是只改证据区

## Doc Links
- `docs/features/F075-cat-leaderboard.md`
- `docs/plans/2026-03-11-f075-cat-leaderboard-phase-bc.md`
- `docs/reflections/2026-03-11-f075-phase-a-capsule.md`（Phase A 反思）
- PR #371（Phase A）、PR #377（Phase B+C）

## Rule Update Target
- `cat-cafe-skills/merge-gate/SKILL.md` Step 7.5：强调 **每次 Phase merge 必须同步**，不能攒到 feat close
- `cat-cafe-skills/feat-lifecycle/SKILL.md`：push back 愿景守护 P1 前，先自查 spec 全文一致性（What/AC/OQ/Evidence 四处对齐）
- `shared-rules.md`：入口/命名变更必须在 Key Decisions 显式记录，不能实现时悄悄换
