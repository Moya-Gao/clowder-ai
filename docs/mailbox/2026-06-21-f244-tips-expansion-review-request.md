# Review Request: F244 Tips Expansion — Feature Discovery for Community Users

Review-Target-ID: f244
Branch: feat/f244-tips-expansion

## What

Expanded capability tips from 13 to 45 entries, flipping perspective from cat-internal to user-facing feature discovery. All `audience: ["all"]` tips use trigger-action format ("when you encounter X, do Y").

Changes:
- **+9 magic word tips** (CVO-only): teach each magic word's trigger and effect
- **+12 capability tips**: eval verdicts, expert panel, image generation, etc.
- **+5 workflow tips**: review process, worktree isolation, memory recall, etc.
- **+4 existing feature tips**: thread management, task tracking, rich blocks, workspace nav
- **+7 new feature tips**: convention graph, context management, pencil design, etc.
- **+5 basics tips**: memory system, at-routing, thread purpose, failure recovery
- **-2 game tips removed**: pixel-cat-brawl + chinese-chess (CVO directive: not useful for feature discovery)
- **Quality pass**: 9 descriptive tips rewritten to trigger-action format, 2 duplicates removed, 2 failure recovery tips added

Files changed: `capability-tips.seed.json` (285 insertions, 40 deletions) + 1 test update.

## Why

CVO directive: tips should teach users how the system works, not just display cute cat phrases. The existing 13 tips were mostly written from cat perspective (internal tooling focus). CVO wants tips as a **feature discovery system** for community users who don't know what Cat Cafe can do.

Three-cat consensus (opus47 + codex + opus): quality pass over quantity, every tip must be trigger-action format, strengthen 4 categories (memory, routing, thread management, failure recovery), don't open Phase C contribution gate yet (wait for telemetry data).

## Original Requirements

> "我们想要的不止是猫言语" — CVO
> "比如有什么 magic words 什么时候可以用 / 家里有什么功能" — CVO
> "猫言语只是最后一层皮，真正的价值是把'家里怎么运转'变成用户在自然等待中持续学会的东西" — CVO
> CVO also directed: many tips written for cats not humans, flip perspective; teach basic features; remove game tips

- 来源: `docs/features/F244-capability-tips-system.md` (Why section) + current thread discussion
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Did NOT add `open_guide` action type tips in CapabilityTipStrip: `canRenderInTipStrip` only renders `open_concierge_draft`. F155 guides are a separate onboarding system. Tips = one-sentence discovery (trigger-action + concierge deep link). This is an intentional boundary, not a gap.
- Did NOT open Phase C contribution gate (auto-prompt for tips on feature PRs). Three-cat consensus: wait for telemetry data on per-tip CTR/dismiss before mandating contributions.
- Did NOT add persistent telemetry sink. Current telemetry is in-memory event bus (100 records). Per-tip rollup needs Redis/OTel/F192 consumer — that's F244 next phase, not this PR.

## Architecture Ownership

Architecture cell: hub-action-surface
Map delta: none
Why: Only expanding tip inventory within existing CapabilityTip contract. No new Store/Queue/Router/Adapter/Dispatcher/Binding. Schema, selector, and renderer unchanged.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. **Trigger-action quality**: Every `audience: ["all"]` tip uses "当你遇到 X，就做 Y" format. Please audit whether any tips are still descriptive ("Cat Cafe supports X") rather than actionable.
2. **open_guide action gap confirmation**: `CapabilityTipStrip` only renders `open_concierge_draft` action (line 26-28). Tips with other action types exist in seed but won't render in the strip. Is this boundary correct per F155 separation? (opus47 consensus: yes, but want reviewer confirmation)
3. **sourceRef anchor validity**: All 45 tips have sourceRef with path + anchor. `check-capability-tips.mjs` validates path exists AND anchor appears in file content. All pass. But reviewer should spot-check 2-3 anchors to confirm semantic match (not just string presence).

### 价值 OQ（给 CVO，如有）
无 — CVO 已在本 thread 给出明确方向，本 PR 是执行层面的 tips 扩充，不涉及价值取舍。

## Next Action

请 reviewer：
1. 审查 trigger-action 模板质量（是否每条都有明确触发条件 + 动作）
2. 确认 F155 边界（open_guide action gap 是否正确）
3. 抽查 2-3 个 sourceRef anchor 的语义匹配
4. 放行 or 退回

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f244/codex`
- Start Command: `pnpm review:start`
- Ports: 非前端改动（纯 JSON seed + test），无需起服务。reviewer 可直接 `git diff origin/main...HEAD` 审查。

## 自检证据

### Spec 合规
- R1 "不止是猫言语": 45 tips 全部面向用户视角，非猫内部术语 ✅
- R2 "magic words": 9 条 magic word tips 覆盖所有 magic words ✅
- R3 "家里有什么功能": 12 capability + 7 feature + 5 basics = 24 条功能发现 tips ✅
- R6 "不冒充真实进度": tips 在 PendingMemberBubble 内展示，不覆盖故障入口 ✅
- R7 "从现有真相源投影": 每条 tip 有 sourceRef 指向真相源 ✅

### 测试结果
```
cd packages/web && npx vitest run --run src/components/__tests__/capability-tip-strip.test.tsx
# 7/7 passed, 0 failed ✅
```

### 质量工具
```
node scripts/check-capability-tips.mjs    # PASS ✅ (45 tips, 0 errors)
pnpm check                                # 0 errors ✅
pnpm lint                                  # 0 errors ✅
```

### Artifact Hygiene
仓库根目录媒体/设计工件: 无 ✅

### Dogfood-Your-Slice
Scope verdict: 🆗 可豁免（理由：纯 JSON seed data + test 改动，非 runtime 行为变化。tips 展示逻辑未改动，renderer 和 selector 均未变。tips 在 PendingMemberBubble 中的渲染已在 Phase A PR #2448 验收过。）

### 相关文档
- Feature: `docs/features/F244-capability-tips-system.md`
- Phase A PR: #2448 (merged as 3fcc93d472)

[宪宪/Claude Opus 4.6 🐾]
