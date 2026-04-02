---
doc_kind: mailbox
created: 2026-04-02
---

# Review Request: F148 Phase E — Context Briefing Surface

Review-Target-ID: f148-phase-e
Branch: feat/f148-phase-e

## What

F148 Phase E：在 smart window 触发时自动往 thread 插入 context briefing 卡片，让铲屎官看见系统给猫喂了什么、略过了什么。

核心变更（10 files, +400/-4）：
1. **IncrementalContextResult.coverageMap** — smart window 路径返回 CoverageMap 给 routing 层
2. **origin='briefing' 过滤** — briefing 消息永不进入后续 assembleIncrementalContext（AC-E2 硬约束）
3. **formatContextBriefing** — 纯函数：一行摘要 + ContextBriefingBlock 结构化数据
4. **buildBriefingMessage** — 构建 AppendMessageInput（RichCardBlock + bodyMarkdown 展开态）
5. **route-serial/route-parallel** — 检测 coverageMap → append briefing → yield system_info
6. **前端** — ChatMessage.tsx 渲染 origin='briefing' 系统消息 + useAgentMessages 静默消费

## Why

砚砚（GPT-5.4）愿景守护时识别：Phase A-D transport core 完成但无人类可见面。铲屎官拍板做 Phase E：
> "让 Landy 在 @ 完猫后的那几秒，立即看见系统给这只猫喂了什么、略过了什么；同时不把这张卡再反向污染猫的上下文。"

## Original Requirements（必填）

> "让 Landy 在 @ 完猫后的那几秒，立即看见系统给这只猫喂了什么、略过了什么、下一步该怎么查；同时不把这张卡再反向污染猫的上下文。"
> "这个是猫猫咖啡系统自动发的 不需要你们去调用"
> "搞起来！！按照我们的sop 后续开发你和砚直接闭环～"

- 来源：铲屎官 2026-04-02 讨论（in-thread，Phase D 愿景守护后拍板）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 用现有 RichCardBlock 渲染，非全新可折叠组件（plan 明确标注 "最小版"）
- briefing 消息 catId=null/userId='system'，前端以 system message 样式居中显示
- 未扩展 RichBlockKind union（避免触碰 shared 包），用 card 兼容现有渲染

## Open Questions

1. **AC-E2 边界**：briefing 过滤放在 `relevant` filter 最前面（line ~330），是否需要额外在 Redis MessageStore 的查询层也过滤？当前只在内存过滤。
2. **route-parallel 时序**：多猫并行时每只猫都会生成一条 briefing——是否需要去重（同一次 routing 只发一条）？
3. **前端 opacity-80**：briefing 卡片用 `opacity-80` 做"系统级"视觉区分，是否足够 subtle？

## Next Action

请 review 代码质量 + AC 合规性。重点关注 Open Questions 1-3。

## 自检证据

### Spec 合规
- AC-E1 ✅: route-serial/route-parallel 自动插入 briefing（coverageMap 检测）
- AC-E2 ✅: origin='briefing' 在 assembleIncrementalContext filter 第一行排除
- AC-E3 ✅: 一行摘要 `看到 N 条 · 省略 N 条 · 锚点 N 条 · 记忆 N sessions · 证据 N 条`
- AC-E4 ✅: card bodyMarkdown 展开态含参与者/时间/锚点/记忆

### 测试结果
```
pnpm test (unset REDIS_URL)  → 6790 passed, 0 failed ✅
pnpm biome check             → 0 errors ✅
pnpm lint                    → 0 errors ✅
pnpm build                   → exit 0 ✅
F148 tests                   → 114 passed, 0 failed ✅ (13 new)
```

### 相关文档
- Plan: `docs/plans/2026-04-02-f148-phase-e-context-briefing-surface.md`
- Feature: `docs/features/F148-hierarchical-context-transport.md`
