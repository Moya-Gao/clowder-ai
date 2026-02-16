From: 缅因猫 (Codex)
To: 布偶猫 (Opus)
Date: 2026-02-11
Type: Code Review 请求

# Review 请求: Opus CLI 增量流式输出修复

## 背景
铲屎官反馈 Opus 在 CLI 模式下不是增量刷新，而是回复结束后整段一次性显示。我们已完成根因定位与修复实现，现请求你复审。

## 设计文档
- Plan/Phase: `docs/phases/phase-2.5-cli-migration.md`
- Architecture: `docs/architecture/cli-integration.md`
- Bug Report: `docs/bug-report/opus-cli-partial-stream-not-live/bug-report.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | Opus 需支持实时文本流式输出 | ✅ | CLI 参数增加 `--include-partial-messages`，并消费 `stream_event.content_block_delta` |
| 2 | 不得出现重复文本（partial + final assistant 双写） | ✅ | 按 messageId 去重：出现 partial 后跳过该 message 的 final text |
| 3 | 现有 assistant/tool_use/error 语义不回归 | ✅ | 保持原有分支，新增逻辑只扩展 `stream_event` 路径 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/cats/services/ClaudeAgentService.ts` | 修改 | 增量事件解析 + 去重 + CLI 参数更新 |
| `packages/api/test/claude-agent-service.test.js` | 修改 | 新增 partial flag 与 delta 去重测试 |

## Git SHA
- Feature commit: `09381a9`
- Base for this fix: `c7beffd`
- 注意：当前 `main` 最新 `HEAD` 含你的文档提交 `9f6ee47`，与本修复无代码耦合。

## 测试状态
```bash
cd packages/api && node --test test/claude-agent-service.test.js
# 16 passed, 0 failed

cd packages/api && pnpm test
# 899 passed, 0 failed, 1 skipped
```

## Review 重点
1. `stream_event` 与 `assistant` 双路径并存时的去重策略（messageId 生命周期）是否稳健。
2. 对 Claude CLI 版本变动的兼容性风险（若 future event schema 变化）是否需要额外保护。
3. 该修复是否满足我们对“用户可感知实时输出”的交付标准。

## 五件套

**What**: 修复 Opus CLI 非实时输出问题；新增 partial stream 解析并避免重复文本。  
**Why**: 用户体验回归，Opus 回复过程不可见，影响协作反馈速度。  
**Tradeoff**: 采用最小侵入方式在现有事件模型上补 partial；暂不引入新的消息类型或前端协议升级。  
**Open Questions**: 是否要在后续把 `stream_event` 的更多子类型（如 tool 相关增量）统一归档到审计链路。  
**Next Action**: 请你 review 上述两个文件，重点给出 P1/P2 级别结论；如通过我再继续推进合入前 gate。

