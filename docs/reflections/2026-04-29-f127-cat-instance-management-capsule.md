---
capsule_id: "F127-completion-2026-04-29"
context: "F127 猫猫管理重构完成反思（账户配置与猫猫实例分离、动态猫、别名路由、账号污染治理）"
feature_ids: [F127]
doc_kind: capsule
created: 2026-04-29
---

# F127 猫猫管理重构 — 完成反思胶囊

## What Worked

- **两层分离方向正确**：账户配置和猫猫实例拆开后，API key / OAuth / custom endpoint 能共用一套账号层，猫猫身份、别名、角色和模型绑定独立演进。
- **catalog overlay 保住兼容性**：`cat-config.json` 继续作为 seed/base，runtime catalog 只做 overlay，既支持动态 CRUD，又不破坏预设猫和历史静态配置。
- **愿景守护最后补上真实缺口**：close 前没有只看 checkbox，而是追到 AC-C2 默认模型别名、AC-B3 V-1/V-2 E2E 和 runtime account pollution，避免把“看起来 done”的 feature 强行 close。
- **云端 + 本地双 review 有价值**：#1457 和 #1464 都经历了云端 Codex / 本地猫交叉审查，捕捉到 homedir legacy import、catalog account keys、resume roster stale 等边界。

## What Failed

- **Feature 拉得太长**：F127 从 2026-03-17 到 2026-04-29 才 close，中间多次 residual 修复说明 Phase 结束时的 close gate 没有足够硬。
- **AC-B3 曾被错误归因**：早期把动态猫路由问题怀疑到 parser fallback，后来才确认 resume system prompt reinjection 才是关键边界。
- **completion 文档差点漏收尾**：PR #1464 已经把 spec 标 done、BACKLOG 移除，但 `docs/features/README.md` completed table 和反思胶囊在 merge 后才补。
- **PR tracking 凭据缺失暴露流程脆弱点**：#1464 创建后 `cat_cafe_register_pr_tracking` 因 callback credentials 缺失失败，只能改手动检查 review/comment/checks。

## Trigger Missed

- **Close gate 应在最后一个功能 PR 前显式列 V-matrix**：V-1/V-2 这种跨 session 行为不该等愿景守护时才发现证据缺口。
- **Migration allowlist 应优先从“真引用源”建模**：账号污染修复最终证明 allowlist 比 blocklist 稳，且引用源必须覆盖 `accountRef`、legacy `providerProfileId`、catalog `accounts` keys、credential refs。
- **Completion checklist 要在 merge-gate 后立即执行**：合入不等于 feature close；反思胶囊、completed index、CloseGateReport 需要作为同一闭环处理。

## Doc Links

- F127 spec: `docs/features/F127-cat-instance-management.md`
- Runtime account pollution fix: `https://github.com/zts212653/cat-cafe/pull/1457`
- Close gate fix: `https://github.com/zts212653/cat-cafe/pull/1464`
- Evolved from: `docs/features/F062-ragdoll-provider-profile-hub.md`
- Related architecture: `docs/features/F032-agent-plugin-architecture.md`
- Related onboarding contract: `docs/features/F050-a2a-external-agent-onboarding.md`

## Rule Update Target

- **`merge-gate` Step 7.5**：补充“若 PR 是 feature close gate，merge 后必须立刻回到 `feat-lifecycle completion`，核对 completed table + reflection capsule”。
- **`feat-lifecycle` Completion Step 1**：CloseGateReport 应明确要求包含 V-matrix / E2E 场景，而不只是 AC checkbox。
- **`receive-review` VERIFY**：迁移/导入类 review 应默认要求“引用源枚举表”，避免 blocklist 式补洞。

## Final Status

- F127 status: done
- Required close gate: AC-C2 + AC-B3 V-1/V-2 ✅
- Runtime account pollution residual: R-12 ✅
- Non-blocking residuals: R-4/R-5/R-7~R-10 retained as future UX / ops improvements, not F127 MVP blockers
