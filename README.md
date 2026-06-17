# Cat Café

Cat Café 是三只猫猫协作开发的工程仓库。  
为避免开发态热更新重启打断对话，运行态与开发态默认分离到不同 worktree。

## 一键启动

```bash
pnpm start
```

`pnpm start` 现在会自动执行 runtime 流程（init/sync/start），保持“单命令拉起”的体验。  
首次运行会创建 `../cat-cafe-runtime` 并安装依赖，后续会自动同步再启动。

## 独立 Hindsight 服务（本仓库）

为了避免和其他仓库共用实例导致互相影响，`cat-cafe` 现在使用独立 Hindsight 入口：

- API: `http://localhost:18888`
- UI: `http://localhost:19999/dashboard`

启动与维护命令：

```bash
pnpm hindsight:start
pnpm hindsight:status
pnpm hindsight:logs
pnpm hindsight:stop
pnpm hindsight:config
```

说明：
- `docker-compose.hindsight.yml` 内置 `hindsight-volume-init`，会在启动前自动修正数据卷权限，避免 pg0 首启失败。
- 首次冷启动会下载本地 embedding/reranker 模型，可能需要 1-3 分钟。
- 启动等待超时可通过 `HINDSIGHT_STARTUP_TIMEOUT_SECONDS` 调整（默认 300 秒）。

配置文件：

- `docker-compose.hindsight.yml`
- `scripts/hindsight-service.sh`

## 运行规范（强制）

1. 不在 `main` 分支直接运行 `scripts/start-dev.sh`。
2. 运行服务使用专用 runtime worktree（默认 `../cat-cafe-runtime`）。
3. 功能开发和 bug 修复在独立 feature worktree 完成。
4. runtime worktree 只做 `origin/main` 的 fast-forward 同步。

`scripts/start-dev.sh` 已内置防呆：在 `main` 分支启动会直接拒绝并给出指引。  
日常请用 `pnpm start`（runtime 一键流）。

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

### 2) 从运行态 worktree 启动开发服务

```bash
pnpm runtime:start
```

**Runtime 契约：passive 冻结 · 单一入口 · explicit restart only**（ADR-039）

`pnpm start`（或 `pnpm runtime:start`）是 runtime 唯一入口，内部完整跑：
1. `git pull` 同步 origin/main
2. Rebuild stale dist（shared / mcp / web）
3. spawn API + Web 进程（**non-watch 模式**——runtime 不主动响应 src 变化）

Runtime 不再监听 main src jitter 自动重启。restart 只在用户显式 `pnpm start` 时发生。  
若检测到 API 已在运行，会跳过预同步避免运行中硬切版本（先 `pnpm stop` 再 `pnpm start`）。

传递 `start-dev` 参数：

```bash
pnpm runtime:start -- --quick
pnpm runtime:start -- --memory
```

等价一键入口（推荐）：

```bash
pnpm start
pnpm start -- --quick
```

### 3) 查看运行态状态

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

## 直连启动（仅调试）

如需直接调用原脚本（不经过 runtime 管理器）：

```bash
pnpm start:direct
```

## Signal Hunter 迁移（F21 S6）

从旧仓库 `signal-hunter` 迁移文章与信源配置到 `~/.cat-cafe/signals`：

```bash
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api run migrate-signals -- --from /Users/lysander/projects/relay-station/signal-hunter
```

常用参数：

```bash
# 只做解析与统计，不落盘
pnpm --filter @cat-cafe/api run migrate-signals -- --from /path/to/signal-hunter --dry-run

# 指定目标 signals 根目录
pnpm --filter @cat-cafe/api run migrate-signals -- --from /path/to/signal-hunter --to /tmp/cat-cafe-signals

# 迁移时同步写 Redis 索引（可选）
pnpm --filter @cat-cafe/api run migrate-signals -- --from /path/to/signal-hunter --redis-url redis://127.0.0.1:6398/15
```
