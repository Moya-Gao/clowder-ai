---
feature_ids: [F041]
topics: [ux, capability, skills, toggle]
doc_kind: bug_report
created: 2026-02-28
---

# Bug Report: Skills 对不相关猫显示可点击开关（导致无效 override）

## 报告人
- 砚砚/Codex（基于分支全量 review 发现）

## 复现步骤

1. 打开 Hub → 能力中心
2. 找到任意 Skill（`type=skill`）
3. 展开卡片 → “各猫配置”（按猫族折叠）
4. 在某些猫（与该 Skill provider 不相关）行上，仍然显示 toggle，且可点击

## 期望 vs 实际

- 期望：不相关的猫应该显示 `–`（或 disabled + tooltip），不允许点击
- 实际：显示可点击 toggle；点击后会发送 PATCH 写入 override，但下一次 GET 因后端 sparse cats 逻辑不会显示该 catId，用户感知为“开关无效 / 消失”

## 根因分析

后端 `GET /api/capabilities` 对 skills 使用 sparse cats：
- `presentForProvider === false` 的 cat 不写 `cats[catId]`（为了让猫过滤有意义）

但前端 per-cat UI 直接用：
- `item.cats[catId] ?? false` 并渲染 `ToggleSwitch`

导致 “不相关猫” 被当作 `false` 渲染成可开关项，点击产生无效 override。

## 修复方案

前端 per-cat 行渲染改为：
- 若 `!(catId in item.cats)`：渲染 `–`，不渲染 toggle，不触发 PATCH
- family 汇总分母改为 relevant cats 数量；relevant 为 0 时隐藏该 family（对 skills）

后端 mount health：
- `resolveMainRepoPath()` 进程内缓存，避免每次 GET 都 exec `git worktree list`

## 验证方式

手工验证（该组件无现成 React test harness）：
1. 刷新 Hub → 能力中心
2. 展开任一 Skill
3. 对不相关的 catId 行应显示 `–`，不可点击
4. 相关 catId 行 toggle 仍可用，PATCH 后状态可见且持久

