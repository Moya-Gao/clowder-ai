---
feature_ids: [F123]
related_features: [F081]
topics: [bubble, message-identity, reconcile, hydration, state-machine]
doc_kind: discussion
created: 2026-03-14
---

# F123 Kickoff Discussion: Bubble Runtime Follow-up

**Thread ID**: `thread_mmrac56gur1luogf`  
**日期**: 2026-03-14  
**参与者**: 铲屎官、布偶猫/宪宪（opus）、金渐层（opencode）、缅因猫/砚砚（gpt52）

## 背景

铲屎官明确提出：前端气泡问题从第一天修到现在，已经不接受继续靠零散补丁维持；要求我们基于代码重新收敛三猫观点，并新开一个明确从 `F081` 演进而来的 follow-up feature。

## 代码证据（本轮收敛的共同底板）

本轮讨论以代码为准，不以猜测为准。我们共同确认的关键入口：

1. `packages/web/src/hooks/useChatHistory.ts`
   - `mergeReplaceHydrationMessages()` 是 history replace / hydration 的核心 reconcile 点
2. `packages/web/src/hooks/useAgentMessages.ts`
   - active thread 的 bubble 建立、认领、late bind 都在这里
3. `packages/web/src/hooks/useSocket-background.ts`
   - background thread 的同类逻辑在这里，不能只修 active path
4. `packages/web/src/stores/chatStore.ts`
   - `messages` 的多入口写入和 `id` 级去重都在这里

本轮已被代码和 thread 证据否掉的假设：

- “当前截图的根因是 stream vs callback 双路径同时各起一个 bubble”  
  - 否决原因：这能解释一部分历史问题，但不能解释本轮截图和现有代码下的主症状；更硬的证据指向 `invocationId` 身份链在 active/background → hydration 的交界处断裂

## 各方观点摘要

### 布偶猫 / 宪宪

- 现状没有一个 active feature 在 owning 这条线，`F081` 虽然最接近，但已经 done
- 根因不是单个 bug，而是实时路径与持久化路径之间缺少统一身份契约
- 修复应该分层：
  - 身份契约收敛
  - 前端去重机制加固
  - 可观测性补强

### 金渐层 / opencode

- 先承认上一轮把根因押成了 stream vs callback 双路径，这是错误方向
- 这次更认同“需要系统性治理”而不是继续 hotfix
- 强调新 feature 不应再按症状命名，而应以 correctness / invariant / debug gate 为中心
- 提出三层结构：
  - invariant 防守层
  - debug timeline 侦查层
  - MessageWriter/统一写入层减负

### 缅因猫 / 砚砚

- “有历史追踪，但没有现役 owner” 是目前最准确的状态描述
- 建议新开一个 follow-up feature，明确 `Evolved from: F081`
- 修复思路分 4 段：
  - 真相模型
  - 写路径收敛
  - 恢复语义重做
  - replay/golden tests

## 共识区

1. 应该新开独立 feature，不继续把这条线塞回已 done 的 F081
2. 新 feature 必须明确从 F081 演进而来，并继承其审计/证据基础
3. 当前问题不是单一 UI 症状，而是：
   - bubble 身份契约
   - reconcile / hydration 状态机
   - 多写入入口缺少统一语义
4. 修复顺序不能继续是“先打一刀 hotfix 再等下一个症状出现”，必须先立 state model / invariant / replay fixtures
5. active path 和 background path 必须一起设计；只修其中一条会继续留下镜像问题
6. Phase A 的第一批 replay fixture 至少要同时覆盖 active late-bind 双影 和 background ref-lost 停更 两条主路径

## 分歧区

### 已收敛分歧：stream vs callback 是否是本轮总根因

- 早期分歧：金渐层曾认为本轮主要是 stream bubble + callback bubble 双路径
- 收敛结果：否。对照当前代码和现场证据，这不是本轮主根因
- 结论：保留 callback 作为相关路径，但不把它写成 F123 的总根因

## 待决事项

1. callback 与 stream 的“语义重叠”判断应落在 hook 层还是 shared helper 层，暂不下到 store 基础层
2. `MessageWriter` 是否会在 Phase B 结束后仍然必要，留待 helper 方案落地后复核

## 行动项

1. kickoff `F123`，明确 `Evolved from: F081`
2. 把已知现场 bug 挂到 F123 的 replay fixture 清单，不再只保留截图和口头描述
3. Phase A 首先产出两个 fixture：active late-bind 双影、background ref-lost 停更
4. 在动实现前先完成 code-backed truth model / 写路径清单 / state machine 草图

## 2026-03-14 晚间补充对齐

在 F123 draft 落盘后，布偶猫与金渐层又对三个 OQ 给出了更具体的代码层意见，已收敛为：

1. **callback vs stream**
   - 同一 invocation 下，语义重叠的 callback text 不应与 stream text 长期并存
   - 默认规则：callback 替换 stream
   - 但具体判断先放在 hook/shared helper 层，不让 store 基础层先变“过聪明”

2. **MessageWriter**
   - 不作为 F123 的前置交付
   - 先落 shared reconcile helper + invariant；如果做完仍显著分散，再决定是否演进成 Writer

3. **provenance / timeline**
   - 先做 `window.__catCafeDebug.dumpBubbleTimeline()` 级别的 dump
   - 不做 UI 入口

## 收敛检查

1. 否决理由 → ADR？没有。本轮是 follow-up feature 立项与修复策略收敛，不涉及新架构 ADR
2. 踩坑教训 → lessons-learned？有待补充。本轮至少确认了一条教训：bubble 问题不能只按症状 hotfix，必须先立身份与状态机模型
3. 操作规则 → 指引文件？暂不新增。先落到 F123 spec 和 replay gate，再视是否上升为 shared rule
