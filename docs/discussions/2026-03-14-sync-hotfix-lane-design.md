---
title: "同步管道 Hotfix Lane 设计"
date: 2026-03-14
participants: [铲屎官, 宪宪/Opus]
status: spec-ready
tags: [sync, clowder-ai, infrastructure]
related_issues: ["clowder-ai#46", "clowder-ai#52"]
---

# 同步管道 Hotfix Lane 设计

## 背景

Cat Café → Clowder AI 的开源同步目前是**全量单向推送**（`sync-to-opensource.sh`）。
每次 sync 按 `sync-manifest.yaml` 白名单把整个 `packages/api`、`packages/web` 等目录树推过去，一个 PR 包含所有变更。

**矛盾**：当社区用户报了 bug（如 clowder-ai#46 proxy ECONNREFUSED），我们只能：
- 在 cat-cafe 修 → 全量 sync → clowder-ai PR 带上所有增量（可能夹带未准备好的特性）
- 或在 clowder-ai 直接修 → 下次全量 sync 会覆盖，容易冲突

两种都不理想。需要一个**精准 hotfix 通道**。

## 决策：Tag-based Hotfix Lane

### 核心机制

```
cat-cafe main (持续开发)
    │
    ├─── 全量 sync ──→ clowder-ai main    ← 批量特性，一个大 PR
    │                       │
    │                       └─ tag: sync/2026-03-13   ← sync 完自动打 tag
    │
    ├─── (社区报 bug)
    │
    ├─── cat-cafe worktree: 基于 sync tag 拉分支 fix/xxx
    │         │
    │         ├─ 修 bug（只改需要的文件）
    │         ├─ 对改动文件跑 sanitizer（单文件模式）
    │         ├─ PR → clowder-ai main       ← 小而精的 bugfix PR
    │         └─ 同一个 fix 合入 cat-cafe main   ← 两边同步
    │
    └─── 下次全量 sync → 两边已一致，无冲突
```

### 两种节奏

| 类型 | 触发 | PR 特征 | 审核负担 |
|------|------|---------|---------|
| **全量 sync** | 铲屎官手动触发 | 大 PR，N 个文件，批量特性 | 低（机械同步） |
| **Hotfix/Enhancement** | 社区 issue 驱动 | 小 PR，聚焦单个 fix | 社区可 review |

### 需要改的东西

#### 1. sync 脚本：自动打 tag

全量 sync 完成后，在 clowder-ai 打 tag：

```bash
# sync-to-opensource.sh 末尾
TAG="sync/$(date +%Y-%m-%d)"
git -C "$TARGET_DIR" tag -f "$TAG"
git -C "$TARGET_DIR" push origin "$TAG" --force
```

#### 2. 新增 hotfix 脚本：`scripts/sync-hotfix.sh`

```
用法: scripts/sync-hotfix.sh <branch-name> <file1> [file2] ...

流程:
1. 在 clowder-ai 基于最新 sync tag 创建分支
2. 从 cat-cafe 复制指定文件到分支
3. 对复制的文件跑 sanitizer（单文件模式）
4. 提交 + 推送
5. 输出: "请在 clowder-ai 上开 PR"
```

#### 3. sanitizer 支持单文件模式

当前 sanitizer 是全量 Perl 脚本跑所有文件。需要支持：

```bash
# 复用同一个 _sanitize.pl，但只对指定文件运行
perl -i -p _sanitize.pl path/to/specific/file.ts
```

这个本身已经可以做到（Perl `-i` 就是 in-place），只需要把 sanitizer 生成逻辑提取为可复用函数。

## 验收标准

1. 全量 sync 后 clowder-ai 有 `sync/YYYY-MM-DD` tag
2. `sync-hotfix.sh fix/proxy-fallback packages/api/src/.../invoke-single-cat.ts` 能生成干净的 hotfix 分支
3. hotfix 分支的 diff 只包含指定文件的变更（经过 sanitizer）
4. hotfix 合入 clowder-ai + cat-cafe 后，下次全量 sync 无冲突

## 分工

- **实现**：平行世界的布偶猫（避免上下文污染）
- **验证 + PR review**：当前宪宪
- **proxy fallback bug（#46）**：作为第一个 hotfix lane 的试点用例

## 开放问题

1. Tag 命名：`sync/2026-03-13` 还是 `sync/v3.1`（语义化版本）？
   - 铲屎官倾向日期，简单直观
2. 如果 hotfix 涉及多个文件跨多个 managed_roots，sanitizer 的上下文（`$ARGV` 条件分支）能否正确处理？
   - 需要验证：单文件 Perl 运行时 `$ARGV` 是否正确反映文件路径
3. cat-cafe 侧的 fix 是直接 commit 到 main 还是也走 worktree + PR？
   - bugfix 级别：worktree + 直接 merge（不需要跨猫 review）
