---
doc_kind: review-request
feature_ids: [F212]
related_features: [F210]
reviewer: opus47
author: codex
created: 2026-06-16
---

# Review Request: F212 AGY Spawn Context in CLI Diagnostics

Review-Target-ID: f212
Branch: fix/f212-agy-debugref-spawn-context
Commit: PR #2321 HEAD

## What

F212 `cliDiagnostics.debugRef` now carries path-safe AGY spawn context:

- `homeMode`: `process_home` / `child_env_home` / `agy_profile_home`
- `spawnCwdMode`: `cat_cafe_agy_cwd` / `agy_profile_cwd`
- `spawnCwdKey`: 16-char workspace hash basename only
- `profileId`: sanitized AGY profile id when profile mode is active

The web diagnostics panel renders these fields so future AGY auth/timeout failures show whether HOME/profile/cwd isolation is involved.

## Why

Live `@gemini35` OAuth failures were visible as `auth_failed`, but persisted route-serial metadata kept only `cliDiagnostics`, not full provider diagnostics. That made the key debugging question invisible: did runtime use real HOME, child env HOME, profile HOME, or which cwd sandbox?

This does **not** claim to fix the OAuth root cause. It fixes the missing evidence surface so the next failure is diagnosable without asking CVO to run ad hoc shell probes.

## Original Requirements

> agy太不靠谱了！我这 每次喊他 他都直接开始 跳出oauth让我登入
> 我自己本地cli也能和他发消息奇怪为什么 这里喊他竟然不可能
> 这种就让其他铲屎官完全不知道到底是为什么以为猫咖的问题

- 来源：当前 thread，2026-06-16 08:30-09:28 UTC live AGY OAuth 调查
- 请对照上面的摘录判断交付物是否改善“失败原因不可见”的问题

## Tradeoff

Deliberately did **not** expose raw `spawnCwd`, `HOME`, OAuth URL, token, or raw env. F212 previously rejected raw cwd/debug-tail exposure because path sanitization is not globally safe for non-HOME installs. The compromise is enum + hash-key context: enough to identify the spawn mode while avoiding raw host paths.

## Architecture Ownership

Architecture cell: bubble-pipeline
Map delta: none
Why: extends the existing `cliDiagnostics` payload and panel rendering; no new Store/Queue/Router/Adapter/Dispatcher/Binding.

Please reviewer check:
- diff is consistent with `Map delta: none`
- the debugRef additions remain finite/path-safe and do not become an arbitrary metadata channel
- timeout, auth-required, profiled stderr, and silent-completion paths carry the expected context

## Open Questions

### 技术 OQ

1. Is `spawnCwdKey` as hash basename enough evidence, or should review require an additional safe `cwdRootMode` enum for env-overridden `CAT_CAFE_AGY_CWD_ROOT`?
2. Is rendering `profileId` acceptable under F212 safety boundaries? It is sanitized config identity, not a path or credential.
3. Should spawn-layer `__cliError` diagnostics be enriched in more provider services later, or keep this AGY-only because this incident is AGY/F210-specific?

### 价值 OQ

无。

## Next Action

Please review `fix/f212-agy-debugref-spawn-context` / PR #2321 HEAD.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f212/opus47`
- Start Command: `pnpm review:start`
- Ports: not started by author

## 自检证据

### Spec 合规

- Spec: `docs/features/F212-cli-error-diagnostics.md`
- 愿景覆盖：AGY auth/timeout 不再只给 generic error; diagnostics panel will show safe spawn context needed for root-cause investigation.
- Design glob: no F212 `.pen` match. UI touched only `CliDiagnosticsPanel`; verified by component test, not live browser.
- Artifact hygiene: root media/design artifact check clean.
- Hotfix pattern: `hotfix=false`.
- Fallback layer check: `✅ No fallback pattern changes detected.`
- Architecture ownership check: exits 0; only repo-existing warnings, diff architecture nouns OK.

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 test/gemini-agent-service.test.js
# 73/73 pass

pnpm --dir packages/web exec vitest run src/components/__tests__/CliDiagnosticsPanel.test.ts
# 14/14 pass

pnpm --filter @cat-cafe/web exec tsc --noEmit
# pass

pnpm biome check packages/shared/src/types/cli-diagnostics.ts \
  packages/api/src/utils/cli-diagnostics.ts \
  packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts \
  packages/api/test/gemini-agent-service.test.js \
  packages/web/src/components/CliDiagnosticsPanel.tsx \
  packages/web/src/components/__tests__/CliDiagnosticsPanel.test.ts
# exit 0; repo-existing warnings remain in GeminiAgentService / cli-diagnostics
```

### Related Documents

- Feature: `docs/features/F212-cli-error-diagnostics.md`
- Related spike context: `docs/features/assets/F210/streamable-trajectory-spike-2026-06-01.md`
