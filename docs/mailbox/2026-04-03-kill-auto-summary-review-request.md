# Review Request: 干掉 chat 流中的自动纪要 + Redis TTL 配置

Review-Target-ID: kill-auto-summary
Branch: feat/kill-auto-summary

## What

移除 chat 消息流中的 system auto-summary 功能（3 个文件，-51/+10 行）：

1. **停止创建**：删除 `POST /api/messages` 的 fire-and-forget `maybeSummarize()` 触发（messages.ts）
2. **停止展示**：删除 `GET /api/messages` 中 system summaries 合并到时间线的逻辑（messages.ts）
3. **清理死代码**：移除 `AutoSummarizer` 的 import、实例化和传参（index.ts + messages.ts）
4. **Redis TTL**：`.env.example` 新增 `MESSAGE_TTL_SECONDS=0`，防止消息 7 天后静默过期

## Why

铲屎官直接反馈自动纪要体验差（clowder-ai#343）：时机不对（对话中突然弹出）、内容过时（regex 提取旧话题）、忽略当前上下文（抢占用户问题回复位）、价值不明。

两猫分析后共识：根因不是参数问题，是产品形态错位。底层 `SummaryCompactionTask`（LLM abstractive summary，服务 memory 基础设施）不受影响。

## Original Requirements（必填）

> "我感觉我们的自动纪要做的很垃圾，要么干掉要么面向最终状态优化"
> "那我们干掉他吧，但是直接在家里干掉，然后我们下次发版本的时候带过去就行"
> "example里的就改永久！！不然env那个 很多人反馈redis消息丢了！！过期了！！"

- 来源：2026-04-03 thread 对话，铲屎官直接拍板
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择完全移除而非"调参数优化"——因为 regex 内容生成 + 无 quiet window + 无会话状态感知，三个问题共同决定了这不是调参能解决的
- 保留 `AutoSummarizer.ts` 类文件和 `summaryStore` 相关代码——它们是独立模块，未来 Thread Recap 可能复用存储层，不做过度清理
- `.env.example` 只加了 `MESSAGE_TTL_SECONDS`，没改代码默认值——改代码默认值影响面更大，先用配置解决

## Open Questions

1. **历史 summary 数据**：Redis 中已有的 system summaries 会随 TTL（30 天）自然过期，不需要手动清理。Reviewer 是否同意这个处理方式？
2. **AutoSummarizer 类是否应该一并删除**：当前只断开了调用链，类文件还在。保留理由是测试还在跑且未来可能复用。

## Next Action

请 review 代码改动，确认：
- 两个切割点（POST 触发 + GET 合并）是否完整
- 是否有遗漏的 auto-summary 调用路径
- `.env.example` 注释是否清晰

## 自检证据

### Spec 合规

Quality Gate 通过（本次运行）：
- 愿景覆盖 2/2 ✅
- 功能验收 4/4 ✅
- 设计稿对照 ➖ 无 UI 改动
- Artifact Hygiene ✅

### 测试结果

```
pnpm check          → 4/4 pass ✅ (biome + env-registry)
pnpm lint           → 0 errors ✅
pnpm -r build       → exit 0 ✅
node --test          → 59/59 pass ✅
  - auto-summarizer: 3/3
  - message-store: 52/52
  - env-registry: 4/4
```

### 相关文档

- Issue: https://github.com/zts212653/clowder-ai/issues/343
- clowder-ai PR: https://github.com/zts212653/clowder-ai/pull/350 (TTL fix)
