---
feature_ids: [F192]
doc_kind: note
created: 2026-05-07
---

# Review Request: F192 Phase A — Harness Eval Skeleton

Review-Target-ID: f192
Branch: feat/f192-harness-eval-skeleton

## What

4 commits 建立 harness-feedback 基础骨架：

1. `docs/harness-feedback/` 目录 + README（doc_kind 规范 + authority boundary）
2. CatCafeScanner KIND_DIRS 加 `'harness-feedback': 'lesson'` + inferKind 识别
3. 样例 harness-feedback 文档（F167 ball-drop friction）
4. feat-lifecycle Step 0.6 Harness Eval Checkpoint

## Why

harness 改动后无法追踪效果，猫猫作为 harness 一线用户没有结构化反馈通道。本 Phase 建最轻量的骨架让 doc type 存在、被索引、在 feat close 时被触发。

## Original Requirements（必填）

> 铲屎官（2026-05-07 03:00）：这个我们要不要正式立项来做啊？有很多其实应该是涉及skills 的修改等等？
> 铲屎官（2026-05-06 01:15）：我们必须有 tracing...可选环节采访猫猫的干活体验是否才是不污染工作上下文且是一个持续性评估的可靠扩展点？

- 来源：thread 对话历史（2026-05-05 ~ 2026-05-07 AHE teardown + socio-technical eval 讨论）
- **请对照上面的摘录判断：(1) harness-feedback doc type 是否建立了结构化反馈通道 (2) Step 0.6 是否在 feat close 时提供了不污染工作上下文的评估扩展点**

## Tradeoff

- `harness-feedback` 映射到 `lesson` EvidenceKind 而非新建独立 kind——减少改动面，代价是 search_evidence 不能按 kind 精确过滤（需用关键词搜）。README 已记录此限制。
- 样例文档用已知的 F167 friction（ball-drop）而非虚构案例——真实数据更有说服力，但 thread_ids/session_ids 暂留空（Phase B pilot 时填充）。

## Architecture Ownership（必填）

Architecture cell: memory-indexing（CatCafeScanner KIND_DIRS）
Map delta: none
Why: 只加了一行 KIND_DIRS 映射 + 一行 inferKind case，无新 boundary/owner/extension point

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding → 无
- 是否修改 cells/*.md → 无

## Open Questions

1. **AC-A2 doc_kind 可见性**：当前 search_evidence 返回的 kind 是 `lesson`，doc_kind 需要从 frontmatter 推断。README 已记录限制——reviewer 判断这个 trade-off 是否足够，还是需要在 Phase C 加独立 EvidenceKind。
2. **Step 0.6 位置**：放在 Step 0.5（反思胶囊）和 Step 1（CloseGateReport）之间——reviewer 判断这个位置是否和草案意图一致。

## Next Action

请 review 4 个 commit 的实现是否满足 AC-A1~A6。重点看：
- CatCafeScanner 改动是否最小且无回归
- 样例文档是否符合"derived view, not source of truth"约束
- Step 0.6 文本是否完整覆盖 AC-A3 的要求

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192/codex`
- Start Command: `pnpm review:start`
- Ports: 不需要起服务——纯 docs + scanner 改动，`node --test test/memory/cat-cafe-scanner-recall.test.js` 验证即可

## 自检证据

### Spec 合规

| AC | Evidence | Status |
|---|---|---|
| AC-A1 | `docs/harness-feedback/README.md` 含 doc_kind 规范 | ✅ met |
| AC-A2 | KIND_DIRS + inferKind + scanner test 3/3 pass | ✅ met |
| AC-A3 | Step 0.6 含 trigger conditions, none+reason, isolated interview, doc linking | ✅ met |
| AC-A4 | `2026-05-07-F167-ball-drop-friction.md` 样例文档 | ✅ met |
| AC-A5 | README 明确 annotations + evidence_refs only, no raw trace | ✅ met |
| AC-A6 | 样例文档 evidence_refs 指向 feedback memories + F167 KD-25 | ✅ met |

### 测试结果

```
cat-cafe-scanner-recall.test.js: 3 pass, 0 fail (691ms)
biome check CatCafeScanner.ts: clean, no fixes applied
```

### 相关文档

- Plan: `docs/plans/2026-05-07-f192-phase-a-harness-eval-skeleton.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Discussion: `docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`
- ADR: `docs/decisions/031-harness-engineering-methodology.md`, `docs/decisions/032-cat-cafe-as-local-first-trace-enabler.md`
