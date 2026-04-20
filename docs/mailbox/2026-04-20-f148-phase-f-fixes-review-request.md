---
doc_kind: review-request
created: 2026-04-20
---

# Review Request: F148 Phase F Fixes — excerpt cleanup + navigation telemetry

Review-Target-ID: f148-phase-f-fixes
Branch: feat/f148-phase-f-fixes

## What

Two changes from Phase F verification findings:

1. **P3 fix**: `extractBatonContext` excerpt now strips ALL `@mentions` (was only stripping `@targetCatId`). Multi-mention messages like `@opus @gemini 帮我看看` previously left `@gemini` in the excerpt.
2. **Telemetry**: Added `f148: 'navigation-header'` log in `assembleIncrementalContext` per cat — captures `catId`, `hasBaton`, `taskCount`, `headerLength`, `unseenCount`, `batonCandidateCount`. For diagnosing the Gemini P1 (navigation header not received in parallel routing) if it recurs.

## Why

铲屎官 restarted runtime and ran live verification with all cats. Found:
- P3: Multi-mention excerpt residual `@mentions` (GPT-5.4 flagged)
- P1: Gemini reported not receiving `[导航]` block — exhaustive code investigation showed all paths are correct (route-parallel, route-serial, ACP adapter all inject navigation header identically). Root cause likely transient runtime state or model behavior. Telemetry added to diagnose.

## Original Requirements

> "还有砚砚说的能够优化的 你总结一下" — 铲屎官 2026-04-19
> "先完成f f完成清楚我们再继续下面的一大块？" — 铲屎官 2026-04-19

- 来源：runtime 验证对话（2026-04-19 18:28-19:07）
- **请对照验证发现判断交付物是否修复了已知 P3 + 增加了 P1 可观测性**

## Tradeoff

- Gemini P1 没有找到代码 bug，选择加 telemetry 而非盲改（code change without evidence = 更大风险）
- Excerpt 用 `/@[\w-]+/g` 全量剥���，aggressive 但 cat café 消息中 `@` 只用于 mentions

## Open Questions

1. `/@[\w-]+/g` 是否过于 aggressive？会不会误剥离非 mention 的 `@` 内容？（实际场景中几乎不存在）
2. Telemetry log 字段是否足够诊断 Gemini P1？是否需要增加 cursor 值？

## Next Action

请做 P1/P2 review（纯后端，3 文件 59 行变更）。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f148-phase-f-fixes/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: reviewer 沙盒自动分配（3201/3202 起）

## 自检证据

### Spec 合规
- AC-F1~F7 全部 ✅（Phase F 原功能 PR #1286 已 merged）
- 本 PR 修 P3 + 加 telemetry，不改变 AC 状态

### 测试结���
- `pnpm test` → 8796 pass, 0 fail ✅
- `pnpm biome check --diagnostic-level=error` → 0 errors ✅
- `tsc` → 0 new errors（pre-existing @types/ only）
- `node --test packages/api/test/f148-navigation-context.test.js` → 29/29 pass ✅（含 2 新 P3 测试）

### Artifact Hygiene
- 根目录媒体工件（工作树 + 已提交差异）：无 ✅

### 相关文档
- Feature: `docs/features/F148-hierarchical-context-transport.md`
- Phase F AC: AC-F1~F7
