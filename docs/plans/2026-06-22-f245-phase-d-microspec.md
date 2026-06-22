---
feature_ids: [F245]
related_features: [F128, F192, F222, F246]
topics: [friction, phase-d, propose-thread, eval-hub, microspec]
doc_kind: plan
created: 2026-06-22
---

# F245 Phase D Microspec

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 把 friction rollup 报告接上“可提议修复”的出口和 Eval Hub 可读视图，同时保持 KD-8：判断权在 eval cat，不让程序自动乱开修复 thread。
**Acceptance Criteria:** 
- AC-D1: ①②③ 可行动项 → F128 propose_thread 创建修复 thread（复用 F222/F128 pattern，截图/thread 链接可复核）
- AC-D2: ④ eval 域摩擦只列出 + 链接各域 verdict，不重复处理（trace Why：铲屎官"④各自会修，只需列出"）
- AC-D3: Eval Hub friction rollup 视图（在 context 可感知性自检过；截图复核）
**Architecture cell:** `harness-eval`
**Map delta:** none
**Map delta why:** Phase D 只是在既有 `eval:friction` domain / F128 propose_thread / Eval Hub read-model 之上补出口 contract 和前端呈现，不新增 ownership cell。
**Architecture:** D1 和 D2 是同一个边界的两面：不是“先做出口、再做引用”，而是先定义 cluster 的 actionability contract。实现上保持 producer/read-model 只做数据标注与 draft 载荷组装，是否值得修、修哪个、给谁修，仍由 eval cat 在 verdict 层判断。Eval Hub 只消费同一份 contract，不另造第二套 friction 系统。
**Tech Stack:** TypeScript, Fastify, React, existing Eval Hub read-model, F128 propose_thread
**前端验证:** Yes — reviewer 必须实测 friction domain card / Hub 视图 / propose_thread draft 交互

---

## Straight-Line Check

- **Finish line:** 一期 friction rollup 里，①②③ 能被 eval cat 选中并一键起 proposal draft，④ 只作 reference-only 展示；同一份语义在 markdown rollup 和 Eval Hub 里一致可见。
- **Not building:** 自动 root-cause 判断、自动开 thread、单独的新 dashboard、分布式 lock 重构、额外持久化 store。
- **Terminal schema:**
  - `FrictionClusterActionability = 'actionable_candidate' | 'reference_only'`
  - `FrictionFollowupDraft = { clusterId, title, summary, evidenceRefs, suggestedOwnerCatId?, reportingMode, projectPath? }`
  - `FrictionRollupReport` 增加 Phase D 可消费字段：
    - `actionableCandidates[]`：仅来自 ①②③ 的 Top-N cluster，默认最多 3 个（configurable）
    - `referenceOnly[]`：④ eval-domain channel cluster，带 verdict/thread 链接
  - Eval Hub friction view 只读消费上述字段，不重新判一次 actionability

## Hard Boundaries（Phase D 先钉死）

1. **判断权 = eval cat verdict 层**
   - producer / clusterer / renderer 只给 evidence、channel、sensorForm、draft 载荷
   - 不在规则层/后端自动判断“这个 cluster 一定该修”

2. **①②③ = 可提议修复，不是自动修复**
   - 每期最多 `maxProposals=3`（默认 3，可调）
   - 由 eval cat 手动触发 `cat_cafe_propose_thread`
   - proposal draft 预填 title / summary / evidence refs / suggested owner / reportingMode

3. **④ = reference-only**
   - eval-domain 通道永远不进入 propose_thread 出口
   - 只列出 cluster + 链接到对应 verdict / thread / bundle evidence

4. **D1 与 D2 同 contract**
   - markdown rollup / live verdict / Eval Hub 必须消费同一份 actionability 结构
   - 禁止一边把某 cluster 当 actionable，另一边当 reference-only

## Stateful Object Gate

### Lifecycle Census

| 对象 | owner | 生命周期 | 备注 |
|------|-------|----------|------|
| `FrictionRollupReport.actionableCandidates[]` | friction rollup producer | build on publish → read-only | 新增投影字段，不单独存储 |
| `FrictionRollupReport.referenceOnly[]` | friction rollup producer | build on publish → read-only | 新增投影字段，不单独存储 |
| `propose_thread` proposal | F128 | created → approved/rejected → thread created | 复用现有 proposal-first 状态机 |
| Eval Hub friction domain view | Hub read-model + web | fetch → render | 只读投影，不写状态 |

### Invariants

- **INV-D1**: `eval-domain` channel cluster 永远不会出现在 `actionableCandidates[]`
- **INV-D2**: `actionableCandidates[].length <= maxProposals`
- **INV-D3**: 每个 actionable candidate 至少带 1 个 `evidenceRef`
- **INV-D4**: Eval Hub 显示的 actionability 与 verdict bundle 中的 actionability 一致
- **INV-D5**: 未经 eval cat 明示触发，不创建 proposal/thread

### Adversarial Scenarios

- **A-D1**: 一个 mixed-channel cluster 同时含 `eval-domain` + `user-feedback`
  - 期望：仍可 actionable，但 draft 中保留 reference-only evidence refs，不把 eval-domain 部分重复提修
- **A-D2**: Top-N 全是低价值噪音，eval cat 选择 0 个 actionable
  - 期望：允许 `actionableCandidates=[]`，不为了凑数强行提 1 个
- **A-D3**: `cat_cafe_propose_thread` 预填参数不支持 evidence/owner
  - 期望：plan 阶段先 spike；若不支持，则退化为 `initialMessage` 预填，不在 Phase D 临时扩协议乱补
- **A-D4**: Eval Hub 中 friction domain 没有最新 verdict bundle
  - 期望：UI honest empty state，不伪造“下次修复建议”

## Implementation Order

### Task 1: Actionability Contract Microscope

**Files:**
- Modify: `packages/shared/src/types/friction-signal.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/friction/friction-rollup-report.ts`
- Test: `packages/api/test/harness-eval/friction-rollup-report.test.js`

**Step 1: Add shared Phase D projection types**

- Extend `FrictionRollupReport` with:
  - `actionableCandidates`
  - `referenceOnly`
- Add `FrictionClusterActionability`
- Add `FrictionFollowupDraft`

**Step 2: Write failing report classification tests**

Cases:
- `eval-domain` only cluster → `referenceOnly`
- `user-feedback` cluster → candidate pool
- mixed channel cluster with `eval-domain` + non-eval-domain → candidate pool + preserved reference refs
- top candidates capped at configurable `maxProposals=3`

**Step 3: Implement pure classification in rollup producer**

- Keep it deterministic and data-only:
  - `eval-domain` only → reference-only
  - all other channels → candidate pool
- Do **not** assign root cause / requested action automatically

**Step 4: Verify**

Run:
```bash
node --test packages/api/test/harness-eval/friction-rollup-report.test.js
```

### Task 2: Proposal Draft Payload Contract

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/friction/eval-friction-renderer.ts`
- Modify: `packages/api/src/infrastructure/harness-eval/eval-cat-invocation.ts`
- Test: `packages/api/test/harness-eval/eval-friction-live-verdict.test.js`
- Spike note: inline in this plan / commit body (no separate long-running spike doc unless blocked)

**Step 1: Verify current `cat_cafe_propose_thread` prefill surface**

Check whether current tool/route can carry:
- title
- initialMessage / summary
- evidence refs
- preferredCats / suggested owner equivalent
- reportingMode
- projectPath

If all fit existing contract, continue.
If not, record the minimal gap and stop before coding new protocol.

**Step 2: Encode draft payload into friction verdict-facing surfaces**

- Renderer / invocation prompt should expose a stable “proposal draft” section for actionable candidates
- This is a draft for the eval cat to launch manually, not an automatic side effect

**Step 3: Write failing tests**

Cases:
- actionable candidate emits draft payload with evidence refs
- reference-only cluster emits links only, no proposal draft
- `maxProposals` respected

**Step 4: Verify**

Run:
```bash
node --test packages/api/test/harness-eval/eval-friction-live-verdict.test.js
```

### Task 3: Eval Hub Friction View

**Files:**
- Modify: `packages/api/src/infrastructure/harness-eval/hub/eval-hub-read-model.ts`
- Modify: `packages/web/src/components/HubEvalTab.tsx`
- Test: `packages/api/test/harness-eval/eval-hub-read-model.test.js`
- Test: `packages/web/src/components/__tests__/HubEvalTab.test.tsx`

**Step 1: Decide reuse shape**

- Reuse existing domain card + verdict detail path
- Add friction-specific rendering only where necessary
- Do not fork a separate hub page

**Step 2: Surface Phase D sections**

Hub must show:
- `建议修复` block for actionable candidates
- `仅引用` block for eval-domain reference-only items
- clear wording that proposals are draft suggestions, not auto-opened tasks

**Step 3: Write failing tests**

Cases:
- friction domain card renders actionable candidate summary
- eval-domain-only cluster appears in reference-only block
- no verdict bundle → honest empty state

**Step 4: Verify**

Run:
```bash
node --test packages/api/test/harness-eval/eval-hub-read-model.test.js
pnpm --dir packages/web exec vitest run src/components/__tests__/HubEvalTab.test.tsx
```

## PR Slicing

1. **PR-D1a** — contract + rollup classification (`shared` + `friction-rollup-report`)
2. **PR-D1b** — proposal draft payload + friction verdict/invocation wording
3. **PR-D1c** — Eval Hub friction view

Reason:
- D1/D2 share one contract, but the contract itself is pure/backend and safest to land first
- Hub UI should consume a settled payload, not drive the payload design

## Open Questions

### 技术 OQ

1. `cat_cafe_propose_thread` 当前是否已有足够的预填字段？
   - First action: verify with existing tool description + route surface
   - If not enough, capture the exact missing field before implementation

2. mixed cluster（同时含 `eval-domain` + non-eval-domain）在 UI 上怎么表述最不误导？
   - 倾向：仍归 actionable，但附 “含 reference-only evidence” 标注

### 价值 OQ

None for now. Current boundary already has team consensus and is reversible.

## Verification Matrix

| AC | Evidence |
|----|----------|
| AC-D1 | report/actionable candidate tests + proposal draft screenshot/link |
| AC-D2 | report/reference-only tests + rendered reference links |
| AC-D3 | HubEvalTab test + browser screenshot |

## Next Step

Plan landed on main → open feature worktree → TDD from Task 1.
