# Review 请求: F24 Session Chain + Context Health — Phase A

> 日期: 2026-02-13
> 作者: 布偶猫/宪宪
> Reviewer: 缅因猫/砚砚

---

## 背景

F24 为 Cat Cafe 引入 Session Chain 机制——每只猫在每个 Thread 中不再只有一个 session，而是一条 session 链。Phase A 实现地基：SessionRecord 数据模型、内存+Redis 双存储、context health 提取、API 路由、前端进度条。

这是后续 Phase B~E（自动 seal、transcript 落盘、MCP 工具、Session 2 Bootstrap）的基础。

## 设计文档

- Plan: `docs/plans/2026-02-13-f24-session-chain.md` (Section 4: Phase A)
- 关联 BACKLOG: F24
- 研究基础: `docs/research/2026-02-13-f24-gpt-pro-research-result.md`

## Spec Compliance 自检

| # | Spec 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| 1 | `SessionRecord` + `ContextHealth` 共享类型 | ✅ | `packages/shared/src/types/session.ts` | TypeScript 编译检查 |
| 2 | `ISessionChainStore` 接口 | ✅ | `SessionChainStore.ts:L1-34` | — |
| 3 | 内存实现 (SessionChainStore) | ✅ | `SessionChainStore.ts:L36-170` | 22 tests (`session-chain-store.test.js`) |
| 4 | Redis 实现 (RedisSessionChainStore) | ✅ | `RedisSessionChainStore.ts` (268 lines) | 20 tests (`redis-session-chain-store.test.js`) |
| 5 | 工厂函数 | ✅ | `SessionChainStoreFactory.ts` | 3 tests (`session-chain-store-factory.test.js`) |
| 6 | Redis Key 设计 (session-chain-keys) | ✅ | `session-chain-keys.ts` | 通过 Redis store 测试间接覆盖 |
| 7 | Context Window fallback 映射表 | ✅ | `context-window-sizes.ts` | 7 tests (`context-window-sizes.test.js`) |
| 8 | Claude `contextWindowSize` 提取 | ✅ | `ClaudeAgentService.ts:+12 lines` | 通过 invoke-single-cat 测试间接覆盖 |
| 9 | `invoke-single-cat` session_init 处理 | ✅ | `invoke-single-cat.ts:+~35 lines` | 6 F24 tests (`invoke-single-cat.test.js`) |
| 10 | `invoke-single-cat` context_health 计算 + emit | ✅ | `invoke-single-cat.ts:+~30 lines` | 4 tests (exact/fallback/unknown/persist) |
| 11 | API 路由 (GET sessions) | ✅ | `routes/session-chain.ts` (49 lines) | 6 tests (`session-chain-route.test.js`) |
| 12 | 前端 ContextHealthBar | ✅ | `ContextHealthBar.tsx` (89 lines) | TypeScript 编译检查 |
| 13 | 前端 socket context_health 事件 | ✅ | `useAgentMessages.ts:+6 lines` | — |
| 14 | `TokenUsage.contextWindowSize` 字段 | ✅ | `types.ts:+1 line` | — |
| 15 | index.ts 创建 + 注入 SessionChainStore | ✅ | `index.ts:+9 lines` | — |

### 偏离说明

| # | Spec 要求 | 实际实现 | 原因 |
|---|-----------|----------|------|
| 1 | `SessionManager` 接受 SessionChainStore 委托查询 | 直接在 `invoke-single-cat` deps 中注入 sessionChainStore | SessionManager 当前只管 CLI session 的 context history，不是 SessionRecord 的 owner。把 SessionRecord 逻辑放在 invoke 层更直接，避免 SessionManager 膨胀。Phase B seal 逻辑可能需要重新评估。 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/session.ts` | 新增 | SessionRecord, ContextHealth, SessionStatus 类型 |
| `packages/shared/src/types/index.ts` | 修改 | 导出 session.ts |
| `packages/api/src/domains/cats/services/SessionChainStore.ts` | 新增 | ISessionChainStore 接口 + 内存实现 (169 lines) |
| `packages/api/src/domains/cats/services/RedisSessionChainStore.ts` | 新增 | Redis 实现 + Lua 原子创建 (268 lines) |
| `packages/api/src/domains/cats/services/SessionChainStoreFactory.ts` | 新增 | 工厂函数 (19 lines) |
| `packages/api/src/domains/cats/services/session-chain-keys.ts` | 新增 | Redis key 模式 (18 lines) |
| `packages/api/src/config/context-window-sizes.ts` | 新增 | Model→window 硬编码映射 (34 lines) |
| `packages/api/src/routes/session-chain.ts` | 新增 | GET /threads/:id/sessions + GET /sessions/:id (49 lines) |
| `packages/web/src/components/ContextHealthBar.tsx` | 新增 | 前端进度条组件 (89 lines) |
| `packages/api/src/domains/cats/services/types.ts` | 修改 | TokenUsage +contextWindowSize |
| `packages/api/src/domains/cats/services/ClaudeAgentService.ts` | 修改 | extractClaudeUsage() 提取 contextWindow |
| `packages/api/src/domains/cats/services/invoke-single-cat.ts` | 修改 | session_init + context_health 处理 (+65 lines) |
| `packages/api/src/domains/cats/services/AgentRouter.ts` | 修改 | 构造函数接受 sessionChainStore (+6 lines) |
| `packages/api/src/domains/cats/services/index.ts` | 修改 | 导出新模块 |
| `packages/api/src/index.ts` | 修改 | 创建 SessionChainStore + 注入 |
| `packages/api/src/routes/index.ts` | 修改 | 导出 sessionChainRoutes |
| `packages/web/src/components/CatTokenUsage.tsx` | 修改 | 挂载 ContextHealthBar |
| `packages/web/src/components/RightStatusPanel.tsx` | 修改 | 传递 contextHealth 数据 |
| `packages/web/src/hooks/useAgentMessages.ts` | 修改 | 处理 context_health 事件 |
| `packages/web/src/stores/chat-types.ts` | 修改 | 新增 contextHealth 状态类型 |

### 测试文件

| 文件 | 测试数 | 说明 |
|------|--------|------|
| `test/session-chain-store.test.js` | 22 | 内存 store 完整覆盖 |
| `test/redis-session-chain-store.test.js` | 20 | Redis store (需 REDIS_URL) |
| `test/session-chain-store-factory.test.js` | 3 | 工厂函数 |
| `test/session-chain-route.test.js` | 6 | API 路由 |
| `test/context-window-sizes.test.js` | 7 | Fallback 映射表 |
| `test/invoke-single-cat.test.js` | +6 | F24 集成测试 (追加到现有文件) |
| **合计** | **64** | — |

## Git SHA

- Base: `5e1ef78` (main HEAD)
- Head: `c5353f3` (feat/f24-session-chain HEAD)

### Commits

1. `52a3024` — `feat(api,web): F24 Session Chain + Context Health — Phase A implementation`
2. `a2e62a5` — `test(api): F24 Session Chain + Context Health — 48 tests [布偶猫🐾]`
3. `c5353f3` — `fix(api): RedisSessionChainStore scanKeys prefix handling [布偶猫🐾]`

## 测试状态

```
pnpm test: 1035 passed, 0 failed
pnpm test:redis: 全部通过 (含 20 F24 Redis tests)
pnpm -r build: 3/3 packages clean
```

## Review 重点

1. **RedisSessionChainStore Lua 原子创建脚本** — `CREATE_LUA` 是否正确处理了 seq 递增和多 key 原子性？
2. **scanKeys keyPrefix 处理** — commit `c5353f3` 修的 ioredis 老坑，前缀拼接和剥离逻辑是否稳妥？
3. **invoke-single-cat context_health 逻辑** — fillRatio 计算、fallback 映射表查找、SessionRecord 更新时机是否合理？
4. **ContextHealthBar.tsx 前端组件** — 颜色阈值 (0-50% 绿/50-70% 黄/70-85% 橙/85%+ 红) 和交互是否合适？
5. **spec 偏离**: SessionChainStore 注入在 invoke-single-cat deps 而非 SessionManager — 你觉得这个 tradeoff 合理吗？

## 五件套

**What**: F24 Phase A — SessionRecord 数据模型 + ISessionChainStore (内存+Redis) + context health 提取 + API 路由 + 前端 ContextHealthBar。26 个文件，+1762 行，64 新测试。

**Why**: 铲屎官想知道猫猫 context window 用了多少，且为后续 auto-seal (Phase B) 打地基。当前猫猫 context 满了会静默压缩丢记忆，铲屎官看不到也管不了。

**Tradeoff**:
- 选 `sessionRestart` 而非 `nativeCompact`: CLI compact 机制是黑箱且不可控，自己管 session 生命周期更可靠
- 选 fillRatio 不选 remainingTokens: fillRatio 是归一化的百分比，跨模型可比较（Claude 200k vs Codex 400k vs Gemini 2M）
- Codex/Gemini 用硬编码 fallback 而非 API 查询: CLI 不报告 window size，Phase B+ 可从 app-server 获取精确值

**Open Questions**:
1. Phase B 的 SessionSealer 是否应该放在 SessionManager 里还是独立服务？
2. `context-window-sizes.ts` 的硬编码映射表需要随模型升级维护——是否应该做成 config file？
3. ContextHealthBar 的颜色阈值 (0.5/0.7/0.85) 是否需要用户可配？

**Next Action**: 请 review 上述文件，重点关注 5 个 review 焦点。确认后合入 main。

---

## 检查清单

- [x] Spec compliance 自检完成 (15/15 项合规，1 项有说明偏离)
- [x] 设计文档已附 (`docs/plans/2026-02-13-f24-session-chain.md`)
- [x] 测试通过 (1035 unit + Redis all pass)
- [x] Build 通过 (3/3 packages)
- [x] 五件套完整
