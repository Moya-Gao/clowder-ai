---
feature_ids: [F024]
topics: [claude-code, hooks, task, model-guard, token-cost]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: 项目级 PreToolUse 覆盖后丢失 Task 模型守卫

- 报告人：铲屎官（2026-03-01，发现 Opus 被低端子任务大量消耗）
- 影响范围：Claude Code 子 agent 调度（Task tool）

## 1) 复现步骤

1. 在包含项目级 `.claude/settings.json` 的 worktree 中工作。
2. 使用 Task tool 派发子任务但不显式传 `model`。
3. 观察子任务继承父模型（Opus），没有被 hook 拦截。

## 2) 期望 vs 实际

- 期望：Task 调用缺少 `model` 时应被 hook 阻断并提示补齐；`model=opus` 应给出强提醒。
- 实际：项目级 `PreToolUse` 仅配置 `Bash` matcher，`Task` matcher 缺失，导致模型守卫不生效。

## 3) 根因分析

1. user 级 `~/.claude/settings.json` 已配置 `PreToolUse.matcher="Task"` + `check-subagent-model.sh`。
2. 本项目 `.claude/settings.json` 的 `PreToolUse` 只声明了 `Bash` 条目。
3. 在当前运行形态下，项目级设置未覆盖到 `Task` 守卫路径，结果是 worktree 场景出现守卫缺口。

## 4) 修复方案

- 在项目级 `.claude/settings.json` 补齐 `PreToolUse.matcher="Task"`。
- 将 `check-subagent-model.sh` 纳入项目 `.claude/hooks/`（避免仅依赖用户主目录脚本）。
- 增加自动化测试，确保：
  - `Task` matcher 存在；
  - command 指向项目内脚本；
  - 脚本存在并可执行。

## 5) 验证方式

- 先运行新增测试，确认在修复前失败（Red）。
- 修复后重跑同一测试通过（Green）。
- 运行格式检查（biome）确保 JSON 与测试文件风格一致。
