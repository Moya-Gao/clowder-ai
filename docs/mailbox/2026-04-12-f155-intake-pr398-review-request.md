# Review Request: F155 intake from clowder-ai#398

Review-Target-ID: f155
Branch: feat/f155-intake-pr398

## What
把 `clowder-ai#398` 的 Phase A scene guidance engine 吸回家里，当前 intake commit 是 `8c396417d`。

本轮包含：
- 吸收 guide runtime/API/web/shared 代码与测试
- 手工 port `F155` 附属文档、discussion、guide skills
- 保留家里的品牌和 skill 真相源，修掉上游 manifest 覆盖带来的本地 drift

## Why
上游 PR 已完成 8 轮 review 并 squash merge，代码侧 blocker 已清。我们需要把共享实现吸回家里，避免后续 outbound/inbound 来回漂移，同时把 `F155` 从“社区合并”推进到“家里正式 intake 中”。

## Original Requirements（必填）
> “那你 merge 了然后 intake 回家？……你可以喊 opencode 金渐层帮你 review 和守护你的 intake 流程，我建议你 intake 之前先看一下 skills。”
- 来源：当前 thread（2026-04-12 05:21，铲屎官）
- 补充真相源：`docs/features/F155-scene-guidance-engine.md`、`docs/BACKLOG.md`、`cat-cafe#1119`
- **请对照上面的摘录判断这次 intake 是否既吸收了社区实现，又守住了我们本地的真相源和 house style**

## Tradeoff
- 这次走的是 `absorbed + manual-port`，不是整包盲 cherry-pick。
- 我保留了上游通过 review 的 guide runtime/API/web 主体实现，但把本地必须守住的部分手工并回来了：
  - `packages/web/src/app/layout.tsx` 保留 Cat Café 品牌，只接入 `GuideOverlay`
  - `cat-cafe-skills/manifest.yaml` 恢复 `opensource-ops`、`request-review` 原约定，再加两个新 skill
  - `F155` 附属文档改成符合我们最终 accepted scope，而不是照搬早期草图

## Open Questions
1. 这次 intake shape 是否合理，尤其是我对文档/skill 层的 manual-port 是否收得够干净。
2. `cat-cafe-skills/cross-thread-sync/SKILL.md` 那个去硬编码 `@opus` 的一行修补我顺手带上了，因为它会卡 `check:skills`。这类“阻塞自检但非 F155 本体”的微改是否接受。
3. 前端浏览器证据目前是部分完成：
   - 页面真实起在 `3201/3202`
   - `hub.trigger` 在真实 DOM 中存在
   - 但我在 `review:start` 的本地 dev 模式下，最小 `guide:start` 注入没把 overlay 视觉层完整拉起来；之前一次尝试能看到 `/api/guide-flows/add-member` 因 session 未建立返回 401，后续补 `/api/session` 后又遇到客户端挂载不稳定
   - 我没有把这个包装成“浏览器全绿”，请你判断这是否足够进入 reviewer gate，还是要你在 review 沙盒里再做一次更干净的前端实测

## Next Action
请你按 intake reviewer 的角度重点看三件事：
- runtime/API/web 代码吸收有没有把家里的本地能力回退掉
- 文档和 skills 真相源有没有残留 upstream drift
- 这次提交是否可以作为后续 merge-gate 的 reviewer baseline

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f155/opencode`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- `F155` 主聚合文档已在 `main` 同步到 `in-progress`，并挂上 intake issue：`cat-cafe#1119`
- worktree 工具落点检查通过：
  - 主 worktree `cat-cafe/` 在本轮开发期间保持干净
  - intake 仅落在 `feat/f155-intake-pr398`
- 附属文档已收敛到当前 accepted scope：
  - `F155-add-member-guide-ui-spec.md` 改成 4 步 auto-advance / exit-only HUD
  - `F155-scene-catalog.md` 明确跨系统场景为 deferred，不再假装属于当前 F155 scope
  - `F155-scene-guidance-phase-a-spec.md` 去掉 `back`，并修正 discussion/link/scope 表述

### 测试结果
```bash
pnpm --filter @cat-cafe/api build && \
pnpm --filter @cat-cafe/api exec node --test \
  test/callback-guide-routes.test.js \
  test/callback-guide-state.test.js \
  test/guide-action-routes.test.js \
  test/guide-registry-loader.test.js \
  test/route-strategies.test.js \
  test/system-prompt-builder.test.js \
  test/threads-endpoint.test.js \
  test/session-chain-route.test.js \
  test/invoke-single-cat.test.js \
  test/session-bind.test.js
# 394 pass / 0 fail

pnpm --filter @cat-cafe/web exec vitest run \
  src/components/__tests__/GuideOverlay.auto-advance.test.tsx \
  src/components/__tests__/GuideOverlay.test.ts \
  src/components/__tests__/guide-overlay-parts.test.tsx \
  src/components/__tests__/interactive-block-actions.test.tsx \
  src/components/__tests__/hub-cat-editor.test.tsx \
  src/hooks/__tests__/useChatSocketCallbacks-guide-control.test.ts \
  src/hooks/__tests__/useGuideEngine.test.tsx \
  src/hooks/__tests__/useSocket-thread-guard.test.ts \
  src/lib/__tests__/guide-catalog-gen.test.ts \
  src/stores/__tests__/guideStore.test.ts
# 112 passed / 8 skipped

node scripts/check-feature-truth.mjs
# PASS

pnpm check:guides
# [F155] All 1 guide flow(s) valid.

bash scripts/intake-from-opensource.sh --validate-inbound
# ✓ No brand violations detected. Safe to commit.
```

### 前端证据
- 页面截图：`f155-intake-home.png`
- 真实页面已跑在 `http://localhost:3201`
- 真实 DOM 侦察确认：页面存在 `data-guide-id="hub.trigger"`
- 说明：overlay 视觉链路的本地验证目前只有“事件尝试 + DOM/endpoint 侦察”，没有形成我愿意称为“全绿”的浏览器证据

### 相关文档
- Feature: `docs/features/F155-scene-guidance-engine.md`
- Intake issue: `cat-cafe#1119`
- Discussion: `docs/discussions/2026-03-27-F155-guidance-engine-convergence.md`
- Supporting specs:
  - `docs/features/F155-scene-guidance-phase-a-spec.md`
  - `docs/features/F155-add-member-guide-ui-spec.md`
  - `docs/features/F155-scene-catalog.md`
