---
feature_ids: [F025]
topics: [wt5, reliability, handoff]
doc_kind: mailbox
created: 2026-02-17
---

# WT-5 工作交接：F25 可靠性（并发演练 + 证据闸门）

**From**: 布偶猫 (宪宪)
**To**: 缅因猫 (砚砚)
**Date**: 2026-02-17
**Type**: 工作交接

---

## What

F23+F25 计划的最后一个 WT。两个产出：

### Component 1: 并发故障演练台

新建 `test/concurrent-fault-drill.test.js`，用 `Promise.all` 交叉验证 CAS 和并发保证。

**必须覆盖的 4 个场景**：

1. **CAS 竞争**：两个并发 `updateStatus()` 同一 InvocationRecord（一个 queued→running，一个 queued→canceled）→ 只有一个赢，另一个返回 null
2. **Update vs Delete 竞争**：update 和 delete 同时操作同一条记录 → 不产生孤儿数据（删了就是删了，不会被 update 复活）
3. **Delivery cursor ack vs 新消息追加竞争**：`ackCursor()` 和 `appendMessage()` 同时操作 → cursor 不跳过消息、不重复消费
4. **幂等性键竞争**：两个请求用同一个 idempotencyKey 同时 `create()` → 只有一个成功创建

**两级测试**：
- **内存 store 级**：用 `Promise.all` + 内存 store 直接测，快速、确定性强
- **Redis 级**：用 `pnpm test:redis` 隔离环境（端口 6398，DB /15），测真实 Redis 的原子性

### Component 2: 证据闸门脚本

新建 `scripts/generate-evidence.sh`：
- 流程：`pnpm build` → `pnpm test`（解析输出）→ 生成 markdown 表格
- 输出：测试总数、通过数、失败数、通过率
- 用途：PR body 附带证据包（手动粘贴，不是 CI 自动阻塞）

---

## Why

WT-2 写了 `invocation-state-machine.ts` 的状态转移规格 + fast-check property tests，但那只验证了**状态转移逻辑本身的正确性**（纯函数级别）。

我们还缺少对**并发场景下 store 层行为**的验证：
- CAS Lua 脚本在并发下是否真的只让一个赢？
- 内存 store 的 `snapshotStatus` 机制在 `Promise.all` 交叉下是否可靠？
- delivery cursor 和消息追加的竞争是否有序？

这些是 ADR-008 的核心可靠性承诺，重构（WT-3）后更应该跑一遍确认没破坏。

证据闸门脚本则是给每个 PR 提供标准化的测试证据格式，省得每次手动跑 + 手动数测试结果。

---

## Tradeoff

- **为什么不用 fault injection 框架（如 chaos monkey）**：项目规模不需要，`Promise.all` 交叉已经能暴露绝大多数并发 bug。过度工程。
- **为什么内存 store 和 Redis 都要测**：内存 store 测逻辑正确性（快、确定性），Redis 测原子性保证（真实环境）。只测一级不够。
- **证据闸门为什么不做 CI 自动阻塞**：项目没有 CI runner，脚本输出人工粘贴到 PR body 即可。
- **numRuns 建议 50-100**：不是 fast-check 的 property test（那个在 WT-2 已经 500 runs），这里是具体场景的并发测试，跑太多次意义不大。

---

## Open Questions

1. **DeliveryCursorStore 并发测试**：当前 `DeliveryCursorStore` 接口的 `ackCursor` 和 `MessageStore.appendMessage` 分属两个 store。并发测试可能需要同时操作两个 store 实例——你觉得怎么组合比较好？直接在测试里 new 两个 store 分别操作？
2. **Redis 级测试的 setup/teardown**：`test:redis` 脚本会自动起临时 Redis。并发测试可能需要预填数据（先 create 一条 InvocationRecord 再并发 update）。确认你那边 `test:redis` 的 beforeEach 机制够用？
3. **generate-evidence.sh 的输出格式**：我想的是简单 markdown 表格。你觉得需要加什么额外信息吗？比如 git SHA、分支名、timestamp？

---

## Next Action

### 砚砚要做的

1. **开 worktree**：
   ```bash
   git worktree add ../cat-cafe-f25-reliability -b feat/f25-reliability feat/f23-integration
   cd ../cat-cafe-f25-reliability && pnpm install
   ```
   注意 base 是 `feat/f23-integration`（WT-3 的重构已在里面）

2. **实现 Component 1**：`test/concurrent-fault-drill.test.js`
   - 4 个并发场景（上面列的）
   - 内存 store 级 + Redis 级
   - 重构后的 import 路径：
     - `InvocationRecordStore` → `../dist/domains/cats/services/stores/ports/InvocationRecordStore.js`
     - `RedisInvocationRecordStore` → `../dist/domains/cats/services/stores/redis/RedisInvocationRecordStore.js`
     - `MessageStore` → `../dist/domains/cats/services/stores/ports/MessageStore.js`
     - `DeliveryCursorStore` → `../dist/domains/cats/services/stores/ports/DeliveryCursorStore.js`
     - `invocation-state-machine` → `../dist/domains/cats/services/stores/ports/invocation-state-machine.js`

3. **实现 Component 2**：`scripts/generate-evidence.sh`

4. **验证**：`pnpm build` + `pnpm test` 全绿

5. **走 SOP**：自检 → 写 review 信给我 → review 循环 → PR 到 `feat/f23-integration`

### 布偶猫同时做的

WT-4 docs 归档 + 兼容层清理（独立工作，不互相依赖）

---

## 参考文件

| 文件 | 用途 |
|------|------|
| `~/.claude/plans/purrfect-sparking-river.md` | F23+F25 完整计划 |
| `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md` | ADR-008，CAS 和状态机规格 |
| `packages/api/src/domains/cats/services/stores/ports/invocation-state-machine.ts` | WT-2 产出，状态转移表 |
| `packages/api/test/invocation-state-machine.test.js` | WT-2 fast-check tests |
| `packages/api/test/invocation-flow.test.js` | 现有 invocation 流程测试（可参考 setup） |
| `scripts/test-redis.sh` | Redis 测试隔离脚本 |

---

**交接五件套自检**:
- [x] What: 两个 Component 的具体产出和场景
- [x] Why: WT-2 状态机是纯函数验证，缺少 store 层并发验证 + 需要标准化证据格式
- [x] Tradeoff: 不用 chaos monkey / 两级测试原因 / 非 CI 自动阻塞
- [x] Open Questions: DeliveryCursorStore 组合方式 / Redis setup / 输出格式
- [x] Next Action: 开 worktree → 实现 → SOP 流程

[布偶猫🐾]
