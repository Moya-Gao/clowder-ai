---
feature_ids: [F184]
related_features: [F176, F183]
topics: [bubble, frontend, rendering, chat-message, dom-mount, debugging, live-reconcile]
doc_kind: spec
created: 2026-04-30
---

# F184: ChatMessage Rendering Mount Investigation — F176 撤销后未查的 DOM 缺失真 bug

> **Status**: done — original DOM mount issue incidentally fixed by F183 Phase B-E architectural work (verified 2026-05-02 alpha walk on `thread_mnux2eewbo4otg17`); stale live streaming bubble follow-up fixed by PR #1582 (2026-05-07) | **Owner**: 布偶猫/宪宪 (Opus-47) | **Priority**: P2
>
> **F184 close evidence**: 2026-05-02 runtime alpha walk on the original repro thread (`thread_mnux2eewbo4otg17`, 1788 messages in Redis): DOM rendered 49 messages in the most-recent 50-msg window, API returned 50 in the same range, the 1 "missing" message is `extra.scheduler.hiddenTrigger=true` (intentional UI filter at `ConnectorBubble.tsx:140`, NOT the F184 bug). All cross-cat 互@ messages render correctly: opus-47 (17), codex (8), antig-opus (2) = 27/27 cat bubbles visible. F183 Phase B (single-writer reducer) + Phase D (IDB merge filter) + Phase E (strict invariant gate) collectively closed the rendering mount path that F176 误诊 had targeted.
>
> **2026-05-07 live follow-up**: 铲屎官 reported an old Opus bubble still showing `CLI Output · streaming` after Opus had finished and Codex was active; F5 / thread switch recovered because history hydration loaded the finalized server state. Root cause was the live `/queue` reconcile path: it rebuilt active server slots but did not finalize local streaming assistant bubbles whose `catId` was absent from server active slots. PR #1582 added a frontend reconcile helper in `useSocket.ts` plus regression coverage that finalizes stale absent-cat bubbles while preserving the active cat bubble.

## Why

F176 (Native CLI Assistant-Speech vs CLI-Stdout) 在 2026-04-26 被铲屎官 revert，原因是误诊——把"DOM 缺失"误读成"内容被折叠"。F176 修了不存在的 bug，**真 bug 至今没人查**。

铲屎官原话（2026-04-26 01:02，三个感叹号纠正）：
> "我滴吗 这个 f176 你们完全理解错了啊，当时是为了修这个 bug 的，就是布偶猫和缅因猫互相 at 然后互相说话了，但是我前端连他们的头像 cli thinking 什么都看不到！！"

`thread_mnux2eewbo4otg17` 实测现象：
- ✅ 顶部缅因猫 GPT-5.5 那条消息：完整渲染（头像 + 标题 + CLI Output）
- ✅ BriefingCard 系统消息 / DirectionPill：正常渲染
- ❌ opus / codex 互 @ 之后的所有 cat 消息：**整条 ChatMessage 不渲染**
  - 没头像 / 没标题 / 没气泡 div / 没 CLI Output
  - 但 messageStore 里有 opus-47 / codex 的 message.content（多条真实存在）

**真问题**：store 有数据，前端 `ChatMessage` 不渲染它们 —— 是 **rendering mount 层** bug，不是 identity contract 层（这就是 F183 不收编它的原因，见 F183 KD-8）。

## What

调查 ChatMessage 不 mount 到 DOM 的根因。候选层（不预设结论）：

- ChatMessage 早 return null（条件判断）
- dedup 误杀
- merge 吃掉
- catData 缺失（catId 找不到 catalog metadata）
- 其它 mount-time 守卫

**禁止凭印象猜根因**（F176 误诊教训）。必须基于 F12 实测 DOM + 代码定位。

## Phases

### Phase A: Repro & Diagnosis（在 F183 Phase A done 后启动）

- 复现 thread_mnux2eewbo4otg17 现场（或新构造同型 thread）
- F12 看 DOM 是否有占位 vs 完全无元素
- 沿 ChatMessage 渲染链定位早 return / dedup / merge / catData / mount 哪一层吃了消息
- 用证据排除每一层，不止血式补 fallback

### Phase B: Fix（与 F183 后续 Phase 串行，不并发）

按 Phase A 结论修对应层；新增 mount-time 守卫测试 + 回归测试。

2026-05-07 follow-up fix: original mount-layer Phase B remained unnecessary, but F184 got a live-state reconcile patch for stale streaming bubbles after F183/F184 close. This is a separate live `/queue` hydration gap, not a backend persistence or ChatMessage mount bug.

## Acceptance Criteria

### Phase A（Diagnosis）
- [x] AC-A1: thread_mnux2eewbo4otg17 现场重新检查（2026-05-02 alpha walk via Playwright）— **现象不复现**：49/49 expected DOM nodes (50 API msgs - 1 intentional hiddenTrigger filter) all 渲染。F183 work 已经 collectively 修了这条线。Evidence: docs/features/assets/F184/diagnosis-2026-05-02.md
- [x] AC-A2: 根因定位 — 不需要 fix。F183 reducer single-writer + Phase D IDB merge filter + Phase E strict invariant gate 覆盖了 mount-link 上 identity-related 的所有 early return / dedup / merge 路径。catData 缺失场景未在该 thread 复现（cat-catalog 默认包含所有内置 cats）。
- [x] AC-A3: 与 F183 identity contract 兼容性确认 — F183 全 phase code 落地后 thread 复测，识别度 100%。

### Phase B（Fix）— **NOT NEEDED**
- [x] AC-B1: 现象消失 (Phase A 验证已 confirm — F183 sided)
- [x] AC-B2: F183 new tests cover mount-time identity invariants（bubble-invariants.test.ts + chatStore-invariant-coverage.test.ts strict mode = ChatMessage mount 前置条件保护）
- [x] AC-B3: alpha 实测 thread_mnux2eewbo4otg17 现象不复发 (2026-05-02 验证)

### Phase C（Live stale streaming bubble follow-up）
- [x] AC-C1: 定位 live-only stale bubble 根因 — server `/queue` slots 不再包含 finished cat，但 local streaming assistant bubble 仍保持 `isStreaming=true`；F5 / thread switch 自愈来自 history hydrate，不是后端未落盘。
- [x] AC-C2: stale absent-cat bubble 被 finalize，active cat bubble 不被误杀 — `packages/web/src/hooks/__tests__/useSocket-stale-watchdog.test.ts` 覆盖 stale Opus (`catId='opus'`) finalize + active Codex (`catId='codex'`) preservation。
- [x] AC-C3: 合入证据 — PR #1582 merged 2026-05-07 (squash `7a579cc2`); `pnpm gate` passed on `589a92ca`; cloud Codex review reported no major issues; inline P0/P1/P2 scan empty。

### 端到端
- [x] AC-E1: 与 F183 实施 Phase 不重叠 — F184 close 在 F183 全 done 后做，零并发（KD-2 honored）
- [x] AC-E2: F176 误诊教训沉淀 — 已记入 F183 spec § Why "F176 误诊后真 bug 没人查" 历史段落 + F184 spec 整体作为"先排查 DOM 实证再下结论"的方法论范例

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "我前端连他们的头像 cli thinking 什么都看不到" (2026-04-26) | AC-A1, AC-B1 | F12 + alpha | [x] (2026-05-02 alpha 复测不复现 — 27/27 cat 互@ messages 渲染) |
| R2 | F176 误诊后真 bug 没人查 | AC-A2, AC-B1 | code review + repro | [x] (查了 — F183 collective fix 覆盖) |
| R3 | 不能与 F183 并发去修（避免引入新不一致） | AC-E1 | roadmap 检查 | [x] (F184 在 F183 全 done 后做，零并发) |
| R4 | F176 误诊教训沉淀 | AC-E2 | lessons-learned 链接 | [x] (F184 整体闭环 — diagnosis 方法论本身就是教训范例) |
| R5 | "布偶猫其实都回答完了，现在是缅因猫但是他气泡还是这样；F5 / 切换 thread 又正常" (2026-05-07) | AC-C1, AC-C2, AC-C3 | live reconcile test + merge gate | [x] (PR #1582 fixed stale absent-cat streaming bubble finalize) |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式

## Dependencies

- **Blocked by**: F183 Phase A（identity contract 必须先稳定，~2026-05-04 完成）
- **Related**:
  - F176（reverted 2026-04-26，本 feature 是其真 bug 的独立排查 successor）
  - F183（架构层重构；KD-8 明确 F184 不并入 F183 + roadmap 串行）
- **Roadmap 串行**：F183 Phase A done → F184 启动；F184 Phase B 与 F183 Phase B-E 实施时间线串行，不重叠

## Risk

| 风险 | 缓解 |
|------|------|
| 复现失败 | thread_mnux2eewbo4otg17 历史数据已存在，理论可重放；不行就构造同型 thread（多猫互 @）|
| 根因可能横跨 mount 链多层 | Phase A 显式排除每一层，不止血式补 fallback（F176 教训）|
| 与 F183 reducer 改动冲突 | roadmap 串行；每 PR rebase 等 F183 B1 落地后再 merge；冲突率高时主动 hold |
| 重蹈 F176 误诊覆辙 | Spec § Why 必须基于图/原话 verbatim quote；Phase A AC 必须用 DOM 证据，禁止凭印象 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | thread_mnux2eewbo4otg17 是否还能复现？还是历史 thread state 被 ledger 改写过？ | ✅ 2026-05-02 alpha walk 不复现；1 条差异为 intentional hiddenTrigger filter |
| OQ-2 | 是否需要构造一个稳定 fixture（多猫互 @ 长 invocation）作为 regression suite？ | ✅ original mount bug 不需要；live stale bubble 另由 `useSocket-stale-watchdog.test.ts` 回归锁定 |
| OQ-3 | F184 owner 最终是 47 还是砚砚？跨 family review 路径如何安排？ | ✅ original diagnosis owner Opus-47；2026-05-07 follow-up 由砚砚修复、Opus 4.6 review |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F184 不并入 F183；分 feat 走 | rendering mount 层 ≠ identity contract 层（不同抽象层），F176 误诊教训说明混层修复风险高 | 2026-04-30 |
| KD-2 | F184 立项 + 实施时间线与 F183 串行（铲屎官 push back） | 耦合点：F183 改 message 数据结构 / reducer / cache contract；F184 改 ChatMessage mount——并发会 break 假设 + 文件冲突 | 2026-04-30 |
| KD-3 | Phase A 禁止凭印象猜根因，必须基于 F12 DOM 证据 + 代码定位 | F176 误诊教训：从图 → spec → 实现一路按错误前提推进，4 轮 review + cloud + alpha 验收都没人 push back § Why | 2026-04-30 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-30 | F184 stub 立项（铲屎官 push back F183 KD-A5 触发）；blocked by F183 Phase A |
| 2026-04-30 | F183 Phase A done（铲屎官自治放行 ADR-033 v2）→ F184 解锁立项（提前于 Roadmap 05-04）|
| 2026-05-02 | Phase A diagnosis 完成：原始 DOM mount 缺失现场不复现，F183 Phase B-E collective fix 覆盖 |
| 2026-05-07 | Live stale streaming bubble follow-up fixed and merged (PR #1582, squash `7a579cc2`) |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F183-bubble-pipeline-architecture-consolidation.md` | 串行依赖；F184 必须在 Phase A done 后启动 |
| **Feature** | `docs/features/F176-native-cli-assistant-speech-rendering.md` | reverted；本 feature 是其真 bug 的 successor |
| **Discussion** | `docs/discussions/2026-04-30-f183-bubble-pipeline-architecture/README.md` | KD-A5 v2 roadmap 串行约束来源 |
| **PR** | `https://github.com/zts212653/cat-cafe/pull/1582` | 2026-05-07 live stale streaming bubble reconcile fix |
