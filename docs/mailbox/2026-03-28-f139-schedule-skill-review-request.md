---
doc_kind: review-request
created: 2026-03-28
---

# Review Request: F139 schedule-tasks skill + rich-block capability coverage

## What

1. **新 skill: `schedule-tasks`** — 定时任务注册、管理、能力指南
2. **rich-block-rules.ts 补全** — 触发场景加"适用场景"前言 + 各 block 类型补充主动/定时场景描述
3. **rich-blocks.md + rich-messaging SKILL.md** — 同步更新

6 个文件改动，148 行新增，8 行删除。无逻辑代码变更，全部是文本/schema/skill。

## Why

铲屎官发现两个根因相同的问题：
1. 猫收到"发图片"请求只联想到 image-generation，不知道能用 media_gallery 发已有图
2. 定时任务没有 skill，其他猫不知道怎么注册/使用，也不知道被唤醒后有完整能力

根因：**猫不知道自己能做什么** — rich block rules 触发描述太窄 + 定时任务无 schema 文档。

## Original Requirements

> "rich-block-rules 这个好像还有一点问题，现在发 Rich Message 的时候，不只只能发你现在列的那些。你还能给我发什么 HTML、什么图片、你自己写完的 HTML 直接挂给我，然后你还能发语音。你得想一想，其实这两个是本质上都是一个问题。包括你自己，你自己现在的 Skill 可能也有这个问题，你可能没有好好写你自己定时任务的 Skill。"

- 来源：铲屎官 2026-03-28 01:06 当前 thread
- **请对照判断：改后的 rules + 新 skill 是否让猫知道自己在各场景下的能力？**

## Tradeoff

- 没有改 MCP tool descriptions（`schedule-tools.ts`）— 那个已经在前一个 commit 直接推 main 了
- schedule-tasks skill 只覆盖用户侧（注册/管理），不覆盖开发侧（如何写新模板）

## Open Questions

1. schedule-tasks skill 的触发词是否覆盖足够？会不会和其他 skill 冲突？
2. rich-block-rules 加的"适用场景"前言是否够清晰？

## Next Action

请 review 并给出放行/修改意见。

Review-Target-ID: f139-schedule-skill
Branch: feat/f139-schedule-skill

## 自检证据

### Spec 合规

本次无逻辑代码，无 AC 对应。属于 F139 收口的 schema/文档补全。

### 测试结果

```
SystemPromptBuilder guardian test: 76 passed, 0 failed
pnpm check:skills: 26 skills validated, 0 errors
pnpm --filter @cat-cafe/api build: success
pnpm --filter @cat-cafe/mcp-server build: success
```

### 相关文档

- Feature: F139 — `docs/features/F139-unified-schedule-abstraction.md`
