---
capsule_id: "F188-PhaseJ-2026-05-26"
context: "F188 Phase J Health Debt Governance：orphan edge repair + verification debt migration + cat-owned review workflow"
feature_ids: [F188]
doc_kind: capsule
created: 2026-05-26
---

## What Worked

- PR #1790 让 health badge 在 MemoryNav 主动浮现（Phase B proactive follow-up），铲屎官 dogfood 看到真实数字（201 orphanEdges / 724 unverified）后自然追问"怎么治" → Phase J 立项需求源自真实 dogfood，不是臆测
- Design Gate 经砚砚 4 轮 review（R1→R4），从最初的"修一下 orphan"收敛到三维分离（authority / verified_at / usage_signal）+ F200 边界 + canonical resolver，scope 紧贴真实问题不发散
- orphan edge 5-bucket classifier 用 dry-run 先跑再 apply 的模式，87% auto-fix（201→26），只有 true ghost 和 non-doc wikilink 进 review bucket，不盲删
- verification debt migration 三桶分类（trusted_legacy / needs_review / escalated）避免了盲降级 validated/constitutional 文档，CVO 不需要逐篇点击
- AC-J5 canonical resolver 在 edge 写入路径统一拦截，防止 F20/F2025 类脏边再次写入 — 是 prevention 不只是 cleanup

## What Failed

- OQ-5/6/7 在 Phase J Design Gate 已经解决但 checkbox 忘改 ⬜ → ✅，第三次漂着被 opus-47 愿景守护指出 — F188 的 OQ 更新纪律始终不到位，Phase G close 时 OQ-2 也有同样问题
- 愿景守护时把 F186 trigger quote（"图书馆 / recall 本 project 以外"）误列为 F188 commitment — 边界意识不够，应先核 discussion 文档的 feature_ids 再引用

## Trigger Missed

- OQ checkbox 更新应该在 Design Gate 通过后立刻做，不是等 close 时补 — 需要在 merge-gate Step 7.5 或 Design Gate 结论落盘时加一个 OQ 扫描步骤
- Phase B badge 的"看到数字 → 怎么治"链路应该在 Phase B 原始 scope 就预留治理入口的 stub（哪怕只是一个 disabled 按钮 + tooltip "治理能力开发中"），而不是等 reopen 才补

## Doc Links

- Feature spec: `docs/features/F188-library-stewardship.md`
- Phase J dogfood report: `docs/harness-feedback/2026-05-21-f188-phase-j-dogfood-report.md`
- Phase A-I 反思胶囊: `docs/reflections/2026-05-20-f188-library-stewardship-capsule.md`
- F200 boundary: KD-12 / KD-13 in F188 spec

## Rule Update Target

- `merge-gate` Step 7.5 或 feat-lifecycle Design Gate 结论落盘: 补提醒 "Design Gate 决定了某 OQ → 立刻更新 spec OQ checkbox，不留到 close"
- `feat-lifecycle` completion Step 0 证物对照表: 补提醒 "引用铲屎官原话前先核 discussion 文档的 feature_ids，确认 quote 属于本 feature 而不是前驱 feature"
