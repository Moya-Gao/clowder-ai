---
feature_ids: [F210]
topics: [review-request, antigravity-cli, agy, recon]
doc_kind: review-request
created: 2026-05-22
---

# Review Request: F210 Phase A AGY CLI Recon

Review-Target-ID: f210
Branch: `feat/f210-antigravity-cli-recon`

## What

Phase A recon for AGY CLI 1.0.1:

- Installed/probed official `agy` in an isolated `/tmp` HOME and binary dir.
- Captured sanitized raw fixtures for help output, unsupported flags, OAuth/auth interruption, and real-HOME keyring auth followed by missing-model failure.
- Updated F210 spec and BACKLOG from `spec` to `in-progress`.
- Added `.antigravitycli/` to `.gitignore` because `agy --print` writes workspace-local project symlinks.

## Why

F210 cannot move into adapter/parser implementation until OQ-1/OQ-3 are factual. The key discovery is that `agy --print` exists, but AGY CLI 1.0.1 has no top-level `--model`, `--json`, `--output-format`, `--mcp-config`, or `--no-mcp` flag. On this machine, real-HOME auth succeeds via macOS keyring, but execution fails before model invocation because no default model is selected.

## Original Requirements

> “Spec 可进 Phase A 执行。下一步是 recon：安装 `agy`、跑 headless 命令、冻结 OQ-1~4 的事实。”
> “@codex 开工，不过你估计得和砚砚46合作了 孟加拉猫猫这可靠性还有点问题 估计到时候也没办法帮你review”

- 来源：Cat Cafe thread `thread_mpg6o4q7gjn576ev` / current A2A handoff; canonical spec: `docs/features/F210-antigravity-cli-migration.md`
- 请对照上面的摘录判断：这次是否正确冻结了 Phase A day-1 facts，并且是否诚实阻塞 Phase B。

## Tradeoff

我没有直接写 `antigravity-cli` adapter。原因是 `agy --print` 还不能在当前机器产出成功 fixture，且没有可传入模型的 CLI flag；现在写 adapter 会把“缺少默认模型”的 onboarding 问题埋成运行时假故障。

## Architecture Ownership

Architecture cell: `transport`
Map delta: `none`
Why: 本轮只冻结 headless carrier facts 和文档证据；没有新增 runtime transport boundary、adapter、parser、queue 或 dispatcher。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致。
- `.antigravitycli/` gitignore 是否应该进入本轮，还是拆到独立 hygiene fix。
- AC-A1/A2/A4/A5/A6 标记为 done 是否过度，AC-A3 保持 open 是否足够严格。

## Open Questions

### 技术 OQ（给 reviewer）

- `agy --print` missing-model 是否足以阻塞 Phase B adapter，还是应该先实现 missing-model actionable error？
- 目前 `--conversation` / `--continue` 只证明 flag 存在，没有成功 fixture；OQ-2 的 Partial 标注是否准确？
- MCP 结论是否应只写“config file path known, launch-time disable/override flag absent”，避免暗示我们已经验证 MCP runtime loading？

### 价值 OQ（给 CVO）

无。

## Next Action

请做代码/文档 review。若放行，我会进入 merge-gate；若要求补，我按 receive-review 处理。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: not needed for this docs-only recon; `pnpm review:start` is unnecessary unless reviewer wants a local app.
- Ports: not started; no web/api service involved.

## 自检证据

### Spec 合规

- AC-A1/A2/A4/A5/A6: covered by `docs/features/assets/F210/phase-a-recon-2026-05-22.md` and fixtures.
- AC-A3: intentionally open; success/tool-use/provider-error/in-flight interruption fixtures are blocked by missing default model.
- Design check: `rg --files designs | rg 'F210|f210|antigravity|gemini|cli'` found only older F097/F118 CLI designs; no F210 UI/design work.
- Artifact hygiene: root media/design gate returned no output.
- Hotfix/fallback: `check-hotfix-pattern` false; `check-fallback-layers` reported no code files changed.
- Architecture ownership: exits 0; F210 has `Architecture cell: transport`, `Map delta: none`, and diff introduces no code architecture nouns. Existing unrelated warnings remain.

### 测试结果

- `pnpm check` PASS.
- `pnpm check:features` PASS (`features=217 backlog_active=61`).
- `git diff --check` PASS.
- `pnpm biome check ...` was not counted as evidence for target markdown/gitignore paths because Biome ignores those paths; full `pnpm check` did run Biome over repo and passed.

### 相关文档

- Feature: `docs/features/F210-antigravity-cli-migration.md`
- Recon: `docs/features/assets/F210/phase-a-recon-2026-05-22.md`
- Fixtures: `docs/features/assets/F210/agy-help.txt`, `agy-install-help.txt`, `agy-unsupported-flags.txt`, `agy-print-auth-required.txt`, `agy-real-home-no-default-model.txt`
