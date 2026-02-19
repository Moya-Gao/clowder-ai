# Bug Report — F21 Cloud Round6 P1 (weekly 调度时区 + legacy 文件名日期解析)

## 1) 报告人
- 报告来源：云端 Codex review（PR #30，review `3824118229`）
- 触发方式：在 head `e51c23d663ab1b418c69800762fd87f713f55a98` 上的行级审查
- 相关评论：
  - `packages/api/src/domains/signals/services/source-processor.ts` (`discussion_r2826274119`)
  - `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` (`discussion_r2826274124`)

## 2) 复现步骤（期望 vs 实际）

### P1-A: weekly 调度按 UTC 判周几
- 前置：`selectSources(..., now)` 内部使用 `now.getUTCDay()`。
- 复现：构造“本地周一、UTC 周日”的 `Date` 场景（测试中通过 stub `getDay/getUTCDay` 固化）。
- 期望：weekly source 在本地周一应被选中。
- 实际：因按 UTC 判定，weekly source 未被选中。

### P1-B: legacy 迁移未正确解析 `YYYY-MM-DD-*` 文件名前缀
- 前置：frontmatter 无 `publishedAt/published/date`，文件名形如 `2026-01-23-title.md`。
- 复现：`parseLegacyArticles()` 读取该文件。
- 期望：`publishedAt` 应解析为 `2026-01-23`（或等价 ISO）。
- 实际：现实现取 `slice(0, 8)`，得到截断值，导致日期错误（并可能退回不正确默认值）。

## 3) 根因分析

### P1-A 根因
- 文件：`packages/api/src/domains/signals/services/source-processor.ts`
- 函数：`isSourceScheduledForAutomaticRun()`
- 根因：weekly 判定固定用 UTC（`getUTCDay()`），与调度任务的本地时区语义不一致。

### P1-B 根因
- 文件：`packages/api/src/scripts/migrate-signals/legacy-article-parser.ts`
- 逻辑：`normalizeDate(basename(filePath).slice(0, 8), fallbackNow)`
- 根因：对 `YYYY-MM-DD-*` 文件名按固定 8 字符截取，无法拿到完整日期，导致迁移时间戳错误。

## 4) 修复方案与取舍
- 方案 A（采用）
  - P1-A：weekly 判定改为“本地周几”语义（`getDay()`），与任务调度时区一致。
  - P1-B：新增文件名前缀提取逻辑，优先识别 `YYYY-MM-DD`，再兼容 `YYYYMMDD`，最后再 fallback。
- 放弃方案
  - P1-A：引入全局 timezone 配置并在调度链路透传。当前改动面更大、涉及配置兼容，超出本轮 P1 最小修复范围。
  - P1-B：直接依赖 `new Date(rawPrefix)` 容错解析。可读性差、行为受运行时解析差异影响，稳定性不足。

## 5) 验证方式
- Red→Green：先新增/更新失败测试（覆盖两个 P1 复现场景），确认 Red 后修复转 Green。
- 回归：运行与 Signals/Migration 相关测试集合，确认无回归。
