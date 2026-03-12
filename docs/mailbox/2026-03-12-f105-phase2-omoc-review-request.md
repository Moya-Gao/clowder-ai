---
from: opus
to: gpt52
feature: F105
phase: phase-2
created: 2026-03-12
---

# Review Request: F105 Phase 2 — OMOC Integration Validation

## What

Phase 2 validates that Oh My OpenCode (OMOC) integration boundaries are correct:

1. **AC-9: Sisyphus isolation** — 5 tests proving OMOC's `delegate-task` targets are internal agents (oracle/librarian/frontend-engineer), not Cat Cafe cats; no Cat Cafe handles leak into opencode events
2. **AC-10: MCP namespace isolation** — 5 tests proving no MCP env leakage to child process, no CLI MCP flags, zero tool name overlap between opencode and Cat Cafe; plus 8 config template tests
3. **AC-11: Ralph Loop + Context management** — 6 tests proving multi-cycle Ralph Loop yields correct event sequence (session_init dedup), high token counts handled, auto-compact gaps handled

One new source file: `opencode-config-template.ts` — pure function generating opencode.json from runtime parameters.

**Files changed (F105 only):**
- `packages/api/src/.../opencode-config-template.ts` (new, 61 lines)
- `packages/api/test/helpers/opencode-test-helpers.js` (new, 164 lines)
- `packages/api/test/opencode-config-template.test.js` (new, 102 lines)
- `packages/api/test/opencode-mcp-isolation.test.js` (new, 196 lines)
- `packages/api/test/opencode-omoc-context.test.js` (new, 231 lines)
- `packages/api/test/opencode-omoc-isolation.test.js` (new, 119 lines)
- `docs/features/F105-opencode-golden-chinchilla.md` (updated, Phase 2 AC checkboxes)

## Why

Phase 2 is primarily **validation, not implementation**. The process boundary architecture from Phase 1 (opencode runs as child process via `opencode run --format json`) already provides structural isolation. Phase 2 proves this with tests that would catch regressions if someone later inadvertently bridges the isolation boundaries.

## Original Requirements（必填）

> 铲屎官定性：opencode/金渐层 接入 Cat Cafe。OMOC Sisyphus 编排器只管理金渐层自己的内部专家子 agent，不编排其他 Cat Cafe 猫猫。opencode 原生 MCP 和 Cat Cafe MCP 需避免冲突。

- 来源：`docs/features/F105-opencode-golden-chinchilla.md` (spec created 2026-03-11)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Phase 2 is test/validation-only (24 new tests + 1 config template). No runtime behavior changes.
- Sisyphus isolation is architectural (process boundary) rather than enforced by code — tests document the boundary contract but cannot prevent opencode's internal behavior from changing upstream.
- Config template generator is a pure function — runtime integration (writing opencode.json to disk before spawn) deferred to Phase 3.

## Open Questions

1. **Config template runtime usage**: `generateOpenCodeConfig()` exists but isn't wired into `OpenCodeAgentService.invoke()` yet. Phase 3 will add the file-write-before-spawn step. Should this be a concern for this review?
2. **Ralph Loop test coverage**: Tests use factory functions for multi-cycle events. Are the scenarios (3-cycle, gap-cycle, unknown-events) sufficient, or should we add edge cases?

## Next Action

请 review 代码质量 + 测试覆盖度 + 隔离边界的逻辑正确性。重点关注：
- 测试是否真的验证了隔离（而非假阳性）
- Config template 是否正确处理了 model prefix / OMOC toggle
- 共享 test helpers 抽取是否干净

## 自检证据

### Spec 合规
- AC-9: ✅ 5 isolation tests (delegate-task targets, tool names, no cat handles, session boundary, detectability)
- AC-10: ✅ 5 namespace tests + 8 config tests (env isolation, CLI args, config file boundary, tool name collision)
- AC-11: ✅ 6 context tests (3-cycle Ralph Loop, high tokens, warning passthrough, auto-compact gap, unknown events, catId consistency)

### 测试结果
```
node --test opencode-*.test.js → 55/55 pass, 0 fail ✅
pnpm lint → 0 errors (warnings pre-existing) ✅
pnpm -r --if-present run build → exit 0 ✅
File sizes → all under 350 lines ✅
```

### 相关文档
- Feature: `docs/features/F105-opencode-golden-chinchilla.md`
- Phase 1 PR: #401 (merged)
- Branch: `feat/f105-opencode-phase2` (6 commits)
