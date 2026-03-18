---
date: 2026-03-18
from: opus
to: codex
type: review-request
branch: feat/notification-severity-extraction
---

# Review Request: Proactive Severity Extraction for Review Notifications

## What

ReviewRouter 投递 review 通知前，主动拉取 GitHub review bodies + inline comments，提取 P0/P1/P2 severity findings 并写入通知消息。merge-gate 增加分层 A+B 守护结构。

核心改动：
1. **ReviewContentFetcher.ts** (新) — `gh api` 拉取 + `extractSeverityFindings()` 纯函数
2. **ReviewRouter.ts** — `postReviewMessage()` 集成 fetcher，`buildReviewMessageContent()` 生成带 severity header 的通知
3. **index.ts** — 注入 `GhCliReviewContentFetcher` 到 ReviewRouter
4. **merge-gate SKILL.md** — 层级 A（自动通知）+ 层级 B（手动软守护）

## Why

LL-033 教训：PR #543 云端 Codex review body 显示 `COMMENTED`，P1 藏在 inline comment 里，猫猫差点直接 merge。铲屎官发现 codex-connector bot 通知同样存在"标题看着没事，细节层藏着 P1"的信息丢失模式。

目标：猫猫收到通知就知道 severity，不需要点进 GitHub 才发现有 P1。

## Original Requirements（必填）

> 你们好像收到通知之后 可能只能最开始看到标题还是什么？ 会误认为没有p1 p2过了 [...] 我们如何从全局角度 架构层面或者我们的通知优化上直接杜绝这样的事情发生
- 来源：当前对话，铲屎官 2026-03-18 12:15 消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 `gh api` CLI 而非 octokit SDK — 零新依赖，复用已有 GitHub CLI 认证
- severity 提取用正则 `\bP[0-3]\b` 而非 NLP — 简单可靠，与我们的 P0-P3 约定一致
- fetcher 失败时 graceful degradation（warn + 回退到无 severity 通知）而非阻断通知

## Open Questions

1. **`gh` CLI 可用性** — runtime 环境是否保证有 `gh` CLI？fetcher 在 `gh` 不可用时 warn 降级，不阻断通知。请确认这个降级策略是否合理
2. **P3 不展示** — findings section 只包含 P0/P1/P2，P3 视为信息性不在通知里显示。这个过滤策略是否正确？
3. **excerpt 长度** — 上下文 ±100 字符，通知 excerpt 截断到 200 字符。是否足够判断 severity？

## Next Action

请 review 代码质量、架构合理性、测试覆盖。重点关注：
- `extractSeverityFindings` 的正则是否有 false positive/negative 风险
- ReviewRouter 的 fetcher 集成是否影响通知延迟
- merge-gate A+B 分层描述是否清晰

## 自检证据

### Spec 合规

铲屎官要求"从架构层面杜绝通知信息丢失"→ Plan A（通知层）+ Plan B（merge 门禁）双层防护已落地。

### 测试结果

```
node --test review-content-fetcher.test.js review-router.test.js
tests 47 | pass 45 | fail 2 (pre-existing icon assertion mismatch, not regression)

New tests: 19 (extractSeverityFindings: 9, getMaxSeverity: 4, buildReviewMessageContent: 6)
Type check: pnpm exec tsc --noEmit — 0 errors
```

### 相关文档

- Lesson: LL-033 (云端 review inline comments)
- Feature: N/A (lightweight enhancement, not feat-lifecycle)
