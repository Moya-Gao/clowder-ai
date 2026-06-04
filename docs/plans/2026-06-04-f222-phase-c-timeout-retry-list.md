# F222 Phase C — A2A Timeout + Retry Burst + Issue List

**Feature:** F222 — `docs/features/F222-frustration-auto-issue.md`
**Goal:** 补齐最后两种触发信号（A2A 超时 + 用户反复 retry）+ 用户查看 issue 列表 API
**Acceptance Criteria:**
- AC-C1: A2A 超时触发 — @了猫超过阈值未产出可见内容时触发 auto-issue
- AC-C2: 用户反复 retry 触发 — 相同/极相似消息连续发送 ≥3 次时触发
- AC-C3: Issue 列表 API — GET /api/frustration-issues（用户可查看自己的所有 issue）
**Architecture cell:** harness-eval
**Map delta:** none
**Architecture:** A2A timeout 检测在 route-serial post-invocation（cat 没产出 + hadError = timeout）。Retry burst 检测在 AgentRouter 消息入口（复用 Phase B 的 paging helper 比较最近消息相似度）。Issue 列表是简单的 GET route。
**Tech Stack:** TypeScript, existing FrustrationDetector pipeline
**前端验证:** No

---

## What We're NOT Building

- ❌ 前端 Issue 看板/管理页面 — 只做 API，前端另立
- ❌ NLP 语义相似度 — 用前缀匹配，简单有效

## Task 1: Extend signal types + add new signals

**Files:**
- Modify: `packages/shared/src/types/frustration-issue.ts` (add 'a2a_timeout' | 'retry_burst')
- Modify: `packages/api/src/domains/cats/services/frustration/FrustrationDetector.ts` (shouldTrigger + signal interfaces)
- Test: extend existing test files

## Task 2: A2A timeout detection in route-serial

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- Integration: after invocation loop, if `!catProducedOutput && hadProviderError` → trigger a2a_timeout

## Task 3: Retry burst detection in AgentRouter

**Files:**
- Create: `packages/api/src/domains/cats/services/frustration/retry-burst-detector.ts`
- Modify: AgentRouter (collectAndDetectTextFrustration 旁边加 retry burst)
- Detection: compare current message with last 5 user messages, ≥3 similar (first 30 chars match) → trigger

## Task 4: Issue list API (AC-C3)

**Files:**
- Modify: `packages/api/src/routes/frustration-issue-routes.ts` (add GET /api/frustration-issues)
- Test: route tests

## Task 5: End-to-end verification

- `pnpm check` + all F222 tests pass
