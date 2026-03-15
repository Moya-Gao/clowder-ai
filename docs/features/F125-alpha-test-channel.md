---
feature_ids: [F125]
related_features: []
topics: [infra, testing, sop]
doc_kind: spec
created: 2026-03-15
---

# F125: Alpha 验收通道 — main-test 升级为正式 alpha 测试基础设施

> **Status**: spec | **Owner**: 缅因猫(gpt52) + 布偶猫(opus) | **Priority**: P1

## Why

铲屎官希望有一套长期可用的、和 runtime 完全隔离的测试环境，用于验收最新 main 上的改动，避免在 runtime（3001/3002/6399）上测试导致不稳定。砚砚已经写好了 `main-test-worktree.sh` 一键脚本（已 review 通过），现在需要：

1. 从 `main-test` 改名为 `alpha`，成为正式基础设施
2. 更新 SOP / quality-gate / worktree skill，让猫猫们知道"开发完了可以拉 alpha 自测"
3. 更新 CLAUDE.md + AGENTS.md + GEMINI.md，加入 alpha 通道规则

铲屎官原话：
> "我要！给他搞个一键启动脚本！然后和 runtime 那样每次启动自动同步 main！"
> "我希望这个变成一个 alpha 测试的分支"
> "不止 claude md 还有 agents 和 gemini md 你别只顾你自己"

## What

### Phase A: 基础设施改名 + 脚本落入 main

- `main-test-worktree.sh` → `alpha-worktree.sh`
- `main-test-worktree.test.sh` → `alpha-worktree.test.sh`
- package.json: `main-test:*` → `alpha:*`
- 环境变量前缀: `CAT_CAFE_MAIN_TEST_*` → `CAT_CAFE_ALPHA_*`
- worktree 目录: `../cat-cafe-main-test` → `../cat-cafe-alpha`
- 分支: `main-test/main-sync` → `alpha/main-sync`
- 日志前缀: `[main-test-worktree]` → `[alpha-worktree]`
- 脚本 commit 进 main

### Phase B: SOP + Skill + 提示词更新

- SOP.md: 加 alpha 通道说明
- quality-gate skill: 验收证据优先取自 alpha
- worktree skill: 提示开发完可以 `pnpm alpha:start` 自测
- CLAUDE.md: 加 alpha 验收通道铁律
- AGENTS.md: 同步 alpha 规则
- GEMINI.md: 同步 alpha 规则（暹罗猫不写代码但需要知道验收流程）

## Acceptance Criteria

### Phase A（基础设施改名）
- [ ] AC-A1: `pnpm alpha:start` 能拉起 3011/3012/4111/6398 隔离环境
- [ ] AC-A2: `pnpm alpha:sync` 能 ff-only 同步 origin/main
- [ ] AC-A3: `pnpm alpha:status` 显示环境状态含 api_running
- [ ] AC-A4: `pnpm alpha:test` 测试全绿
- [ ] AC-A5: 旧 `main-test` worktree 能被自动迁移到 `alpha/main-sync`

### Phase B（SOP + 提示词）
- [ ] AC-B1: CLAUDE.md 含 alpha 通道规则
- [ ] AC-B2: AGENTS.md 含 alpha 通道规则
- [ ] AC-B3: GEMINI.md 含 alpha 通道规则
- [ ] AC-B4: SOP.md 含 alpha 通道使用说明
- [ ] AC-B5: quality-gate skill 提及 alpha 验收证据

## Dependencies

- **Evolved from**: 砚砚的 `feat/main-test-worktree-launcher` 分支（已 review 通过）
- **Related**: runtime-worktree.sh（模式对齐）

## Risk

| 风险 | 缓解 |
|------|------|
| 改名后旧 worktree 路径残留 | 脚本已有 detached HEAD 自动修复逻辑，扩展到支持旧 main-test 目录迁移 |
| 提示词改动影响多猫 | Phase B 改动最小化，只加一条短规则 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-15 | 立项；砚砚 main-test 脚本已 review 通过 |
