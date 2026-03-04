---
name: worktree
description: >
  创建 Git worktree 隔离开发环境，含 Redis 6398 安全配置。
  Use when: 开始任何代码修改、新功能开发、bug fix。
  Not for: 纯文档修改（≤5 行）、不涉及代码的讨论。
  Output: 隔离的 worktree + 正确的 Redis/环境配置。
triggers:
  - "开始开发"
  - "新 worktree"
  - "开 worktree"
renamed-from: using-git-worktrees
---

# Worktree

开始任何非 trivial 的功能开发前，必须拉 worktree 隔离，不要直接在 main 上改代码。

## 目录位置（铁律）

**Cat Cafe 项目：`../cat-cafe-{feature-name}`（relay-station/ 同级）**

```bash
git worktree add ../cat-cafe-{feature-name} -b feat/{feature-name}
```

- 🔴 **禁止在项目内部创建**（不要用 `.worktrees/` 子目录）
- 🔴 **`cat-cafe-runtime` 是生产环境，绝对不能删/清理！** 它不是开发 worktree
- 🔴 **禁止在 `cat-cafe-runtime` 里执行 `pnpm start` / `pnpm runtime:start`**（会先 kill 旧 API，等于把在线 runtime 踢掉）

其他项目：先查 `CLAUDE.md / AGENTS.md` 有没有指定位置 → 有就用 → 没有再问用户。

## 创建步骤

```bash
# 1. 创建 worktree
git worktree add ../cat-cafe-{feature-name} -b feat/{feature-name}
cd ../cat-cafe-{feature-name}

# 2. 安装依赖
pnpm install

# 3. 创建 .env.local（Redis 隔离，必须！）
cat > .env.local <<EOF
REDIS_URL=redis://localhost:6398
NEXT_PUBLIC_API_URL=http://localhost:3102
EOF

# 4. 验证 Redis 隔离
echo $REDIS_URL   # 必须是 redis://localhost:6398，不能是 6399

# 5. 验证基线测试通过
pnpm test
```

## Redis 隔离（数据安全红线）

| Redis | 端口 | 用途 |
|-------|------|------|
| **用户 Redis** | **6399** | 铲屎官的数据，🔴 圣域，只读 |
| **开发 Redis** | **6398** | 猫猫开发测试，随便折腾 |

**Worktree 中启动服务 = 必须用 6398。**
不设置 REDIS_URL 就启动服务 = 回落到 6399 = 数据丢失风险。

## 合入后清理

分支合入 main 后**当场清理**，不要留到下次：

```bash
git worktree remove ../cat-cafe-{feature-name}
git branch -d feat/{feature-name}
git worktree prune
```

检查是否有积压未清理：
```bash
git worktree list             # 列出所有 worktree
git branch --merged main      # 哪些分支已合入
```

## Codex `apply_patch` 陷阱（开发猫必读）

`apply_patch` 落点由**会话默认工作目录**决定，不跟着 `cd` 走。

**避免方式：**
- patch 文件名用绝对路径（指向目标 worktree）
- 或者改用 `sed/perl` 在目标 worktree 执行

## 安全核查

创建前：
- [ ] 目录放在 relay-station/ 同级（不在项目内部）
- [ ] 不是 `*-runtime` 命名
- [ ] `.env.local` 包含 `REDIS_URL=redis://localhost:6398`
- [ ] 基线测试通过（失败了先报告再问是否继续）
- [ ] 当前会话不是 `cat-cafe-runtime` 的运行态验收会话（验收会话默认只读，不做重启命令）

清理前：
- [ ] 分支已合入 main（`git branch --merged main`）
- [ ] 不是 `cat-cafe-runtime`（永远不删）

## Next Step

→ `tdd`（在 worktree 里开始实现）
