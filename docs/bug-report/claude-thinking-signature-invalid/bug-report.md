---
feature_ids: [F084]
topics: [claude, session, resume, rescue, self-heal]
doc_kind: bug-report
created: 2026-03-07
---

# Bug Report: Claude Resume 因损坏的 Thinking Signature 秒死

## 报告人
铲屎官（2026-03-07 21:22 - 23:15）

## 现象

同一批布偶猫 Claude session 在 `claude --resume <sessionId>` 时秒报：

```text
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.1.content.0: Invalid `signature` in `thinking` block"}}
```

新开 Claude session 正常，只有恢复旧 session 会死。

## 已确认影响

至少 6 条本地 Claude session 命中过相同病灶：

- `fcaafb86-7acd-4f1f-bb4d-4c5809da4979`
- `b0b6d295-a1f8-491b-91b1-b7301c7dee4e`
- `17fd326c-6ddc-44a0-be91-12d4852f360c`
- `07bdb2dc-314f-43b8-9749-81536a96f86c`
- `f2e066c6-7173-488a-9913-a66161fba4ed`
- `8760eebe-e315-4b5d-b331-6b938a2f89a8`

## 定位过程

1. 先直接在本机复现 `claude --resume 07bdb2dc-... -p 'hi'`，确认不是猫猫咖啡前端或 runtime 特有问题。
2. 检查 Claude 本地 transcript：`~/.claude/projects/.../<sessionId>.jsonl`
3. 在损坏 session 中发现大量 `assistant` turn 只有 `thinking` block，且带 `signature`
4. 这些旧 `thinking` block 会被 Claude `--resume` 原样带回给 Anthropic
5. 其中一部分旧 `signature` 已不再被服务端接受，于是恢复时直接 400

## 根因

Claude 本地 session transcript 中积累了“纯 thinking-only assistant turn”。  
当这些 turn 的 `signature` 失效后，Claude CLI 在 `--resume` 时会把它们连同签名一起重新发送，导致 Anthropic 拒绝整个请求。

这不是：

- 猫猫咖啡前端渲染问题
- Redis/队列问题
- 我们的 Cat Café prompt 或 session-chain 逻辑问题

而是 Claude 本地 `~/.claude/projects/**/*.jsonl` 自身的恢复数据坏了。

## 有效急救

### 手工急救（已验证）

1. 先备份原 transcript 到 `~/.claude/backups/`
2. 从主 transcript 里剥掉“纯 thinking-only assistant turn”
3. 保留用户正文和普通 assistant 文本

这样可以把坏 session 从“秒死”救回到“能继续 resume”。

### 一键急救脚本

仓库里新增：

```bash
pnpm rescue:claude:thinking -- --session <sessionId>
pnpm rescue:claude:thinking -- --all-broken
```

脚本行为：

- 按 session id 修复，或批量扫描已记录该错误的 session
- 自动备份到 `~/.claude/backups/`
- 只剥离纯 `thinking` assistant turn
- 不碰用户消息和普通 assistant 文本

## Cat Café 侧修复

除了脚本，我们还在 runtime 里补了一层检测：

- 当 Claude CLI 的 stderr 命中 `Invalid signature in thinking block`
- Cat Café 不再只给出模糊的 `CLI 异常退出`
- 而是返回明确的修复提示，指向 rescue 脚本

## 边界

这次修的是“救活 session + 给出修复提示”，不是无损恢复私有 thinking 历史。  
被剥掉的纯 thinking turn 不会再保留在主 transcript 中，但这比整个 session 完全无法 resume 更可接受。

## 验证

- 脚本测试：`node --test scripts/rescue-claude-thinking-signature.test.mjs`
- ClaudeAgentService / resume 分类：见 `packages/api/test/claude-agent-service.test.js` 和 `packages/api/test/invoke-single-cat.test.js`
- 真实现场抽样：`07bdb2dc-...` 与 `fcaafb86-...` 在剥离坏 thinking turn 后已能再次 `claude --resume`
