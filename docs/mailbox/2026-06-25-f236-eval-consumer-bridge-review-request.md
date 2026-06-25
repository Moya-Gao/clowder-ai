---
feature_ids: [F236]
topics: [review-request, eval, anchor, carrier]
---

# Review Request: F236 Phase E — Eval Consumer Bridge

Review-Target-ID: f236-eval-bridge
Branch: feat/f236-eval-consumer-bridge

## What

Closes the cross-process data gap for cc-native anchor eval telemetry. Phase C's PostToolUse hook (`f236-anchor-posttool.mjs`) writes eval events to `/tmp/cat-cafe-anchor-eval-{invocationId}.jsonl`, but the API server's `recordAnchorPreviewEvent()` never sees them because the hook runs in a cc subprocess. This PR adds:

1. **`AnchorEvalBridgeConsumer.ts`** (new) — Pure-function transform from eval jsonl entries to `AnchorPreviewEventInput[]`. Same pattern as `HookSidechannelConsumer`.
2. **Carrier wiring** — Second `TranscriptTailer` in the carrier's output loop polls the eval jsonl, transforms via the consumer, feeds into `recordAnchorPreviewEvent()`. Includes final drain + cleanup.
3. **Hook-setup integration** — `setupHookInfrastructure()` now registers the F236 anchor hook as a second PostToolUse entry when the hook file exists, so managed PTY sessions get anchor-eval events.

Files changed (6):
- `AnchorEvalBridgeConsumer.ts` — CREATE (pure function)
- `ClaudeInteractivePtyCarrierService.ts` — MODIFY (eval tailer + bridge)
- `pty/hook-setup.ts` — MODIFY (second PostToolUse entry)
- `f236-eval-consumer-bridge.test.js` — CREATE (17 tests)
- `f230-hook-setup.test.js` — MODIFY (2 new tests)
- `docs/plans/2026-06-25-f236-eval-consumer-bridge.md` — plan doc

## Why

AC-C4 was marked partial in Phase C: "type extension + data shape ready, consumer deferred to Phase E." The hook subprocess writes Track-2 compatible eval events (tool, itemIds, originalChars, returnedChars, modeResolved, modeSource, catId) but nothing consumes them. Without this bridge, cc-native tool anchor **preview** events — the token big head — are invisible to the telemetry rollup.

**Scope correction (gpt52 R1 P1)**: This PR advances AC-C4 but does NOT fully close it. AC-C4 requires bilateral eval (preview + drill). This bridge wires the preview side only. CC drill telemetry (bounded Read pass-through emitting drill events) is a remaining Phase E item.

## Original Requirements

> "cc 内置 Read/Grep（读文件/搜代码）才是 agent 工作流 token 大头——经查证 cc PostToolUse hook 能治（Phase C）。本 feat 不止治小头，更要治大头"
> "双边 eval 对 cc 工具同样适用（Read drill 净收益 = 省 − drill 成本）"
- 来源：`docs/features/F236-anchor-first-context-entry.md` (AC-C4, line 161)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Could have inlined eval consumption into the hook sidecar consumer — rejected because the two jsonl files serve different lifecycle owners (F230 hook capture vs F236 anchor eval) and mixing them couples unrelated concerns.
- Could have used a named pipe or IPC instead of file tailing — rejected because TranscriptTailer is proven infrastructure and file-based bridges are the existing pattern.

## Architecture Ownership

Architecture cell: `carrier/pty-interactive` + `harness-eval/anchor-first`
Map delta: none
Why: Consumer bridge closes data gap between cc subprocess and API server for anchor telemetry completeness. No new architectural cell — extends existing carrier poll loop with a second tailer.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Hook ordering**: Capture script runs first (stdin → sidecar, no stdout), anchor hook runs second (stdin → maybe stdout replacement + eval jsonl append). Both are PostToolUse entries in array order. Verify this chaining semantics is correct for cc's hook runner.
2. **Timeout**: Anchor hook gets 10s timeout (Node.js startup + ESM import + processing) vs capture script's 5s (POSIX sh). Is 10s appropriate?
3. **Error isolation**: Eval bridge consumption is wrapped in try/catch (non-fatal). Is this the right failure mode — should any eval bridge error be visible somewhere (log/telemetry)?

### 价值 OQ（给 CVO，如有）

无 — pure internal infrastructure, no user-visible change.

## Next Action

请 review 代码正确性、error isolation 边界、hook-setup 集成。非前端改动，无需起服务。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f236-eval-bridge/{reviewer-handle}`
- Start Command: 无需启动服务（纯 API 包改动，测试自包含）
- Ports: N/A

### 沙盒 Bootstrap（reviewer 在干净 sandbox 复跑 Validation 前必做）

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/mcp-server run build  # coverage-search test 依赖
pnpm --filter @cat-cafe/api run build
```

## 自检证据

### Quality Gate Report

Spec: docs/plans/2026-06-25-f236-eval-consumer-bridge.md
原始需求: docs/features/F236-anchor-first-context-entry.md (AC-C4)
检查时间: 2026-06-25 18:15

#### 愿景覆盖（Step 0）
| # | 铲屎官原始需求 | AC 覆盖？ | 实现？ |
|---|---------------|-----------|--------|
| 1 | cc 原生工具 eval 对双边适用 | AC-C4 | 🔶 partial (preview bridge done; drill telemetry pending) |

#### 功能验收
| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | Pure-function transform eval entries → AnchorPreviewEventInput | ✅ | AnchorEvalBridgeConsumer.ts | f236-eval-consumer-bridge.test.js (10 unit tests) |
| 2 | resolveEvalJsonlPath matches hook convention | ✅ | AnchorEvalBridgeConsumer.ts:75 | f236-eval-consumer-bridge.test.js (3 tests) |
| 3 | Carrier output loop polls eval tailer | ✅ | ClaudeInteractivePtyCarrierService.ts | f236-eval-consumer-bridge.test.js (4 integration tests) |
| 4 | Final drain catches last events | ✅ | ClaudeInteractivePtyCarrierService.ts | — (structural, covered by integration) |
| 5 | Eval jsonl cleanup in finally block | ✅ | ClaudeInteractivePtyCarrierService.ts | — (structural) |
| 6 | Hook-setup registers F236 hook conditionally | ✅ | hook-setup.ts:85-89 | f230-hook-setup.test.js (2 new tests) |
| 7 | Error isolation (eval failure non-fatal) | ✅ | try/catch in carrier | — (structural pattern) |

#### 设计稿对照（Step 5）
glob designs/**/*.pen 匹配结果: 无匹配
对照状态: ➖ 无 UI 改动

#### Artifact Hygiene（Step 7.5）
仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

#### Architecture Ownership（Step 2.7）
Architecture cell: carrier/pty-interactive + harness-eval/anchor-first
Map delta: none
Why: Consumer bridge extends existing carrier poll loop, no new cell
Diff mismatch scan: 无新增并行 Store/Queue/Router/Adapter ✅

#### Fallback Layer Check（Step 2.6）
Script flagged 2 files with ≥3 layers. Analysis: these are **error isolation patterns** (try/catch for non-fatal eval bridge + null guard on evalTailer), not coordinate-system fallbacks. Same pattern as existing HookSidechannelConsumer. Each layer is necessary:
- Layer 1: `if (evalTailer)` — null guard (no invocationId = no tailer)
- Layer 2: `try { ... } catch { }` — non-fatal error isolation (eval must never break output loop)
- Layer 3: Final drain try/catch — same reason, different lifecycle point
No coordinate-system issue.

#### Dogfood-Your-Slice（Step 4.5）
Scope verdict: 🆗 可豁免
理由: Pure internal infrastructure (eval telemetry bridge). No user/cat visible path change. The bridge feeds data into existing in-memory event log; no new MCP tools, no new REST endpoints, no UX change.

### 测试结果

```
pnpm test → all pass ✅ (after mcp-server dist rebuild — pre-existing stale dist)
pnpm lint → 0 errors ✅ (warnings are pre-existing web package)
pnpm check → 0 errors ✅ (biome format fix committed as 8fc490330)
pnpm -r --if-present run build → exit 0 ✅
pnpm check:capability-tips → PASS ✅
Hotfix check → false ✅

F236-specific tests (29 total):
- evalEntriesToPreviewEvents: 10 tests ✅
- resolveEvalJsonlPath: 3 tests ✅
- eval bridge integration: 4 tests ✅
- f230-hook-setup (new): 2 tests ✅
- f230-hook-setup (existing): 10 tests ✅
```

### 相关文档
- Plan: `docs/plans/2026-06-25-f236-eval-consumer-bridge.md`
- Feature: F236 (AC-C4 closure)
