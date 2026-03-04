# Review Request: F051 v2 — 猫粮看板重写

## What

F051 猫粮看板 v2 重写，共 2 个 commit（基于 `feat/f051-v2` 分支）：

1. `44c93ae1` — v2 baseline: poolId 字段 + glanceable UI + 删除旧运维面板
2. `9b2e9194` — Gemini/Antigravity 后端 + 前端集成

核心变更：
- **后端**：CodexUsageItem 加 `poolId` 字段，parsers 自动标注 codex-main/spark/review/overflow 和 claude-session/weekly-all/weekly-sonnet。新增 PATCH `/api/quota/gemini` + `/api/quota/antigravity` 路由。AntigravityQuota 从占位符升级为真实额度类型。
- **前端**：重写 HubQuotaBoardTab → glanceable list，按猫猫+用途分组（布偶猫 Claude / 缅因猫 Codex×4 / 暹罗猫 Gemini / Antigravity IDE），每行色点+进度条+百分比。删除所有运维 UI。
- **清理**：删除 SwiftBar 脚本、QuotaSummaryWidget、/widget/quota 页面。

变更范围：6 files changed, 317 insertions, 34 deletions（不含 baseline 的 292 ins / 1111 del）。

## Why

v1（缅因猫实现）的核心问题：额度粒度错误（OpenAI 4 个独立池合并为一张卡）、UI 是运维面板不是给铲屎官看的、过度工程（Web Push、通知能力矩阵）。铲屎官要求重写。

## Original Requirements（必填）

> "缅因猫没理解我想要什么，他的小组件也还是 PWA 的组件，而且也有点丑。ClaudeBar 可以参考这个开源项目他的做法。"

> "缅因猫的额度人家是有区隔的，你不应该笼统归因。至少要知道 Codex 云端 review 额度和 Codex 本地额度还有 spark 的额度。"

> "按照我们现在的情况 antigravity 和 gemini cli 也能接入了吧？"

- 来源：F051 spec `docs/features/F051-real-quota-dashboard.md` §"铲屎官原话"
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 PATCH push 模式（由 ClaudeBar 推送 Gemini/Antigravity 数据）而非 Cat Café 后端直接抓取。理由：ClaudeBar 已有成熟实现，不造轮子。
- 前端 Gemini/Antigravity 空态显示"暂无数据（需 ClaudeBar 推送）"而非隐藏。理由：让铲屎官知道数据源在哪。
- 删除 `/api/quota/summary` 的 antigravity 占位符逻辑，简化为通用 4-platform 模式。

## Open Questions

1. **愿景守护重点**：额度粒度是否正确？4 个 OpenAI 池的 poolId 映射是否符合官方页面？
2. Gemini/Antigravity 的 degradation hint 文案是否合理？（gemini-pro → "建议切到 Flash"）
3. `buildQuotaSummary` 函数认知复杂度 17（阈值 15）—— 预存问题，本次未改动该函数。

## Next Action

请砚砚 review 代码质量 + 愿景对照。重点关注：
- poolId 映射是否正确
- 前端分组逻辑是否完整
- 类型变更是否有遗漏

## 自检证据

### Spec 合规

AC-v2-1 ~ AC-v2-9 全部通过（详见本 thread 上方 Quality Gate Report）。

### 测试结果

```
pnpm --filter @cat-cafe/api test       # 42 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test       # 689 passed (114 files), 0 failed ✅
pnpm lint                              # 0 errors ✅
pnpm -r --if-present run build         # exit 0 ✅
```

### 相关文档

- Feature spec: `docs/features/F051-real-quota-dashboard.md`
- Branch: `feat/f051-v2` (worktree at `cat-cafe-f051-v2`)
- Pencil mockup: `designs/猫粮看板—猫爪导航.pen` frame `kQytH`
