# Review Request: intake(clowder-ai#562) batch fixes

Review-Target-ID: intake-clowder-562
Branch: fix/intake-clowder-562

## What
吸收 `clowder-ai#562` 的 batch fixes：
- 默认猫 dropdown / unavailable guard / `.env` persistence safety
- serial / parallel agent message timestamp 使用 invocation start time
- Redis deliveredAt cursor re-scoring regression
- Web local fonts, `next/image` cleanups, message ID copy button, onnxruntime warning suppression

## Why
`clowder-ai#562` 已 merge 到开源仓 `main`，对应修复 `#553/#525/#149/#543/#557/#565`。这批改动对我们自己有实际价值，但 high-risk routing/config 文件不能直接覆盖家里的当前主线，所以本轮按 source intent replay。

## Original Requirements
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家 记得一定要好好看看intake skills 大多数猫猫都会犯错”
- 来源：当前 thread（铲屎官 2026-04-25 13:52 指令）
- 请对照上面的原话判断：这次 intake 是否既吸收了 `clowder-ai#562` 的行为变化，又守住了 cat-cafe 当前主线约束。

## Tradeoff
- 没有照搬 source 的 `.cat-cafe/default-cat-override.json` 机制；保留 cat-cafe 当前 `.env` 持久化和 atomic failure behavior。
- `DefaultCatSelector.tsx` / dropdown 测试 / `GuideOverlay.tsx` 的 source intent 在 cat-cafe main 已存在或等价，因此没有机械改动这些文件。
- 前端浏览器 smoke 只覆盖 `/pixel-brawl` local font path；`next/image` 迁移主要由 build 验证。

## Open Questions
1. `cat-config-loader.ts` / `routes/config.ts` 的 manual-port 是否准确吸收 unavailable default-cat guard，同时没有回退现有 owner gate 和 `.env` atomicity？
2. `route-serial.ts` / `route-parallel.ts` 是否只改了 persisted message timestamp，没有影响 A2A、draft、tool/rich/thinking persistence？
3. PR 文件集合是否符合 `cat-cafe#1404` 的逐文件决策表；`DefaultCatSelector` / `GuideOverlay` 作为 no-op existing 是否可接受？

## Next Action
请 review `cat-cafe#1406`，并在 GitHub PR 留 formal review comment，必须写明当前 HEAD SHA 覆盖范围。intake record guard 需要 review-proof URL。

## Review Sandbox
- Path: `/tmp/cat-cafe-review/intake-clowder-562/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3211`, `api=3212`（或 review:start 分配的等价隔离端口，禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- Intake plan：`bash scripts/intake-from-opensource.sh --pr 562 --mode=plan`
- Intent Issue：`cat-cafe#1404`
- Absorb PR：`cat-cafe#1406`
- Brand Guard：`bash scripts/intake-from-opensource.sh --validate-inbound` → pass
- Artifact Hygiene：根目录媒体/设计工件检查 → 无命中
- 设计稿 glob：存在相关 `designs/像素猫猫格斗.pen` / `designs/f075-cat-leaderboard.pen` / `designs/f070-project-setup-card.pen`，本次为 intake bugfix，未做设计稿重实现；浏览器 smoke 见下。

### 测试结果
- `pnpm --dir packages/api run build` → pass
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/default-cat-config.test.js` → 23 passed, 0 failed
- `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test test/route-strategies.test.js` → 91 passed, 0 failed
- `REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/redis-message-store.test.js` → 20 passed, 0 failed
- `pnpm --filter @cat-cafe/api run lint` → pass
- `pnpm --filter @cat-cafe/web run test` → 346 files, 2476 tests passed
- `pnpm --filter @cat-cafe/web run build` → pass（existing ESLint warnings remain warnings）

### 前端证据
- Worktree server: `http://127.0.0.1:3211/pixel-brawl` from `/Users/lysander/projects/relay-station/cat-cafe-intake-clowder-562`
- Screenshot: `/tmp/cat-cafe-evidence/intake-562/pixel-brawl-1280x900.png`
- Browser evidence: `document.fonts.status === "loaded"`, title `Cat Cafe`, visible text includes `PIXEL BRAWL`

### 相关文档
- Source PR: `clowder-ai#562`
- Intent Issue: `cat-cafe#1404`
- Absorb PR: `cat-cafe#1406`
