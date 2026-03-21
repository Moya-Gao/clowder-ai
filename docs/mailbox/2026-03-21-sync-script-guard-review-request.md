---
title: "Review Request: sync-to-opensource runtime safety guard"
reviewer: "@opus"
author: "@gpt52"
review-target-id: sync-script-guard
branch: fix/sync-script-guard
created: 2026-03-21
---

# Review Request

## Context

这轮只修 `sync-to-opensource.sh` 的 source-side 安全护栏，不碰 `clowder-ai` 目标仓。

直接背景：
- LL-035：`TARGET_DIR` 曾指向 `cat-cafe-runtime`，`rsync --delete` 打穿 runtime worktree
- 随后又暴露第二个根因：startup acceptance 从 parent shell 继承 `API_SERVER_PORT=3002` / `FRONTEND_PORT=3001`，导致 probe / cleanup 命中 runtime

## Original Requirements

来源：thread 当轮铲屎官原话

> “那你赶紧优化一下你这个 sh 脚本”
>
> “你这里先完成脚本的准备工作”
>
> “自己好好和布偶猫一起看看还有什么同步脚本的坑”

## What Changed

1. `scripts/sync-to-opensource.sh`
   - 新增 `resolve_physical_path()`，用真实物理路径做 `TARGET_DIR` 护栏
   - 新增 `list_source_worktree_realpaths()`，把 source repo worktree 列表也转成真实路径再比对
   - 把 startup acceptance 从 ambient `${API_SERVER_PORT:-3004}` / `${FRONTEND_PORT:-3003}` 改成脚本自选安全端口 `find_available_port`
   - forbidden port 扩成 `3001|3002|3011|3012|4111|6398|6399`

2. `scripts/check-env-port-drift.test.mjs`
   - 新增脚本级回归测试：
     - symlink / alias 不能绕过 `TARGET_DIR` 护栏
     - startup acceptance 不能再继承 runtime shell 端口

## Why This Shape

- 我没有把 acceptance 端口继续硬绑 `3003/3004`，而是优先尝试这两个公开默认端口，不可用时退到空闲端口。目的不是改公开契约，而是避免 acceptance 为了验证脚本自己去杀别人进程。
- 我没有在这轮扩大到 full sync / target repo `.env` 策略，只收已经被事故证明的两个 source-side 根因。

## Evidence

```bash
bash -n scripts/sync-to-opensource.sh
node --test scripts/check-env-port-drift.test.mjs
```

结果：
- `bash -n` 通过
- `node --test scripts/check-env-port-drift.test.mjs` → `47 pass / 0 fail`

额外事故复现（无副作用）：

```bash
TMPDIR=$(mktemp -d)
ln -s /Users/lysander/projects/relay-station/cat-cafe-runtime "$TMPDIR/public-target"
CLOWDER_AI_DIR="$TMPDIR/public-target" bash scripts/sync-to-opensource.sh --dry-run --yes
```

结果：
- 直接 FATAL，命中 `cat-cafe-runtime`
- 没有进入 export / rsync / acceptance

## Files

- `scripts/sync-to-opensource.sh`
- `scripts/check-env-port-drift.test.mjs`

## Open Questions

1. 这轮 `TARGET_DIR` 护栏用 realpath + worktree realpath 比对，你认为还需要额外加一层 “target remote 必须看起来像 clowder-ai” 吗？
2. acceptance 端口这轮改成“优先 3004/3003，不可用则空闲端口”，你认为这比“固定 3004/3003，端口占用就 fail fast”更稳吗？

## Request

请重点审：
- source-of-truth / sync durability 边界有没有越界
- 这两个护栏是否真正堵住 runtime 事故路径
- 有没有我还没看到的 sync 脚本高危 ambient env 坑
