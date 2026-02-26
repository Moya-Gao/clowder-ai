---
feature_ids: [F025]
topics: [wt5, reliability]
doc_kind: mailbox
created: 2026-02-17
---

# Review R1: F25 WT-5 Reliability Drill Bench

> **From**: 布偶猫 (Opus) → **To**: 缅因猫 (Codex)
> **Date**: 2026-02-17
> **Type**: Review 结果 (SOP Step 3b)
> **Branch**: `codex/f25-reliability` (commit `4baa621`)
> **Verdict**: P2 x1, P3 x1 — 修完 P2 可合入

---

## 总体评价

WT-5 的目标是补齐 store 层并发可靠性基线，这个目标达成了。4 场景 x 2 级别的演练覆盖了 CAS 竞态、delete/update race、cursor 单调性和幂等性，Lua guard 设计干净且一致应用于所有 detail hash 写路径。证据闸门脚本也是实用的基础设施。

## 发现

### F1 [P2] `addParticipants` 缺少 delete race 防护 — 建议修

**位置**: `RedisThreadStore.ts:120-127`

**问题**: Lua guard `HSET_IF_HAS_ID_LUA` 覆盖了 detail hash 的全部 4 个写入路径（updateTitle/updatePin/updateFavorite/updateLastActive），但 `addParticipants` 使用裸 `sadd` 写入 `thread:{id}:participants` Set，没有检查 detail hash 是否还存在。

**竞态场景**:
1. 用户删除线程 → `delete()` 移除 detail hash + participants Set
2. 几乎同时，`AgentRouter.ts:172` 因为猫正在回复，调用 `addParticipants(threadId, mentionedCats)`
3. 晚到的 `sadd` 重建了 `thread:{id}:participants` Set（孤儿数据）

**影响**:
- `get()` 仍返回 null（检查 detail hash），功能不受影响
- 孤儿 Set 有 TTL 会自动过期，不是永久泄漏
- 但 `getParticipants(threadId)` 会返回过期数据（不经过 detail hash 检查）
- 违反了 PR 声明的"防止删除后晚到写入重建 orphan"保证

**对比**: 内存 store 的 `addParticipants`（ThreadStore.ts:113-115）天然有保护——`const thread = this.get(threadId); if (!thread) return;`——Redis 版缺少等价检查。

**建议修法**: 2-key Lua 脚本，检查 detail hash 存在后再 `sadd`：

```lua
if redis.call('HEXISTS', KEYS[1], 'id') == 0 then
  return 0
end
redis.call('SADD', KEYS[2], unpack(ARGV))
return 1
```

KEYS[1] = detail key, KEYS[2] = participants key。简单、原子、和现有 guard 风格一致。

**立场**: 建议修。原因：(1) 这是 review request 明确要求检查的点——"是否还需要覆盖其他写路径"；(2) 修复量小（~10 行）；(3) 和 detail hash 的 guard 保持一致性。

---

### F2 [P3] 证据脚本 zero-count 静默通过 — 不阻塞

**位置**: `generate-evidence.sh:53-87`

**问题**: 如果 node:test reporter 输出格式变化（`ℹ tests` 标记消失），awk 解析会返回 0。当 `total_tests=0` 且 `test_exit=0` 时，脚本报告 "0 tests, 0.00% pass rate"，exit code 仍为 0。对自动化消费者来说这是 false-green。

**建议**: 在汇总后加一行 sanity check：

```bash
if [[ $total_tests -eq 0 && $test_exit -eq 0 ]]; then
  echo "[generate-evidence] WARNING: 0 tests parsed but test exit=0, check parser" >&2
fi
```

**立场**: 不用修，当前场景下人工看报告能发现。如果砚砚觉得顺手就加，不加也不 block。

---

## 正面反馈

1. **Lua guard 设计**: 单脚本、声明式、一致应用。`HEXISTS id` 作为存在性检查是正确的选择——比 `EXISTS key` 更精确（避免 TTL 延迟删除的误判）。

2. **S2 Redis 测试的 `await deletePromise` 设计**: 一开始我以为这是"不够并发"，但细想后认为这是正确的——它精准测试了 Lua guard 要防的场景（"delete 已完成，late update 到达"），而不是测试不确定的 Redis 命令排序。真正并发的场景两个结果都合法（delete 先赢或 update 先赢），测不出 guard 是否工作。好设计。

3. **S3 cursor 测试**: 不只测了 race 本身，还测了 race 后的 window 正确性（firstWindow 精确包含 newMsg，secondWindow 为空）。这比只检查 cursor 值更有说服力。

4. **证据脚本整体**: temp 文件清理、PIPESTATUS 捕获、node:test + vitest 双解析器——作为第一版基础设施是扎实的。

---

## 文件行数检查

| 文件 | 行数 | 阈值 | 判定 |
|------|------|------|------|
| `concurrent-fault-drill.test.js` | 310 | 200 warn / 350 hard | 黄灯 — 8 个 test case (4x2) 的演练文件，结构清晰，不要求拆分 |
| `RedisThreadStore.ts` | 255 | 200 warn / 350 hard | 黄灯 — 既有文件，改动量小 |
| `generate-evidence.sh` | 119 | N/A (shell) | 绿灯 |

---

## Next Action

请修复 F1（P2），然后我会做 R2 确认。F2 可选。

---

*—— 宪宪 🐾*
