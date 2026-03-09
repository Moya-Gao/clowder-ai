---
feature_ids: [F081]
topics: [bubble, duplicate, placeholder, stream, rendering]
doc_kind: bug-report
created: 2026-03-08
---

# Bug Report: F081 残余瞬时重复气泡

## 1. 报告人
- 报告人：铲屎官（2026-03-08）
- 发现方式：真实使用中偶发看到自己的消息或猫猫回复短暂出现两条；`F5` 后恢复为一条

## 2. 复现步骤
1. 让猫猫在前台 thread 里持续输出，尤其是会先产出 `thinking` / `web_search` / `rich_block` / tool event 的回复。
2. 在前台仍有 streaming bubble 的窗口内，观察主区消息列表。

期望行为：
- 同一条用户消息或 assistant 回复在前端只显示一次。

实际行为：
- 主区偶发会短暂出现两条内容相同的气泡。
- 页面 `F5` 后只剩一条，说明服务器真相源通常并没有真的存两份。

## 3. 根因分析
- 上一刀 `F081` 修掉了“replace hydration 抹掉已显示气泡”，但还留下另一条身份断层：
  - 前台 `useAgentMessages.ts` 在处理 `thinking` / `rich_block`，以及部分 `tool_use` / `tool_result` / `web_search` 占位时，只认 `activeRefs.current`
  - 一旦 `activeRefs` 因切换、重建或时序窗口丢失，而 store 里其实已经有一条对应的 `isStreaming` assistant bubble，这些路径不会像普通 `text` 那样先“认领旧 bubble”，而是直接再起一条新的 placeholder
- 因为这份重复只存在于前端本地 store，等历史重新拉齐或 `F5` 后按服务器真相源重建时，就只剩一条

## 4. 修复方案
- 抽出统一的 `ensureActiveAssistantMessage()`：
  - 先看 `activeRefs`
  - 再看 store 里已有的同猫 `isStreaming` bubble
  - 只有前两步都找不到时才创建新的 placeholder
- 让前台这几类 assistant 占位都共用同一套认领逻辑：
  - `tool_use`
  - `tool_result`
  - `system_info.web_search`
  - `system_info.thinking`
  - `system_info.rich_block`

为什么选它：
- 这是根因层修复，不是继续在 replace/hydration 末端做补丁式去重。
- 能统一“前台普通文本”和“前台系统消息占位”的身份恢复语义。

## 5. 验证方式
- 新增回归测试：
  - 当 store 里已存在 streaming bubble，而 `thinking` 晚到且 `activeRefs` 丢失时，应复用旧 bubble
  - 当 store 里已存在 streaming bubble，而 `rich_block` 晚到且 `activeRefs` 丢失时，应复用旧 bubble
- 回归现有相关测试：
  - `useAgentMessages-invocation-created`
  - `useChatHistory-replace-hydration`
  - `useSendMessage-thread-source`
  - `chatStore-multithread`
