# Review Request: F061 CDP idle timeout + thinking separation

## What
两个改进 CDP 桥的 pollResponse：
1. **idle timeout 替代 hard timeout** — `pollResponse` 不再用 60s 硬上限，改为 idle timeout（有活动就重置）+ maxTimeoutMs 绝对上限（默认 5min）
2. **thinking 内容分离** — `POLL_RESPONSE_JS` 提取 `<details>` / thinking 区域，单独返回，AntigravityAgentService 通过 `system_info` 管道传递（与 Claude/Codex thinking 一致）

改动文件：
- `AntigravityCdpClient.ts` — pollResponse 返回 `PollResponseResult | null`，idle timeout 逻辑
- `cdp-dom-scripts.ts` — POLL_RESPONSE_JS 提取 thinkingText
- `AntigravityAgentService.ts` — thinking → system_info 消息
- `types.ts` — 注释更新（thinking 通过 system_info 传递）

## Why
铲屎官 @ 孟加拉猫时，孟加拉猫 thinking 8s + Imagen 3 生图成功了，但 CDP 桥 60s 硬超时报错"未收到回复"。孟加拉猫明明在干活，我们不能因为超时就说人家什么也没干。

## Original Requirements（必填）
> "你的cdp设计不能这么粗暴！得和你们自己检查输出那样！得想想他有在干活你就不能说人家什么也没干？"
> "他的thinking那些你得想想怎么才能丢到thinking 🧠 气泡里"
- 来源：2026-03-08 铲屎官在 thread 中的直接反馈（message ID `0001772985224199-000164`）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- idle timeout 默认仍是 60s（向后兼容），maxTimeoutMs 默认 300s（5min）——对生图任务足够
- thinking DOM 选择器用 `details, [class*="thinking"], [class*="thought"]`，可能需要随 Antigravity 版本更新
- 未引入新的 AgentMessageType，复用 `system_info` + `{ type: 'thinking' }` JSON（与 route-serial 现有管道一致）

## Open Questions
1. thinking DOM 选择器是否足够稳健？目前基于 `<details>` 和 class 名匹配，Antigravity 版本更新可能改变 DOM 结构
2. maxTimeoutMs 默认 300s 是否合适？生图可能更久

## Next Action
请 review 代码变更，特别关注 idle timeout 重置逻辑的正确性和 thinking 提取的 DOM 选择器。

## 自检证据

### Spec 合规
- ✅ 铲屎官需求 1: idle timeout 在 loading/text 变化时重置
- ✅ 铲屎官需求 2: thinking 提取并通过 system_info 管道传递
- ✅ 文件大小: max 343 行 (< 350 限制)

### 测试结果
```
node --test test/antigravity-cdp-client.test.js  # 35 passed, 0 failed
pnpm run build                                    # exit 0
pnpm biome check (changed files)                  # 0 errors
```

### 相关文档
- Feature: F061 CDP Bridge Stability
- Debug log: `memory/cdp-bridge-debugging.md`
