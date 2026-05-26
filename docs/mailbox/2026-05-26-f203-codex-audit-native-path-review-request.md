---
feature_ids: [F203]
topics: [system-prompt, phase-e-audit, review-request]
doc_kind: mailbox
created: 2026-05-26
---

# Review Request: F203 Codex audit native binary path

Review-Target-ID: f203
Branch: fix/f203-codex-audit-native-path

## What

- Fixed `scripts/audit-claude-code-system-prompt.mjs` so Codex native binary candidates mirror Codex 0.133 launcher order: `vendor/<triple>/bin/codex` first, legacy `vendor/<triple>/codex/codex` second.
- Added a regression test for the Codex 0.133 bin layout and updated existing candidate-order assertions.
- Archived `docs/audits/codex-system-prompt-v0.133.0.md` after confirming 0.130.0 -> 0.133.0 has no added/removed anchors.
- Included one mechanical Biome formatting fix in `scripts/compile-system-prompt-l0.test.mjs` because full `pnpm check` was red on origin/main without it.

## Why

F203 Phase E weekly audit detected Codex drift (`0.130.0` -> `0.133.0`) but `--diff` failed before it could inspect anchors. Root cause was not a missing platform package; the installed package exists, but Codex 0.133 moved the native binary path to `vendor/<triple>/bin/codex`.

## Original Requirements

> CLI 升级 -> `--diff` -> 新 functional anchor 就补 L0 §2（走 SOP）-> `--emit` 归档新版本。
> 不重拆 = 静默丢能力。

- 来源：`cat-cafe-skills/refs/cc-system-prompt-audit-sop.md`
- 请对照上面的摘录判断交付物是否恢复了 Phase E audit workflow。

## Tradeoff

I did not reinstall Codex globally. The local install was valid according to the 0.133 launcher, so changing the audit script to follow the launcher layout is the durable fix. I kept the legacy path as fallback for older installs.

## Architecture Ownership

Architecture cell: none (tooling/audit script only)
Map delta: none
Why: No runtime boundary, store, queue, router, adapter, dispatcher, binding, or ownership cell changed.

Please check:

- Diff matches `Map delta: none`.
- Candidate path order really matches `/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js` 0.133 behavior.
- Keeping both `bin` and legacy `codex` layouts does not mask a genuinely missing platform package.

## Open Questions

### 技术 OQ（给 reviewer）

- Is the candidate list order correct for all three resolution layers: Node-resolved package, hardcoded nested package, and local vendor fallback?
- Should the archive source text stay as `strings $(which codex)` even though the script resolves through the launcher to the native binary?

### 价值 OQ（给 CVO，如有）

无。

## Next Action

Please review the branch. If approved, I will enter merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f203/opus47`
- Start Command: no service start needed; run the script/test commands below.
- Ports: n/a (no web/api server; do not use 3001/3002)

## 自检证据

### Spec 合规

- Codex drift was inspected after fixing the path resolver.
- Diff result: `{"added":[],"removed":[],"changed":[]}`.
- L0 §2 carry-over: not needed, because there are no new functional anchors.
- Archive emitted: `docs/audits/codex-system-prompt-v0.133.0.md`.
- Dogfood: ran real `--diff`, `--emit`, and `--check` against installed Codex 0.133.0.

### 测试结果

```bash
node --test packages/api/test/audit-cc-system-prompt.test.js
# 18 passed, 0 failed

node scripts/audit-claude-code-system-prompt.mjs --cli codex --diff docs/audits/codex-system-prompt-v0.130.0.md
# {"added":[],"removed":[],"changed":[]}

node scripts/audit-claude-code-system-prompt.mjs --cli codex --check
# codex: live=0.133.0 archived=0.133.0 drift=false

node scripts/audit-claude-code-system-prompt.mjs --cli claude --check
# claude: live=2.1.150 archived=2.1.150 drift=false

pnpm check
# passed
```

### 相关文档

- SOP: `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md`
- Feature: `docs/features/F203-native-system-prompt-l0.md`
- Archive: `docs/audits/codex-system-prompt-v0.133.0.md`

