---
feature_ids: [F192]
topics: [harness-eval, sop-compliance, review-request]
doc_kind: mailbox
---

# Review Request: feat(f192) wire eval:sop live publish path

Review-Target-ID: f192-sop-wiring
Branch: feat/f192-sop-wiring

## What

Wire the 3-piece eval:sop publish pipeline so `cat_cafe_publish_verdict` no longer returns 501 for this domain:

1. **SopTraceSourceSelector** — new discriminated union variant (`kind: 'sop-trace-eval'`) in `types.ts` + validation in `validation.ts`
2. **File-writer layer** — `eval-sop-live-verdict.ts` writes bundle (snapshot + attribution + provenance JSON), raw inputs (trace + eval-results JSON), verdict.md
3. **Generator adapter + wiring** — `sop-generator-adapter.ts` validates → builds trace → evaluates → writes; registered in `index.ts` verdictGenerators + `PUBLISH_VERDICT_INSTRUCTIONS_SOP` in `eval-cat-invocation.ts`

Re-enables `eval-sop.yaml` (removes `enabled: false`) after 2-week sunset (2 silent weekly fires with 0 verdict).

## Why

eval:sop was sunset on 2026-06-06 because the publish pipeline wasn't wired — weekly cron fired but had nowhere to send verdicts (501). This PR completes the last piece: now the SOP compliance eval domain can produce real verdicts through the same `cat_cafe_publish_verdict` MCP tool as eval:a2a and eval:memory.

## Original Requirements（必填）

> E-sop 的 schema / registry / predicate evaluator 是已合并事实；"weekly eval cat 产 violation verdict + re-eval closure"不是当前事实。`docs/harness-feedback/eval-domains/eval-sop.yaml` 已用 `enabled: false` sunset weekly pickup，BACKLOG `F192-sop-wiring` 是恢复 live path 的单独 P2 工作。

- 来源：`docs/features/F192-socio-technical-harness-eval.md` (Truth sync 2026-06-09, line 269)
- AC-E20 (line 261): "真实 re-enable 条件：SopTrace producer + file-writer layer + publish-verdict instructions/generator 三件套"
- **请对照上面的摘录判断交付物是否解决了 eval:sop 无法产出 live verdict 的问题**

## Tradeoff

- **Embed full SopTrace in sourceRefs** vs persist to store: SOP traces are small (< 10 KB) and no persistent SOP trace store exists (unlike task-outcome SQLite or memory API). Embedding is simpler and keeps the selector self-contained for deterministic replay. Reviewer: is the trace size assumption reasonable?
- **Direct bundle refs** vs reuse `resolveA2aEvidenceBundle`: a2a bundle schema requires `evalSnapshotId`, `window`, `components` that SOP bundles don't have. Building refs directly (`bundle:{verdictId}/snapshot`) avoids forcing SOP data into an a2a shape.

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: eval:sop is a new domain instance within the existing harness-eval cell — same registry / invocation / verdict / handoff patterns as eval:a2a and eval:memory. No new cell or boundary change.

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **SopTraceSourceSelector 嵌入完整 trace**: trace 对象通常 < 10 KB，但如果 commands 数组很大理论上可以膨胀。是否需要加 size guard？
2. **`parseVerdictHandoffPacket` 重写 evidencePacket refs**: file-writer 用已验证的 packet schema 重新 parse 来注入 bundle refs，而不是 raw object spread。这确保 schema 一致性，但如果 packet 结构演进可能需要同步更新。Reviewer 是否认为这个 coupling 可接受？

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码正确性，特别关注：
- `publish-verdict.ts` 中 `isSopSourceRefs` 分支的位置和优先级
- `sop-generator-adapter.ts` 的错误路径（kind 不匹配 / definition 不存在）
- `eval-sop-live-verdict.ts` 文件写入路径是否与其他 domain (memory) 保持一致模式

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192-sop-wiring/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

AC-E20 (publish pipeline wired): ✅ verdictGenerators + PUBLISH_VERDICT_INSTRUCTIONS registered
AC-E24 (re-eval closure prerequisite): ✅ eval:sop re-enabled, can now produce live verdicts
eval-sop.yaml re-enabled: ✅ `enabled: false` removed with documented re-enable conditions

### 测试结果

```
pnpm check                              # 22/22 checks passed (13246ms)
sop-generator-adapter.test.js           # 9 passed, 0 failed
eval-domain-daily.test.js               # 15 passed, 0 failed
pnpm biome check                        # 0 errors
```

### 根目录工件闸门

```
git status --short | rg root-artifacts   # (empty)
git diff --name-only origin/main...HEAD | rg root-artifacts  # (empty)
```

### 相关文档

- Plan: `docs/plans/2026-05-27-f192-e-sop.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- PR: #2186

### 如果判断错了我最可能错在哪

1. `parseVerdictHandoffPacket` 重 parse 可能在 packet schema 演进后 break — 但其他 domain generator 也这么做
2. `generateSopLiveVerdict` 的 `repoRoot = dirname(dirname(harnessFeedbackRoot))` 假设了目录层级 — 如果 harnessFeedbackRoot 的嵌套深度变了，raw inputs 写到错误位置
3. 是否遗漏了 `isSopDefinitionId()` 对动态注册 SOP 定义的支持（当前只查 shared catalog 的静态定义）

[宪宪/claude-opus-4-6🐾]
