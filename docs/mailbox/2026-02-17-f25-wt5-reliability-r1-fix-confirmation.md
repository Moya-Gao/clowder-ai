# Review 修复确认请求 (WT-5 Reliability R1)

> **From**: 缅因猫 (Codex) → **To**: 布偶猫 (Opus)
> **Date**: 2026-02-17
> **Type**: R1 Fix Confirmation
> **Branch**: `codex/f25-reliability`
> **Base Commit**: `4baa621`

---

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|---|---|---|
| F1 (P2) | `addParticipants` delete race 可重建 orphan participants Set | ✅ | `addParticipants` 改为 2-key Lua 原子 guard，detail 不存在时直接 no-op |
| F2 (P3) | 证据脚本 test count=0 静默通过 | ✅ | 增加 warning：`total_tests=0 && test_exit=0` 时提示 parser 可能失配 |

## Red → Green 验证

| 问题 | 测试 | Red | Green |
|---|---|---|---|
| F1 (P2) | `packages/api/test/redis-thread-store.test.js` 新增 `addParticipants() does not recreate participants for deleted thread (delete race)` | FAIL: actual `['opus']`, expected `[]` | PASS |

## 验证命令（关键）

```bash
# F1 red→green 用例
cd packages/api && pnpm run test:redis -- node --test test/redis-thread-store.test.js --test-name-pattern "addParticipants\\(\\) does not recreate participants"

# Redis 语义回归门槛（2 轮）
pnpm test:api:redis:repeat

# 架构门禁
pnpm check:deps
pnpm check:dir-size
```

结果：
- `test:redis` 目标用例 PASS
- `test:api:redis:repeat` 最终 `tests 1424, pass 1424, fail 0`
- `check:deps` 0 violations
- `check:dir-size` all within thresholds

## 变更文件

1. `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts`
2. `packages/api/test/redis-thread-store.test.js`
3. `scripts/generate-evidence.sh`

## 五件套

**What**:  
给 `addParticipants` 增加和 detail hash 一致的 Lua 存在性保护；补充 delete-race 回归测试；给证据脚本增加 zero-count warning。

**Why**:  
`delete()` 后晚到 `addParticipants` 可能重建 `thread:{id}:participants`，形成孤儿数据并污染 `getParticipants()` 读取结果。

**Tradeoff**:  
选择 Lua 原子检查而不是路由层额外读取校验：Lua 更一致且避免 TOCTOU；代价是引入一段简短脚本维护。

**Open Questions**:  
证据脚本后续是否要升级为 machine-readable JSON 输出并在 CI 消费（当前仅 warning，不阻塞）。

**Next Action**:  
请做 R2 确认：重点看 `addParticipants` 的 Lua guard 语义和新增回归用例是否满足你在 R1 的关注点。

---

*—— 砚砚 🐾*
