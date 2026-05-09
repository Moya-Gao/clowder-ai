---
capsule_id: "F193-COMPLETE-2026-05-09"
context: "F193 Cross-Thread Communication Unification 4-Phase 完整闭环"
feature_ids: [F193]
doc_kind: capsule
created: 2026-05-09
---

# F193 Reflection Capsule

## What Worked

- **Phase 拆分粒度合理**：A（发送侧）/B（接收侧）/C（配置层）/D（清理）四个 Phase 各自正交，每个 Phase 独立 PR + review，不同 Phase 之间无 merge conflict。
- **三猫 Audit 立项**（46 + 47 + 砚砚 2026-05-07）：根因分析比单猫看症状有效。砚砚识别出"配置双重注册"才是 #3 根因；铲屎官第二轮纠正"接收侧 reply hint" 是 #4 根因。把 4 个根因写进 spec，对应 4 个 Phase。
- **`healCatCafeMcpTopology` 抽象**（Phase C 砚砚 R7 P1）：5 call sites（GET / PATCH / install / delete / orchestrate）共享同一条 migration chain，避免每个 call site 都变成 edge case 放大器。云端 9 轮 review 把 migration logic 推到接近最优，但前提是有这个抽象。
- **typed `crossThreadReplyHint` 字段 + structured hydrate**（Phase B AC-B2）：明确禁止从 prompt 文本解析，强制按 `StoredMessage.extra.crossPost.sourceThreadId + StoredMessage.catId` 直接 hydrate。砚砚 round 2 P1 抓到的"fake test 反模式"是这条规则在测试侧的反面验证。
- **Two-track migration**（Phase C AC-C2/C3）：`generateCliConfigs` 自动重写 `.mcp.json/.codex/config.toml`（primary）+ 手工 diff（fallback），避免逼用户手动迁移又能在 Hub 不可用时给兜底。砚砚 R2 P2 修正我误述"orchestrator 不重写"的位置。

## What Failed

- **Phase B regression: hydrateCrossThreadReplyHint 调用 store.getById 但 mock messageStore 缺 getById**（Phase D gate 撞到，landy 在 `2fad783b6` 帮修了）。教训：引入新 store API 时，所有 mock factory 都要同步覆盖。
- **Phase C 测试 fixture 遗漏**：`codex-agent-service.test.js` 的 mcp dist stubs 在 Phase C 没同步更新（landy 在 `8023851b7` 修了）。教训：spec 要列"间接依赖测试 fixture" — 不只是源码改动 surface。
- **Phase C cloud review 9 轮**：每轮 1-2 个 P1/P2，每次都是真实 edge case（external ID collision / partial split set / hasLimb source filter / write-path heal seam），但说明 migration 函数复杂度爆发。如果设计阶段就抽 helper（不到 R7 才抽），可能 3-4 轮就收敛。
- **Phase D gate web prerender 撞 pre-existing flake**：useContext null at static page generation, origin/main 也复现。本应在更早阶段（Phase A?）就发现并 bug-report，而不是 Phase D 才撞上。
- **Phase D F193 spec 文档 Status 字段没及时翻**：Phase D pending PR 时还是 in-progress；merge 后才 sync。Step 7.5 应该把 Status 行也纳入。

## Trigger Missed

- **元思考触发器 E（新领域侦查）部分缺失**：Phase D AC-D3 写"删 user-local probe-* 配置" 时没第一时间想到这是 user-action 不是 PR 改动；后来对比 Phase C migration doc 模式才意识到，浪费了一次 plan iteration。
- **元审美自检（meta-aesthetics）— Phase C migration logic**：每轮 cloud review 都在加 source filter / collision guard / inheritance precedence，没在 R3-R4 就停下来问"这是坐标变换还是堆补丁"。R7 抽 helper 是迟到的坐标变换。
- **Reviewer Continuity Guard**：Phase C HEAD 从 `deaf9c189` 一路 push 到 `e1b6bbb31`（6 commits 行为性 delta），中间没主动 ping 砚砚做"延续覆盖"声明。最后他自己接了透明窗口 review。如果作者主动通知会更标准。

## Doc Links

- F193 spec: `docs/features/F193-cross-thread-comm-unification.md`
- F193 plan files: `docs/plans/2026-05-08-F193-phase-C.md`, `docs/plans/2026-05-08-F193-phase-D.md`
- Phase C migration guide: `docs/F193-phase-C-migration.md`
- Bug reports（pre-existing flakes 不阻塞 phase PR）：
  - `docs/bug-report/2026-05-08-gate-api-mcp-probe-flaky/`
  - `docs/bug-report/2026-05-09-gate-web-prerender-useContext-null/`
- Related ADR-style decisions：KD-1（principal-conditioned threadId）+ KD-2（限位 limb harness placement 选 A）写在 F193 spec Key Decisions 段
- Related features：F043（split-only origin）、F052（cross-thread identity isolation）、F178（agent-key auth）

## Rule Update Target

- **`cat-cafe-skills/refs/feature-doc-template.md`**：补一节"测试 fixture 同步清单" — 改 source registry 时必须 grep 所有 mock factory + test fixture（避免 Phase C → Phase D 的 codex-agent-service.test.js drift）
- **`cat-cafe-skills/feat-lifecycle/SKILL.md` Step 7.5**：明确 Status 行要在 last Phase merge 时同步翻成 `completed`（不是 close 时再翻）
- **`cat-cafe-skills/merge-gate/SKILL.md` Reviewer Continuity Guard**：补一条"作者主动责任" — 行为性 delta 多 commit 时主动 ping reviewer 请求延续 review，不要让 reviewer 自己发现要重审
- **新建 LL: gate-context-flake**：`pnpm gate` 在某些 worktree context 下 web prerender 会出 useContext null 但直接 build 通过 — 待定位根因后回写到 LL-061 或类似编号
