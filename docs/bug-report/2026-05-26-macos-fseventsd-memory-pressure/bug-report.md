---
created: 2026-05-26
updated: 2026-05-26
doc_kind: bug-report
topics: [incident, macos, fseventsd, gate, redis, process-cleanup]
---

# macOS fseventsd Memory Pressure Incident

## 1. 报告人

铲屎官在 2026-05-25 16:13 PDT 发现 macOS 弹出应用程序内存不足，Force Quit 窗口把 `Terminal` 显示成约 60GB。这个现场在 Cat Cafe thread `thread_mpltme5sq72yqava` 里并发定位，thread 标题是「内存泄漏 整改聊天记录备份导出目录」。

同一个 thread 里，后续还追到了 Redis 冷启动风险、stale process cleanup、thread export autosave 污染 docs corpus 两个相关修复链路：

- PR #1891 / merge `7fb376a1c`: `fix: harden redis startup and stale process cleanup`
- PR #1897 / merge `58f0a43ec`: `fix(memory): keep thread exports out of docs corpus`

另一个今天的本地 Codex session `019e62e9-6269-7981-8124-c35c6972512a` 也有强相关证据：它在 2026-05-25/26 夜间运行了 `pnpm check`，进入 `check:start-profile-isolation`，并实际跑到 `sync-to-opensource.sh --dry-run --yes` 这段重型导出测试。

## 2. 复现步骤

已观察到的用户可见路径：

1. 多个 agent / thread 并行运行 `pnpm gate`、`pnpm check` 或开源 sync/intake 相关检查。
2. `pnpm check` 会执行 `pnpm check:start-profile-isolation`。
3. `scripts/start-dev-profile-isolation.test.mjs` 里的 `sync-to-opensource public launch transforms` 会直接执行 `bash scripts/sync-to-opensource.sh --dry-run --yes`。
4. `sync-to-opensource.sh` 会创建临时导出目录，复制/过滤大量文件，并对导出目录里的 docs / skills / 源码做多轮 `find` / recursive `grep` 扫描。
5. 如果 agent 被中断、反复重启或多个 gate 并发，文件系统事件量会被放大；同时旧测试进程、headless browser/MCP、随机端口 Redis 可能残留。
6. macOS `fseventsd` 进入异常状态后，内存继续攀升。Force Quit 可能把内存压力归因到启动这些命令的 `Terminal`，但真实大户是 root 进程 `fseventsd`。

期望行为：

- 普通 `pnpm check` / `pnpm gate` 不应在多个 thread 里无限叠加重型文件导出和全仓扫描。
- 测试 Redis、测试进程、browser/MCP 进程在父进程异常退出后应可被发现并清理。
- macOS 文件事件系统不应因为我们的 gate/test 模式被打到长期高 RSS / 高 CPU。

实际行为：

- 2026-05-25 现场出现 60GB 级内存压力。
- 2026-05-26 07:04 PDT 复查时，`fseventsd` 仍处于异常状态：PID `326`，RSS `36193072KB`，CPU `161.6%`，状态 `Rs`。
- 同一时间 `Terminal.app` 自身 RSS 只有 `134656KB`，说明 Force Quit 里的 `Terminal 60GB` 是归因/宿主现象，不是 Terminal.app 自己持有 60GB heap。
- 随机端口测试 Redis 已被清到 0 个；只剩受保护的 `6398` 和 `6399`。

## 3. 根因分析

这不是一个单点 JS heap leak。更准确的模型是三层叠加：

1. **后台 gate 太重**

   `package.json` 里 `check` 仍包含 `pnpm check:start-profile-isolation`。该测试文件里有一个用例会直接跑 `sync-to-opensource.sh --dry-run --yes`。这个 dry-run 不只是轻量字符串检查，而是构建临时导出树、复制文件、生成 public docs、执行格式化和多轮全目录扫描。

2. **agent 会把重型 gate 反复启动**

   现场曾看到 F211 / F212 worktree 里存在多个 `pnpm gate` / `pre-merge-check` / `start-dev-profile-isolation` 进程组。某些 Claude / Codex 后台 host 被中断后仍会继续或重启 gate，导致同一类重型文件系统操作叠加。

3. **测试清理不完整，异常退出后残留扩大系统压力**

   `packages/api/scripts/run-isolated-redis-tests.sh` 仍是弱 cleanup：只在 trap 里 `kill "$(cat "$PIDFILE")"`，没有 Redis registry、没有 `redis-cli shutdown nosave`、没有等待退出、没有 KILL fallback。父进程被 `SIGKILL`、host 崩溃或 terminal/session 被杀时，trap 不会运行，随机端口 Redis 会残留。PR #1891 已经补了 `process:doctor` / `process:cleanup` 来处理部分 stale dev processes，但测试 Redis orphan 的生命周期还没有同等级兜底。

macOS `fseventsd` 是结果放大器，不是我们 repo 里的普通 child process。我们的重型导出/扫描/清理不完整让它承受异常事件量；它一旦进入 bad state，会继续吃内存和 CPU，即使直接触发的 `pnpm gate` 已经被杀掉，也不一定自行恢复。

## 4. 已完成修复

PR #1891 已经完成：

- 修 Redis 冷启动路径：`dump.rdb` 存在但 `appendonlydir` 缺失时，先 RDB-first boot，再启 AOF，避免空库覆盖。
- 新增 `process:doctor` / `process:cleanup`，能识别一批 PPID=1 的 stale Cat Cafe dev 进程。
- `process:cleanup --run` 已支持 `SIGTERM -> wait -> SIGKILL`，比单发 TERM 更可靠。
- 修 LaunchAgent 的 PATH / cwd，降低 launchd 环境下 `redis-cli` / `node` 找不到导致的异常。
- embedding / IndexBuilder 方向补了观测和分页风险收敛。

PR #1897 已经完成：

- `docs/discussions/exported-threads/` 不再作为 thread autosave 默认输出目录。
- raw thread markdown dump 改到 `.cat-cafe/thread-exports/repo/`，并由 `.gitignore` 保护。
- `CatCafeScanner` 排除任意 `exported-threads` segment，避免原始聊天导出进入 docs / memory corpus。
- Redis 仍是 thread sidebar / thread selection 的 live source；markdown export 只做本地恢复/离线备份。

## 5. 仍需修复

这次事故链还没有完全根除。建议按以下顺序处理：

1. **把重型 sync dry-run 从普通 `pnpm check` 拆出去**

   `check:start-profile-isolation` 应保留轻量 profile / launch wrapper 断言；真实 `sync-to-opensource.sh --dry-run --yes` 应移到独立脚本，比如 `check:sync-export`，只在 outbound sync / release gate / 显式开源验证时运行。

2. **给 `pnpm gate` 加 singleflight lock 和 system-pressure preflight**

   同一个 worktree 同一时间只允许一个 gate。发现已有 active gate 时直接失败并输出 PID / worktree / startedAt。启动前检查 `fseventsd` RSS、随机端口 Redis orphan、陈旧测试进程；如果系统已经处于异常状态，gate 应拒绝继续制造文件事件。

3. **强化 isolated Redis 测试脚本**

   `run-isolated-redis-tests.sh` 应维护 registry，启动前清理上一轮随机端口测试 Redis；cleanup 优先 `redis-cli shutdown nosave`，等待退出，再 TERM，最后 KILL。必须硬保护 `6398` / `6399`。

4. **约束 agent 重启循环**

   agent/supervisor 如果要恢复 gate，必须识别已有 gate lock。不能因为 thread resume / host 重启而再次启动同一套 `pnpm gate`。

5. **macOS 现场恢复**

   当前 `fseventsd` 仍然异常。代码层修复不会自动释放它已经吃掉的内存。需要用管理员权限重启该系统进程或直接重启 Mac。没有 sudo 权限时，最稳妥的恢复动作是重启系统。

## 验证方式

本 report 的证据来自：

- Redis thread store 只读查询：`thread_mpltme5sq72yqava`，标题「内存泄漏 整改聊天记录备份导出目录」，2026-05-25 16:13 PDT 起有完整定位记录。
- 本地 Codex session 搜索：`019e62e9-6269-7981-8124-c35c6972512a` 显示同夜 `pnpm check` 进入 `check:start-profile-isolation`，并跑过 `sync-to-opensource.sh --dry-run --yes`。
- 当前进程快照：2026-05-26 07:04 PDT，`fseventsd` PID `326` RSS `36193072KB` / CPU `161.6%`；`Terminal.app` PID `35163` RSS `134656KB`。
- 当前 Redis 快照：随机端口 orphan Redis 数量为 `0`，只保留 `127.0.0.1:6398` 和 `127.0.0.1:6399`。
- 代码真相源：
  - `package.json` 的 `check` 仍包含 `check:start-profile-isolation`。
  - `scripts/start-dev-profile-isolation.test.mjs` 仍会在该测试组内调用 `sync-to-opensource.sh --dry-run --yes`。
  - `scripts/sync-to-opensource.sh` 仍包含临时导出树复制、多轮 `find` / recursive `grep` 扫描。
  - `packages/api/scripts/run-isolated-redis-tests.sh` 仍缺少 registry + shutdown/wait/KILL fallback。
