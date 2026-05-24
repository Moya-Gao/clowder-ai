# Review Request: F192 E-scale — eval:memory adapter (AC-E11~E13)

Review-Target-ID: f192
Branch: feat/f192-e-scale

## What

Generalize the F192 eval infrastructure from `eval:a2a`-only to multi-domain, and wire up `eval:memory` as the second domain. Three AC covered:

- **AC-E11**: `eval:memory` adapter — consumes F200 RecallMetrics + F188 LibraryHealth → standard VerdictHandoffPacket
- **AC-E12**: Bidirectional jump links — Eval Hub verdict card → `/memory/health`, HealthReport footer → `/settings?ops=observability&obs=eval`
- **AC-E13**: Legacy scheduled-task inventory + dry-run cleanup for `memory-recall-digest`, proving no double-trigger

Key changes across 8 TDD commits (937 insertions, 50 deletions, 17 files):

1. `eval-domain-registry.ts` — domainId union `eval:a2a | eval:memory`, sourceAdapter union, featureId regex
2. `eval-cat-invocation.ts` — domain-aware eval cat instructions
3. `eval-a2a-artifact-resolver.ts` — featureId regex generalized from F167 literal
4. `verdict-handoff.ts` — domainId union
5. `eval-memory-adapter.ts` — NEW ~201 lines, transforms RecallMetrics + LibraryHealth → VerdictHandoffPacket
6. `eval-memory.yaml` — NEW domain registry entry
7. `eval-hub-read-model.ts` — single-domain → multi-domain: `loadDomain()` → `loadDomains()` scanning all `eval-domains/*.yaml`
8. `HubEvalTab.tsx` — conditional `Memory Health` link for `eval:memory` items
9. `HealthReport.tsx` — `Eval Hub` backlink in footer

## Why

F192 Phase E build sequence: E-pilot (done) → E-hub (PR #1878 merged) → **E-scale (this PR)** → E-sop → E-community. Per KD-16 PR packaging decision, E-scale is owned by 宪宪, E-hub was owned by 砚砚.

This PR makes the eval infrastructure genuinely multi-domain — the read model, registry, and handoff contracts all work with N domains, not just `eval:a2a`.

## Original Requirements（必填）

> 铲屎官原话（2026-05-21 kickoff）：
> "对 harness 的运行效果做长期追踪和解释，产出 delete / build / fix / keep 的证据化 verdict，并把诊断交给负责 feature 的猫处理，再由后续 eval 验证。"
> "接入完成后要清理 F192 等遗留定时任务，避免双触发。"
> "delete 还有一种情况是 sunset，比如猫猫变强了，不需要了。"

- 来源：`docs/discussions/2026-05-21-f192-phase-e-eval-hub-kickoff/README.md`
- Spec：`docs/features/F192-socio-technical-harness-eval.md` § Phase E / E-scale
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `eval-memory-adapter` 消费 F200 RecallMetrics + F188 LibraryHealth 的**类型签名**，不 import 它们的内部实现。如果 F200/F188 接口变化，adapter 层会 fail-fast
- Jump links 用硬编码路由（`/memory/health`、`/settings?ops=observability&obs=eval`）而非动态 discovery。这是因为现有路由已稳定，且 Eval Hub 已有类似模式（domain thread link, related traces link）
- Legacy task cleanup 只做 dry-run + inventory，不自动 disable。自动 disable 需要 CVO signoff（避免无通知停服务）

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: 所有改动都在 harness-eval cell 内部扩展（eval-domain-registry, eval-hub-read-model, verdict-handoff, adapters）。没有新建并行 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `eval-hub-read-model.ts` 的 `loadDomains()` 每次调用都 `readdirSync` 扫 `eval-domains/` 目录。当前只有 2 个域文件，性能无影响。如果未来域数增长，是否需要缓存？（我认为 ≤10 域不需要）
2. `eval-memory-adapter.ts` 对 RecallMetrics 和 LibraryHealth 输入的 Zod schema 是否足够严格？目前验证了核心字段，optional 字段用 `.passthrough()`

### 价值 OQ（给 CVO，如有）

无。技术选择均可回滚、无不可逆操作。

## Next Action

请 review 代码变更（17 files, 937+/50-），重点关注：
1. `eval-memory-adapter.ts` 的 transform 逻辑是否正确消费了 F200/F188 数据
2. `eval-hub-read-model.ts` 多域扫描的 error handling（unknown domain_id 抛错是否合理）
3. 前端 jump link 路由是否正确
4. legacy-task-cleanup dry-run 测试覆盖是否充分

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f192/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（由 review:start 自动分配）

## 自检证据

### Spec 合规

Quality Gate 通过：
- Step 0 愿景对照：AC-E11~E13 与铲屎官原始需求（verdict 证据化、legacy cleanup 防双触发、F188 repair surface 双向跳转）对齐
- Step 2.5 Follow-up tail scan：clean，无 deferred/follow-up 关键词
- Step 2.6 Fallback layer check：triggered on directory filters，justified（standard defensive programming）
- Step 2.7 Architecture ownership：cell=harness-eval, delta=none, warning about `sourceAdapter` noun is expected
- Step 5 PEN check：无 F192 .pen 文件，jump links only（⚠️ 无设计稿，跳过对照）
- Step 7.5 Artifact hygiene：clean（工作树 + 已提交差异均无根目录媒体工件）
- Step 4.5 Dogfood：🆗 可豁免（理由：纯内部 eval infrastructure，非 user/cat 可感知路径。adapter/registry/read-model 是后端数据管道，jump links 是 HTML anchor 不需要运行时验证）
- Hotfix check：not a hotfix

### 测试结果

```
pnpm --filter @cat-cafe/api test  → harness-eval: 152/152 pass ✅
  (AgentRouter/AntigravityAgentService/F201/Codex MCP failures pre-exist on origin/main)
NODE_ENV=test pnpm --filter @cat-cafe/web test → HealthReport + HubEvalTab tests pass ✅
pnpm lint                         → 0 errors ✅
pnpm check                        → 0 errors ✅ (biome format + lint + all sub-checks)
pnpm -r --if-present run build    → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-05-24-f192-e-scale.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Discussion: `docs/discussions/2026-05-21-f192-phase-e-eval-hub-kickoff/README.md`

---

[宪宪/Opus-47🐾]
