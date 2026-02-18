## Review 请求: RedisInvocationRecordStore 非 CAS 并发竞态修复

### 背景

缅因猫在 F23+F25 post-merge review 中发现 P1：`RedisInvocationRecordStore.update()` 的非 CAS 路径（无 `expectedStatus`）使用 `hget → validate → hset` 三步分离操作，并发时 stale read 可以绕过状态机约束，导致终态被非法回退（如 `succeeded → failed`）。

### 设计文档

- ADR: `docs/decisions/008-invocation-record-state-machine.md`
- 状态机 spec: `packages/api/src/domains/cats/services/stores/ports/invocation-state-machine.ts`
- 缅因猫 review 原文: 对话记录 `0001771366618580-000004`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 非 CAS 路径原子状态机守护 | ✅ | `ATOMIC_UPDATE_LUA` Lua 脚本内置转移表 |
| 2 | CAS 路径保持正常 | ✅ | 同一 Lua 脚本，ARGV[1] 非空时做 CAS check |
| 3 | 并发写不能回退终态 | ✅ | Lua 内 `transitions` table 禁止 `succeeded → *` |
| 4 | 不存在记录返回 null | ✅ | Lua 返回 -2 → TS 返回 null |
| 5 | 补并发回归测试 | ✅ | 2 条新测试 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/cats/services/stores/redis/RedisInvocationRecordStore.ts` | 修改 | 新增 `ATOMIC_UPDATE_LUA` 统一 Lua 脚本，替换 `CAS_UPDATE_LUA` + 非原子分支 |
| `packages/api/test/redis-invocation-record-store.test.js` | 修改 | 新增 2 条回归测试 |

### Git SHA

- Base: `d366ad5`
- Head: `12a3c82`

### 测试状态

```
pnpm test: 1327 passed, 0 failed (non-Redis)
pnpm test:redis: 1427 passed, 0 failed (全量含 Redis)
```

### Review 重点

1. **Lua 状态机表与 TS 状态机表一致性**：`ATOMIC_UPDATE_LUA` 里的 `transitions` table 必须和 `invocation-state-machine.ts` 的 `VALID_TRANSITIONS` 语义一致。目前是手动同步，请确认两边一致。
2. **ARGV 约定**：ARGV[1]=expectedStatus, ARGV[2]=newStatus, ARGV[3..N]=field/value pairs。空字符串表示"不提供"。请确认 Lua 逻辑对空字符串的处理正确。
3. **并发测试的确定性**：`concurrent non-CAS race` 测试同时发 `succeeded` 和 `failed`，由于 Redis 单线程，必定一个先到。请确认测试断言覆盖了两种赢家情况。

### 五件套

**What**: 统一 Redis invocation update 为单个 Lua 原子脚本（`ATOMIC_UPDATE_LUA`），内置状态机转移表，CAS 和非 CAS 路径共用。

**Why**: 修复砚砚发现的 P1 — 非 CAS 路径的 `hget → validate → hset` 有并发窗口，stale read 可绕过状态机约束。

**Tradeoff**: 状态机转移表现在有两份（Lua + TS）。考虑过用代码生成保持同步，但转移表小且稳定（5 个状态），手动同步 + 注释互指更简单。

**Open Questions**: 无。

**Next Action**: 请 review 上述 2 个文件。
