---
feature_ids: [F024]
topics: [gemini, seal, misfire]
doc_kind: bug-report
created: 2026-02-15
---

# F24 Gemini Seal Misfire — Token 统计失真导致误触发

**报告人**: 铲屎官 (2026-02-15 ~00:14)
**定位人**: 布偶猫/宪宪
**严重度**: P0 (数据完整性风险 + 用户体验断裂)
**状态**: 待修

## 复现步骤

1. 在 thread `thread_mln54grb12u8v28h` 中与暹罗猫 (Gemini) 对话
2. Gemini CLI 返回 token usage 数据
3. F24 context health 计算触发 seal 阈值检查
4. Gemini 的 session 被自动封存

### 期望行为

- Gemini context 使用率应在合理范围内 (0-100%)
- 仅在真正接近 context 窗口上限时才触发 seal

### 实际行为

- Gemini 报告 `usedTokens: 1,476,229`，`windowTokens: 1,000,000`
- 计算出 `fillRatio: 1.47` (147.6%)，**超过 100% 是不可能的**
- `source: 'approx'` 证实这不是精确值，而是估算
- 65% seal 阈值立刻被触发，session 被封存

## 根因分析

### 直接原因

Gemini CLI 返回的 token usage 数据不准确。`invoke-single-cat.ts:303-312` 的 token 取值链：

```
lastTurnInputTokens (优先) → inputTokens → totalTokens (回退)
```

Gemini 走的是 `totalTokens` 回退路径（Gemini CLI 不提供 `lastTurnInputTokens` 或 `inputTokens`），而 `totalTokens` 可能是**累计值**（多轮 API 调用的总和），不是当前 context 窗口的填充量。

### 窗口大小来源

`windowTokens: 1,000,000` 来自 `getContextWindowFallback()`，对 Gemini 模型的硬编码 fallback。Gemini CLI 也没有返回 `contextWindowSize` 字段。

### 为什么其他猫没问题

- **Claude (opus)**: 返回精确的 `lastTurnInputTokens` + `contextWindowSize`，`source: 'exact'`
- **Codex**: 返回精确的 `inputTokens` + `contextWindowSize`，`source: 'exact'`
- **Gemini**: 只有 `totalTokens`（可能是累计值），没有 `contextWindowSize`，`source: 'approx'`

## 连带问题

### 问题 1: Gemini 新 session 是否真正可用

API 数据显示 seal 后创建了 gemini seq:1 (active, `cliSessionId: e7999d3d-...`)。但铲屎官反馈"没真的新拉起一个 gemini"。

可能原因：
- SessionRecord 被创建了（因为下次调用时 `session_init` 事件触发），但 Gemini CLI 进程可能没有正确启动新的对话上下文
- 或者前端没有展示 Gemini 新 session 的活动状态
- 需要进一步复现确认

### 问题 2: F24 缺少 per-cat 开关

`index.ts:122-125` 无条件将 `sessionChainStore`、`transcriptWriter`、`transcriptReader`、`sessionSealer` 注入 AgentRouter。所有猫都会进入 F24 链路，**无法单独对某只猫关闭**。

当 token 统计不准时（如 Gemini），seal 会误触发，但无法降级。

### 问题 3: 前端 session 链可见性

前端 `CatInvocationInfo` 只保存当前 invocation 的 sessionId，覆盖式更新。无法展示完整 session 链（sealed → active 的历史），用户无法判断 seal 是否正常工作。

## 修复方案

### Phase 1: Per-cat F24 Feature Toggle (本次修复)

在 `cat-config.json` 增加 `features.sessionChain` 开关：

```json
{
  "catId": "gemini",
  "features": { "sessionChain": false }
}
```

实现要点：
1. `cat-config.json` 加 per-cat `features.sessionChain` 字段
2. `invoke-single-cat.ts` seal 触发前检查开关
3. `route-strategies.ts` bootstrap 注入前检查开关
4. `invoke-single-cat.ts` session_init 中 SessionRecord 创建前检查开关
5. 默认 `true`（向后兼容），gemini 显式设为 `false`

### Phase 2: 未来改进 (不在本次范围)

- `source === 'approx'` 时禁止自动 seal（只允许手动 seal）
- fillRatio 上限 clamp 到 1.0（防止 >100% 的荒谬值）
- 前端 session 链时间轴组件（暹罗猫设计中）

## 现场数据

```json
// thread_mln54grb12u8v28h session chain (2026-02-15 02:46)
[
  { "catId": "codex",  "seq": 0, "status": "active", "fillRatio": 0.52, "source": "exact" },
  { "catId": "gemini", "seq": 0, "status": "sealed", "fillRatio": 1.00, "source": "approx",
    "usedTokens": 1476229, "windowTokens": 1000000, "sealReason": "threshold" },
  { "catId": "gemini", "seq": 1, "status": "active", "fillRatio": 0.28, "source": "approx" },
  { "catId": "opus",   "seq": 0, "status": "active", "fillRatio": 0.81, "source": "exact" }
]
```

## 验证方式

1. 设置 `gemini.features.sessionChain = false`
2. 调用 Gemini → 不应产生 SessionRecord、不触发 seal、不注入 bootstrap
3. 调用 opus/codex → F24 正常工作（seal/bootstrap/transcript）
4. 修改配置为 `true` → Gemini 重新启用 F24

---

*布偶猫/宪宪 2026-02-15*
