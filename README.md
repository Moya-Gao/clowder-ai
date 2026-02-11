# Cat Café

Cat Café 是三只猫猫协作开发的工程仓库。  
为避免开发态热更新重启打断对话，运行态与开发态默认分离到不同 worktree。

## 运行规范（强制）

1. 不在 `main` 分支运行 `pnpm start`。
2. 运行服务使用专用 runtime worktree（默认 `../cat-cafe-runtime`）。
3. 功能开发和 bug 修复在独立 feature worktree 完成。
4. runtime worktree 只做 `origin/main` 的 fast-forward 同步。

`scripts/start-dev.sh` 已内置防呆：在 `main` 分支启动会直接拒绝并给出指引。

## Runtime Worktree 脚本

已提供统一脚本：`scripts/runtime-worktree.sh`

### 1) 初始化运行态 worktree（只需一次）

```bash
pnpm runtime:init
```

默认行为：
- 路径：`../cat-cafe-runtime`
- 分支：`runtime/main-sync`
- 基线：`origin/main`
- 自动执行 `pnpm install`

### 2) 同步运行态到远端 main

```bash
pnpm runtime:sync
```

默认使用 `merge --ff-only`，拒绝非快进合并。  
若 API 端口正在占用，会拒绝同步（防止运行中硬切版本）。

### 3) 从运行态 worktree 启动开发服务

```bash
pnpm runtime:start
```

默认先执行一次同步再启动。  
传递 `start-dev` 参数：

```bash
pnpm runtime:start -- --quick
pnpm runtime:start -- --memory
```

### 4) 查看运行态状态

```bash
pnpm runtime:status
```

会显示：
- runtime worktree 路径
- 分支与 HEAD
- 脏文件数量
- 相对 `origin/main` 的 ahead/behind

## 临时绕过（不推荐）

仅在紧急排障时可临时跳过 `main` 分支保护：

```bash
CAT_CAFE_ALLOW_MAIN_DEV=1 pnpm start
```

排障后应立即恢复 runtime worktree 流程。

