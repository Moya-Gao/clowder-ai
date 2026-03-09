---
feature_ids: [F086]
related_features: [F079, F055, F037]
topics: [collaboration, routing, mcp, multi-mention, orchestration]
doc_kind: spec
created: 2026-03-08
---

# F086 Cat Orchestration — 多重 @ + 回流路由

## Why

当前猫猫 @ 其他猫受 CLI mention ≤2 限制（防提示词注入广播风暴）。但在协作场景中，猫猫经常需要主动收集多方意见（如设计讨论拉 3 只猫），目前只能由铲屎官手动协调。

铲屎官原话 (2026-03-08)：
> "猫猫想要 multi at 其他猫 可能需要有个方式解除 =2 的限制 那就是用现在的猫猫调用 MCP。只是 CLI 的 at xxx 还是保留限制。"
> "这个模式可能就是 布偶猫 at 三只猫；三只猫这里不能 at 其他猫了。然后他们回答完自动路由到你这个 at 发起者。"

## What

### 核心能力

**MCP 多重 @**：猫猫通过 MCP 工具（而非 CLI @）发起多猫协作，绕过 ≤2 限制。

**回流路由**：被 @ 的猫回答后，结果自动路由回发起者猫，而非等铲屎官转发。

**防扩散**：被 @ 的猫不能在回答中再 @ 其他猫（防止级联广播），只能回答发起者的问题。

### 交互流程

```
铲屎官 @opus "帮我设计一下这个功能"
    ↓
布偶猫思考后，需要收集意见
    ↓
调 cat_cafe_multi_mention({
  targets: ['codex', 'gemini', 'gpt52'],
  question: "这个 API 设计你们怎么看？附上方案...",
  mode: 'parallel'  // parallel | sequential
})
    ↓
三只猫各自收到消息（parallel routing）
  ├── codex 回答 → 自动路由回 opus
  ├── gemini 回答 → 自动路由回 opus
  └── gpt52 回答 → 自动路由回 opus
    ↓
布偶猫收到三份回答，综合后给铲屎官
```

### 安全模型

| 层面 | 规则 |
|------|------|
| CLI @ | 保留 ≤2 限制（防提示词注入） |
| MCP multi_mention | 无上限（猫猫自主意图，非用户输入解析） |
| 被 @ 猫 | **禁止** 在回答中 @ 其他猫（防级联） |
| 回流 | 自动路由回发起者，不经过铲屎官 |

### MCP 工具设计

```typescript
// MCP tool: cat_cafe_multi_mention
{
  targets: CatId[];      // 要 @ 的猫猫列表
  question: string;      // 问题/请求内容
  mode: 'parallel' | 'sequential';  // 并行还是顺序
  context?: string;      // 附加上下文（如代码片段、设计方案）
}
```

### 后端改动

1. **新增 MCP tool handler** `cat_cafe_multi_mention`
2. **routing 层扩展**：
   - 增加 `callbackTo: CatId` 字段标记回流目标
   - route-parallel 完成后，汇总结果发回 `callbackTo`
3. **防扩散**：被 multi_mention 召唤的猫，其回复中的 @ mention 被忽略
4. **提示词注入**：被召唤的猫的 system prompt 中注入"你正在回答 {发起者} 的问题，回答后会自动路由回去"

### 提示词 / Skills 更新

- Skills 告知猫猫有 `cat_cafe_multi_mention` 工具
- 协作指南：什么时候该自己想 vs 什么时候该拉猫讨论
- 礼仪：不要滥用（每个问题都拉全体）

## Acceptance Criteria

- [ ] MCP 工具 `cat_cafe_multi_mention` 可被猫猫调用
- [ ] parallel 模式：所有 targets 同时收到消息
- [ ] sequential 模式：一只猫回答完再通知下一只
- [ ] 回流路由：被 @ 猫的回答自动路由回发起者
- [ ] 防扩散：被 @ 猫不能再 @ 其他猫
- [ ] CLI @ 限制 ≤2 保持不变
- [ ] Skills/提示词更新，猫猫知道有这个工具和使用礼仪

## Dependencies

- Evolved from: F079（投票系统，猫猫协作的先例）
- Related: F055（A2A MCP Structured Routing — targetCats 路由）
- Related: F037（Agent Swarm — 多猫协同模式）

## Risk

- 中风险：回流路由是 routing 核心改动，需要严格测试
- 防扩散逻辑可能有边界情况（如猫猫在回答中提到 @xxx 但不是 mention）
- 提示词膨胀：新工具 + 使用指南增加 prompt 长度

## Open Questions

- sequential 模式是否需要？还是先只做 parallel？
- 回流结果是原文转发还是发起者看到汇总摘要？
- 被 @ 猫的回答字数/长度是否要限制？
- 和 F037 Agent Swarm 的关系：是 swarm 的子集还是独立能力？

## Review Gate

- 跨猫 review：@codex（安全边界） + @gpt52（架构）

## Timeline

| Date | Event |
|------|-------|
| 2026-03-08 | Kickoff — 铲屎官提出需求 |
