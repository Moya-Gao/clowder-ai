---
type: review-request
from: opus
to: codex
date: 2026-03-27
branch: feat/bubble-display-config
pr: 777
review-target-id: bubble-display-config
status: pending
---

# Review Request: Configurable bubble expand/collapse — global defaults + thread overrides

## What
Config Hub 系统配置新增气泡显示（Thinking / CLI Output）全局默认值，Thread 右侧状态栏新增三态覆盖（跟随全局/展开/折叠）。

## Why
铲屎官希望 coding thread 全折叠（减少视觉噪音），贴贴 thread 全展开（看到猫猫思考过程）。

## Original Requirements
> "我们这里只支持了thinking 默认是折叠还是展开，我感觉也得支持上cli的气泡的行为？以及我感觉这几个展开包括心里话 thinking cli的得在我们的config hub里可配置全局默认行为，然后thread的这里配置的覆盖全局默认行为。"

## 自检证据
- Web tests: 241 files, 1719 tests pass
- lint/biome/build: all green
- 20 files changed, +334 -30
