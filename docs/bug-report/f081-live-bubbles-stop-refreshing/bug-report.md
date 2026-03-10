---
feature_ids: [F081]
topics: [bubble, streaming, hydration, invocation, rendering]
doc_kind: bug-report
created: 2026-03-09
---

# Bug Report: F081 增量气泡中途停止刷新

## 1. 报告人
- 报告人：铲屎官（2026-03-09）
- 发现方式：真实使用中观察到主区气泡增量不再继续刷新，但 `F5` 后能看到更完整的最终内容

## 2. 复现步骤
1. 让猫猫在前台 thread 里持续 streaming 回复。
2. 在回复中途触发一次 replace hydration，让主区从 `/api/messages` 追上当前 invocation 的正式消息。
3. 继续观察同一条 assistant 气泡的后续增量。

期望行为：
- 已显示的 streaming bubble 持续收到后续 chunk，不需要 `F5`。

实际行为：
- 主区气泡在中途看起来“卡住”，不再继续增长。
- `F5` 后重新按服务器真相源加载，又能看到更完整的内容。

## 3. 根因分析
- `useChatHistory` 的 replace hydration 允许“同一 `catId + invocationId` 的正式历史消息”替换掉本地 streaming bubble。
- 但 `useAgentMessages` 里的 `activeRefs.current` 仍然抱着旧的本地 message id。
- 后续 text/tool/thinking 增量到来时，前台继续往这个旧 id 调 `appendToMessage` / `setMessageThinking`。
- 旧 id 此时已经不在 store 里，所以这些增量等于写进空气；直到 `F5` 或后续 history reload，服务器里已经积累的最终内容才重新显示。

## 4. 修复方案
- 不再盲信 `activeRefs` 里的缓存 id，先验证它在当前 store 里仍然存在。
- 如果 replace hydration 已经把本地 bubble 换成了 server message，则按 `catId + invocationId` 从现存 assistant message 里重新认领目标。
- 若认领到的正式历史消息当前不是 `isStreaming`，立即补回 `setStreaming(true)`，让后续 chunk 继续落在同一条气泡上。

为什么选它：
- 这是“本地 stream 写目标漂移”的根因修复，不是再靠 `F5`/history reload 打补丁。
- 修复点集中在 `useAgentMessages`，不会重新扩大 `useChatHistory` 的 merge 复杂度。

## 5. 验证方式
- 新增回归测试：本地 live bubble 的 id 被 hydration 换成 server id 后，下一批 text chunk 仍会落到 server id 上。
- 回归现有 placeholder / invocation_created 测试，确保原有“丢 ref 后恢复”路径不回退。
- 跑相关 `useAgentMessages / useChatHistory / useSocket` 回归 + `web build` + `lint`。
