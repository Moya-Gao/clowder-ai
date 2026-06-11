# Review Request: Codex cats cost estimation via pricing table

Review-Target-ID: codex-cost-estimation
Branch: worktree-codex-cost-estimation
PR: #2233

## What
Codex CLI provides token counts but not `costUsd`. Added a model pricing lookup table + estimation logic so Hub UI can display cost for Maine Coon cat invocations.

Changes (7 files, +204/-3):
1. **New** `packages/api/src/config/model-pricing.ts` — per-model pricing table + `estimateCostFromTokens()` pure function
2. **New** `packages/api/test/config/model-pricing.test.js` — 10 unit tests
3. `CodexAgentService.ts` — calculate estimated cost before yielding `done` event (when `costUsd == null` but tokens exist)
4. `types.ts` (API) — add `costEstimated?: boolean` to `TokenUsage` + handle in `mergeTokenUsage` (latest-wins)
5. `chat-types.ts` (web) — add `costEstimated?: boolean` to frontend `TokenUsage`
6. `MetadataBadge.tsx` — show `~$X.XX` with tooltip for estimated costs
7. `CatTokenUsage.tsx` — same

## Why
铲屎官发现 Hub 气泡 Claude cats 有 cost 显示（$2.86）但 Codex cats 没有。诊断发现 Codex CLI 有 token 数据但不报 cost。用定价表估算填补空白。

## Original Requirements
> codex的cli里jsonl我记得原本是能采集到猫粮消耗的，现在咋没了，你看看？
> 那我估计这个只能当估计 还得写一下预估价格 🤣 倒是可以显示一下看看砚砚多贵
> 好呀！走起！
- 来源：本次 thread 对话（2026-06-11）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **精确 vs 估算**：Codex CLI 不提供 cost，只能从 token × price 估算。用 `costEstimated` flag + `~` 前缀区分。
- **Spark 定价**：gpt-5.3-codex-spark 研究预览未公布定价，暂用 gpt-5.3-codex 同价。
- **Gemini/Antigravity 不做**：这两家连 token 数据都没有，无米之炊，留给后续。

## Architecture Ownership
Architecture cell: config/model-pricing (new utility)
Map delta: none
Why: 纯新增配置文件 + 单点消费（CodexAgentService），不改架构边界。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `estimateCostFromTokens` 的 freshInput = inputTokens - cacheReadTokens 计算是否正确？OpenAI 对 cached input 和 fresh input 分开计费。
2. CodexAgentService 中 `metadata.usage.inputTokens ?? metadata.usage.lastTurnInputTokens ?? 0` 的 fallback chain 是否合理？
3. 定价数据准确性——源自 developers.openai.com/api/docs/pricing（2026-06-11 查询），reviewer 可 spot-check。

### 价值 OQ（给 CVO，如有）
无——这是铲屎官直接要求的功能，方向已确认。

## Next Action
请 review PR #2233，重点关注：
- 定价计算正确性
- token→cost 的数据流是否有漏洞
- 前端 `~` 标识是否足够清晰

## Review Sandbox
- Path: `/tmp/cat-cafe-review/codex-cost-estimation/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- ✅ 铲屎官要求给 Codex 加费用显示 → 已实现
- ✅ 精确 vs 估算区分 → `costEstimated` flag + `~` 前缀
- ✅ 不影响 Claude 的精确 cost 显示 → 仅当 `costUsd == null` 时才触发估算

### 测试结果
```
node --test packages/api/test/config/model-pricing.test.js  # 10 passed, 0 failed
pnpm --filter @cat-cafe/api build                           # 编译成功
pnpm biome format (changed files)                           # No fixes needed
pnpm biome lint (core files)                                # No fixes needed (pre-existing warnings only)
```

### 前端视觉
前端改动仅为 `~` 文本前缀 + tooltip（`title` 属性），在 `costUsd != null` 条件内。此前 Codex cats 的 `costUsd` 恒为 null（不显示任何 cost），所以改动零回归风险。完整视觉验证需 alpha + Codex 实际调用。

### 相关文档
- 无 Plan/ADR（scope ≤50 行核心逻辑，铲屎官对话中直接确认方向）
- PR: #2233
