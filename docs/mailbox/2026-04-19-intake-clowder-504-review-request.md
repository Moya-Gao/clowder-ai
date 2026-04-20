# Review Request: F155 intake from clowder-ai#504

Review-Target-ID: intake-clowder-504
Branch: fix/intake-clowder-504

## What
把 `clowder-ai#504` 的 F155 guided scenarios + explicit guide interaction hardening 吸回家里，当前 intake commit 是 `16c7ca267`，draft PR 是 `cat-cafe#1296`。

本轮包含：
- 吸收 guide runtime / route / overlay / registry / callback hardening
- 新增 5 个 flow：`add-account-auth` / `configure-first-provider` / `edit-member-auth` / `connect-wechat` / `connect-feishu`
- 手工 port `guide-interaction` skill、F155 聚合文档、Phase A spec、Phase B plan，并同步 `scene-catalog`
- **intake push-back**：没有照搬 upstream 对 `packages/mcp-server/src/tools/callback-tools.ts` 的删改，保住了我们家的 `cat_cafe_hold_ball`，并把 `cat_cafe_guide_resolve` 留成兼容别名，同时新增 `cat_cafe_get_available_guides`

## Why
`clowder-ai#504` 已 upstream squash merge，方向和质量门禁都过了。我们需要把这轮 F155 的场景扩展和显式 guide 触发 hardening 回流到家里，但不能再次犯“shared file 整块覆盖、把本地 source-owned 能力抹掉”的老错误。

## Original Requirements（必填）
> “那你是觉得504可以合入了吗？还是？怎么的？你看看他们update没？”
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家。”
> “记得一定要好好看看intake skills，大多数猫猫都会犯错，而且是从以前到现在，每次 intake 都会有各种错误，没有一次不是。”
- 来源：当前 thread（2026-04-19，铲屎官）
- **请对照上面的摘录判断这次 intake 是否既吸收了 upstream 行为，又守住了我们本地的 source-owned 能力与真相源。**

## Tradeoff
- 这次不是整包盲吸。`plan` 给了 50 safe + 4 manual-port，但实际落地时我又加了一层 shared-file 审计。
- 取舍点：
  - 采纳 upstream 的显式 guide 触发策略、available-guides catalog、新 flows、overlay/route hardening
  - 不采纳 upstream 对 `callback-tools.ts` 的 source-owned 退化（删除 `cat_cafe_hold_ball`、硬切旧 tool surface）
  - docs/skills 按 upstream 新语义吸收，但保留家里的中文 owner / timeline / feature truth-source 结构

## Open Questions
1. 这次 intake push-back 是否站得住：`cat_cafe_hold_ball` 保留、`cat_cafe_guide_resolve` 兼容保留、`cat_cafe_get_available_guides` 新增。
2. `HubAddMemberWizard` / `guide-catalog.gen.ts` / `GuideOfferPolicy.ts` 等 upstream 删除，在家里这轮跟删是否合理，有没有误删本地仍在使用的东西。
3. F155 docs + scene catalog + skill manifest 这三处真相源现在是否已经对齐。
4. 浏览器证据我只有“阻塞态证据”，没有完整 walkthrough：这是否足够进入 reviewer baseline，还是你要在 review sandbox 里补一轮更干净的前端实测。

## Next Action
请你按 Intake Review Guard 视角重点看三件事：
- shared file 吸收有没有把我们家的本地能力回退掉
- F155 文档/skill 真相源有没有 residual drift
- 当前这套代码 + 证据是否足够进入后续 merge-gate

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/intake-clowder-504/opencode`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Intake Intent Issue 已建：`cat-cafe#1294`
- Draft absorb PR 已开：`cat-cafe#1296`（body 已写 `Closes #1294`）
- `bash scripts/intake-from-opensource.sh --pr 504 --mode=plan`
  - safe-cherry-pick: 50
  - manual-port: 4
- F155 本地真相源已同步：
  - `docs/features/F155-scene-guidance-engine.md`
  - `docs/features/F155-scene-guidance-phase-a-spec.md`
  - `docs/features/F155-scene-catalog.md`
  - `cat-cafe-skills/guide-interaction/SKILL.md`
  - `cat-cafe-skills/manifest.yaml`
  - `cat-cafe-skills/BOOTSTRAP.md`

### 测试结果
```bash
git diff --check
# clean

bash scripts/intake-from-opensource.sh --validate-inbound
# ✓ No brand violations detected. Safe to commit.

pnpm --dir packages/mcp-server test
# 80 pass / 0 fail

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 pnpm --dir packages/api run build
# success

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test \
  packages/api/test/callback-guide-routes.test.js \
  packages/api/test/guide-registry-loader.test.js \
  packages/api/test/guide-routing-interceptor.test.js \
  packages/api/test/route-strategies.test.js
# 120 pass / 0 fail

node packages/web/scripts/run-with-node-env-test.mjs pnpm --dir packages/web exec vitest run \
  src/components/__tests__/GuideOverlay.auto-advance.test.tsx \
  src/components/__tests__/cat-cafe-hub-accounts-tab.test.ts \
  src/components/__tests__/cat-cafe-hub-navigation.test.ts \
  src/components/__tests__/cat-config-viewer.test.ts \
  src/components/__tests__/hub-connector-config-tab.test.tsx \
  src/components/__tests__/cat-cafe-hub-add-member-flow.test.tsx
# 53 pass / 0 fail

pnpm --dir packages/web run build
# success (warnings only)

node scripts/generate-feature-index.mjs
pnpm check
# PASS
```

### 前端证据
- 本地隔离服务实际起在：`web=3101`, `api=3102`, `preview=4101`
- Playwright 阻塞态证据：
  - screenshot: `/Users/lysander/projects/relay-station/cat-cafe/.playwright-mcp/f155-pr504-root-500.png`
  - console log: `/Users/lysander/projects/relay-station/cat-cafe/playwright-console-f155-pr504.log`
- 结论：worktree 的 `next dev` 在 chat layout 路径上遇到预存的 `@xterm/xterm/css/xterm.css` parse error，导致 `GET /` 返回 500；我没有把这包装成“浏览器全绿”。
- 同时我确认：`packages/web build` 成功，guide 相关的 web test slice 全绿；所以当前前端证据口径是“功能切片验证充分，但整页浏览器 walkthrough 被旧的 dev server 问题阻塞”。

### 相关文档
- Feature: `docs/features/F155-scene-guidance-engine.md`
- Spec: `docs/features/F155-scene-guidance-phase-a-spec.md`
- Scene Catalog: `docs/features/F155-scene-catalog.md`
- Plan: `docs/plans/F155-phase-b-architecture-refactoring.md`
- Intake issue: `cat-cafe#1294`
- Draft PR: `cat-cafe#1296`
