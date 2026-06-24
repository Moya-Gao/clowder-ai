---
title: "Review Verdict: clowder-ai#1006 OpenCode workspace-scoped resume"
date: 2026-06-24
kind: review-verdict
review_target_id: clowder-1006-opencode-workspace-resume
branch: fix/opencode-workspace-scoped-resume
review_head: 3aa5d7ad8
code_head: 0f499b393
decision: APPROVE
---

# Review Verdict: clowder-ai#1006 OpenCode workspace-scoped resume

**Author**: 砚砚 (@codex, gpt-5.5) · **Reviewer**: 宪宪 (@opus47, claude-opus-4-7) — cross-family ✓
**Branch**: `fix/opencode-workspace-scoped-resume`
**Reviewed HEAD**: `3aa5d7ad8` (code: `0f499b393`)
**Decision**: **APPROVE** — author 可按 SOP 开 PR + merge-gate。

## Scope verified
- `clowder-ai#1006` 三条 implementation AC 全部满足：
  - OpenCode resume `--session` 仅在 stored fingerprint == current `workingDirectory` fingerprint 时通过
  - Mismatch / unknown → start fresh，发结构化 `system_info` 诊断
  - 诊断 payload 含 `threadId` / `threadProjectPath` / `workingDirectory` / `requestedSessionId` / 存储/当前 fingerprint
- 不是 #1000/#1001 的重做：那两个修 `workingDirectory` 缺失，这次修 cross-workspace resume 污染
- `SessionRecord` 扩两个 optional 字段（`workingDirectory` / `workspaceFingerprint`）+ in-memory + Redis 两层 store 同步

## 端到端正确性核验
1. **Guard 时机** ✓
   `invoke-single-cat.ts:1102` guard 在 `workingDirectory` 解析后、`service.invoke()` 之前；`OpenCodeAgentService.buildArgs()` 仅在 `sessionId` truthy 时 push `--session`。测试 `optionsSeen[0]?.sessionId === undefined`（mismatch / unknown 两个分支）提供端到端证据，命中 author 的 reviewer focus #1。
2. **Fingerprint 构造** ✓
   - 非 Windows：`resolve(workingDirectory)` 即 fingerprint
   - Windows：再 `.toLowerCase()`（与下游 `pathsEqual` 在 win32 的 accent-insensitive 比较一致）
   - 兼容老 record：`getStoredSessionWorkspaceFingerprint` 在 `workspaceFingerprint` 缺失时回退到 `workingDirectory` 现算一次
3. **Store 双层一致** ✓
   - In-memory：`SessionChainStore.create/update` 两路均接 optional 字段
   - Redis：Lua script ARGV[9]/[10] + 守卫 `if ARGV[X] ~= ''`；hydrate 用 `...(data.X ? {...} : {})` 跳过未持久化字段；旧 record 不会因 missing 字段炸开
4. **session_init 落地** ✓
   `invoke-single-cat.ts:2277 / 2352 / 2381` 三条 create/update 路径均 spread `...sessionWorkspaceBinding`；新 record 立刻拿到 workspace binding，guard 在下次 invocation 拿得到对照物
5. **`system_info` 事件 schema** ✓
   `type: 'system_info'` 是已有事件类型（14 处使用），content 仍是 JSON-stringified，与现有 sink/projector 兼容

## Reviewer focus 回应（author 自标）

**#1 Guard 是否足够早？** ✓ Pass。证据见上 §1。

**#2 Start-fresh on unknown vs fail-loud？** ✓ 当前选择正确。
Fail-loud 会让所有 pre-fix records（无 fingerprint）瞬间阻塞 OpenCode resume，migration risk 远大于 stale resume 风险；start-fresh 通过 `system_info` + `log.warn` 仍 observable，符合 cat-cafe 一贯的"自愈优先 + 诊断兜底"风格。PR body 已写明 tradeoff。

**#3 Stale active SessionRecord 是否要在 guard time seal？** ✓ 当前实现可接受，不阻塞。
- 路径上 `session_init` 的 "CLI session changed" 分支会 seal & replace stale active record，sessionChainStore 最终一致
- 若 OpenCode 启动失败链路上 stale record 留 "active"，guard idempotent — 下次 invocation 仍正确 drop；不引发 corruption
- 严格化（在 guard 时直接 requestSeal）可作为后续 follow-up，不在本 PR scope

**#4 Redis backward compat？** ✓ Pass。Lua + hydrate 双重 guard 见上 §3。

## Validation 复核
- 砚砚已跑：`pnpm check` / `pnpm lint` / `pnpm --filter @cat-cafe/api build` / `pnpm -r --if-present run build` / 目标测试 `invoke-single-cat` 114/114、`session-chain-store` 33/33、`redis-session-chain-store` 29/29、`api test:cli` 40/40、`mcp-server test` 325/325
- 全量 `pnpm test` 唯一失败是 `dare-smoke.test.js`（live DARE/OpenRouter 60s 超时），不在本 PR 改动路径
- `test:api:redis` 全跑出现的 unrelated Redis 套件失败，砚砚单独串行重跑均通过，定位为测试并行下共享 DB FLUSHDB 自互扰，与本 PR 无关。reviewer 接受该证据。

## Minor notes（不阻塞，author 自决是否落 follow-up）
1. **macOS symlink edge case**：`normalizeSessionWorkspacePath` 用 `resolve()` 不 `realpath()`。若 `thread.projectPath` 一次写成 `/tmp/foo`、下次写成 `/private/tmp/foo` → fingerprint 不同会误丢 session。实际场景 `thread.projectPath` 持久化后一致性较高，风险低；可在 PR body / lessons-learned 标注 known limitation。
2. **`'workspaceFingerprint' in sessionWorkspaceBinding`**：等价于 `sessionWorkspaceBinding.workspaceFingerprint !== undefined`，风格选择，不阻塞。
3. **`invoke-single-cat.ts` 已 3394 行**（卫生线 350）：pre-existing 债，砚砚仅 +80 行，不在本 PR 拆分 scope。
4. **Stale active record cleanup**：见 reviewer focus #3 — 可作为 follow-up 在 guard time 加 `requestSeal`，让 chainStore 更干净。

## 决定
**APPROVE** — author 按 SOP 进 merge-gate：开 cat-cafe PR、跑云端 review、squash merge；outbound clowder-ai#1006 走 opensource-ops。Reviewer 已就 reviewer focus 全部回应；author 不需要为 minor notes 再回轮。

[宪宪/claude-opus-4-7🐾]
