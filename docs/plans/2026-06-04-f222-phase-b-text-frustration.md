# F222 Phase B — Text Frustration Trigger + Parallel Route

**Feature:** F222 — `docs/features/F222-frustration-auto-issue.md`
**Goal:** 用户消息含摩擦关键词时触发 auto-issue，并补齐 routeParallel 检测
**Acceptance Criteria:**
- AC-B1: 文本情绪触发 — 用户消息含摩擦关键词（"不对""错了""怎么回事""又来了"等）时触发 auto-issue
- AC-B2: routeParallel 摩擦检测接入（Phase A 云端 review P2→P3 遗留）
- AC-B3: 误触发防护 — 关键词匹配须结合上下文窗口（避免正常讨论中的"不对"触发）
**Architecture cell:** harness-eval
**Map delta:** none
**Map delta why:** 复用 Phase A 全部基础设施（FrustrationDetector / store / card / routes），只扩展信号类型和集成点
**Architecture:** 新增 `text_frustration` 信号类型到 FrustrationDetector。检测点在 AgentRouter.route() 用户消息入口（不是 post-invocation）。误触发防护：查最近 N 条消息窗口内是否有 ≥2 条匹配关键词，单条不触发。routeParallel 复用 route-serial 同样的 post-invocation detection 逻辑。
**Tech Stack:** TypeScript, existing FrustrationDetector pipeline
**前端验证:** No — 不改前端（复用 Phase A 的 FrustrationIssueCard）

---

## What We're NOT Building

- ❌ NLP/ML 情感分析 — 关键词匹配足够，不引入模型依赖
- ❌ A2A 超时检测 → Phase C
- ❌ 重复 retry 检测 → Phase C
- ❌ 前端改动 — 复用 Phase A 的 FrustrationIssueCard

## Terminal Schema

```typescript
// Extend FrustrationSignalType (packages/shared)
export type FrustrationSignalType = 'cli_error' | 'cancel_burst' | 'text_frustration';

// New signal interface (packages/api)
export interface TextFrustrationSignal {
  type: 'text_frustration';
  matchedKeywords: string[];       // which keywords hit
  matchCount: number;              // how many messages matched in window
  recentUserMessages: string[];    // the matching messages (truncated)
}
```

---

## Task 1: Extend shared FrustrationSignalType

**Files:**
- Modify: `packages/shared/src/types/frustration-issue.ts` (add `'text_frustration'` to union)
- Test: existing `packages/shared/test/frustration-issue.test.js` still passes

**Step 1.1:** Add `'text_frustration'` to `FrustrationSignalType` union
**Step 1.2:** `pnpm --filter @cat-cafe/shared build` + existing tests pass
**Step 1.3:** Commit

---

## Task 2: Text frustration keyword detector + context window

**Files:**
- Create: `packages/api/src/domains/cats/services/frustration/text-frustration-keywords.ts`
- Modify: `packages/api/src/domains/cats/services/frustration/FrustrationDetector.ts` (add `text_frustration` to shouldTrigger)
- Test: `packages/api/test/services/frustration-detector.test.js` (extend)

**Step 2.1:** Write failing tests:
- `shouldTrigger({ type: 'text_frustration', matchCount: 2 })` → true
- `shouldTrigger({ type: 'text_frustration', matchCount: 1 })` → false (AC-B3: single match = no trigger)
- `detectTextFrustration(["不对啊", "错了错了"], keywords)` → { matched: true, keywords: ["不对", "错了"], count: 2 }
- `detectTextFrustration(["今天天气不错"], keywords)` → { matched: false }
- `detectTextFrustration(["这个不对"], keywords)` → { matched: false, count: 1 } (below threshold)

**Step 2.2:** Implement `text-frustration-keywords.ts`:
- `FRUSTRATION_KEYWORDS`: ["不对", "错了", "怎么回事", "又来了", "什么情况", "搞什么", "没用", "还是不行"]
- `TEXT_FRUSTRATION_THRESHOLD`: 2 (≥2 matching messages in window = trigger)
- `TEXT_FRUSTRATION_WINDOW`: 5 (scan last 5 user messages)
- `detectTextFrustration(recentUserMessages: string[], keywords?: string[])`: returns { matched, matchedKeywords, matchCount }

**Step 2.3:** Extend `shouldTrigger` to handle `text_frustration` signal:
```typescript
if (signal.type === 'text_frustration') {
  return signal.matchCount >= TEXT_FRUSTRATION_THRESHOLD;
}
```

**Step 2.4:** Run tests → green
**Step 2.5:** Commit

---

## Task 3: Integrate text frustration into AgentRouter message entry

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts` (~line 1250, after storedUserMessage)
- Test: `packages/api/test/services/text-frustration-integration.test.js`

**Step 3.1:** Write failing test:
- Mock messageStore with recent user messages containing frustration keywords
- Call evaluate with text_frustration signal → issue created

**Step 3.2:** After `storedUserMessage` append (line 1250), add:
```typescript
// F222 Phase B: Text frustration detection — scan user message for frustration keywords
if (this.frustrationIssueStore) {
  try {
    const { detectTextFrustration } = await import('../../frustration/text-frustration-keywords.js');
    const recentMessages = await this.messageStore.getByThread(resolvedThreadId, 5);
    const userMessages = recentMessages
      .filter(m => !m.catId && m.userId !== 'system')
      .map(m => typeof m.content === 'string' ? m.content : '');
    const detection = detectTextFrustration(userMessages);
    if (detection.matched) {
      const { evaluate } = await import('../../frustration/FrustrationDetector.js');
      await evaluate({
        signal: {
          type: 'text_frustration',
          matchedKeywords: detection.matchedKeywords,
          matchCount: detection.matchCount,
          recentUserMessages: userMessages.slice(-3).map(m => m.slice(0, 200)),
        },
        threadId: resolvedThreadId, userId, catId: targetCats[0] as string,
      }, {
        frustrationIssueStore: this.frustrationIssueStore,
        messageStore: this.messageStore,
        socketManager: this.socketManager as SocketManager | undefined,
      });
    }
  } catch { /* non-blocking */ }
}
```

**Step 3.3:** Tests pass
**Step 3.4:** Commit

---

## Task 4: routeParallel frustration detection (AC-B2)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-parallel.ts` (post-invocation section)
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` (if parallel needs same deps)

**Step 4.1:** Find post-invocation section in route-parallel where cliDiagnostics is already captured
**Step 4.2:** Mirror route-serial's F222 detection block (CLI error + cancel burst)
**Step 4.3:** Build + test
**Step 4.4:** Commit

---

## Task 5: End-to-end verification

**Step 5.1:** `pnpm check` + `pnpm lint` pass
**Step 5.2:** All F222 tests pass
**Step 5.3:** `pnpm gate` passes
**Step 5.4:** Commit any remaining fixes

---

## Open Questions (Technical — 自决)

| OQ | 决策 | 理由 |
|----|------|------|
| 关键词列表来源 | 硬编码常量 | 不用 NLP/配置文件，可逆（改常量 + redeploy），Phase C 可改配置化 |
| 上下文窗口大小 | 最近 5 条用户消息 | 和 Phase A context collection 一致 |
| 触发阈值 | ≥2 条匹配 | 单条"不对"可能是正常讨论，2 条以上 = 用户在重复表达不满 |
| 检测时机 | 用户消息入口（AgentRouter.route） | 文本信号来自用户输入不是猫的输出，与 CLI error / cancel burst 的 post-invocation 时机不同 |
