---
title: "同步管道 Hotfix Lane 设计"
feature_ids: [F059]
date: 2026-03-14
participants: [铲屎官, 宪宪/Opus]
status: spec-ready
tags: [sync, clowder-ai, infrastructure]
related_issues: ["clowder-ai#46", "clowder-ai#52"]
doc_kind: discussion
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
    │         │
    │         └─ tag: sync/2026-03-13-143052   ← sync 完在 cat-cafe 打 tag（秒精度）
    │
    ├─── (社区报 bug)
    │
    ├─── cat-cafe worktree: 基于 sync tag 拉分支 fix/xxx
    │         │                  （git worktree add -b fix/xxx ../cat-cafe-hotfix-xxx sync/...）
    │         │
    │         ├─ 在 worktree 里修 bug（只改需要的文件）
    │         ├─ 从 worktree 跑 sync-hotfix.sh → 对改动文件跑 sanitizer → 推到 clowder-ai 分支
    │         ├─ PR → clowder-ai main       ← 小而精的 bugfix PR
    │         └─ 同一个 fix cherry-pick 回 cat-cafe main   ← 两边同步
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

全量 sync 完成后，在 **cat-cafe（源 repo）** 打 tag：

```bash
# sync-to-opensource.sh 末尾
TAG="sync/$(date +%Y-%m-%d-%H%M%S)"
git -C "$SOURCE_DIR" tag "$TAG"
# 每次 sync 生成唯一 tag（秒精度），不用 -f
```

> **已决**：Tag 打在 cat-cafe（源），不打在 clowder-ai（目标）。秒精度，不用 `-f`。

#### 2. 新增 hotfix 脚本：`scripts/sync-hotfix.sh`

```
用法: cd <cat-cafe-worktree> && bash scripts/sync-hotfix.sh <branch-name> <file1> [file2] ...

流程:
1. 找到最新 sync tag（在 cat-cafe 源 repo 上）
2. 验证指定文件在 manifest 白名单内
3. Target 侧漂移检查：clowder-ai main 上的这些文件必须仍等于 sync tag 对应版本，否则 hard-fail
4. 在 clowder-ai 基于 main 创建分支
5. 从 worktree（pwd）复制指定文件到分支
6. 对复制的文件跑 sanitizer（单文件模式）
7. 提交 + 推送
8. 输出: "请在 clowder-ai 上开 PR"
```

> **关键**：脚本从 pwd（worktree）读文件，不从 cat-cafe main 读。worktree 基于 sync tag checkout，所以只有 fix 的增量。

#### 3. sanitizer 支持单文件模式

当前 sanitizer 是全量 Perl 脚本跑所有文件。需要支持：

```bash
# 复用同一个 _sanitize.pl，但只对指定文件运行
perl -i -p _sanitize.pl path/to/specific/file.ts
```

这个本身已经可以做到（Perl `-i` 就是 in-place），只需要把 sanitizer 生成逻辑提取为可复用函数。

## 验收标准

1. 全量 sync 后 **cat-cafe**（源 repo）有 `sync/YYYY-MM-DD-HHMMSS` tag
2. `sync-hotfix.sh fix/proxy-fallback packages/api/src/.../invoke-single-cat.ts` 在 worktree 内运行，能生成干净的 hotfix 分支
3. **hotfix 分支的 diff 只包含指定文件的 fix 增量**（经过 sanitizer），不夹带 sync tag 之后的其他改动
4. 如果 clowder-ai main 上的目标文件在 sync tag 之后有变动，脚本 hard-fail 并提示
5. hotfix 合入 clowder-ai + cherry-pick 回 cat-cafe main 后，下次全量 sync 无冲突

## 分工

- **实现**：平行世界的布偶猫（避免上下文污染）
- **验证 + PR review**：当前宪宪
- **proxy fallback bug（#46）**：作为第一个 hotfix lane 的试点用例

## 宪宪（当前 session 布偶猫）Review 意见

方向支持。补 3 点：

### 1. 和 intake ledger 的交互（遗漏）

Hotfix 合入 clowder-ai 后，`last_reviewed_target_head`（`docs/ops/opensource-intake-ledger.json`）会落后于新 commit。下次全量 sync 前必须先 `--record` 这个 hotfix commit，否则 intake gate 会 block。

**建议**：`sync-hotfix.sh` 末尾自动提示或直接调用 `intake-from-opensource.sh --record`。

### 2. Review 铁律（开放问题 #3）

文档说 bugfix "不需要跨猫 review"——但铁律是"同一个体不能 review 自己的代码"。

- 平行布偶猫写 fix → 当前布偶猫 review：✓（同 family 不同个体）
- 同一只猫自己写自己 review：✗

建议明确写成：hotfix 也要跨个体 review，可降级到同 family 不同个体。

### 3. sanitizer `$ARGV` 上下文（开放问题 #2）

`$ARGV` 在单文件模式下就是传入的文件路径。只要路径格式和 sanitizer 里的条件分支匹配（相对路径 `packages/api/src/...`），应该能正确命中。需要实测验证 `managed_roots` 前缀是否一致。

## 开放问题

1. Tag 命名：`sync/2026-03-13` 还是 `sync/v3.1`（语义化版本）？
   - 铲屎官倾向日期，简单直观
   - **已决**：日期 + 秒精度 `sync/YYYY-MM-DD-HHMMSS`，不用 `-f`
2. 如果 hotfix 涉及多个文件跨多个 managed_roots，sanitizer 的上下文（`$ARGV` 条件分支）能否正确处理？
   - 需要验证：单文件 Perl 运行时 `$ARGV` 是否正确反映文件路径
   - 宪宪：应该能，但需实测
3. cat-cafe 侧的 fix 是直接 commit 到 main 还是也走 worktree + PR？
   - **已决**：hotfix 也需要跨个体 review（铁律：同一个体不能 review 自己的代码），可降级到同 family 不同个体
4. Tag 打在哪个 repo？
   - **已决**：打在 cat-cafe（源），不打在 clowder-ai（目标）

---

## 2026-03-13 实现偏差分析与修正计划

### 偏差记录

首次实现（宪宪/Opus, 2026-03-13）偏离了设计文档核心流程。

| # | 设计文档原文 | 实际实现 | 严重度 |
|---|---|---|---|
| D1 | "cat-cafe **worktree**: 基于 sync tag 拉分支" — hotfix 文件从 worktree 出发 | `SOURCE_DIR` 硬编码为脚本所在目录的 `..`（即 cat-cafe 主仓库 HEAD），实际从 **main** 复制 | **P0** |
| D2 | "只改需要的文件" → diff 只含 fix 增量 | 整文件复制从 main HEAD，夹带了 sync tag 之后所有后续改动（如 `铲屎官` vs `team lead`） | **P0**（D1 的直接后果） |
| D3 | 推完 clowder-ai 后再合回 cat-cafe main | 先合 cat-cafe main → 再从 main 推到 clowder-ai | P1（顺序反了，但不影响正确性如果 D1 修好） |
| D4 | 流程文档应同步更新：SOP、喵约、社区相关 skills | 只写了脚本，未更新任何流程文档 | P1 |

**根因**：实现时没有逐条对照设计文档的验收标准（尤其是 AC#3 "diff 只包含指定文件的变更"）。

### 实际事故

用 clowder-ai#18（button tooltips）做 e2e 验证时发现：
- QueuePanel.tsx 的 `team lead`（clowder-ai 外部称呼）被 cat-cafe main 的 `铲屎官`（内部称呼）覆盖
- 原因：从 main 整文件复制，cat-cafe main 里就是 `铲屎官`，sanitizer 故意不替换（设计如此）
- 如果从 worktree（基于 sync tag）复制，worktree 里的文件和 clowder-ai 上次 sync 状态一致，只有 fix 的增量，不会出现此问题

### 修正计划

#### M1. 修 `sync-hotfix.sh`：支持从 worktree 运行（修 D1/D2）

**正确流程**：

```
铲屎官说"修 clowder-ai#XX"
    │
    ├─ 1. 开 worktree，基于 sync tag 拉分支
    │      git worktree add -b fix/XX ../cat-cafe-hotfix-XX sync/2026-03-13-HHMMSS
    │
    ├─ 2. 在 worktree 里修 bug（只改需要的文件）
    │
    ├─ 3. 从 worktree 跑 sync-hotfix.sh
    │      cd ../cat-cafe-hotfix-XX
    │      bash scripts/sync-hotfix.sh fix/XX <changed-files>
    │      脚本自动检测 pwd 是 worktree → 用 worktree 文件作为源
    │
    ├─ 4. clowder-ai 上开 PR、review、merge
    │
    └─ 5. 同一个 fix cherry-pick 回 cat-cafe main
```

**脚本改动**：
- `SOURCE_DIR` 不再硬编码为脚本所在目录。改为使用 `pwd` 作为源
- **Source 侧硬约束**：pwd 必须是基于 sync tag 的 git worktree，否则 **hard-fail**（不给 confirm-continue）。检查方式：`git rev-parse --git-common-dir` ≠ `--git-dir`（是 worktree）+ `git log --oneline sync/TAG..HEAD` 确认 worktree 基于 sync tag
  - 不提供 `--source` 快捷覆盖。如果确实需要从非 worktree 运行（调试/紧急情况），提供 `--force-unsafe-source`，但脚本会打 **WARNING: 不满足 AC#3，hotfix diff 可能包含非 fix 增量**
- **新增 target 侧漂移检查**（修 R1-P1-2）：
  - 对每个要复制的文件，比较 clowder-ai main 上的当前版本与上次全量 sync 推过来的版本
  - 如果不一致（说明 clowder-ai 在 sync 后有过改动），**hard-fail** 并提示：
    `"文件 {path} 在 clowder-ai main 上已有 sync tag 之后的改动，整文件复制会覆盖。请手动处理。"`
  - 这保证了 AC#3：hotfix diff 只包含 fix 增量，不会意外覆盖 target 侧的后续改动

#### M2. 修 clowder-ai PR #65 的误伤（止损）

- 在 clowder-ai 的 `fix/18-button-tooltips` 分支上，回退 QueuePanel.tsx 的 `铲屎官` → `team lead`
- force push 更新 PR

#### M3. 更新流程文档（修 D4）

需要检查并更新的文档/skills：

| 文档/Skill | 具体位置 | 需要写什么 |
|---|---|---|
| 本文档（hotfix-lane-design.md） | 全文 | ✅ 偏差分析已写入，前半截已统一到新共识 |
| `docs/SOP.md` | §社区 issue 流程（~L125） | 补充 hotfix lane 操作步骤：worktree → sync-hotfix → PR → cherry-pick |
| `docs/features/F059-open-source-plan.md` | Phase 4c | 补充 hotfix lane 作为已实现的同步机制 |
| `cat-cafe-skills/community-pr/SKILL.md` | 全文 | 评估：是在现有 community-pr skill 中扩展 hotfix 流程，还是新建 `hotfix-lane` skill |
| `sync-manifest.yaml` | 无需改（manifest 本身不变） | — |

#### M4. 修正顺序（修 D3）

SOP 中明确：hotfix 先推 clowder-ai → 验证通过 → cherry-pick 回 cat-cafe main。不是反过来。

### 愿景守护请求

请砚砚（@gpt52）review 本修正计划，重点守护：

1. **M1 的流程是否真正匹配设计文档的核心机制图**（第 29-46 行）
2. **验收标准 AC#3（"diff 只包含指定文件的变更"）是否被 M1 方案覆盖**
3. **M3 的文档清单是否完整**——还有哪些文档/skills 应该同步更新
4. **是否有其他偏差我没发现的**
