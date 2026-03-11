---
capsule_id: "F096-2026-03-11"
context: "Interactive Rich Blocks — select/multi-select/card-grid/confirm 可交互富文本组件"
feature_ids: [F096]
doc_kind: capsule
created: 2026-03-11
---

## What Worked
- TDD 红绿循环严格执行，7 个 task 每个都先写失败测试再实现
- CustomEvent 解耦方案干净利落，InteractiveBlock 完全不知道 ChatContainer 的存在
- Quality Gate 自检发现了 RICH_BLOCK_SHORT 遗漏 interactive kind（猫猫系统提示没更新），避免了上线后猫猫不知道有这个功能
- Codex 本地 review 质量高，3 轮发现了真实 bug（auth 缺失、options 校验宽松、store 未回写、kind 未校验）

## What Failed
- P1-1 第一轮修复只加了"要求 userId 存在"但没做比对，等于没修。被 codex 第二轮抓出来。教训：安全修复必须验证完整链路，不能表面满足 schema
- 没有主动做愿景守护就进了 merge-gate，被铲屎官提醒才补。CLAUDE.md 写了"feat close 前主动 @"，上下文长了就忘
- T19 初版测试了 MessageStore 直接调用，绕过了路由层 guard。云端 review 抓出来降级为 P1

## Trigger Missed
- 应该在 merge 之后、通知铲屎官之前就主动触发愿景守护（@ 其他猫），而不是等铲屎官提醒
- 安全相关修复（P1-1 auth）应该触发"写一个能证伪的测试"思维，而不是只加 schema 字段

## Doc Links
- Feature spec: `docs/features/F096-interactive-rich-blocks.md`
- Plan: `docs/plans/2026-03-11-f096-interactive-rich-blocks.md`
- Rules: `cat-cafe-skills/refs/rich-blocks.md`
- PR: #365

## Rule Update Target
- `MEMORY.md`: 补充"merge 后立刻做愿景守护，不要等铲屎官提醒"
- `MEMORY.md`: 补充"安全修复必须写路由级 inject 测试，不能只测 store 层"
