---
feature_ids: [F192]
topics: [harness-engineering, eval, harness-feedback]
doc_kind: plan
created: 2026-05-07
---

# Harness Feedback

对 harness（skill、SOP、MCP tool、shared rules）的结构化使用反馈。

## `doc_kind: harness-feedback`

本目录下的文档使用 `doc_kind: harness-feedback`，是独立于 feature/discussion 的 doc type。

### 为什么不是 discussion？

- harness feedback 是对**系统本身**的使用反馈，不是某个 feature 的普通讨论
- 需要被 `search_evidence` 单独索引、过滤、统计
- 后续 monthly digest / sunset audit / tool eval 都按 doc type 聚合
- feature spec 只挂链接，避免 spec 越滚越大

### Frontmatter Schema

```yaml
---
doc_kind: harness-feedback
feedback_type: cat-user | feature-fit-review | tool-eval | sunset-signal | cvo-correction | trace-fixture | trace-bundle | cat-interview
feature_id: F167
thread_ids: []
session_ids: []
cats: []
primary_failure_class: vision_gap | translation_gap | harness_misfit | tool_gap | execution_gap | environment_drift | taste_gap | none
status: candidate | accepted | rejected | resolved | superseded
created: 2026-05-07
---
```

### Authority Boundary

**本目录的文档是 trace 数据的解释层和标注层，不是 trace 的定义层。**

- harness-feedback docs 只存 **annotations + evidence_refs**，不存 raw trace 副本
- Feature Trace Bundle 是从 F153 canonical trace 派生的 **derived view**
- 所有 trace identifiers 和 redaction rules defer to F153 / ADR-032
- `trace_refs` / `evidence_refs` 指向 canonical thread/session/invocation ID，不复制 raw tool-call payload
- 如果 F192 被 sunset，只需删除本目录——不影响 ADR-032 的 export pipeline

### Scanner & Indexing

CatCafeScanner 将 `docs/harness-feedback/` 映射为 `lesson` EvidenceKind。

**当前限制**：search_evidence 不支持按 `doc_kind` 单独过滤（EvidenceKind 只有 lesson/feature/decision 等粗粒度）。要找 harness-feedback，搜 `"harness-feedback"` 或 `"harness friction"` 关键词。未来如需独立 EvidenceKind，需改 `interfaces.ts` + `CatCafeScanner.ts`。

### 子目录

```
docs/harness-feedback/
├── README.md                    # 本文件
├── bundles/                     # Feature Trace Bundle（trace-bundle）
├── fixtures/                    # Trace fixtures（trace-fixture）
├── interviews/                  # Cat interview samples（cat-interview）
├── reviews/                     # Feature Fit Review（feature-fit-review）
├── tool-evals/                  # MCP 工具 eval contract（tool-eval）
└── YYYY-MM-DD-Fxxx-*.md         # 按 feature + 日期命名的反馈文档（cat-user）
```

### 相关文档

- [F192 Spec](../features/F192-socio-technical-harness-eval.md)
- [社会技术 Eval 草案](../discussions/2026-05-05-socio-technical-harness-eval-draft.md)
- [ADR-031 Harness Engineering](../decisions/031-harness-engineering-methodology.md)
- [ADR-032 Local-First Trace Enabler](../decisions/032-cat-cafe-as-local-first-trace-enabler.md)
