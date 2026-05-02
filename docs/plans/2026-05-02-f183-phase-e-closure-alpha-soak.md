---
feature_ids: [F183]
related_features: [F123, F081, F164]
topics: [websocket, idb, store-invariant, replay-harness, alpha-soak, closure]
doc_kind: plan
created: 2026-05-02
---

# F183 Phase E — Closure + Alpha Soak

**Feature:** F183 — `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
**Goal:** 把 Phase B0 立的最小 invariant gate 升级成 dev/runtime 完整断言（违反即抛 in dev/test，prod 仍 warn），收编 F123 TD112+TD114，并在 alpha 通道实测 5 类气泡症状全部消失（AC-Z1）。
**Acceptance Criteria:** AC-E1（dev/runtime invariant 断言完整）+ AC-E2（F123 TD112/TD114 收编完成）+ AC-E3（replay harness 跑过历史 fixture + Phase E 新增 fixture）+ AC-Z1（alpha 5 类症状消失）。Phase E 落地后 F183 即可走 feat-lifecycle 愿景守护 close。
**Architecture:** B0 已建 `bubble-invariants.ts` (`findBubbleStoreInvariantViolations` / `validateIncomingBubbleEvent` / `assertNoBubbleInvariantViolations`) + `bubble-replay-harness.ts` + `bubbleInvariantDiagnostics.ts` (`recordBubbleInvariantViolation('warn')`)。Phase E 不重写架构，加 4 件事：(1) `BUBBLE_INVARIANT_STRICT` env mode 在 dev/test 下把 warn 升级为 throw；(2) 给 chatStore 主写入口加 ASSERT 包裹，凡是 reducer 路径未覆盖的 mutation 也走 invariant gate；(3) replay harness 跑一遍 F123 历史 fixture matrix + Phase B/C/D 新增 scenario；(4) alpha 通道实测 5 症状对照表。
**Tech Stack:** TypeScript, Vitest, Zustand, alpha environment (3011/3012/4111/6398)
**前端验证:** Yes — alpha 通道实测 + 5 症状对照表（截图/录屏证据）

---

## TL;DR — Scope

**做 (in scope)**:
- AC-E1 dev/runtime hard assertion: `BUBBLE_INVARIANT_STRICT` toggle (default ON in test/dev, OFF in prod)
- AC-E2 TD112/TD114 closure: chatStore 主写入口 invariant 覆盖审计 + 补缺口
- AC-E3 replay harness: 跑全 F123 历史 fixture，加 Phase B/C/D 引入的新 scenario fixture
- AC-Z1 alpha实测: `pnpm alpha:start` 拉最新 main，按 5 症状清单挨个验证

**不做 (out of scope)**:
- 重写 invariant 检测算法（B0 已 done）
- F183 之外的 store 异常治理
- 整体 ChatStore 重构
- 新增 BubbleEvent 枚举（B0 14 类已固化）

---

## Architecture Decisions

### KD-E1: strict mode 用 env 开关，不用 build flag

`process.env.BUBBLE_INVARIANT_STRICT === '1'` → throw mode；否则 warn-only。Default：test 环境自动 ON（vitest setup），dev/prod 默认 OFF（需要主动 opt-in 才挂到主流程）。

**Why**：build flag 需要重新构建才能切，env 即时生效，方便 reviewer 在 alpha 通道临时打开抓现场。

### KD-E2: assert wrapping 不改 reducer 路径，只补漏

bubble-reducer 已经在 `validateIncomingBubbleEvent` + `findBubbleStoreInvariantViolations` 调用后返回 `result.violations`。Phase E 在 `recordBubbleInvariantViolation` 调用点 elevation：strict mode 下 throw，非 strict 下 warn（既有行为）。

**Why**：reducer 是收口的最佳点，所有 active+bg path 的 invariant 已经在那儿被检查。Phase E 只需要把"被检查到的违反"从 warn 升级到 throw 即可，不需要把检查逻辑迁移到 chatStore。

### KD-E3: replay fixture 增量补，不重写

B0 已建框架 + 几个基础 fixture。Phase E 加：
- F123 symptom matrix 里没覆盖的剩余历史症状（如果有）
- Phase B/C/D 引入的新场景：seq+gap 触发 catchup → bubble 不裂、IDB cache hydration → 不闪老气泡

---

## Implementation

### Task 1: BUBBLE_INVARIANT_STRICT env toggle (AC-E1)

**Files:**
- Modify: `packages/web/src/debug/bubbleInvariantDiagnostics.ts`
- Test: `packages/web/src/debug/__tests__/bubbleInvariantDiagnostics.test.ts`

**Step 1: Write failing test**

```ts
it('AC-E1: throws when BUBBLE_INVARIANT_STRICT=1 (dev/test mode)', () => {
  vi.stubEnv('BUBBLE_INVARIANT_STRICT', '1');
  const violation = makeViolation();
  expect(() => recordBubbleInvariantViolation(violation, 'warn')).toThrow(/bubble invariant violation/);
});

it('AC-E1: warns (does not throw) when BUBBLE_INVARIANT_STRICT unset (prod default)', () => {
  vi.unstubAllEnvs();
  const violation = makeViolation();
  expect(() => recordBubbleInvariantViolation(violation, 'warn')).not.toThrow();
});
```

**Step 2: Implement strict mode in `recordBubbleInvariantViolation`**

```ts
export function recordBubbleInvariantViolation(
  violation: BubbleInvariantViolation,
  level: BubbleInvariantLogLevel = 'warn',
): void {
  const payload = { ...violation, level };
  if (level === 'error') {
    console.error('[F183] bubble invariant violation', payload);
  } else {
    console.warn('[F183] bubble invariant violation', payload);
  }
  recordDebugEvent({ event: 'bubble_invariant_violation', ...payload });
  // F183 Phase E AC-E1: dev/test strict mode escalates warn → throw
  if (process.env.BUBBLE_INVARIANT_STRICT === '1') {
    throw new Error(
      `[F183] bubble invariant violation (strict): ${violation.violationKind} ${violation.threadId}/${violation.actorId}/${violation.canonicalInvocationId}/${violation.bubbleKind}`,
    );
  }
}
```

**Step 3: Wire into vitest setup (default ON in test)**

`packages/web/src/test-setup.ts` add: `process.env.BUBBLE_INVARIANT_STRICT = '1';`

**Step 4: Run all web tests** — any test that triggers a violation now fails. This is a feature: surfaces dormant bugs.

**Step 5: Commit**

### Task 2: chatStore mutation path coverage audit (AC-E2)

**Files:**
- Read: `packages/web/src/stores/chatStore.ts` — find all `set((state) => ...)` mutations that produce `messages: ...`
- Modify (only as needed): chatStore mutations not gated by reducer

**Step 1: Audit script** — grep for set callbacks that produce messages array, list each
**Step 2: For each:**
- If goes through `bubble-reducer` (replaceMessages, replaceThreadMessages, applyBubbleEvent etc.) → covered
- If bypasses (e.g., `clearMessages`, `addMessage` legacy paths) → wrap with `findBubbleStoreInvariantViolations` post-mutation in dev mode

**Step 3: Pre-existing fixture replay run** — start from a known-broken pre-Phase-B0 fixture; verify strict mode catches it

### Task 3: Replay harness fixture expansion (AC-E3)

**Files:**
- Modify: `packages/web/src/stores/__tests__/bubble-replay-harness.test.ts`
- Optional add: `packages/web/src/stores/__tests__/bubble-replay-harness-phaseE.test.ts` for Phase B/C/D scenarios

**Step 1: List F123 historical symptoms** — read `docs/features/assets/F123/symptom-fixture-matrix.md` or fallback to F123 spec
**Step 2: For each symptom not yet a fixture:** write replay fixture (event sequence) + assert no violations + assert expected end state
**Step 3: Add Phase B/C/D scenarios:**
- Phase C: gap detected → catchup HTTP fetch → no duplicate stable identity created
- Phase D: IDB cache hydration → mergeReplaceHydrationMessages → cached msg dropped, history wins
- Phase B1: bg path text + tool共存 → reducer kind filter → no canonical-split

### Task 4: Alpha实测 + 5 症状对照表 (AC-Z1)

**Files:**
- Create: `docs/features/assets/F183/alpha-vision-guard-2026-05-02.md`

**Step 1:** `pnpm alpha:start` (cwd: cat-cafe-alpha worktree)，等到 3011/3012/4111/6398 都 ready
**Step 2:** 按以下 5 症状逐个 reproduce + 记录：
| # | 症状 (铲屎官原话) | 触发步骤 | 期望 (Phase E 后) | 实测结果 |
|---|------|----|----|----|
| R1 | "气泡裂了" | 同 invocation 同时触发 stream + callback | 同 stable identity 只有 1 条 | (alpha 截图) |
| R2 | "气泡不见了" | broadcast emit 失败/丢包 | gap detection 触发 catchup 自愈 | (alpha 截图) |
| R3 | "F5 之后气泡不裂了" | F5 reload | IDB hydrate 立即渲染 + API replace 不闪 | (alpha 截图) |
| R4 | "F5 之后气泡出来了" | 长 invocation 中 F5 | catchup 拉到 missed events | (alpha 截图) |
| R5 | "猫猫发完消息气泡才出来" | broadcast 大延迟 | seq + gap detection 主动 catchup | (alpha 截图) |
**Step 3:** Strict mode alpha smoke — 临时 export `BUBBLE_INVARIANT_STRICT=1` 跑 alpha 一次，看是否在浏览器 console 里抛出 invariant violation（如果抛了 → 后续 PR 修；不抛 → 5 症状真消）
**Step 4:** 截图 + 文档落盘

### Task 5: F183 spec sync + Phase E close (Phase 完成)

**Files:**
- Modify: `docs/features/F183-bubble-pipeline-architecture-consolidation.md`
- Modify: `docs/lessons-learned.md` (if Phase E surfaced new lessons)

**Step 1:** Phase E 4 个 AC 标 [x] + Timeline + 5 症状清单状态从 [~] 改 [x]
**Step 2:** 主动 @ 非作者非 reviewer 的猫做愿景守护
**Step 3:** 守护猫放行 → close F183

---

## Risks

| 风险 | 缓解 |
|------|------|
| Strict mode 触发 dormant bug，把全 web suite 烧红 | 第一波允许 surface — 都是 F183 该闭的。但如果烧的不是 invariant 类（比如时间型 flake），需要单独识别 + 修。先在 Task 1 跑全 suite，发现什么修什么。 |
| Alpha 浏览器实测 reproducibility 差 | 5 症状有些是 race / 时间相关。允许 "无法稳定复现 = 已修复"，但要附 console log + replay fixture 双证据。 |
| F123 TD112/TD114 还有 chatStore 漏网入口 | Task 2 audit 兜底；如果某入口有性能 / lifecycle 原因不能加 invariant，文档化为已知例外。 |
| Phase E close 后 F183 整 feature close 时还需 production strict 选项 | 默认不开 strict in prod 是有意的（throw 在用户面前没用）；如果生产需要 metric → 走 F153 observability，不在 F183 范围。 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-E1 | strict mode 是否要在 alpha 默认 ON？ | 暂定 OFF；alpha 是用户测试通道，不希望 invariant assert 中断使用。手动 export 才开启。 |
| OQ-E2 | F123 symptom-fixture-matrix.md 是否还存在？ | Task 3 第一步会确认；如果不存在用 F123 spec AC-C2 列的症状清单替代。 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-02 | 铲屎官 "走起 大猫猫 胜利就在眼前" 拍板 Phase E 方向 |
