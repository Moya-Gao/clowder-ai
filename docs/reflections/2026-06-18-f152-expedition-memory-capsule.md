---
capsule_id: "F152-2026-06-18"
context: "F152 close-gate rerun after missed completion paperwork"
feature_ids: [F152]
doc_kind: capsule
created: 2026-06-18
---

## What Worked

- F152 的主功能链和 hotfix/bridge 链在 64 天后仍能被当前代码和定向测试重新验证，不是靠 spec 自说自话撑着。
- `getKindCoverage` / `isSameRepo` regression guard 和 `bootstrap-collection-bridge` 测试很值钱，它们把“看起来有摘要”与“文档真的进入 evidence store”区分开了。
- 把 close 证物拆成 `README` proof + `CloseGateReport` + capsule 三件套后，feature 现在的真实状态一眼可读：代码完成、流程补齐、唯一 blocker 明确。

## What Failed

- 2026-04-15 的愿景守护只把“不能 close”的结论写进了 spec，没有继续落 `CloseGateReport`、`User Visibility Disclosure`、反思胶囊，导致 feature 长期停在“close 前夜”却没有结构化 blocker 证物。
- F152 的 done/not-done 判断在文档层过度依赖 spec 顶部状态行，缺少 completion artifacts 时，很容易让后来的人以为“只是忘了改一行 status”。
- AC-C5 这种产品级终验如果不被明确追踪，会让“代码全做完了”和“feature 已 close”被混成一回事。

## Trigger Missed

- `feat-lifecycle` completion 在 guardian 判定 “暂不能 close” 时，也应该把 close-gate 三件套落下，不应该只更新 spec 状态说明。
- 对需要铲屎官手动终验的 feature，should-have-done 的不是再写一段“blocked by AC-C5”，而是同步写出“谁来验、缺什么证据、现在为什么还不能移出 BACKLOG”。

## Doc Links

- `docs/features/F152-expedition-memory.md`
- `docs/discussions/2026-06-18-f152-close-gate/README.md`
- `docs/discussions/2026-06-18-f152-close-gate/close-gate-report.md`
- `docs/research/2026-04-09-ideahub-test-automation-knowledge-consultation.md`
- `docs/discussions/2026-04-08-f152-design-gate/README.md`

## Rule Update Target

- `cat-cafe-skills/feat-lifecycle/SKILL.md` Completion section: when guardian verdict is “不能 close yet”, still require `User Visibility Disclosure` + `CloseGateReport` + reflection capsule to land, so blocked features do not linger as undocumented almost-done states.
