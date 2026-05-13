---
type: review-request
date: 2026-05-13
feature: F190
author: codex
reviewer: opus-47
branch: feat/f190-ref-audio-upload
status: pending
---

# Review Request: F190 Phase C — refAudio Upload

Review-Target-ID: f190-ref-audio-upload
Branch: feat/f190-ref-audio-upload
Initial review commit: branch HEAD

## Original Requirements

Source:
- User thread, 2026-05-13: "Phase C 高风险面单独开 slice"
- User thread, 2026-05-13: "继续完成 Service Manifest、refAudio、IM connector write"
- `docs/features/F190-console-settings-appshell-skeleton.md` AC-C3: "refAudio upload 独立 slice，必须覆盖 path traversal、文件类型/大小限制与清理证明。"

## What

Phase C 第三枚高风险 slice：只接 cat voiceConfig 的 TTS reference-audio 上传与 `/uploads/...` path resolver，不接 F195 meeting audio runtime，不接 Service Manifest lifecycle，不接 IM connector write，不碰 chat/bubble/read-model 红区。

改动范围：
- 新增 `POST /api/uploads/ref-audio`
- `cat-voices` 支持安全解析 `/uploads/...` refAudio URL
- `cats` create/update 接收 `voiceConfig`
- Hub 成员编辑器增加 Voice Config 折叠区与 Ref Audio 上传入口
- focused API/Web tests
- F190 spec / 本 review request

## Source Behavior

clowder-ai#669 提供了 refAudio upload / cat voice config 的方向：用户在成员编辑面上传参考音频，服务端保存到 uploads，成员 `voiceConfig.refAudio` 指向返回 URL。

## Must Preserve Home Behavior

- `refAudio upload` 只处理 TTS reference-audio 文件，不接 meeting audio recording/transcript。
- 不读取或写入 F195 meeting audio runtime、transcript、live advisory 状态。
- 不允许 trusted Origin fallback 冒充上传身份；上传必须有真实 session user id。
- 不信任上传文件名；服务端生成文件名并写入 `UPLOAD_DIR`。
- 不允许 path traversal：`cat-voices` 解析 `/uploads/...` 时必须限制在 upload dir 下。
- 不迁移 #669 的 service lifecycle / process spawn / SIGTERM / IM write endpoint。

## Decision

只 port 最小可验证 upload surface：
- API: `POST /api/uploads/ref-audio`，multipart single-file，10 MiB limit，magic-byte sniff WAV/MP3/OGG/WebM。
- Storage: generated filename `ref-audio-<timestamp>-<random>.<ext>` under `UPLOAD_DIR`.
- Resolver: `resolveRefAudioPath('/uploads/...')` only resolves inside `UPLOAD_DIR`; traversal returns `invalid-ref`.
- UI: HubCatEditor Voice Config 折叠区，上传成功后写回 form 的 `voiceRefAudio`，保存时落到 `voiceConfig.refAudio`.
- Cats API: create/update schema 接收 `voiceConfig`；update 支持 `voiceConfig: null` 清空。

Rejected / not in this slice:
- F195 meeting audio upload / recording / transcript runtime
- Service Manifest lifecycle controls
- IM connector write
- voice preview / playback / synthesis invocation
- deleting uploaded refAudio files

## Architecture Ownership

Architecture cell: action-plane
Map delta: none
Why: 这是现有 API route + Hub editor 的 bounded write surface；不新增 Store/Queue/Router/Adapter/Dispatcher，不创建 service lifecycle owner，也不改 F195 meeting audio ownership。

请 reviewer 检查：
- 上传身份 gate 是否足够 fail-closed。
- 文件 sniff / size limit / generated filename / cleanup proof 是否覆盖 AC-C3。
- `/uploads/...` resolver 是否真的锁在 upload dir 下。
- cat `voiceConfig` 写回是否没有绕开 existing cats route validation。
- UI 是否只是成员 voice config surface，没有误接 F195 meeting audio。

## Open Questions

1. `voiceConfig: null` 清空是否应允许？当前用于编辑已有成员时清空 voice fields；符合 "写回成员配置" 语义。
2. 是否需要同 slice 加 uploaded refAudio delete endpoint？当前不加，避免把文件生命周期与 UI 删除语义混进 upload slice。
3. `VOICE_LANG_OPTIONS` 是否要扩展到所有语言？当前只覆盖 #669 和家里常用值，后续可跟 TTS provider catalog 对齐。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f190-ref-audio-upload/opus-47`
- Start Command: `pnpm review:start`
- Suggested browser path: `/` → Cat Cafe Hub → `+ 添加成员` → Voice Config.

## 自检证据

```
pnpm --filter @cat-cafe/api build
node --test packages/api/test/ref-audio-upload-route.test.js packages/api/test/cat-voices-ref-audio-path.test.js
→ 7/7 pass ✅

node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/hub-cat-editor-client.test.ts src/components/__tests__/hub-cat-editor.test.tsx
→ 2 files / 44 tests pass ✅

pnpm --filter @cat-cafe/web exec tsc --noEmit
→ exit 0 ✅

pnpm biome check touched files --diagnostic-level=error
→ exit 0 ✅

pnpm check
→ exit 0 ✅

pnpm check:features
→ PASS check-feature-truth ✅

pnpm check:architecture-ownership
→ exit 0; warning-only unrelated repo-wide missing cell warnings; F190 declares action-plane ✅

pnpm check:followup-tails
→ No follow-up tails detected ✅

git diff --check
→ exit 0 ✅

red-zone path grep
→ no useAgentMessages / bubble-* / chatStore / ChatContainer / meeting / transcript paths ✅

root artifact guard
→ no root media/design artifacts ✅

browser proof
→ `CAT_CAFE_ALLOW_NON_SANDBOX_REVIEW=1 CAT_CAFE_STRICT_PROFILE_DEFAULTS=1 NODE_ENV=production EMBED_MODE=off pnpm review:start --web-port=3221 --api-port=3222 --prod-web` ✅
→ `GET http://localhost:3222/health` passed ✅
→ Playwright `http://localhost:3221/` → skip bootcamp modal → Cat Cafe Hub → `+ 添加成员` → Voice Config visible ✅
→ `Ref Audio` and `Voice Lang Code` visible after expand ✅
→ screenshots saved outside repo root: `/tmp/cat-cafe-evidence/F190/ref-audio-prod/*.png` ✅
→ console: 0 non-resource errors; 5 pre-existing resource load errors from the empty review profile ✅
```
