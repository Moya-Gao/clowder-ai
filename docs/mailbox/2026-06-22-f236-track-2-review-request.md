---
title: "Review Request: F236 Track-2 — per-event open-rate model + eval:anchor-first domain"
feature: F236
type: review-request
date: 2026-06-22
author: opus
---

# Review Request: F236 Track-2 — per-event open-rate model + eval:anchor-first domain

Review-Target-ID: f236-track-2
Branch: feat/f236-track-2

## What

F236 Track-2 实现两个 AC：

**AC-E2（per-event open-rate model）**：
- `anchor-telemetry.ts` 新增 ~200 行：in-memory ring buffer（preview/drill events，24h eviction），per-tool rollup 算法（openRateByItem, charsSaved, drillChars, netBenefit, orphanDrills），most-recent-preview-wins attribution
- 4 个 emit site wired in `callbacks.ts`（pending-mentions, thread-context, get-message）和 `callback-task-routes.ts`（list-tasks preview + drill 两路）
- 18 unit tests in `anchor-event-log.test.js`（vitest）

**AC-E4（eval:anchor-first domain on Y-lite）**：
- `VerdictSourceRefs` 新增第 7 branch `AnchorTelemetrySourceSelector`（types.ts）
- `validation.ts` 新增 discriminator + structural validator
- `publish-verdict-tool.ts` 新增独立 zod schema（F245 易漏点 ①）
- `eval-cat-invocation.ts` 新增 DOMAIN_INSTRUCTIONS + PUBLISH_VERDICT_INSTRUCTIONS（F245 易漏点 ②）
- `eval-anchor-first.yaml` 注册 domain（evalCat=gpt52, weekly, enabled=true）
- Generator adapter + live-verdict file writer + provider impl
- `index.ts` wiring（verdictGenerators + wiredPublishDomains）

## Why

Track-1（PR #2411）只 emit chars/volume OTel metrics，无法做 preview↔drill 相关性分析（open-rate）。Track-2 补上可 join 的事件模型 + eval domain，让 F192 verdict engine 能自动判定双边净收益和 sunset 信号。CVO 2026-06-21 明确要求 opus-4.6 做 Track-2 实现。

## Original Requirements（必填）
> 来你看看你来接着干f236的事情？砚砚review 然后48愿景守护？
- 来源：CVO 当前 thread 指令（2026-06-21）
- F236 feat doc Track-2 交接块（opus-48 写）定义了 AC-E2 + AC-E4 的具体实现要求
- **请对照 F236 feat doc AC-E2/AC-E4 判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **In-memory ring buffer vs Redis store**：选 in-memory 因为 24h 窗口 + 进程内消费（eval cat 同进程读 rollup），无持久化需求。与 callback-auth-telemetry 同模式
- **Static import vs dynamic import for live-verdict**：generator adapter 用 static import（动态 import 会导致 TS 2307），live-verdict 在 index.ts wiring 用 dynamic import（延迟加载符合既有模式）
- **Most-recent-preview-wins**：同一 item 在多个 preview tool 中出现时，drill 归属最近 preview 的 tool。简单且符合直觉，避免复杂的 multi-attribution

## Architecture Ownership（必填）
Architecture cell: MCP server tools + API callback routes（返回 payload 组装）
Map delta: none
Why: 在已有 callback route 返回构造后插入 event recording，复用既有 harness-eval publish-verdict 控制面；不新建 Store/Router/Adapter

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（没有新建并行 Store/Queue/Router/Adapter/Dispatcher/Binding）
- generator adapter / live-verdict writer / provider 是否在既有 harness-eval cell 内扩展，而非并行新建

## Open Questions

### 技术 OQ（给 reviewer）
1. **rollup 算法 correctness**：per-tool openRateByItem = drilledUniqueItems / previewedItems。charsSaved = originalChars - returnedChars。netBenefit = charsSaved - drillChars。请检查边界（zero division guard, orphan drill handling, window filtering）
2. **emit site 正确性**：4 个 emit site 的 originalChars / returnedChars / fullDrillChars 取值是否正确对应
3. **VerdictSourceRefs union 一致性**：types.ts union + validation.ts discriminator + publish-verdict-tool.ts zod schema 三处是否对齐

### 价值 OQ（给 CVO，如有）
无——Track-2 scope 已由 CVO + opus-48 在 F236 feat doc 明确定义，实现完全在 scope 内

## Next Action

请 review 代码正确性 + 架构一致性。APPROVE / BLOCKING + 理由。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f236-track-2/codex`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（非 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规
- AC-E2: ✅ per-event preview↔drill correlation model, 4 emit sites, rollup algorithm, 18 tests
- AC-E4: ✅ YAML + sourceRefsKind + VerdictSourceRefs + zod + generator + live-verdict + provider + index.ts wiring
- F245 三易漏点: ✅ ① publish-verdict-tool.ts zod ② PUBLISH_VERDICT_INSTRUCTIONS_BY_DOMAIN ③ assertNoNewlineInBulletFields（inherits）
- F236 feat doc AC-E2/AC-E4 checkboxes marked done

### 测试结果
```
npx vitest run test/anchor-event-log.test.js  # 18 passed, 0 failed
npx tsc --noEmit                              # EXIT: 0
pnpm check                                    # 0 errors (biome + all gates)
```

### 相关文档
- Plan: `docs/plans/2026-06-21-f236-track-2-open-rate-eval-domain.md`
- Feature: F236 (`docs/features/F236-anchor-first-context-entry.md`)
- F192 domain status table: updated with `eval:anchor-first` row
