---
topic: LL-055 busy-loop deadline
to: codex
from: opus-47
date: 2026-05-08
status: draft
---

# Review Request: LL-055 — process-liveness-probe child carries self-deadline

Review-Target-ID: ll-055
Branch: feat/ll-055-busy-loop-deadline

## What

两个改动 + 一段顺手清理：

1. `packages/api/test/process-liveness-probe.test.js#L140-L155`：把 `node -e 'while(true){}'` 改成 `node -e 'const end=Date.now()+10000;while(Date.now()<end){}'`。child 自带 10s 自杀 deadline。
2. `docs/lessons-learned.md`：新增 LL-055，沉淀根因 + 防护 + 排查 SOP。
3. `chore` commit：`biome --write` 清掉 12 个 baseline format errors（来自我自己 merge 的 #1599 + #1605），让 `pnpm gate` 能跑通。纯格式调整，213 个相关测试仍全绿。

## Why

今天铲屎官 `pnpm dev:direct` 报 "API Server 启动超时（端口 3002, 20s 内未监听）"。诊断发现 4 只 PPID=1 孤儿进程 `node -e while(true){}` 跑了 6h–19h，加起来 ~270% CPU，把 tsx 启动 + tsc 编译压垮，3002 在 20s 窗口内 listen 不上。

孤儿源头追到 `process-liveness-probe.test.js`——这个测试 spawn 一个 idle parent + busy child 来验证 probe 的 busy-silent 状态。设计是"parent 收 SIGTERM 后 handler 链式 kill child"。但 macOS 没 `PR_SET_PDEATHSIG`，parent 异常死亡（runner timeout / Ctrl+C / `pnpm gate` 中断）就会留下 child 孤儿继续烧 CPU。

铲屎官明确同意修复路径：在主仓改 + 走 SOP 合入 main，下次 runtime worktree pull 自动同步（`feedback_no_touch_runtime` 教训）。

## Original Requirements

> 铲屎官原话（2026-05-08 13:42）：
> "我发现现在会出现很奇葩的事情 我们runtime启动可能会启动着启动着 ...：line 598: 66750 Terminated: 15 ... [tsx] Previous process hasn't exited yet. Force killing... API Server 启动超时（端口 3002, 20s 内未监听）"
>
> "我能看到 busy-loop 到底从哪里泄漏出来的咩？" → grep 锁定 process-liveness-probe.test.js
>
> "好像 可以在main上改合入main 下次启动的时候runtime就同步了呀？... 这个才能全猫感知" → 在主仓修 + 写 LL-055 全猫共享

- 来源：本对话 thread（无独立 discussion 文档）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

子进程不依赖 parent 中转的两条路：

| 方案 | 优点 | 缺点 | 选择 |
|---|---|---|---|
| **A. child 自带 deadline**（本 PR） | 一行字面量改动；零结构调整；macOS/Linux 通用 | child 一定时间内必死，长测试场景需调长 | ✅ 选这条 |
| B. parent 把 child PID 写到 stdout，测试 finally 独立 SIGKILL | child 可无限活到测试结束；更精确 | 需要 stdio: 'pipe'、`readline` parse、增加测试代码复杂度 | ❌ |

10s 是测试实际需要时间（probe sample 间隔 100ms × 几个 sample ≈ 1–2s 即可进入 busy-silent；CI 慢机器 3–5x 也只到 ~7s）的 5x 安全冗余。

## Architecture Ownership

Architecture cell: 无对应 cell（test infrastructure 改动 + lessons-learned 文档）
Map delta: none
Why: 测试设计修复属于 test infra 范畴；LL-055 落 `docs/lessons-learned.md`，纯文档新增不动 ownership map。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致 ✅（无新建 Store/Queue/Router/Adapter/Dispatcher/Binding）
- 是否新建了并行抽象 ❌（无）
- 是否修改 ownership map ❌（无）

## Open Questions

### 技术 OQ

1. **10s deadline 是否合适**？对 macOS Apple Silicon 本地、CI（GitHub Actions、Linux Runner 慢机器）、`--test-concurrency` 并发场景都够用吗？太短可能导致测试 flaky（child 在 probe 完成前死了），太长则泄漏一只就要等 10s 才退。建议 reviewer 帮忙 sanity check 数值。
2. **是否需要 follow-up CI lint**？LL-055 防护清单第 3 条说"扫 `**/*.test.{js,ts}` 中 `spawn(... while(true)` 模式，缺 deadline 直接 fail"——这次没落 CI lint（scope 控制），但建议作为 follow-up。reviewer 觉得有必要可以建 TD。
3. **biome cleanup 11 文件改动是否过大**？纯格式（净减 25 行多行折单行），213 测试全绿，但跨包改动；reviewer 可以选择性抽查 `capability-orchestrator.ts`、`callback-tools.ts` 这种逻辑文件确认无 functional 变化。

### 价值 OQ

无——这是 P1 bug 修复 + 防护型 LL，无价值取舍。

## Next Action

请 @codex review 并放行（或 push back）。目标：通过后走 merge-gate（已含完整 `pnpm gate` 跑通信号）。

## 自检证据

### Spec 合规

- 改动范围：仅 `process-liveness-probe.test.js` + `docs/lessons-learned.md` + biome auto-fix
- 无 spec 文档改动（feature index 不动）
- LL-055 遵循 7 槽位模板（坑/根因/触发条件/修复/防护/来源锚点/原理）

### 测试结果

```
node --test test/process-liveness-probe.test.js
→ 14/14 pass (4.77s)

node --test test/{process-liveness,capability-orchestrator,hydrate-cross-thread-reply-hint,system-prompt-builder,callback-cross-post-fail-closed}.test.js
→ 213/213 pass (5.80s)

pnpm biome check . --diagnostic-level=error
→ Checked 2836 files. 0 errors.

pnpm gate
→ 跑完后会在 PR comment 附完整 SHA + 状态（背景任务进行中，merge-gate 之前会确认）
```

### 反向自检（如果判断错了我最可能错在哪）

- **deadline 数值**：10s 可能在某些 CI 环境太短或太长——如果 reviewer 实测过 flaky，请改数值
- **biome cleanup scope**：纯顺手清理但跨 11 文件，可能 reviewer 觉得应该单独 PR——可以接受拆 PR 重做
- **LL-055 措辞**：原理段强调 "macOS 进程孤立化默认 detach 不死链"——如果 reviewer 觉得 Linux 也存在等价场景（PR_SET_PDEATHSIG 不 default-on），可以泛化

### 相关文档

- LL: `docs/lessons-learned.md` LL-055
- Test: `packages/api/test/process-liveness-probe.test.js#L133-L169`
- 没有 plan / ADR / feature（发现性 bug，无立项需要）
