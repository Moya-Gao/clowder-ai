# Review Request: F149 — ACP capacity signal fallback for delayed stderr

Review-Target-ID: f149-capacity-fallback
Branch: feat/acp-capacity-fallback

## What

AcpClient 新增 `recentCapacitySignal` 持久化字段，GeminiAcpAdapter `classifyError` 新增 client-level fallback。修复 PR #930 后仍存在的 429 误分类问题。

4 文件变更：AcpClient +9 行、GeminiAcpAdapter +19 行、测试 +192 行。

## Why

PR #930 的 invoke-level listener 架构正确，但 2s grace window 不够。生产日志显示 Gemini CLI 的 `retryWithBackoff` 导致 429 stderr 延迟 ~5 分钟到达——此时 invoke listener 已 offCapacity，信号落入无人监听空隙。

## Original Requirements

> 铲屎官 08:44: `[错误] lease_timeout: ACP timeout: session/prompt did not respond within 120000ms`
> 铲屎官 08:45: `@opus 你看他还是没体现429啊？我也不知道它到底为什么超时`
> 铲屎官原话: `透传这个429告诉我他429了正在重试不然我怎么知道是你们的问题还是google的问题？`
- 来源：当前 thread 对话历史
- **请对照上面的摘录判断：timeout 时是否能区分 "Google 429" vs "本地 runtime 卡死"**

## Tradeoff

- **不用 ring buffer**：一个 `recentCapacitySignal` 够用，多值等有真实需求再加（Step 2）
- **不加 confidence enum**：evidence source 写在 errorMsg 展示文本中，不是机器接口契约（砚砚约束）
- **10 分钟窗口**：生产数据显示 ~5 分钟 gap，2x 安全余量

## Open Questions

1. `RECENT_SIGNAL_MAX_AGE_MS = 10min` 是否合理？生产 gap 一致 ~5min，10min 给了 2x margin
2. errorMsg 中 `evidence: recent_process_signal, Xs ago` 是否清晰足够？（展示文本，不是接口）

## Next Action

请 review 代码变更，特别关注：
- fallback 边界是否收住（只用于 AcpTimeoutError + 同 client + 10min 窗口）
- 是否引入了 R2 review 时修掉的 cross-prompt contamination

## 自检证据

### Spec 合规
- F149 L148: MODEL_CAPACITY_EXHAUSTED → model_capacity ✅
- F149 L149: 观测拆开 provider_backoff vs runtime ✅ (evidence tag)
- AC-B4: failure classification ✅

### 测试结果
ACP tests → 57/57 pass (含 4 个新 case)
pnpm check → 0 errors
pnpm lint → 0 errors
pnpm -r build → exit 0

### 相关文档
- Feature: F149 (docs/features/F149-acp-runtime-operations.md)
- 上游 PR: #930 (invoke-level listener isolation)
