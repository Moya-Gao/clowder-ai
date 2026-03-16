# F123 Closure Plan

**Feature:** F123 — [docs/features/F123-bubble-runtime-correctness.md](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F123-bubble-runtime-correctness.md)
**Goal:** 把 F123 从“几个关键路径有效”推进到“bubble identity / reconcile / recovery 有系统性收口证据，足以 close”。
**Acceptance Criteria:**  
- AC-A1: 产出一份 code-backed bubble state model，逐条映射当前真实写入入口与字段职责  
- AC-A2: replay harness 的首批 fixture 至少覆盖 active late-bind 双影 + background ref-lost 停更 两条主路径  
- AC-A3: 每个进入 F123 的现场症状都能映射到某个 fixture，而不是只保留口头描述  
- AC-B1: active / background / history / draft / queue 的 assistant bubble 创建路径统一遵守同一身份 contract  
- AC-B2: 同一 `catId + invocationId + bubble kind` 不会在 store 中稳定存在两条 text bubble  
- AC-B3: placeholder 升级为正式消息时遵守单调规则，不会因 id swap / hydration / late bind 产生影子 bubble  
- AC-B4: 同一 invocation 下，语义重叠的 callback text 到达时会替换对应 stream text，而不是新增第二条 bubble  
- AC-B5: dev/test 模式下提供 invariant 断言或诊断日志，能直接指出 duplicate 是在哪个入口创建的  
- AC-C1: F5、thread switch、replace hydration、draft recovery 后，用户看到的同一条消息满足单调可见性  
- AC-C2: 针对已知历史症状的 replay/golden tests 全绿：瞬时双影、stream 停更、draft/hydration 身份断层、rich block 落错 bubble、queue/hydration 乱序  
- AC-C3: 提供 bubble provenance / timeline dump 的最小可用调试能力，能导出一次 invocation 的关键 lifecycle  
- AC-C4: F123 完成时，剩余未解问题必须明确分流为 provider/runtime 问题或 follow-up feature，不能再以“散装 bug”留在空气里  
**Architecture:** 先补 code-backed truth model 和 symptom→fixture 映射，再把 identity contract/invariant 下沉到共享 helper 与 store 诊断，最后用 replay suite 封住 F5/thread switch/draft/queue 等恢复路径。`MessageWriter` 不是前置，只有 shared helper 在 3+ 入口同构复用时才升级。当前现场的“thread switch 时裂成两个，F5 后归一”要被当成同一套 monotonic recovery 失败来处理，不单开绕路热修。  
**Tech Stack:** React hooks, Zustand chat store, Vitest, existing invocation debug timeline.  
**前端验证:** Yes — reviewer 必须用浏览器在 Alpha 环境验证 F5 / thread switch / callback replacement 的真实表现。  

---

## Straight-Line Check

- **Finish line**：F123 close 时，我们能拿代码、fixture、timeline 和浏览器证据证明 bubble 这条线已经系统性收口，而不是只修掉几个高频 case。
- **不做的事**：不在本轮引入大一统 `MessageWriter` 重构；不把 provider/runtime hang 混进 F123；不把测试临时工件治理混进这条线。
- **不做的事**：不做整页刷新、偷偷 F5、thread-scoped reload 之类把症状藏起来的绕路操作；修复必须落在 identity contract / reconcile / recovery 本身。
- **终态 schema**：
  - `BubbleIdentity = { catId, invocationId, bubbleKind, originPhase }`
  - `BubbleLifecycle = create → append → replace → finalize → hydrate-recover`
  - `BubbleInvariant = same identity key must not stably exist as 2 text bubbles`
  - `SymptomFixture = one historical symptom ↔ one replay fixture ↔ one verification target`

## Task 1: Truth Model 收口（AC-A1, AC-A3）

**Files:**
- Create: `packages/web/src/debug/bubbleIdentity.ts`
- Create: `packages/web/src/debug/__tests__/bubbleIdentity.test.ts`
- Create: `docs/features/assets/F123/symptom-fixture-matrix.md`
- Modify: `docs/features/F123-bubble-runtime-correctness.md`

**Plan:**
1. 定义最终身份模型：`messageId / invocationId / catId / bubbleKind / originPhase / provenance`
2. 把现有写入口逐条挂到模型上：active / background / history / draft / queue
3. 建 symptom-fixture 矩阵，把历史 bug report 全挂到 fixture 名称，不再只靠截图和口头描述
4. 先写 identity helper 单测，再写最小实现

**验证:**
- `pnpm -C packages/web test -- --run src/debug/__tests__/bubbleIdentity.test.ts`
- 文档检查：feature doc / symptom-fixture-matrix 能一一对上现有 bug report

## Task 2: Replay Harness 扩容到剩余历史症状（AC-A3, AC-C2）

**Files:**
- Create: `packages/web/src/hooks/__tests__/helpers/bubbleReplayHarness.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useSocket-background.test.ts`

**Plan:**
1. 先把现有 active/background 两条 fixture 提炼成 shared replay helper
2. 再补剩余历史症状：
   - thread switch 时裂成两个，F5 后归一（当前 Alpha 现场）
   - F5 后双影 / 单调可见性
   - thread switch 后 hydrate 不一致
   - draft/hydration 身份断层
   - rich block 落错 bubble
   - queue/hydration 乱序
3. 每个症状都要求：先红灯，再最小实现，再并入 matrix

**验证:**
- 针对上述 5 类症状的 replay/golden tests 全绿
- `docs/features/assets/F123/symptom-fixture-matrix.md` 中每条都能指向具体测试文件

## Task 3: Identity Contract + Store Invariant（AC-B1, AC-B2, AC-B3, AC-B5）

**Files:**
- Create: `packages/web/src/hooks/bubbleIdentityContract.ts`
- Modify: `packages/web/src/hooks/useAgentMessages.ts`
- Modify: `packages/web/src/hooks/useSocket-background.ts`
- Modify: `packages/web/src/hooks/useChatHistory.ts`
- Modify: `packages/web/src/stores/chatStore.ts`
- Create: `packages/web/src/stores/__tests__/chatStore-bubble-invariants.test.ts`
- Modify: `packages/web/src/debug/invocationEventDebug.ts`

**Plan:**
1. 抽出 shared identity/reconcile helper，先接 active/background/history 三个主入口
2. 明确 placeholder → formal / stream → callback / local → hydrated 的升级顺序
3. 在 store 增 invariant 诊断：同 identity key 的 duplicate text bubble 直接报 debug event
4. 只有在 helper 在 3+ 入口同构复用后，才评估是否升级为 `MessageWriter`

**验证:**
- `pnpm -C packages/web test -- --run src/stores/__tests__/chatStore-bubble-invariants.test.ts src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useChatHistory-replace-hydration.test.ts`
- `dumpBubbleTimeline()` 能指出 duplicate 是从哪个入口创建的

## Task 4: Monotonic Recovery 封口（AC-C1, AC-C2）

**Files:**
- Modify: `packages/web/src/hooks/useChatHistory.ts`
- Modify: `packages/web/src/hooks/useAgentMessages.ts`
- Modify: `packages/web/src/hooks/useSocket-background.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-replace-hydration.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useChatHistory-queue.test.ts`

**Plan:**
1. 把 F5 / thread switch / replace hydration / draft recovery 统一成“只能补齐或替换为更强版本”
2. 对未带 `invocationId`、late chunk、history callback-over-stream、queue cancel/restart 做统一恢复语义
3. 用 Alpha 环境做浏览器实测，重点看：
   - F5 前后是否仍一会两条一会一条
   - thread switch 当下是否先裂成两个，随后再被 hydration 合一
   - thread switch 回来后是否出现影子 bubble
   - queue steer/cancel 后 loading 是否残留

**验证:**
- replay suite 绿
- 浏览器验证证据：F5 / thread switch / queue 3 个场景截图或录屏

## Task 5: 收尾分流与 close 准备（AC-C4）

**Files:**
- Create: `docs/features/assets/F123/remaining-issues-triage.md`
- Modify: `docs/features/F123-bubble-runtime-correctness.md`
- Modify: `docs/BACKLOG.md`（仅在 close 时）

**Plan:**
1. 把剩余异常逐条分流：provider/runtime / 新 feature / 已接受的边界
2. 更新 F123 spec：只勾真实完成的 AC，不做“体感 close”
3. 满足 close 条件后再走愿景守护和 feat completion

**验证:**
- `remaining-issues-triage.md` 中每条都有 owner 和去向
- F123 feature doc 中 12 个 AC 全部有代码/测试/证据锚点

## Execution Order

1. Task 1 — Truth Model
2. Task 2 — Replay Harness 扩容
3. Task 3 — Identity Contract + Invariant
4. Task 4 — Monotonic Recovery 封口
5. Task 5 — 分流与 close 准备

## Reviewer Plan

- 代码 review：`@opus`
- 愿景守护 / close gate：`@opus-45` 或另一只非作者、非 reviewer 的猫
- 浏览器验证：优先 Alpha 环境，不碰 runtime

## Exit Criteria

只有同时满足下面 4 条，F123 才能 close：

1. 12 个 AC 都有代码/测试/证据锚点
2. Alpha 环境验证通过 F5 / thread switch / queue 关键场景
3. 剩余问题已分流，不再悬空
4. 愿景守护明确判定“可以 close”
