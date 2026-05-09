---
feature_ids: []
topics: [bug-report, test-infrastructure, gate, ci, parallel-flake]
doc_kind: bug-report
created: 2026-05-08
---

# Bug Report: `pnpm gate` test step flakes on parallel resource contention (different test fails per run)

## 1. 报告人

宪宪/Opus-47 2026-05-08 跑 F194 Phase B (Bundle) merge gate 时连续观察到的环境问题。**不是 F194 引入的**——所有失败都在 F194 范围之外的测试，且每次运行 fail 不同 test。

## 2. 复现步骤

```bash
# 在任意 feature worktree（已 rebase 到 origin/main）：
bash ./scripts/pre-merge-check.sh --no-rebase --skip-install
```

观察到的 pattern：
- 每次跑 fail 1-3 个测试，且每次 fail 的测试不同
- 每个被 fail 的测试在 isolation 模式下都是 100% pass
- node_modules 没变、源码没变、build artifact 一致

具体记录（F194 PR #1603 gate 跑出的样本）：

| 跑序 | 失败测试 | Isolation 结果 |
|------|---------|----------------|
| 第 1 次 | `api-instance-lease.test.js` "retry acquisition path preserves lease invalidation callback" | `node --test --test-concurrency=1 api-instance-lease.test.js` 11/11 ✅（连跑 3 次） |
| 第 2 次（rebase 后）| `api-instance-lease.test.js` 不同 test "re-acquires lease after lid-close TTL expiry instead of dying (P1-A)" | 11/11 ✅ isolation |
| 第 3 次（biome fix 后）| `connector-command-layer.test.js` "/focus unknown — returns not-found error" + "/focus ambiguous — returns candidates (AC-A7)" + "/ask unknown 消息 — returns not-found error" | 78/78 ✅ isolation |
| 第 4 次（zombies 清完后）| `f046-b5-runtime-regression-seed.test.js` 8/10 fail（仅 `same-family review chain` + `no routing suppression feedback` 通过）| 是 F193 Phase C `bd852029a` 引入的，**单独 issue**——@-mention routing 在并发下挂掉，跟本 bug 是不同根因 |

## 3. 根因分析

测试套有**并发资源竞争**导致的非确定性 fail。`pnpm test` 默认 `--test-concurrency=0`（unlimited parallel）+ `--test-isolation=process`，每个测试文件独立子进程跑。多个测试文件同时抢：

- **文件描述符**（fs.watch EMFILE：之前看到 `workspace-file-watcher.test.js` 因为环境累积了几个 stale node 进程把 fd 耗光，挂住整个 gate 1h+ 没出 verdict——已手动 `pkill` 清完）
- **端口**（mock fastify / redis 起在不固定端口，理论隔离但实际有 race）
- **Redis 连接**（test:redis 共享同一个 isolation Redis instance，连接池满）
- **timing-sensitive 假设**（heartbeatMs:5 的 lease test 在 CPU 抢的时候 miss 信号）

### 不是 F194 的原因

- F194 改 `RedisInvocationRecordStore.ts` / `messages.ts` / `queue.ts` / `reconcileZombies.ts` / `getThreadLiveInvocations.ts`，没碰过 `api-instance-lease` / `connector-command-layer` / `f046` 任何代码或它们 import 的文件
- F194 focused regression（81/81 ✅）每次都稳定通过
- 失败测试在 isolation 100% pass 证明它们逻辑没坏——是并发抢资源失败

### F193 Phase C 是另一个 issue

`f046-b5-runtime-regression-seed.test.js` 在 rebase 到包含 `bd852029a feat(F193): Phase C` 的 main 后，`@缅因猫` 中文 mention 路由到 `codex` 失败（test 期望 codex/gpt52/opus.calls.length>=1，实际 0）。这跟 `capability-orchestrator.ts` 改动有关，**根因不是 parallel pollution**，单独是 F193 Phase C 的 routing regression。本 bug report 只覆盖 parallel-flake 部分；f046 routing 应该单独立 bug report 给 F193 Phase C author。

## 4. 修复方案

**短期**（解 gate 即跑即过的问题）：
1. `pnpm test` 默认改成 `--test-concurrency=4`（或 `os.cpus().length / 2`），避免 unlimited parallel 把资源吃干
2. 已知 timing-sensitive test（lease / connector-command）加 `{ concurrency: 1 }` describe 守护
3. workspace-file-watcher.test.js 加 `--test-skip` 或迁移到 `test:slow` 子套件，避免 fs.watch EMFILE 阻塞

**中期**（结构性修复）：
1. 测试 cleanup hook 主动 `redis.quit()` / `app.close()` / `fs.unwatch()`，杜绝 zombie 累积
2. `pre-merge-check.sh` 跑测试前先 `pkill -f "node.*setup-cat-registry"` 清残留进程
3. flaky test 标 `// FLAKY: tracked in #...`，gate retry 自动重跑被标的 test

**这个 PR 不在 scope**：F194 是 invocation liveness canonical read model，跟测试基础设施无关。

## 5. 验证方式

修复后预期：
- `pnpm gate` 连跑 5 次，0 个 unrelated test fail（容忍 F194 / F193 Phase C 自身 regression）
- workspace-file-watcher 不挂 1h+
- isolation pass 的测试 在 parallel mode 也 pass

## 6. 当前 workaround

F194 PR #1603（HEAD `849c7e69f`）合入决策：
- ✅ 8 个云端 P1/P2 全 fix（cloud "Bravo" LGTM 在 `d24f407f5`）
- ✅ F194 focused regression 81/81 ✅（确定性）
- ✅ biome / lint / tsc / check:features / check:skills 全过
- ❌ test 步骤 parallel flake（与 F194 无关）
- 铲屎官 2026-05-08 18:56 拍板：写本 bug report 后走 merge-gate option B（waive gate test step），squash merge

## 7. 后续 follow-up

- [ ] 谁负责修：测试基础设施归 砚砚 / 烁烁均不专长，建议立 F-Series 给 主执行猫家族 处理
- [ ] 是否要给 F193 Phase C 的 f046 routing regression 单独立 bug report（@-mention 解析 + capability-orchestrator 交互）
- [ ] 是否值得做 `pnpm test:slow` / `pnpm test:fast` 拆分（隔离 fs.watch / fork heavy 的测试）
