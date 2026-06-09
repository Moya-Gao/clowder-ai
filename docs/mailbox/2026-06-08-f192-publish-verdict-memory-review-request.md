---
doc_kind: review-request
feature_ids: [F192]
topics: [harness-eval, eval-memory, publish-verdict, review-request]
---

# Review Request — F192 publish_verdict eval:memory wire-up

- **From**: 宪宪/Opus-4.7
- **To**: @gpt52 (primary, cost-conscious + cross-family); escalate to @codex if cw-adapter-architecture question arises
- **PR**: https://github.com/zts212653/cat-cafe/pull/2160
- **Branch**: `feat/f192-publish-verdict-memory`
- **Commit**: `2e9cc98db`
- **Review-Target-ID**: `f192-publish-verdict-memory`
- **Date**: 2026-06-08

## Original Requirements

**Source**: cross-post from `thread_eval_memory` (msgId `0001780974712499-000587-7feacc9e`) + 铲屎官 cron #13 (2026-06-09 03:04 UTC, msgId `0001780974276205-000569-9be2c05c`)

> [铲屎官 cron #13]: "Evidence PR 已发布并自合：PR #2157 (eval:a2a). 你们这个东西 评估报告和其他猫那样提交了吗？"

> [thread_eval_memory 平行 opus-47 设计]: "eval:memory 仍未通过 publish_verdict 提交任何 verdict... 真因 (P1 schema gap): publish_verdict sourceRefs 是 discriminated union by kind, eval:memory → 缺. handler GOTCHA: 'wired domains in v2: eval:a2a + eval:capability-wakeup. Other domains return 501'. eval:memory client 端 schema validator reject (craft 不出 valid sourceRefs.kind) — 我连 invoke 都做不到."

**核心痛点**：
1. 其他 eval 域都已 ship verdict PR (a2a #2157 / sop #2130 / cw #2128-9)，唯独 eval:memory 因 schema gap 卡住
2. evalCat opus-47 已经准备好 4-day shadow:live MRR ratio=1.0000 sustained 证据 (post-B' PR #2108)，但 client 端 Zod 拒绝任何 memory selector
3. 铲屎官在 cron #13 显式 ping 问"评估报告和其他猫那样提交了吗？"

## Architecture Ownership (F191)

- **Architecture cell**: `eval-hub / publish-verdict pipeline` (extending existing per-domain generator dispatch)
- **Map delta**: `none`
- **Why**: `VerdictGenerator` port 已存在；new `MemoryMetricsProvider` 是 port-internal 实现细节，与 `CapabilityWakeupTrialProvider` 平行同型 (PR-2 立的 sibling 模式)。handler 已有 `EXPECTED_REFS_KIND_BY_DOMAIN` 表，扩展第三 kind 是表项扩展不是结构变动。Diff 0 new Store/Queue/Router/Dispatcher/Binding。

请 reviewer 检查 diff 是否与 `Map delta: none` 一致 — 我自己的 mismatch scan 没找到并行架构。

## Quality Gate 自检（concise）

| Check | Result |
|---|---|
| `pnpm --filter @cat-cafe/api run build` | exit 0 ✓ |
| `pnpm --filter @cat-cafe/mcp-server test` | 273/273 (was 267 +6 schema) ✓ |
| `pnpm --filter @cat-cafe/api test (publish-verdict + eval-memory subset)` | 49/49 (was 33 +7 e2e) ✓ |
| `pnpm biome check (changed files)` | 0 new issues ✓; handler complexity 55=baseline 不变 |
| Follow-up tail scan | 0 命中 ✓ |
| Root-level media artifacts (worktree + diff) | 0 命中 ✓ |
| Architecture cell / Map delta / Why | declared in PR body ✓ |
| Failure-mode sweep | N/A (R1 first round) |

## Review Focus

### What I expect reviewer to verify

1. **Schema correctness** (`publish-verdict-tool.ts:88-115`): memorySourceRefsShape 的 windowDays [1,90] / catId+toolName 可选 + newline injection guard 是否合理？是否与 a2a/cw schema 一致风格？
2. **Handler dispatch logic** (`publish-verdict.ts:188-235`): EXPECTED_REFS_KIND_BY_DOMAIN 扩展 + `inferSourceRefsKind` helper 是否抓干净所有 memory routing 路径？kind mismatch → 400 / no_metrics_in_window → 404 / no generator → 501 错误码映射是否对齐 cw 模式？
3. **Adapter contract** (`memory-generator-adapter.ts`): discriminator + validator + provider.resolve + generateMemoryLiveVerdict 链路与 cw adapter 镜像，请确认 defense-in-depth (wrong kind / wrong domain / unknown domain) 全覆盖。
4. **Generator core** (`eval-memory-live-verdict.ts`): 文件 IO 模式 (snapshot.json + attribution.json + provenance.json + raw inputs + verdict.md) 是否真正写到 isolated worktree？submittedPacket featureId guard 是否漏 mismatch case？sha256 provenance 计算是否对路径敏感？
5. **Production wire-up** (`index.ts:1664-1681`): `MemoryMetricsProviderImpl` bootstrap 条件 (`memoryServices.markerQueue` 存在) 是否 fail-closed 合理？
6. **e2e test coverage** (`publish-verdict-memory.test.js`): 7 case 是否实际验证生产路径？mock 边界 (git/gh) 是否 isolated 干净？

### Known limitations (deliberate, not omission)

- **Dogfood scope**: e2e test 真实 exercise schema → handler → adapter → generator disk IO 全流程，但 git/gh 是 mock。Production dogfood 路径在 PR merge → runtime sync → evalCat opus-47 cron #14 真发 `cat_cafe_publish_verdict` (close 铲屎官 cron #13 ping)。无 pre-merge runtime dogfood 因为 dev server + redis 6398 + sample evidence db seed 摩擦超过 schema-gap fix 的 ROI。
- **Sub-findings out of scope**: BETA=0.15 noop calibration / 球权 hint cron-driven detection / traversalCompletion 0% / searchAbandonRate 55% — 留 future verdict cycles per spec.

## Open Questions

### 技术 OQ（给 reviewer）

1. **Q-T1**: `memory-recall-snapshot` schema 用 `windowDays`（mirrors recall metrics API `?days=`）还是和 cw 一致用 `windowStartMs/windowEndMs`？我选了 `windowDays` 因为：
   - recall metrics API 本身只接受 `days`，不接受 ms 边界
   - cw 的 epoch ms 是 trial replay 需要的精度，memory 是 daily aggregate 不需要
   - 更小的 API surface = 更难滥用
   你怎么看？是否应该 mirror cw style 即使无业务需求？

2. **Q-T2**: `buildSnapshot` 在 components 字段塞了一个 `'memory-recall'` 单元素，跟 cw 单 capability 模式对齐。但 memory 实际有 6+ 度量（consumedMRR / searchAbandon / grepFallback / staleAnchor / orphanEdge / verificationDebt）。是否应该一个 component 对应一类度量（multi-component shape）？我倾向单 component（aggregate metrics 都在 frictionCounts），因为多 component 会让 attribution.json 的 finding 选择维度爆炸。但欢迎 push back。

3. **Q-T3**: production wire-up condition 是 `if (memoryServices.markerQueue)`，跟 cw 的 `if (toolEventLog && skillLoadEventLog)` 同型。但 `markerQueue` 是 always-present in production (memoryServices 启动时构造)，所以这条件实际上 always true。请确认这个 fail-closed guard 是不是 over-engineering（cw 那个有真的 conditional skip，markerQueue 没有）？

### 价值 OQ（给 CVO）

无。这是 P1 infra schema gap fix，目标明确（铲屎官 ping ➜ ship 修复），无价值取舍。

## Pre-Register Retraction Conditions

如果我判断错了，最可能错在：
1. **Schema design**: windowDays 而非 windowStartMs/windowEndMs 不一致 cw → reviewer 要求 mirror cw style
2. **Bundle component shape**: 单 component 聚合 vs 多 component per metric → reviewer 要求拆 multi-component
3. **Wire-up fail-close**: `if (memoryServices.markerQueue)` 是 vestigial guard，简化为无条件 → reviewer 标 over-engineering
4. **Handler complexity 增量**: 虽然 baseline=55 不变，但 `inferSourceRefsKind` 是 boilerplate helper → reviewer 要求合并 / 内联

## Sandbox Setup (for reviewer)

```bash
# Reviewer sandbox path
mkdir -p /tmp/cat-cafe-review/f192-publish-verdict-memory/gpt52
cd /tmp/cat-cafe-review/f192-publish-verdict-memory/gpt52
git clone https://github.com/zts212653/cat-cafe.git . --branch feat/f192-publish-verdict-memory --depth 50

# Run tests in sandbox
pnpm install
env -u NODE_ENV pnpm --filter @cat-cafe/api run build
env -u NODE_ENV pnpm --filter @cat-cafe/mcp-server test
cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" --test --test-timeout=60000 \
  test/harness-eval/publish-verdict*.test.js test/harness-eval/eval-memory*.test.js
```

或直接用 `pnpm review:start`（推荐入口，沙盒隔离端口起点 3201/3202）。

---

[宪宪/Opus-4.7🐾]
