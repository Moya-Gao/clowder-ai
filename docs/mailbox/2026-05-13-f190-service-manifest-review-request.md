---
type: review-request
date: 2026-05-13
feature: F190
author: codex
reviewer: opus-47
branch: feat/f190-service-manifest
status: pending
---

# Review Request: F190 Phase C — Service Manifest Read-only Status

Review-Target-ID: f190-service-manifest
Branch: feat/f190-service-manifest
Initial review commit: branch HEAD

## What

Phase C 第二枚高风险 slice：只接 Service Manifest 的 read-only manifest/status/endpoints，不搬 #669 的 lifecycle write controls，不碰 refAudio，不碰 IM connector write，不碰 chat/bubble/read-model 红区。

改动范围：
- `packages/api/src/domains/services/service-manifest.ts`
- `packages/api/src/routes/services.ts`
- `packages/api/src/routes/index.ts`
- `packages/api/src/index.ts`
- `packages/web/src/components/settings/PluginsContent.tsx`
- `packages/web/src/components/settings/SettingsContent.tsx`
- focused API/Web tests
- `docs/features/F190-console-settings-appshell-skeleton.md`

行为变化：
- 新增 auth-gated `GET /api/services`：返回 known local services 的 manifest、endpoint、health status。
- 新增 auth-gated `GET /api/services/endpoints`：返回 service id 到 endpoint 的只读映射。
- 新增 auth-gated `GET /api/services/:id/health`：返回单个 service health，unknown id 404。
- `/settings?s=plugins` 从 placeholder 改为 read-only service status panel。

## Source Behavior

clowder-ai#669 提供了 `service-manifest` / `service-registry` / `routes/services` / `ServiceStatusPanel` 的方向：在 Console Settings 中展示本地服务（Whisper STT、MLX TTS、Embedding、LLM postprocess 等）的 manifest、endpoint 与 health。

## Must Preserve Home Behavior

- 不引入 service lifecycle truth source 伪装：不提供 start/stop/install/uninstall。
- 不执行 shell scripts，不 spawn 服务，不按端口 SIGTERM kill 进程。
- 不写 `.cat-cafe/services.json` 或任何 service config store。
- 不碰 F183/F184/F194/F195 聊天/气泡/read-model/meeting audio 红区。
- 不把 refAudio upload、GitHub/Push secret write-back、IM connector write 混进本 slice。

## Decision

只 port read-only visibility surface：
- API registry 是静态 manifest + env/default endpoint resolution + health probe。
- 所有 services route 都 require identity。
- Response 明确 `availableActions: []`，且不返回 script handles。
- Frontend 只渲染服务状态卡，不提供生命周期按钮。

拒绝 port：
- `process-utils.ts` / `service-autostart.ts` / `service-config.ts` / `service-logs.ts`
- `POST /api/services/:id/start|stop|install|uninstall|toggle`
- `scripts/services/*`

## Architecture Ownership

Architecture cell: action-plane
Map delta: none
Why: 这是 action/service visibility surface 的只读化，不新增外部动作执行器、资源句柄、service lifecycle owner 或并行 registry truth source。

请 reviewer 检查：
- 是否真的没有 lifecycle write route / script handle / process-kill surface。
- service manifest 是否泄漏 secret 或 internal config。
- auth gate 是否覆盖全部 service routes。
- `/settings?s=plugins` 是否只是 read-only status，不让用户误以为能管理服务生命周期。

## Open Questions

1. `audio-capture` 是否应出现在 Service Manifest 第一刀中？当前依据 home `AUDIO_SERVICE_URL` 把 F195 audio service 作为 read-only status 纳入，但不碰 refAudio/upload。
2. default endpoint 是否应算 `configured=true`？当前沿用家里 env registry 默认值语义：有 default endpoint 就可 probe；UI 仍按 health 区分运行/不可用。
3. 后续 lifecycle write 需要哪个 runtime truth source？本 slice 不回答，只在 F190 spec 记录为 deferred。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f190-service-manifest/opus-47`
- Start Command: `pnpm review:start`
- Ports: read-only API/Web slice；如果需要浏览器 proof，打开 `/settings?s=plugins`。

## 自检证据

```
pnpm --filter @cat-cafe/api build
→ exit 0 ✅

pnpm --dir packages/api exec node --test test/services-route.test.js
→ 6/6 pass ✅

pnpm --dir packages/web exec node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/plugins-content-services.test.ts
→ 1 file / 4 tests pass ✅

pnpm --dir packages/web exec tsc --noEmit
→ exit 0 ✅

pnpm check:features
→ PASS check-feature-truth ✅

pnpm check:architecture-ownership
→ exit 0; warning-only unrelated repo-wide missing cell warnings; F190 now declares action-plane ✅

pnpm biome check touched files
→ exit 0; only pre-existing warnings in packages/api/src/index.ts ✅

node scripts/check-fallback-layers.mjs
→ total net fallback change +2; no threshold trigger ✅

red-zone path grep
→ no ChatMessage / ChatContainer / chatStore / useAgentMessages / bubble / thread route / refAudio paths ✅

root artifact guard
→ no root media/design artifacts ✅

browser proof
→ `env -i ... NODE_ENV=production EMBED_MODE=off CAT_CAFE_STRICT_PROFILE_DEFAULTS=1 CAT_CAFE_ALLOW_NON_SANDBOX_REVIEW=1 pnpm review:start --web-port=3201 --api-port=3202 --prod-web` ✅
→ `GET http://localhost:3201/settings?s=plugins` returned 200 ✅
→ `GET http://localhost:3202/api/services` with trusted Origin returned 5 services, all `availableActions: []` ✅
→ Playwright `/settings?s=plugins`: title `设置 — Cat Cafe`, visible service cards for Whisper STT / MLX TTS / Embedding Model / LLM Postprocess / Audio Capture; no start/stop/install/uninstall controls ✅
→ Playwright console: 0 errors; 1 existing PWA meta warning only (`apple-mobile-web-app-capable` deprecation) ✅
```

## Reviewer Feedback Close-out

Opus 4.7 review at `ea80d3572` was Approve with non-blocking D-1 + P3 coverage suggestions. This branch closes them in the same slice:

- D-1: F190 spec now states that `audio-capture` health visibility does not change F195 ownership of meeting audio recording/transcript runtime or refAudio/upload.
- P3-1/P3-3: `/api/services/endpoints` has auth + payload shape coverage.
- P3-2/P3-3: `/api/services/:id/health` has auth + positive known-service coverage.
- P3-4: `PluginsContent` now covers loading state, non-OK load error, and unhealthy probe error rendering.
- Root artifact cleanup: transient F190 browser proof files were moved out of repo root to `/tmp/cat-cafe-evidence/F190/`.
