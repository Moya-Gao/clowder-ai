---
feature_ids: [F218, F192, F203]
topics: [source-hygiene, review-request]
doc_kind: review-request
created: 2026-05-31
---

# Review Request: F218 Phase A source hygiene guardrails

Review-Target-ID: f218
Branch: feat/f218-source-hygiene
Implementation Commit: 666b11da6

## What

Implemented the F218 Phase A shared-layer guardrails:
- Added `source-audit` skill and project skill mount.
- Upgraded L0 §2 with compact source-hygiene and `soft + hard + eval` harness triggers.
- Added deep-research source-provenance template hooks.
- Added feat-lifecycle Eval Contract teaching for the ADR-031 method.
- Added the MemU echo-chamber fixture to `eval:capability-wakeup`.
- Added `check:source-hygiene` wiring and L0 test coverage.

## Why

High-risk external claims were reaching planning/docs with weak provenance. F218 adds the middle layer between casual search and full deep-research: lightweight claim audit, source mix checks, conflict-of-interest checks, and an eval fixture so the behavior is testable.

## Original Requirements（必填）

> F218 所有交付物放共享层；不放 CLAUDE.md / AGENTS.md / GEMINI.md。
> L0 §2 加一句话："harness 改动三层：软+硬+eval，详见 ADR-031"。
> feat-lifecycle skill 的 Eval Contract 门禁从 checkbox 升级为带教学段落。
- 来源：cross-thread handoff `thread_mpndq0ztqnl307f9` + `docs/features/F218-evidence-provenance-source-hygiene.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

- Provenance output stays text/Markdown only; rich block provenance is deferred.
- L0 only carries compact triggers; detailed method stays in shared skills and refs to protect token budget.
- `check:skills` full mount audit is not used as a blocking gate here because this environment still has existing Kimi mount anomalies; `check:skills:manifest` is green.

## Architecture Ownership（必填）

Architecture cell: `harness-eval`
Map delta: none
Why: This changes shared prompt/skill/docs/eval fixture wiring and does not create a new Store / Queue / Router / Adapter / Dispatcher / Binding.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. L0 §2 新增内容是否足够触发 `source-audit`，同时不过度占用系统提示词预算。
2. `source-audit` 的触发范围是否覆盖日常 WebSearch 风险 claim，但不把所有轻量查询都升级成 deep-research。
3. MemU fixture 是否足够代表这次污染事故的失败模式。

### 价值 OQ（给 CVO，如有）

无。F218 的新增范围来自铲屎官 signoff，具体实现是共享层内可回滚文本/测试改动。

## Next Action

请 Opus review 后给明确结论：放行 / 退回 + findings。重点看共享层位置、L0 token 预算、source-audit 触发器、eval fixture 是否能防同类事故。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f218/opus`
- Start Command: `pnpm review:start`
- Ports: 由 `review:start` 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

- AC-A1/A2/A3/A4/A6/A7: checked in `docs/features/F218-evidence-provenance-source-hygiene.md`.
- KD-6: zero per-family divergence; implementation landed in shared L0, shared skills, shared refs, and eval fixture.
- KD-8: L0 truth source changed with compile test coverage.

### 测试结果

```
node scripts/f218-source-hygiene.test.mjs
  pass 1, fail 0

node --test scripts/compile-system-prompt-l0.test.mjs
  pass 50, fail 0; all cats <= 5600 tokens

pnpm check:source-hygiene
  pass

pnpm check
  pass

pnpm lint
  pass; existing warnings only

pnpm test
  pass; web summary: 439 files / 3624 tests passed; command exited 0

pnpm check:skills:manifest
  PASS 43 skills; 5 existing advisory MCP warnings

git diff --check
  pass

node scripts/check-fallback-layers.mjs
  only +1 fallback pattern in compile-system-prompt-l0.test.mjs; threshold not triggered

root artifact gate
  no root media/design artifacts in worktree or origin/main...HEAD diff
```

### 相关文档

- Feature: `docs/features/F218-evidence-provenance-source-hygiene.md`
- Skill: `cat-cafe-skills/source-audit/SKILL.md`
- Fixture: `docs/harness-feedback/fixtures/source-hygiene-memu-echo-chamber.md`
- Eval domain: `docs/harness-feedback/eval-domains/eval-capability-wakeup.yaml`
