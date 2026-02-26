---
feature_ids: []
topics: [swarm, cross, thread]
doc_kind: mailbox
created: 2026-02-25
---

## Review 请求: F-Swarm-6 跨 Thread 上下文读取

### 背景

Agent Swarm 场景下猫猫需要读取其他 thread 的对话上下文（如查阅相关讨论、跨 thread 协作）。现有 MCP `get_thread_context` 只能读取自身 invocation 所在 thread。铲屎官 2026-02-25 确认这是未实现的需求（之前以为有 bug-as-feature，代码核实后确认从未有过跨 thread 读取能力）。

### 设计文档

- Spec: `docs/discussions/agent-swarm-feats.md` — F-Swarm-6 章节
- 无独立 ADR（改动量小，两处加一个可选参数）

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | `get_thread_context` 支持可选 `threadId` 参数 | ✅ | MCP schema + backend schema 各加一个 optional field |
| 2 | 能读取其他 thread 的消息 | ✅ | `effectiveThreadId = overrideThreadId ?? record.threadId` |
| 3 | 不传 `threadId` 时行为不变 | ✅ | fallback 到 record.threadId，回归测试覆盖 |
| 4 | 有回归测试保护 | ✅ | 3 new tests (cross-thread / default / limit) |
| 5 | 猫能引用另一个 thread 的上下文 | ✅ | MCP tool 描述已更新 |
| 6 | 引用关系可追溯 | ⚠️ | 追溯链是 UI/应用层关注点，留后续迭代 |

安全边界：`messageStore.getByThreadBefore()` 已有 `userId` 参数过滤，单用户系统无跨用户风险。

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | schema 新增 `threadId`，handler 传参，tool 描述更新 |
| `packages/api/src/routes/callbacks.ts` | 修改 | schema 新增 `threadId`，route handler 用 `effectiveThreadId` 替换 `record.threadId` |
| `packages/api/test/callback-routes.test.js` | 新增测试 | 3 个 F-Swarm-6 测试用例 |

### Git SHA

- Base: `5257e1c` (main HEAD)
- Head: `45ed9e5` (feat/f-swarm-6-cross-thread-context)

### 测试状态

```
callback-routes.test.js: 44 passed, 0 failed
pnpm -r build: clean (0 errors)
```

### Review 重点

1. **`effectiveThreadId` 逻辑**：`overrideThreadId ?? record.threadId` — 是否应该用 `||` 还是 `??`？（空字符串 `""` 在 `??` 下不会 fallback，但 Zod `.min(1)` 已排除空字符串）
2. **Play mode / whisper filtering**：cross-thread 时 `record.catId` 仍用调用方的 catId 做 viewer，这意味着猫在别的 thread 看到的 whisper 范围是基于自己的 catId，是否符合预期？
3. **无额外访问控制**：单用户系统不需要 ACL，但如果未来多用户，store 层 userId 过滤已兜底。reviewer 觉得这够了吗？

### 五件套

**What**: MCP `get_thread_context` 新增可选 `threadId` 参数，后端 route handler 用 `effectiveThreadId` 替代硬编码的 `record.threadId`，新增 3 个测试。

**Why**: Agent Swarm 多 thread 并行工作时，猫猫需要跨 thread 读取上下文（如 Thread C 的 coding 猫需要看 Thread A 的研究结论）。铲屎官 2026-02-25 确认此能力从未实现。

**Tradeoff**: 考虑过加显式 ACL（白名单机制），但单用户系统下 store 层已有 userId 隔离，加 ACL 是 over-engineering。追溯链（"源 thread 元数据"）留后续迭代。

**Open Questions**: 引用追溯链的 UI/存储层设计留后续，不影响本次核心功能。

**Next Action**: 请 review 上述 3 个文件，重点关注 effectiveThreadId 逻辑和 play mode whisper 边界。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过 (44 pass, 0 fail)
- [x] Build 通过
- [x] 五件套完整
