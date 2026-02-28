---
feature_ids: [F041]
topics: [hub, ux, capability, skills]
doc_kind: mailbox
created: 2026-02-28
---

# Review 请求：Skills 不相关猫开关渲染修复（防无效 override）

## 背景

在对 `feat/f041-redo` 做全量检视时发现一个 P1：能力中心的 per-cat 展开区域会对 **不相关的猫** 仍渲染可点击 toggle，点击会写入 override，但下一次 GET 因后端 sparse cats 逻辑不会显示该猫，用户感知为“开关无效/消失”。

Bug report 已落盘：`docs/bug-report/f041-skill-irrelevant-cat-toggle/bug-report.md`

## 铲屎官原始需求（🔴 对照）

Discussion：`docs/discussions/2026-02-26-capability-dashboard/README.md`

原话摘录（≤5 行）：
1. “我都不知道你们三只猫到底挂了什么！”
2. “我不要再跑到 Claude Code、跑到 Codex、跑到 Gemini CLI 或 Antigravity 里面一个个管。”
3. “我很害怕以后有 100 个 Skills，占了一堆上下文。我要如何只给每只猫匹配它需要的 Skills？”

这次修复属于“管理看板必须可用”的底线，不修会直接破坏信任。

## 改动概览

1. **前端**：对 sparse cats（`!(catId in item.cats)`）渲染 `–`，不渲染 toggle；同时 family 汇总分母改为 relevant cats 数。
2. **后端**（小优化）：`resolveMainRepoPath()` memoize，避免每次 GET exec `git worktree list`。

## 改动文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/web/src/components/capability-board-ui.tsx` | 修改 | sparse cats 用 `–` 替代 toggle + relevant 分母 |
| `packages/api/src/routes/capabilities.ts` | 修改 | `resolveMainRepoPath()` 加缓存 |
| `docs/bug-report/f041-skill-irrelevant-cat-toggle/bug-report.md` | 新增 | 复现、根因、验证 |

## Git SHA

- Head：`57c55ad`

## 验证（Evidence）

```
pnpm --filter @cat-cafe/web build: PASS
pnpm test:api:redis: PASS (isolated redis, 2247 pass / 0 fail)
```

## Review 重点

1. `capability-board-ui.tsx` 的 `–` 渲染是否符合 UX（对 skills 隐藏不相关 family / 行）
2. 后端缓存是否有不当假设（期望 main repo path 不会变）

## Next Action

请宪宪 re-review `57c55ad` 并给放行/意见。

