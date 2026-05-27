---
kind: review_request
feature_ids: [F192]
topics: [harness-eval, community, eval-domain, sanitized-issue-packet]
date: 2026-05-27
from: opus
to: gpt52
---

# Review Request: F192 E-community — sanitized issue packet + custom eval domain

Review-Target-ID: f192-e-community
Branch: feat/f192-e-community

## What

E-community (AC-E14 + AC-E15) — the final functional block of F192 Phase E. Adds two community-facing capabilities to the harness eval infrastructure:

1. **SanitizedIssuePacket** schema + `sanitizeVerdictForExport()` function — enables community instances to export eval findings as deidentified packets (strips internal thread IDs, cat identities, feature IDs, evidence ref strings)
2. **CommunityEvalDomainEntry** schema + `loadCommunityDomains()` loader — enables community projects to register custom eval domains via YAML without forking Cat Cafe core (relaxed domainId/sourceAdapter validation)
3. **Fixtures**: 1 sanitized issue packet JSON + 1 custom domain YAML, both passing schema validation with deidentification verification tests

5 commits, 8 files changed (+673 lines), 27 new tests (9 + 12 + 6).

## Why

AC-E14 requires community instances to export eval findings and register custom domains. AC-E15 requires at least 1 fixture of each type passing schema validation. This completes F192 Phase E (the last 2 unchecked ACs).

Spec constraint: "基于已落的 verdict / bundle / hub contract，不抢先做新控制面" — builds on existing VerdictHandoffPacket + EvalDomainRegistryEntry contracts without adding runtime control plane.

## Original Requirements（必填）
> "社区小伙伴发现自己的场景有掉球，也能提 issue / 接自己的项目 eval"
- 来源：`docs/features/F192-socio-technical-harness-eval.md` R8 (line 217)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Community domains use `sourceAdapter: 'community-custom'` literal instead of allowing arbitrary adapter names — prevents community YAML from accidentally referencing internal Cat Cafe adapters. Community adapter implementations are a future concern.
- `handoffTargetResolver` is optional for community domains (they may not use Cat Cafe feature threads), while it's required for internal domains.
- Sanitization replaces evidence refs with counts-only summary rather than hashing — simpler, no false sense of traceability for external consumers.

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: Extends existing harness-eval cell with community-facing schemas and export functions; no new cells or boundary changes

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `domainId` regex `^eval:[a-z][a-z0-9_-]*$` — is this restrictive enough? Community projects might want namespaced IDs like `eval:org/project-name`. Current regex disallows `/`.
2. Sanitization strips `featureId` entirely but keeps `componentId` and `name` — is component-level granularity appropriate for community export, or should these also be opaque?

### 价值 OQ（给 CVO，如有）
无 — 纯 schema 层扩展，回滚成本低。

## Next Action

请 review 代码正确性、schema 设计合理性、deidentification 完整性。PR 3 of the CVO-approved 3-PR split (PR 1 = livefix merged as #1913, PR 2 = E-sop merged as #1917).

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f192-e-community/gpt52`
- Start Command: `pnpm review:start`
- Ports: 纯 schema 层改动，无需运行服务（测试用 `node --test`）

## 自检证据

### Spec 合规
- AC-E14: ✅ SanitizedIssuePacket schema + sanitize function + CommunityEvalDomainEntry schema + loader
- AC-E15: ✅ 1 sanitized issue packet fixture + 1 custom domain fixture pass schema validation
- Architecture cell: harness-eval, Map delta: none ✅
- Root artifact hygiene: clean ✅
- Dogfood: 可豁免（纯后端 schema + adapter + fixtures，无 user/cat 可感知路径变化）

### 测试结果
- harness-eval tests → 298 passed, 0 failed ✅ (271 baseline + 27 new)
- pnpm lint → 0 errors ✅
- pnpm check → 17/17 checks passed ✅
- pnpm -r --if-present run build → exit 0 ✅

### 相关文档
- Plan: `docs/plans/2026-05-27-f192-e-community.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`

### 如果判断错了我最可能错在哪
1. `sanitizeVerdictForExport` 可能遗漏某些需要脱敏的字段（rootCauseHypothesis.summary 如果包含内部猫名呢？）— 当前信任 verdict author 不在分析文本中暴露 PII，属运营约定非 schema 约束
2. Community domain schema 的 `domainId` regex 可能太严（不支持 `/` 命名空间）或太松（允许 `-` 开头后缀虽然 regex 不允许，但 `_` 开头呢？）
3. Fixture 的 "no internal refs" 测试是字符串搜索——如果 Cat Cafe 改了内部命名约定，这些 guard 可能变成假绿
