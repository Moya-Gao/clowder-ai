## Review 请求: #77 Pending-mentions Ack 机制

### 背景

`get_pending_mentions` 是纯快照查询，无 ack 机制。自动 compact 或 F24 session seal 后，新 session 会重新看到所有旧 mentions 并重复执行已完成的工作。本 PR 实现显式 ack cursor，让猫猫处理完 mentions 后标记进度。

### 设计文档

- Bug Report (v3.3, R7 passed): `docs/bug-report/2026-02-16-pending-mentions-no-ack/bug-report.md`
- BACKLOG: `docs/BACKLOG.md` #77

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 显式 ack (R1 P1-1): read ≠ processed | ✅ | 独立 `ack-mentions` endpoint，不自动 ack |
| 2 | 专用命名空间 (R2 P1-1): mention-ack 与 delivery-cursor 分离 | ✅ | `SessionKeys.mentionAck` + `mentionAckCursors` Map |
| 3 | messageId 作为 cursor (R1 design) | ✅ | 利用 sortable ID 的字典序做 `>` 比较 |
| 4 | 升序返回 (R4 P1): oldest N after cursor | ✅ | in-memory 正向遍历 + Redis `zrange` |
| 5 | Cursor fallback (R2 P2): stale cursor 容错 | ✅ | Redis `zrank` 检查 + warn + 降级全扫 |
| 6 | 4-way validation: existence/ownership/monotonic/window | ✅ | callbacks.ts ack-mentions endpoint |
| 7 | Window 无状态重算 (R5/R6 P1) | ✅ | 每次 ack 时重新查询 pending window |
| 8 | Redis primary + in-memory fallback | ✅ | DeliveryCursorStore 双层 |
| 9 | MCP tool 注册 | ✅ | callback-tools.ts + tools/index.ts + index.ts server.tool() |
| 10 | 向后兼容: 无 cursor 时返回全部 | ✅ | afterMessageId undefined → 跳过过滤 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/utils/redis.ts` | 修改 | SessionKeys.mentionAck + 3 个 SessionStore 方法 |
| `packages/api/src/domains/cats/services/DeliveryCursorStore.ts` | 修改 | mentionAckCursors Map + get/ack/delete 方法 |
| `packages/api/src/domains/cats/services/MessageStore.ts` | 修改 | IMessageStore + MessageStore: afterMessageId 参数 + 升序遍历 |
| `packages/api/src/domains/cats/services/RedisMessageStore.ts` | 修改 | afterMessageId + zrank fallback + zrange 升序 |
| `packages/api/src/routes/callbacks.ts` | 修改 | pending-mentions 接入 cursor + POST ack-mentions (4-way validation) |
| `packages/api/src/index.ts` | 修改 | deliveryCursorStore 传入 callbacksRoutes |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | ackMentionsInputSchema + handleAckMentions + callbackTools entry |
| `packages/mcp-server/src/tools/index.ts` | 修改 | re-export ackMentionsInputSchema + handleAckMentions |
| `packages/mcp-server/src/index.ts` | 修改 | server.tool('cat_cafe_ack_mentions') 注册 |
| `packages/api/test/mention-ack.test.js` | 新增 | 11 个回归测试 |

### Git SHA

- Base: `156d923` (main HEAD)
- Head: `3b3d1e0`
- Branch: `fix/mention-ack-mechanism`
- Worktree: `.worktrees/mention-ack`

### 测试状态

```
mention-ack.test.js: 11 passed, 0 failed
Full suite: 301 passed / 109 failed (baseline 300/109, +1 from new test file)
Redis tests: not run (in-memory only; Redis behavior tested via mock patterns)
```

### Review 重点

1. **4-way validation 逻辑** (`callbacks.ts:160-227`): existence → ownership → monotonic → window，是否有遗漏场景？
2. **升序遍历改动** (`MessageStore.ts:148-163`, `RedisMessageStore.ts` getMentionsFor): 从 descending 改为 ascending，是否影响其他调用者？
3. **DeliveryCursorStore 双层一致性** (`DeliveryCursorStore.ts`): Redis primary + in-memory fallback，cursor 更新顺序和错误处理是否正确？
4. **Redis cursor fallback** (`RedisMessageStore.ts`): zrank 检测 stale cursor 后降级全扫，性能影响是否可接受？

### 五件套

**What**: 为 `get_pending_mentions` 添加显式 ack 机制。新增 `POST /api/callbacks/ack-mentions` endpoint + `cat_cafe_ack_mentions` MCP tool。猫猫处理完 mentions 后调用 ack，下次 session 只看到新的。

**Why**: 无 ack 机制导致 auto-compact/session seal 后新 session 重复处理旧 mentions，浪费 token 且可能产生重复操作。这是 #77 bug report 的修复。

**Tradeoff**:
- 放弃了 auto-ack（read=processed）方案 — crash recovery 时会丢 mentions
- 放弃了 timestamp 做 cursor — messageId 的字典序更精确，同 ms 内有序
- Window validation 选择无状态重算而非 Redis 端原子操作 — 简单可审计，代价是多一次查询

**Open Questions**:
- RedisMessageStore.ts 已达 505 行（pre-existing），后续需要拆分
- Redis 端 cursor fallback 在高并发下可能有少量重复（可接受）

**Next Action**: 请 review 上述 10 个文件，重点关注 4-way validation 和升序改动的影响

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成 (10/10 通过)
- [x] 设计文档已附 (bug-report v3.3)
- [x] 测试通过 (11/11 + 0 regression)
- [x] 五件套完整
