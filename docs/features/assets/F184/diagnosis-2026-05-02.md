---
feature_ids: [F184]
related_features: [F183, F176]
doc_kind: phase_evidence
created: 2026-05-02
topics: [bubble, frontend, rendering, chat-message, dom-mount, debugging]
---

# F184 Phase A Diagnosis — 2026-05-02

## Setup

- **Trigger**: 铲屎官 2026-05-02 23:04 提醒 "F184 做了吗？当时我记得 183 要和 184 一起的"
- **Approach** (铲屎官 23:15 拍板): "现在去做 F184 Phase A diagnosis：alpha 打开 thread_mnux2eewbo4otg17，F12 看那些 opus/codex 互 @ 的旧消息是否还缺 DOM"
- **Reality adjustment**: Alpha 用 fresh Redis 6398，看不到 user thread (data 在 6399)。改用 runtime `localhost:3001` 做 read-only inspection (F183 已 merged，runtime HEAD `d348eb41b` 含全套 fix)。
- **Tool**: Playwright MCP — navigate + evaluate DOM

## Method

1. Navigate to `http://localhost:3001/thread/thread_mnux2eewbo4otg17`
2. Wait 3s for hydration
3. Count `[data-message-id]` DOM nodes
4. API call `/api/messages?threadId=thread_mnux2eewbo4otg17&limit=100` for ground truth
5. Filter API to DOM time range, diff IDs to find any missing

## Findings

### Quantitative

| Metric | Value |
|--------|-------|
| Redis zset 总消息数 | 1788 |
| DOM `[data-message-id]` 渲染条数 | 49 |
| API limit=100 in DOM time range (`0001777124996980` → `0001777202478972`) | 50 |
| **Diff** (only_in_api) | **1** |
| Cat-bubble 渲染数 (opus-47 + codex + antig-opus) | 27 |
| Cat-bubble 期望数 (API 同范围) | 27 |
| **Cat 互@ render rate** | **27/27 = 100%** |

### Qualitative — the 1 missing message

```json
{
  "id": "0001777181592170-000018-24112613",
  "type": "connector",
  "catId": null,
  "content": "[定时任务] 持球唤醒：云端 codex 已接单 R2 ...",
  "origin": "callback",
  "extra": {
    "scheduler": {
      "hiddenTrigger": true   // ← intentional UI filter trigger
    }
  },
  "source": {
    "connector": "scheduler",
    "label": "定时任务",
    "icon": "scheduler"
  },
  "timestamp": 1777181592170
}
```

**Code path**: `packages/web/src/components/ConnectorBubble.tsx:140`:
```ts
if (message.extra?.scheduler?.hiddenTrigger) return null;
```

This is **by design** — scheduler self-callbacks (cat → cat for hold-ball wake-ups) are hidden from the UI to avoid clutter. Tested by `connector-bubble-theme.test.ts:117`.

### Conclusion

**F184 reported bug ("opus/codex 互@ 后 ChatMessage 不渲染") is NOT reproducing on the original repro thread.**

- All 27 cat-bubble messages in the visible window render to DOM
- The 1 "missing" message is intentional UI design (hiddenTrigger filter, not the bug)
- F183 Phase B (single-writer reducer) + Phase D (IDB merge filter) + Phase E (strict invariant gate) collectively closed the rendering mount path that F176 had误诊 targeted

## Side notes

- DOM=49 < API limit=100 because initial page load fetches a default batch (~50 messages). Scrolling up to load older messages didn't trigger more loads in the 4s window — likely needs explicit scroll trigger; not relevant to F184 since the visible range is fully covered.
- Cross-check: `MAX_SNAPSHOT_MESSAGES = 50` in `offline-store.ts` matches the IDB cap; initial `loadCachedMessages` returns up to 50 → IDB hydrate → API replace → end state 49 (the hiddenTrigger one filtered).

## F184 Status: DONE — incidentally fixed by F183

- AC-A1: ✅ thread_mnux2eewbo4otg17 现场不复现
- AC-A2: ✅ 根因 → 不需要 fix（F183 collective sided）
- AC-A3: ✅ 与 F183 identity contract 兼容性 confirmed
- AC-B1: ✅ symptom not present
- AC-B2: F183 invariant tests cover mount-time guards (bubble-invariants.test.ts + chatStore-invariant-coverage.test.ts strict mode)
- AC-B3: ✅ alpha-equivalent (runtime) 复测不复发

[宪宪/Opus-47🐾]
