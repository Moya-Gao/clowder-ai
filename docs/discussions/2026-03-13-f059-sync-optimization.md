---
feature_ids: [F059]
topics: [sync, opensource, architecture, governance]
doc_kind: discussion
created: 2026-03-13
participants: [opus, gpt52]
status: converged
thread: current
---

# F059 同步架构优化讨论

> 背景：3/9~3/13 的同步事故链暴露了 cat-cafe ↔ clowder-ai 同步管线的结构性缺陷。
> 本文综合布偶猫和缅因猫的独立分析，收敛为可执行的优化方案。

---

## 一、两猫独立分析摘要

### 布偶猫（opus）的分析

**核心发现：4 个结构性缺陷**

1. **`rsync --delete` 是核武器** — 目标仓任何不在白名单的文件都被删除，社区贡献、独立 CI 配置一次 sync 全归零
2. **没有入站同步机制** — 完全无法感知 clowder-ai 的独立变更，社区 PR 合入后下次 sync 直接覆盖
3. **没有 pre-sync 门禁** — 不检查源仓 dirty 状态、测试是否通过、目标仓是否有未合入 PR
4. **没有 diff 预览** — 直接 rsync，不告诉操作者会删什么改什么

**提出的方案：**
- 用 diff-then-apply 替代 rsync --delete
- 新增 `target_owned_files` 保护清单
- 新增 pre-sync gate check
- 新增 `sync-from-opensource.sh --check`（感知入站变更，不自动回流）
- 加强 security scan（entropy 检测、email regex、`/Users/` 路径扫描）

### 缅因猫（gpt52）的分析

**核心立场：不做双向自动同步，正向是发布，反向是 intake**

三层关系模型：
1. **Source-owned** — 代码/脚本/skills/架构文档，只在 cat-cafe 改，clowder-ai 的改动只算候选
2. **Public-generated** — README/CONTRIBUTING/.env.example 等，cat-cafe 维护源文件 → transform 生成
3. **Public-intake** — issues/PR/beta 反馈，不自动回写，走 intake 流程

**提出的方案：**
- 反向不做 sync，做 intake/backport（clowder-ai PR → review → intake-approved 标签 → cat-cafe 重做/cherry-pick）
- 未来如需双向，先划出"社区区"（`examples/community/`, `docs/community/`），镜像区覆盖，社区区保留
- 同步前源仓必须绿（pnpm check + lint + test:public）
- 同步后跑发布验收（文件 inventory + forbidden scan + 标准启动）
- 改共享脚本时必须附"对家里 runtime 的影响说明"

---

## 二、共识点（两猫一致）

| # | 共识 | 说明 |
|---|------|------|
| C1 | **cat-cafe 是唯一真相源** | clowder-ai 的代码/脚本/docs 真相永远在 cat-cafe |
| C2 | **反向不自动同步** | 社区变更走 intake 流程，不做 reverse sync |
| C3 | **需要 pre-sync 门禁** | 源仓 clean + 测试通过 + 目标仓无冲突 |
| C4 | **rsync --delete 太危险** | 需要保护目标仓独有文件 |
| C5 | **需要 diff 预览** | 同步前展示变更摘要，人工确认 |
| C6 | **永不同步真实 .env** | 只同步 `.env.example.opensource` → `.env.example` |
| C7 | **同步后需发布验收** | install + build + smoke test 必须通过 |
| C8 | **白名单优于黑名单** | 维持现有 allowlist 架构不变 |

---

## 三、分歧与收敛

### 分歧 1：反向回流的具体机制

- **opus**: 写一个 `sync-from-opensource.sh --check` 脚本，利用 provenance SHA 对比找出目标仓独立改动
- **gpt52**: 不需要脚本，用 GitHub label（`intake-approved` / `needs-backport`）人工驱动

**收敛方向**: 两者不矛盾。脚本做检测（sync 前自动跑，提醒有什么需要回看），label 做流程治理（决定哪些值得 backport）。

### 分歧 2：目标仓保护粒度

- **opus**: `target_owned_files` 列表 + diff-then-apply
- **gpt52**: 分区思路（镜像区 vs 社区区）

**收敛方向**: 当前阶段用 `target_owned_files` 列表就够，未来社区活跃后再升级为分区模式。

---

## 四、决策

> 以下决策由两猫讨论收敛后确认。

### D1: 两仓关系定义

**cat-cafe = 开发真相源，clowder-ai = 发布仓/内测仓/社区入口。**

| 层级 | 文件所有权 | 同步方向 | 例子 |
|------|-----------|---------|------|
| Source-owned | cat-cafe 独占 | 正向覆盖 | 代码、脚本、skills、架构文档 |
| Public-generated | cat-cafe 维护源 → transform | 正向生成 | README、CONTRIBUTING、.env.example |
| Target-owned | clowder-ai 独占 | 正向不触碰 | .github/FUNDING.yml、CHANGELOG、社区文档 |
| Public-intake | clowder-ai 接收 → intake | 反向受控 | issues、PR、beta 反馈 |

**Public-generated 真相源文件（制度化）：**

以下文件是 cat-cafe 里的**公开版真相源**，不是 transform 的中间产物。它们的存在和维护是制度性要求：

| cat-cafe 真相源 | → clowder-ai 目标 |
|----------------|-------------------|
| `README.opensource.md` | `README.md` |
| `CONTRIBUTING.opensource.md` | `CONTRIBUTING.md` |
| `SETUP.opensource.md` | `SETUP.md` |
| `.env.example.opensource` | `.env.example` |
| `.github/pull_request_template.opensource.md` | `.github/pull_request_template.md` |
| `CLA.md` | `CLA.md`（直出） |
| `TRADEMARKS.md` | `TRADEMARKS.md`（直出） |

> 教训来源：README/CONTRIBUTING 事故中，根因之一是这层真相源没被制度化，导致公开仓手工维护了一份、源仓又维护了另一份。

### D2: 出站同步优化（sync-to-opensource.sh 改造）

**2a. Pre-sync gate（Step 0，在现有 Step 1 前插入）**

```
检查清单：
□ cat-cafe main 无 dirty（git diff --quiet && git diff --cached --quiet）
□ 目标仓无未提交改动（git -C $TARGET_DIR status --porcelain 为空）
□ 目标仓无 open PR（gh pr list -R ... --state open | wc -l == 0，或 warn）
```

失败则中止同步，打印原因。

**2b. Target-owned 保护（manifest 新增 `target_owned_files`）**

```yaml
# sync-manifest.yaml 新增
target_owned_files:
  - .github/FUNDING.yml
  - .github/ISSUE_TEMPLATE/
  - .github/DISCUSSION_TEMPLATE/
  - CHANGELOG.md
  - docs/community/
```

sync Step 5 改为：先备份 target-owned → rsync → 恢复 target-owned。

**2c. Diff 预览（Step 4.5，security scan 后、rsync 前）**

```
=== Sync Preview ===
新增:  12 files
更新:  45 files
删除:   3 files ⚠️
  - packages/web/src/components/OldComponent.tsx
  - docs/features/F099-deprecated.md
  - scripts/old-tool.sh
Target-owned (保护): 2 files
  - .github/FUNDING.yml
  - docs/community/setup-guide.md

继续? [y/N]
```

非 `--force` 模式下必须人工确认。

**2d. Post-sync 标准启动验收（Step 6，rsync 后必须执行）**

> 这次事故真正咬人的不是 `pnpm check`，而是同步后按公开用户方式跑不起来。
> 因此 post-sync 验收不是可选 smoke test，而是**硬性启动验收**。

```bash
# 在目标仓执行——模拟公开用户首次启动
cd $TARGET_DIR
cp .env.example .env                          # 用公开版模板，不手改
pnpm install --frozen-lockfile                 # 依赖安装
pnpm --filter @cat-cafe/shared build           # shared 构建
pnpm --filter @cat-cafe/api build              # API 构建

# 启动验收（必须通过）
# 1. 前端页面能打开（端口必须是 3003 或 3004，不是 3001/3002）
# 2. API health endpoint 返回 200
# 3. 端口验收：公开仓必须使用 3003/3004/6379
#    不得 kill / 占用 / 污染我们家的 3001/3002/6399
#    验证方式：启动前后对比 lsof snapshot，家里的端口 before/after 无差异
# 4. 可选：pnpm --filter @cat-cafe/api run test:public
```

验收失败 → 中止同步，不推 commit 到 clowder-ai。

### D3: 入站感知机制

**3a. Sync 前自动检测**

sync-to-opensource.sh 在 pre-sync gate 中加一步：
```bash
# 读上次 provenance 中的 source_commit_sha
LAST_SYNC_SHA=$(jq -r '.source_commit_sha' "$TARGET_DIR/.sync-provenance.json" 2>/dev/null)
if [ -n "$LAST_SYNC_SHA" ]; then
  # 检查目标仓自上次同步后的独立改动
  UPSTREAM_CHANGES=$(git -C "$TARGET_DIR" log --oneline "${LAST_SYNC_SHA}..HEAD" 2>/dev/null | wc -l)
  if [ "$UPSTREAM_CHANGES" -gt 0 ]; then
    echo "⚠️ clowder-ai 自上次同步后有 $UPSTREAM_CHANGES 个独立 commit"
    echo "建议先 review 这些变更再同步"
    git -C "$TARGET_DIR" log --oneline "${LAST_SYNC_SHA}..HEAD"
  fi
fi
```

**3b. GitHub label 流程**

| Label | 含义 | 动作 |
|-------|------|------|
| `intake-approved` | 值得吸收回 cat-cafe | 在 cat-cafe 开 intake 任务 |
| `needs-backport` | 需要 cherry-pick | 在 cat-cafe 做 cherry-pick + review |
| `public-only` | 只影响公开仓 | 直接在 clowder-ai 处理，加入 target_owned |

### D4: 安全扫描加强

**4a. 文件名级 denylist 新增**

| 检查项 | 类型 | 实现 |
|--------|------|------|
| `proxy-upstreams.json` | denylist_patterns 新增 | 文件名匹配（含上游密钥） |
| `.mcp.json` | denylist_patterns 新增 | belt-and-suspenders |

**4b. 内容级扫描新增**

| 检查项 | 类型 | 实现 |
|--------|------|------|
| `/Users/` 绝对路径 | 零容忍 | `grep -r '/Users/' $FILTERED_DIR` |
| Email 地址 | 零容忍（非 noreply） | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`（排除 `@example.com`、`@noreply`） |
| 高熵字符串（≥32 chars） | warning 级 | 对非 hash/非 lockfile 文件扫描 |

**4c. 内部工作流路径/运行态坐标扫描（gpt52 补充）**

> 这次泄漏和误导的不只是 secrets，还有内部工作流路径和内部运行态坐标。

| 检查项 | 类型 | 说明 |
|--------|------|------|
| `docs/mailbox` | 零容忍（docs/ 内） | 内部 review 路径，不应出现在公开文档 |
| `docs/plans` | 零容忍（docs/ 内） | 内部计划路径 |
| `docs/discussions` | 零容忍（docs/ 内） | 内部讨论路径 |
| `.cat-cafe/` | 零容忍 | 本地运行态目录 |
| `cat-cafe-runtime` | warning | 内部运行态标识 |
| `6399` | 零容忍（非注释行） | 我们家的 Redis 端口 |
| `3001` / `3002` | warning（docs/skills 内） | 我们家的 web/API 端口 |

### D5: 共享脚本变更纪律（说明 + 强制验收）

改动以下文件时，**必须同时满足两个要求**：

**受控文件清单：**
```
scripts/start-dev.sh
scripts/runtime-worktree.sh
scripts/anthropic-proxy.mjs
scripts/qwen3-asr-server.sh
scripts/whisper-server.sh
scripts/tts-server.sh
scripts/llm-postprocess-server.sh
.env.example / .env.example.opensource
```

**要求 1：commit message 或 PR description 附 Runtime Impact 说明**

```
## Runtime Impact
- 家里(cat-cafe): [影响说明]
- 公开仓(clowder-ai): [影响说明]
- 需要补的 .env 显式项: [列表]
```

**要求 2：强制 smoke test（不能只写说明不验证）**

> 教训：这次事故中文档写了影响说明，但真正重启 runtime 后还是炸了。

- 家里 runtime smoke test：`pnpm start` 能正常启动，关键端口（3001/3002/6399）正常
- 公开仓 startup smoke test：按 D2d 标准启动验收流程执行

两个 smoke 都通过才允许 merge。

---

## 五、实施优先级

| 优先级 | 项目 | 理由 | 工作量 |
|--------|------|------|--------|
| P0 | target_owned_files 保护 + rsync 改造 | 防止核弹式同步毁掉目标仓内容 | 中 |
| P0 | pre-sync gate check | 防止脏 tree / 未通过测试的代码同步出去 | 小 |
| P0 | post-sync 标准启动验收 | 这次事故首先被"同步后跑不起来"咬死 | 中 |
| P1 | diff 预览 + 人工确认 | 让操作者知道会发生什么 | 小 |
| P1 | 入站变更检测（provenance-based） | 防止覆盖社区贡献 | 小 |
| P1 | 安全扫描加强（含内部路径/运行态坐标） | 堵住已知泄漏向量 | 小 |
| P1 | runtime impact 说明 + 强制 smoke | 纪律 + 验证双保险 | 小 |
| P2 | 高熵字符串检测 | 兜底未知格式密钥 | 中 |
| P3 | GitHub label 流程 | 社区活跃后才有意义 | 小 |

---

## 六、关联文档

- [F059 Feature Spec](../features/F059-open-source-plan.md)
- [同步事故链复盘](../postmortems/2026-03-13-opensource-sync-incident-chain.md)
- [sync-manifest.yaml](../../sync-manifest.yaml) — 同步白名单 SOT
- [sync-to-opensource.sh](../../scripts/sync-to-opensource.sh) — 同步脚本
- [open-source-status.md](../open-source-status.md) — 开源状态跟踪

---

## 七、决策签名

| 猫猫 | 立场 | 签名时间 |
|------|------|---------|
| 布偶猫(opus) | 同意 D1~D5（含 gpt52 补充的 4 点 + 端口验收修正） | 2026-03-13 |
| 缅因猫(gpt52) | 同意 D1~D5（4 点修订已采纳 + D2d 端口措辞已修正） | 2026-03-13 |
