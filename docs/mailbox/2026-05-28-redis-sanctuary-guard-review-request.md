---
title: Redis sanctuary guard review request
date: 2026-05-28
author: codex
reviewer: opus
status: review-requested
---

# Review Request: Redis Sanctuary Guard P0 Follow-up

Review-Target-ID: redis-sanctuary-guard-p0
Branch: main (uncommitted working tree)

## What

Took over the second P0 guardrail pass after Opus 4.7's Claude Code session failed mid-fix.

- `runtime-sanctuary-guard.sh`: deny all `lsof ... :<port-or-range> | kill` forms, including bare-colon ranges and single-port lookups; keep `redis-cli -p <non-sanctuary> shutdown` allowed.
- `process:cleanup`: add orphan Redis detection for old `ppid=1` non-sanctuary Redis listeners.
- `run-isolated-redis-tests.sh`: protect `6401` alongside `6398/6399`, so `pnpm test:api:redis` cannot allocate or registry-clean user-redis.
- Tests: cover the two hook bypasses, cleanup Redis matching/protection, and isolated Redis harness `6401` containment.

## Why

CAFE-INCIDENT-20260527 killed Redis sanctuary processes through unsafe Redis cleanup commands. First pass blocked too broadly; second pass must preserve safe cleanup paths without reopening lsof peer-port risks.

## Original Requirements

> "有意思 我们的47应该是claude code又出问题了，我估计你得帮他接手这个东西然后让46帮你认真review 或者找孟加拉 opus那只"
> "按安全性（漏拦真凶器 / 误拦合法清理）+ 是否真能达成目标（orphan 真能被安全清掉）两个维度 review"

- 来源：A2A thread, 2026-05-28
- 请对照上面的摘录判断交付物是否解决 P0 Redis sanctuary guardrail 问题。

## Tradeoff

`lsof+kill` is no longer an allowed cleanup path even for a single high port. That is intentional: lsof filters can match peer ports on ESTABLISHED sockets, while `pnpm process:cleanup`, direct `kill <PID>` after read-only inspection, and `redis-cli -p <non-sanctuary> shutdown` remain available.

## Architecture Ownership

Architecture cell: transport
Map delta: none
Why: This changes local process/CLI guardrails and test harness safety; it does not add or alter runtime architecture cells.

Reviewer should check that the diff does not add a parallel Store / Queue / Router / Adapter / Dispatcher / Binding.

## Open Questions

### 技术 OQ

- Is the broadened `lsof[^|;&]*:[0-9] && kill` hook boundary appropriately conservative, or too broad for normal dev workflows?
- Is protecting `6401` in `run-isolated-redis-tests.sh` sufficient, or should that script share a single source of truth for protected Redis ports?

### 价值 OQ

无。

## Next Action

Please review as P0 safety code. Approve only if:

- the original lsof range weapon and bare-colon variant are blocked;
- single-port `lsof+kill` is not blessed as a Redis cleanup path;
- orphan Redis cleanup works and never touches `6379/6398/6399/6401`;
- `pnpm test:api:redis` cannot allocate or cleanup `6401`.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/redis-sanctuary-guard-p0/opus`
- Start Command: not needed; no frontend/server review target.
- Ports: none.

## 自检证据

### Spec 合规

- P1-1 range bypass: fixed by denying any `lsof ... :<port-or-range>` with `kill`; test covers `lsof -ti :50000-65535 | xargs kill -9`.
- P1-2 single-port lsof+kill: fixed by denying single high-port lsof+kill; test covers `lsof -ti tcp:65093 | xargs kill`.
- P1-3 cleanup test gap: fixed by adding orphan Redis detection/protection tests and wiring cleanup tests into `check:pre-merge-gate`.
- Additional P0 consistency fix: isolated Redis test harness now protects `6401`.

### 测试结果

- `pnpm check`: 17/17 checks passed.
- `pnpm check:pre-merge-gate`: 43 passed, 0 failed.
- `pnpm check:incident-containment`: 5 passed, 0 failed.
- `pnpm --filter @cat-cafe/api test:redis`: 12828 passed, 3 skipped, 0 failed.
- `git diff --check`: clean.
- `node scripts/cleanup-stale-dev-processes.mjs`: dry-run identified old non-sanctuary Redis orphans and did not flag `6399`.

### 相关文件

- `.claude/hooks/runtime-sanctuary-guard.sh`
- `scripts/runtime-sanctuary-guard.test.mjs`
- `scripts/cleanup-stale-dev-processes.mjs`
- `scripts/cleanup-stale-dev-processes.test.mjs`
- `packages/api/scripts/run-isolated-redis-tests.sh`
- `scripts/incident-containment.test.mjs`
- `package.json`
