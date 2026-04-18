# Review Request: F061 Antigravity partial reply truncation fix

Review-Target-ID: fix-antig-partial-reply-preserve
Branch: fix/antig-partial-reply-preserve

## What
修复 `AntigravityBridge.pollForSteps()` 只按 `numTotalSteps` 增长投递内容的问题。

- 新增 step 级 fingerprint + planner text 跟踪
- 当同一个 `PLANNER_RESPONSE` step 的 `modifiedResponse/response` 原地增长时，桥层发出 append-safe delta，而不是把后续全文静默丢掉
- 补两条回归测试：桥层 in-place growth；service 层 partial text 不得退化成 `empty_response`

## Why
铲屎官踩到的不是“完全没回复”，而是更糟的“先收到半句，后续补全文时被桥层吞掉”。

当前 LS 会在**同一个 step**上持续更新 `plannerResponse.modifiedResponse`，但我们之前只把“step 数增加”当成新活动。结果是第一次拿到半句后，后续完整文本即使已经写回同一步，也不会再往下游发。

## Original Requirements
> 「你别只定位一半啊，我是想要你修好他，你还记得最开始他是完整的可以回复回来的吗？」
> 「招其他猫猫review看看？」
- 来源：当前 thread `thread_mnux2eewbo4otg17`（2026-04-18 铲屎官原话）
- **请对照上面的摘录判断交付物是否真的把“完整回复”这条能力接回来了**

## Tradeoff
我没有改前端消息协议，也没有上“replace bubble”语义，只在桥层把同一步原地增长转换成 suffix delta。

这样能最小改动修掉“半句被截断”的主路径，并保持现有 append-only streaming contract 不变。代价是：如果上游未来出现**非前缀重写**（不是 append，而是中间改写），现在仍会 fallback 成 full snapshot，append-only 消费方可能重复文本。

## Open Questions
1. 你是否认同根因判断：主 bug 在桥层的 step-count-only delivery，而不是前端气泡回收？
2. 对于非前缀重写，你是否接受当前先保留 fallback 行为，把真正的 replace semantics 留后续单开？
3. 这次 `pnpm check` 被 repo 级存量问题挡住：`docs/features/index.json` stale。请帮我判断是否可以按“与本改动无关的已知阻塞”继续 review，而不是要求我顺手修文档索引。

## Next Action
请按“桥层是否真的恢复完整回复能力”来 review，重点看：

- `pollForSteps()` 的 mutation detection 条件是否足够稳
- delta 转换是否会破坏等待批准 / native executor / terminal idle 等相邻路径
- 这次测试面是否覆盖了你认为最关键的回归点

## Review Sandbox
- Path: `/tmp/cat-cafe-review/fix-antig-partial-reply-preserve/opus`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- 针对用户要求“完整回复回来”，这次修的是桥层 delivery 语义，不是仅补 observability
- 设计稿检查：`rg --files designs | rg 'F061|antigravity'` 无匹配
- Artifact hygiene：根目录媒体/设计工件检查为空

### 测试结果
- `pnpm --filter @cat-cafe/api build` ✅
- `node --test packages/api/test/antigravity-streaming.test.js packages/api/test/antigravity-agent-service.test.js` → `40 pass, 0 fail` ✅
- `node --test packages/api/test/antigravity-*.test.js` → `155 pass, 0 fail` ✅
- `pnpm lint` ✅（`packages/web` 仅有既有 warnings，无新 errors）
- `pnpm -r --if-present run build` ✅（`packages/web` 仅有既有 warnings）
- `pnpm check` ❌ repo 级既有阻塞：`docs/features/index.json is stale`，与本次代码改动无关

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Mailbox: `docs/mailbox/2026-04-18-antigravity-partial-reply-review-request.md`
