# F24: Session Chain + Context Health 实施计划

> 日期: 2026-02-13
> 作者: 布偶猫/宪宪 (Claude Opus)
> 状态: 🔄 Phase A 已实现 (feat/f24-session-chain 待 review)，Phase B~E 待设计
> 关联:
> - [BACKLOG F24](../BACKLOG.md) — 原始需求
> - [GPT Pro 调研 (R1+R2)](../archive/2026-02/research/2026-02-13-f24-gpt-pro-research-result.md)
> - [调研提示词](../prompts/2026-02-13-f24-gpt-pro-research-prompt.md)
> - [铲屎官 Session Chain 讨论](../discussions/2026-02-13-f24-session-chain-handoff/README.md)

---

## 1. 背景与动机

### 问题

Cat Café 的三猫（Claude/Codex/Gemini）通过 CLI 子进程调用。每只猫在一个 Thread 里只有**一个 Session**。当 context window 填满时：

1. CLI 自动压缩（auto-compact），**静默丢失早期上下文**
2. 铲屎官可能不在线，猫猫"失忆"后质量下降但不自知
3. 前端看不到 context 使用了多少，也看不到被压缩掉的内容
4. 濒死猫（context 剩 15%）让它写交接，它已经记不清早期细节了

### 目标

> "猫的 session 满了就自动换一个，新猫能按需查旧 session，前端能看到完整历史"

铲屎官想要：
1. **Thread → N Sessions per cat** — session 满了自动拉新的，不丢数据
2. **前端可视化 Context 健康度** — 实时看到"已用 75%"
3. **新 session 的猫按需获取旧上下文** — 派 sub-agent 读旧 transcript，不是一次性灌入
4. **不依赖铲屎官在线** — 全自动检测 + 切换 + 恢复

### 研究基础

| 材料 | 结论 |
|------|------|
| 三猫 CLI 能力调研 (宪宪) | Claude ✅ stream-json 注入; Codex ❌ exec 不支持 (app-server 有); Gemini ❌ one-shot |
| GPT Pro 调研 R1 | PreCompact hook 不能阻止压缩; `/compact` headless 不可靠; Stop hook 无 token 信息 |
| GPT Pro 调研 R2 | 建议 Seal 概念; SessionRecord 完整数据模型; MCP 工具三层分页; 双轨交接 |
| 铲屎官脑洞 | Session 2 的猫派 Sonnet sub-agent 读 Session 1 transcript → 会议纪要格式交接 |

---

## 2. 核心设计决策

### 决策 1: sessionRestart 而非 nativeCompact

**Why**: GPT Pro 调研确认三猫的 compact 机制各不相同且都是黑箱。`/compact` 在 headless 模式下不可靠，`PreCompact` hook 不能阻止压缩。自己管 session 生命周期比依赖黑箱更可控。

**Tradeoff**: 新 session 需要"热启动"时间（sub-agent 读旧 session + 总结），但比静默丢记忆好。

### 决策 2: Session 三态生命周期 (GPT Pro R2)

```
active → sealing → sealed
```

- **active**: 正在使用。每只猫每个 thread 同一时间只有一个
- **sealing**: 阈值触发，正在写 transcript + 生成 digest
- **sealed**: 不可变快照。可被 sub-agent 读取

**Why**: 分两步（seal vs start new）避免"边写边读"的竞态。Seal 时刻可触发后台 job。

### 决策 3: Context Health = inputTokens / contextWindowSize

- **Claude (exact)**: `result/success` 事件的 `modelUsage[model].contextWindow` 直接给出 window 大小
- **Codex/Gemini (approx)**: CLI 不报告 window 大小，用硬编码 model→window 映射表 fallback

**Why**: Claude CLI 已有精确数据但我们没提取。Codex/Gemini 暂用保守估算，后续升级 (Codex app-server 有 `model_context_window`)。

### 决策 4: 文件系统存 transcript，Redis 存元数据

**Why**: GPT Pro R2 建议。Transcript 可能 200k+ tokens，不适合 Redis。JSONL 落盘 + Redis 索引是最优组合。Redis 只缓存 active session 的热数据。

---

## 3. 实施分期

### 全局分期概览

| Phase | 内容 | 依赖 | 预估测试 |
|-------|------|------|---------|
| **A** | SessionRecord + ContextHealth + 前端显示 | 无 | ~50 | ✅ 实现 (64 tests) |
| B | 阈值检测 + 自动 Seal + SessionSealer | A | ~30 | 待设计 |
| C | Transcript JSONL 落盘 + Extractive Digest | B | ~25 | 待设计 |
| D | MCP 工具 (list/read/detail) | C | ~20 | ⚠️ 设计空白 |
| E | Session 2 Bootstrap (digest 注入 + 按需深查) | D | ~20 | ⚠️ 设计空白 |

**Phase A 已实现** (branch: `feat/f24-session-chain`, 待缅因猫 review)。Phase D/E 有重要的设计问题待讨论（见第 9 节）。

---

## 4. Phase A 详细设计

### 4.1 新类型定义

**`packages/shared/src/types/session.ts`** (NEW)

```typescript
import type { CatId } from './cat-breed.js';
import type { TokenUsage } from '../../api-types'; // 或从 services/types.ts 重导出

export type SessionStatus = 'active' | 'sealing' | 'sealed';

export interface SessionRecord {
  /** 内部唯一 ID (UUID, 非 CLI session ID) */
  readonly id: string;
  /** CLI 报告的 session ID (from session_init event) */
  cliSessionId: string;
  readonly threadId: string;
  readonly catId: CatId;
  readonly userId: string;
  /** 链中的序号 (0-based) */
  readonly seq: number;
  status: SessionStatus;
  /** 最新一次 invocation 结束后的 context 快照 */
  contextHealth?: ContextHealth;
  messageCount: number;
  totalUsage?: TokenUsage;
  /** Seal 原因 (Phase B) */
  sealReason?: 'threshold' | 'manual' | 'error';
  readonly createdAt: number;
  updatedAt: number;
  sealedAt?: number;
  // Phase C 扩展字段:
  // transcriptPath?: string;
  // digest?: string;
}

export interface ContextHealth {
  /** 当前已用 token (= inputTokens from last invocation) */
  usedTokens: number;
  /** context window 总容量 */
  windowTokens: number;
  /** usedTokens / windowTokens (0.0 ~ 1.0) */
  fillRatio: number;
  /** exact = CLI 直接报告; approx = 硬编码估算 */
  source: 'exact' | 'approx';
  measuredAt: number;
}

export interface ContextHealthConfig {
  /** 预警阈值 (default 0.70) — 前端显示黄色 */
  warnThreshold: number;
  /** 封存阈值 (default 0.85) — 触发自动 Seal (Phase B) */
  sealThreshold: number;
}
```

### 4.2 新文件清单

| # | 文件路径 | 行数 | 说明 |
|---|---------|------|------|
| 1 | `packages/shared/src/types/session.ts` | ~60 | 共享类型 |
| 2 | `packages/api/src/domains/cats/services/SessionChainStore.ts` | ~100 | ISessionChainStore 接口 + 内存实现 |
| 3 | `packages/api/src/domains/cats/services/RedisSessionChainStore.ts` | ~150 | Redis 实现 |
| 4 | `packages/api/src/domains/cats/services/SessionChainStoreFactory.ts` | ~20 | 工厂函数 |
| 5 | `packages/api/src/domains/cats/services/session-chain-keys.ts` | ~15 | Redis key 模式 |
| 6 | `packages/api/src/config/context-window-sizes.ts` | ~25 | model→window 硬编码映射 |
| 7 | `packages/api/src/routes/session-chain.ts` | ~80 | API 路由 |
| 8 | `packages/web/src/components/ContextHealthBar.tsx` | ~50 | 前端进度条 |

### 4.3 需修改的现有文件

| # | 文件 | 改动说明 |
|---|------|---------|
| 1 | `packages/shared/src/types/index.ts` | 导出 session.ts 的类型 |
| 2 | `packages/api/src/domains/cats/services/types.ts` | TokenUsage 新增 `contextWindowSize?: number` |
| 3 | `packages/api/src/domains/cats/services/ClaudeAgentService.ts` | extractClaudeUsage() 提取 `modelUsage[model].contextWindow` |
| 4 | `packages/api/src/domains/cats/services/invoke-single-cat.ts` | session_init 时创建 SessionRecord; done 时更新 contextHealth; emit context_health |
| 5 | `packages/api/src/domains/cats/services/SessionManager.ts` | 接受 SessionChainStore，getActiveRecord() 委托查询 |
| 6 | `packages/api/src/domains/cats/services/AgentRouter.ts` | 构造函数接受 SessionChainStore |
| 7 | `packages/api/src/index.ts` | 创建 SessionChainStore 并注入 |
| 8 | `packages/api/src/routes/index.ts` | 导出 sessionChainRoutes |
| 9 | `packages/web/src/stores/chat-types.ts` | 新增 contextHealth 状态 |
| 10 | `packages/web/src/components/CatTokenUsage.tsx` | 挂载 ContextHealthBar |
| 11 | `packages/web/src/hooks/useSocket.ts` | 处理 context_health 事件 |

### 4.4 ISessionChainStore 接口设计

遵循现有 Store 模式 (Interface → Memory → Redis → Factory):

```typescript
export interface CreateSessionInput {
  cliSessionId: string;
  threadId: string;
  catId: CatId;
  userId: string;
}

export interface ISessionChainStore {
  /** 创建 SessionRecord (seq 自动递增，status=active) */
  create(input: CreateSessionInput): SessionRecord | Promise<SessionRecord>;
  /** 按内部 ID 查询 */
  get(id: string): SessionRecord | null | Promise<SessionRecord | null>;
  /** 获取某猫在某 thread 的 active session */
  getActive(catId: CatId, threadId: string): SessionRecord | null | Promise<SessionRecord | null>;
  /** 获取完整 session 链 (按 seq 排序) */
  getChain(catId: CatId, threadId: string): SessionRecord[] | Promise<SessionRecord[]>;
  /** 获取 thread 下所有猫的 session 链 */
  getChainByThread(threadId: string): SessionRecord[] | Promise<SessionRecord[]>;
  /** 更新 SessionRecord (部分字段) */
  update(id: string, patch: Partial<Pick<SessionRecord, 'cliSessionId' | 'status' | 'contextHealth' | 'messageCount' | 'totalUsage' | 'sealReason' | 'sealedAt' | 'updatedAt'>>): SessionRecord | null | Promise<SessionRecord | null>;
  /** 按 CLI session ID 查询 */
  getByCliSessionId(cliSessionId: string): SessionRecord | null | Promise<SessionRecord | null>;
}
```

### 4.5 Redis Key 设计

```typescript
// session-chain-keys.ts (cat-cafe: prefix 由 ioredis keyPrefix 自动加)
export const SessionChainKeys = {
  /** Hash: session record 所有字段 */
  detail: (id: string) => `session:${id}`,
  /** Sorted Set: 某猫某 thread 的 session 链 (score = seq) */
  chain: (catId: string, threadId: string) => `session-chain:${catId}:${threadId}`,
  /** String: 某猫某 thread 当前 active session ID (快速查询) */
  active: (catId: string, threadId: string) => `session-active:${catId}:${threadId}`,
  /** String: CLI session ID → record ID 索引 */
  byCli: (cliSessionId: string) => `session-cli:${cliSessionId}`,
};
```

### 4.6 Context Health 提取逻辑

#### Claude (exact)

在 `ClaudeAgentService.ts` 的 `extractClaudeUsage()` 函数末尾追加:

```typescript
// F24: 提取 context window 容量
const modelUsage = e['model_usage'] as Record<string, Record<string, unknown>> | undefined;
if (modelUsage) {
  for (const data of Object.values(modelUsage)) {
    if (typeof data['contextWindow'] === 'number') {
      result.contextWindowSize = data['contextWindow'];
      break;
    }
  }
}
```

#### Codex / Gemini (approx fallback)

新文件 `context-window-sizes.ts`:

```typescript
/** 硬编码 model → context window 大小映射 (token 数)
 *  用于 CLI 不报告 window 大小的猫猫 (Codex exec, Gemini -p)
 *  后续 Codex app-server 升级后可用精确值替换 */
export const CONTEXT_WINDOW_SIZES: Record<string, number> = {
  // Claude (精确值由 CLI 报告, 这里做 fallback)
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-5': 200_000,
  // Codex/GPT
  'gpt-5.3': 128_000,
  'gpt-5.2': 128_000,
  'gpt-5.1-codex': 400_000,
  // Gemini
  'gemini-2.5-pro': 1_000_000,
  'gemini-2.5-flash': 1_000_000,
};

export function getContextWindowFallback(model: string): number | undefined {
  // 精确匹配优先，然后尝试前缀匹配
  if (CONTEXT_WINDOW_SIZES[model]) return CONTEXT_WINDOW_SIZES[model];
  for (const [key, value] of Object.entries(CONTEXT_WINDOW_SIZES)) {
    if (model.startsWith(key)) return value;
  }
  return undefined;
}
```

#### invoke-single-cat.ts 集成

在 `msg.type === 'done'` 分支中，`invocation_usage` emit 之后:

```typescript
// F24: 计算并 emit context health
if (msg.metadata?.usage) {
  const windowSize = msg.metadata.usage.contextWindowSize
    ?? getContextWindowFallback(msg.metadata.model);
  const usedTokens = msg.metadata.usage.inputTokens ?? 0;
  if (windowSize && usedTokens > 0) {
    const health: ContextHealth = {
      usedTokens,
      windowTokens: windowSize,
      fillRatio: Math.min(usedTokens / windowSize, 1.0),
      source: msg.metadata.usage.contextWindowSize ? 'exact' : 'approx',
      measuredAt: Date.now(),
    };
    // 1. 更新 SessionRecord
    if (sessionChainStore && activeSessionRecordId) {
      await sessionChainStore.update(activeSessionRecordId, {
        contextHealth: health,
        updatedAt: Date.now(),
      });
    }
    // 2. 推送给前端
    yield {
      type: 'system_info' as const,
      catId,
      content: JSON.stringify({ type: 'context_health', catId, health }),
      timestamp: Date.now(),
    };
  }
}
```

### 4.7 SessionManager 向后兼容改造

现有 `SessionManager.get()` 返回 CLI session ID string。改造为优先从 SessionChainStore 查:

```typescript
constructor(sessionStore?: SessionStore, sessionChainStore?: ISessionChainStore) {
  this.sessionStore = sessionStore ?? null;
  this.sessionChainStore = sessionChainStore ?? null;
}

async get(userId: string, catId: CatId, threadId: string): Promise<string | undefined> {
  // F24 路径: 从 SessionChainStore 获取 active record 的 cliSessionId
  if (this.sessionChainStore) {
    const record = await this.sessionChainStore.getActive(catId, threadId);
    return record?.cliSessionId ?? undefined;
  }
  // 降级到原有逻辑
  if (this.sessionStore) {
    const result = await this.sessionStore.getSessionId(userId, catId, threadId);
    return result ?? undefined;
  }
  return this.sessions.get(`${userId}:${catId}:${threadId}`);
}

async store(userId: string, catId: CatId, threadId: string, sessionId: string): Promise<void> {
  // F24 路径: 更新 active record 的 cliSessionId
  if (this.sessionChainStore) {
    const record = await this.sessionChainStore.getActive(catId, threadId);
    if (record) {
      await this.sessionChainStore.update(record.id, {
        cliSessionId: sessionId,
        updatedAt: Date.now(),
      });
      return;
    }
    // 如果没有 active record，创建一个 (首次调用)
    await this.sessionChainStore.create({ cliSessionId: sessionId, threadId, catId, userId });
    return;
  }
  // 降级到原有逻辑
  // ... existing code ...
}
```

### 4.8 API 路由

**`packages/api/src/routes/session-chain.ts`**:

| Method | Path | 返回 |
|--------|------|------|
| GET | `/api/threads/:threadId/sessions` | `{ sessions: SessionRecord[] }` (query: `catId` 可选) |
| GET | `/api/sessions/:sessionId` | `SessionRecord` |

### 4.9 前端 ContextHealthBar

```tsx
// packages/web/src/components/ContextHealthBar.tsx
// 水平细条 (h-1.5)，嵌入 CatTokenUsage 组件下方
//
// 颜色逻辑:
// - fillRatio < 0.70: 猫猫品牌色 (bg-opus-dark / bg-codex-dark / bg-gemini-dark)
// - 0.70 ~ 0.85: bg-amber-500
// - > 0.85: bg-red-500 + animate-pulse
//
// Tooltip: "Context: 72% (144k / 200k tokens)"
// source='approx' 时在百分比前加 "~"
```

### 4.10 测试清单 (~50 tests)

**后端 Store 测试:**
- SessionChainStore (内存): create, getActive, getChain 排序, update, getByCliSessionId, seq 自增, 只有一个 active
- RedisSessionChainStore: 同上 + Lua 原子性, TTL, keyPrefix 正确
- Factory: Redis 可用 → Redis 实现; 不可用 → 内存实现

**Context Health 提取测试:**
- Claude: mock `result/success` 含 `modelUsage.*.contextWindow` → contextWindowSize 正确
- Codex: 无 contextWindowSize → 用 fallback 表
- Gemini: 无 contextWindowSize → 用 fallback 表
- Unknown model → contextWindowSize undefined

**集成测试:**
- invoke-single-cat: session_init → 创建/查找 SessionRecord
- invoke-single-cat: done + usage → 更新 contextHealth + emit context_health
- SessionManager 向后兼容: 有 SessionChainStore 时走新路径, 无时走旧路径

**API Route 测试:**
- GET /api/threads/:id/sessions → 返回有序 session 列表
- GET /api/threads/:id/sessions?catId=opus → 过滤
- GET /api/sessions/:id → 返回单个 record
- 404 for missing

**前端测试:**
- ContextHealthBar: 各阈值正确渲染颜色
- ContextHealthBar: approx source 显示 "~"
- socket context_health 事件 → store 更新

---

## 5. 风险与缓解

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| Claude CLI 改变 `modelUsage` 格式 | 中 | 版本锁定 + graceful fallback 到硬编码 |
| Codex/Gemini window 估算不准 | 低 | 保守估算 + source='approx' 标注 |
| SessionManager 改造破坏现有 resume | 高 | 保持 get()/store() 签名不变，只改内部实现 |
| Redis key 和现有 key 冲突 | 低 | 用 `session:` / `session-chain:` 独立前缀 |
| Phase A 无自动 seal → context 仍会 compact | 已知限制 | Phase A 只做监控，Phase B 加自动 seal |

---

## 6. 验证方式

1. `pnpm test` — 所有新增 + 现有测试通过 (目标 ~50 新 tests)
2. `pnpm --filter @cat-cafe/api test:redis` — Redis store 测试通过
3. 手动验证: dev server 启动，和布偶猫对话 → 前端 CatTokenUsage 下方出现 ContextHealthBar
4. API 验证: `curl /api/threads/:id/sessions?catId=opus` → 返回含 contextHealth 的 session 列表
5. 向后兼容: 现有 session resume 功能不受影响（`--resume` 参数正常传递）

---

## 7. Worktree 计划

```bash
git worktree add ../cat-cafe-f24-session-chain -b feat/f24-session-chain
cd ../cat-cafe-f24-session-chain
pnpm install
```

## 8. Phase A 实施结果 (2026-02-13)

### 交付物

- **Branch**: `feat/f24-session-chain` (4 commits, base: `5e1ef78`)
- **Review 信**: `docs/archive/2026-02/mailbox/2026-02-13/2026-02-13-f24-session-chain-review-request.md`
- **代码**: 26 个文件, +1762 行
- **测试**: 64 新增 (22 内存 store + 20 Redis store + 3 factory + 6 route + 7 fallback + 6 集成)
- **测试结果**: `pnpm test` 1035 pass / `pnpm test:redis` 全部通过 / `pnpm -r build` 3/3 clean

### 实现偏离

| # | Spec 要求 | 实际实现 | 原因 |
|---|-----------|----------|------|
| 1 | SessionManager 接受 SessionChainStore 委托查询 (4.7) | 直接在 invoke-single-cat deps 中注入 sessionChainStore | SessionManager 当前只管 CLI session 的 context history，不是 SessionRecord 的 owner。把 SessionRecord 逻辑放在 invoke 层更直接，避免 SessionManager 膨胀。Phase B seal 逻辑可能需要重新评估 |

### 实现中发现的 bug

- **ioredis scanKeys keyPrefix**: `getChainByThread()` 用 `scanStream` 扫描，但 ioredis `scanStream` 不会自动加 keyPrefix（和 `eval`/`hset`/`zrange` 不同）。修复: 手动拼接前缀 + 剥离。commit `c5353f3`

---

## 9. Phase D/E 待解决设计问题 (2026-02-13 铲屎官讨论)

> 背景: Phase A 只做了存储层 + 仪表盘。铲屎官问"你打算怎么用这套东西？"时发现 Phase D/E 的功能设计还是空白。以下问题需要在 Phase D/E 动手前解决。

### Q1: Digest 是什么格式？

Plan 说"extractive digest"，但没定义具体结构。不同场景可能需要不同格式：
- 关键决策列表？
- 代码变更摘要？
- 会议纪要？

**需要决定**: digest 的格式、生成方式（LLM 总结 vs 规则提取）、存储位置。

### Q2: 谁来触发按需查询？

Plan 说猫猫通过 MCP 工具查旧 session。但猫猫怎么知道自己需要查？

三种可能：
1. **铲屎官手动提示** — "去查查 session 1 关于 X 的讨论"
2. **猫猫自主判断** — 意识到自己缺少上下文时主动查
3. **系统自动检测** — 检测到猫猫在问已回答过的问题，自动触发

**需要决定**: 初期走哪条路？三条路的优先级？

### Q3: MCP 工具粒度 — 分页读 vs 语义搜索

Plan 写的是按 session ID 分页读 transcript (`session_read`)。但铲屎官的直觉是"传关键字让 sonnet 去调研"——这更像语义搜索。

两个方向：
- **A: 结构化分页** — `session_list` → `session_read(id, page)` → 按顺序读
- **B: 语义搜索** — `session_search(query)` → 跨所有 session 搜索相关内容（类似 Hindsight recall）

A 简单但笨，B 灵活但需要索引。可以 A 先行、B 后续？还是直接做 B？

**需要决定**: MCP 工具的核心交互模式。

### Q4: 多 session 传递问题

如果猫猫在 session 5，它只有 session 4 的 digest。Session 1-3 的信息怎么办？

可能的方案：
- **逐层递归 digest** — session 4 的 digest 里包含"session 3 的要点是..."，层层递推
- **全局 timeline** — 维护一个不断追加的 thread-level summary
- **按需深查** — 默认只给最近 digest，需要更早的就用 MCP 工具查

**需要决定**: 上下文传递策略。这影响 digest 的生成方式和 MCP 工具的设计。

### Q5: SessionSealer 归属

Phase B 的 SessionSealer（阈值触发 seal）放在哪？
- SessionManager 里（和 session 管理逻辑在一起）
- 独立服务（职责更清晰，但多一个依赖）

Phase A 的偏离（sessionChainStore 注入在 invoke 层而非 SessionManager）会影响这个决策。

---

## 10. 参考资料

- [BACKLOG F24](../BACKLOG.md)
- [GPT Pro 调研 R1+R2](../archive/2026-02/research/2026-02-13-f24-gpt-pro-research-result.md)
- [铲屎官 Session Chain 讨论](../discussions/2026-02-13-f24-session-chain-handoff/README.md)
- [调研提示词](../prompts/2026-02-13-f24-gpt-pro-research-prompt.md)
- 现有 Store 模式参考: `InvocationRecordStore.ts` / `RedisInvocationRecordStore.ts`
- 现有 Token Usage 提取: `ClaudeAgentService.ts:extractClaudeUsage()`

----

# 第三轮 to Phase D/E 待解决设计问题 research

收到，这份计划已经很接近“能跑起来的系统设计文档”了。Phase A 既然已经落地，我们现在要做的，是把 B 到 E 变成一套 **“一边做一边不会推翻自己”** 的规格书，尤其把你在第 9 节提的 5 个开放问题一次性钉死，不然 D/E 写着写着一定会长出第二套世界观。

我下面按“可以直接抄进 design doc / PR 描述”的粒度给出建议，重点覆盖：

* Phase B（阈值检测 + 自动 Seal + SessionSealer）怎么放、怎么幂等、怎么不竞态
* Phase C（Transcript 落盘 + Extractive Digest）到底落哪些文件、怎么分页读的索引怎么做
* Phase D（MCP 工具）API 形状一次定住，先用笨实现，后面不破坏接口升级成语义搜索
* Phase E（Session 2 Bootstrap）怎么把 digest 注入、怎么让猫知道何时查、怎么处理多 session 递归

最后我会把 Q1-Q5 给一个“建议决策 + 后续升级路线”。

---

## 先给你一个“总决策包”结论（Q1-Q5 的推荐答案）

### ✅ Q1 Digest 格式是什么？

**定两份产物，一份机器可校验，一份人类可读：**

1. `digest.extractive.json`（规则提取，Seal 时生成，零 LLM 成本，确定性强）
2. `digest.handoff.md`（会议纪要规范，LLM 生成，可选异步，缺了也不阻塞）

> Phase C 只保证 1) 一定有。
> Phase E 优先用 2)，没有就降级用 1) 生成一个“临时 handoff”。

这样你不会被“现在要不要引 LLM 摘要”卡住，同时又能把“会议纪要规范”确立为最终交付格式。

---

### ✅ Q2 谁触发按需查询？

**MVP 顺序：系统自动 > 猫自发 > 人手动（最后才做自动检测）**

* **系统自动（必做）**：Session 2 启动时自动注入 “你是 Session #k + 最近 digest + 工具使用说明”
* **猫自发（必做）**：在系统提示里写清楚“缺上下文就用工具查，不要猜”
* **人手动（锦上添花）**：前端一个“让猫回看 Session X”的按钮，发一条 steer/inject 的自然语言指令
* **系统自动检测（后续）**：检测猫重复问已回答的问题再自动触发 search（这块很容易误触发，放最后）

---

### ✅ Q3 MCP 工具粒度：分页读 vs 语义搜索？

**接口同时提供 A+B，但实现分期：**

* **Phase D 先做 A（分页读）**：一定能用、最稳
* **Phase D 同时提供 B 的接口（search），先用“朴素全文搜索”实现**
* **Phase D+1 / Phase E+** 再把 search 的内部实现换成向量检索或更聪明的索引，不破坏接口

> 核心：把“工具的形状”现在定住，把“聪明程度”以后再升级。

---

### ✅ Q4 多 session 传递问题怎么处理？

**三件套并存，互相兜底：**

1. **Last digest**：每次新 session 注入“上一段 digest”（低成本）
2. **ThreadMemory（线程级滚动摘要）**：维护一个有上限的全局记忆（高价值）
3. **按需深查**：用 MCP 工具读任意旧 session，必要时派 sub-agent 深读

> 这能避免“session 5 只知道 session 4”的断层，也不会让每次启动都灌一坨史诗巨长文本。

---

### ✅ Q5 SessionSealer 放哪里？

结合你 Phase A 的偏离（逻辑在 invoke 层），我建议：

* **SessionSealer 做成独立服务**（职责清晰，便于测试与恢复）
* **触发点仍在 invoke-single-cat 的 done 分支**（因为那儿拿得到 usage/contextHealth）

也就是：invoke 层只负责“发现阈值到了”，Sealer 负责“状态机推进 + transcript finalize + digest 生成”。

---

下面展开 Phase B-E 的具体设计。

---

## Phase B：阈值检测 + 自动 Seal + SessionSealer

### B0. 目标行为（把“应该发生什么”写清楚）

当某猫在某 thread 的 active session 的 `fillRatio >= sealThreshold`（或 `remainingTokens < turnBudget + margin`）时：

1. **当前 session 从 `active -> sealing`**（原子切换，避免重复触发）
2. **清掉 active 指针**，让下一次调用自然创建新 session（sessionRestart）
3. **异步/后台**完成 finalize（落盘、生成 digest、标记 sealed）
4. 前端能看到 Session 状态变化与“正在 sealing”的提示
5. 不依赖 `/compact`，不依赖 hook，完全由你们自控

> 关键点：**切 session 的动作必须快**，digest 慢慢做不影响继续干活。

---

### B1. 阈值策略：别只看 fillRatio，再加一个 “turnBudget” 保险丝

你现在 Phase A 计算 `fillRatio = usedTokens / windowTokens`。Phase B 建议把触发条件变成：

```ts
shouldSeal =
  fillRatio >= sealThreshold
  || (windowTokens - usedTokens) < (turnTokenBudget + safetyMargin);
```

理由：有些回合会突然爆 tokens（长代码 diff、长错误栈、长工具输出），只用百分比会出现“上一轮 84%，下一轮直接撞顶”的惊吓。

**默认建议：**

* `turnTokenBudget`: 12_000（先保守，后面按 P95 调）
* `safetyMargin`: 4_000
* sealThreshold 仍按你们的 config（Claude 0.85，Gemini 先更低一些）

---

### B2. SessionSealer 的接口（可测、可幂等）

建议新增 `SessionSealer`（或叫 `SessionLifecycleService`），核心方法两类：

```ts
export interface SessionSealer {
  /** 基于阈值请求 seal（幂等） */
  requestSeal(args: {
    sessionId: string;                // internal SessionRecord.id
    reason: 'threshold' | 'manual' | 'error';
    measuredHealth?: ContextHealth;   // 触发时的快照
  }): Promise<{ accepted: boolean; status: SessionStatus }>;

  /** 执行 finalize（可被 job runner 或恢复流程调用） */
  finalize(args: { sessionId: string }): Promise<void>;
}
```

* `requestSeal` 只做**快路径**：CAS 改状态 + 清 active 指针 + enqueue finalize
* `finalize` 才做重活：flush transcript、写 index、写 digest、改 sealed

---

### B3. Redis 原子性（避免竞态的关键）

你 Phase A 已经有 Lua 做原子性，这里继续用 Lua 保证：

* 只有 `status=active` 的 session 能变 `sealing`
* active key 只有仍指向该 session 才能被清掉
* sealReason、sealedAt、updatedAt 一起写

伪代码（Lua 思路）：

1. 读 `session:{id}.status`
2. 若不是 `active` 返回 `accepted=false`
3. 写 `status=sealing`, `sealReason=...`, `updatedAt=now`
4. 若 `session-active:{catId}:{threadId} == id` 则 DEL
5. 返回 `accepted=true`

---

### B4. “新 session 怎么创建？”（不需要提前 create）

你们现在 record 是在 `session_init` 时创建的。对自动切换来说完全够用：

* 旧 session 变 sealing 后就没有 active
* 下一次 spawn 不传 `--resume`（因为 active cliSessionId 查不到）
* CLI 自然开新 session
* `session_init` event 到来时 create 新 record，seq 自动加 1

> 这条链路几乎不需要改你们 Phase A 的“在 init 时 create”的模式，只要 B 把 active 清掉即可。

---

### B5. Phase B 新增事件（前端要看到状态变化）

建议新增 websocket 事件：

* `session_status_changed`：`{sessionId, status, reason?}`
* `session_seal_requested`：`{sessionId, reason, healthSnapshot}`（可选，用于 debug）

这能让 UI 立刻显示“正在封存 Session 3…”，体验上很关键。

---

## Phase C：Transcript JSONL 落盘 + Extractive Digest

### C1. Transcript 文件落盘的最小规范（建议直接写进代码注释）

每个 session 一个目录：

```
<root>/threads/<threadId>/<catId>/sessions/<sessionRecordId>/
  events.jsonl
  index.json
  digest.extractive.json
  digest.handoff.md        (可选)
```

**events.jsonl 的行结构建议加一层 envelope**（以后扩展不痛）：

```json
{
  "v": 1,
  "t": 1730000000000,
  "threadId": "thr_x",
  "catId": "claude",
  "sessionId": "sess_internal_uuid",
  "cliSessionId": "cli_abc",
  "invocationId": "inv_123",
  "event": { ...原始NDJSON消息... }
}
```

这样你们可以用同一份 transcript 同时支撑：

* UI chat replay
* MCP read_session_events
* 调试审计（工具输出、报错）

---

### C2. Index 怎么做才能支持“分页读”？

你们希望 MCP 有分页。纯 JSONL 没索引，分页会变成“每次从头扫到第 N 行”，会很痛。

**推荐“稀疏索引”**：每写入 N 行记录一次 byte offset，N 默认 100。

`index.json` 结构：

```json
{
  "v": 1,
  "eventCount": 5321,
  "stride": 100,
  "offsets": [0, 18923, 40211, ...],
  "invocations": [
    { "invocationId": "inv_1", "startEventNo": 0, "endEventNo": 420 },
    { "invocationId": "inv_2", "startEventNo": 421, "endEventNo": 860 }
  ]
}
```

读取 page 的算法：

1. 根据 cursor/eventNo 找到最近 stride 的 offset
2. 从该 offset 开始读 JSONL，跳过到目标 eventNo，再取 limit 条

> 这样分页性能是 O(limit + stride)，不会 O(total)。

---

### C3. Extractive Digest（规则提取）内容到底写啥？

它必须“有用、可重复、可校验”，不依赖 LLM。建议固定 schema：

```ts
type ExtractiveDigestV1 = {
  v: 1;
  sessionId: string;
  threadId: string;
  catId: CatId;
  seq: number;

  time: { createdAt: number; sealedAt: number };
  model?: { name?: string; alias?: string };

  context?: ContextHealth;

  invocations: Array<{
    invocationId: string;
    status: 'success' | 'error' | 'interrupted';
    startedAt: number;
    endedAt: number;
    durationMs: number;
    summary?: string;        // 规则级摘要，非 LLM
    toolNames?: string[];    // 从 tool_use 提取
  }>;

  filesTouched: Array<{
    path: string;
    ops: Array<'create'|'edit'|'delete'>;
    invocations: string[];
  }>;

  errors: Array<{
    at: number;
    invocationId?: string;
    message: string;
  }>;
};
```

**怎么提取：**

* `invocations`：直接用你们 InvocationRecordStore（现成）
* `filesTouched`：优先从 tool_use（write/edit/apply_patch）提取 path

  * 如果工具输出里拿不到，就用 `git status --porcelain`（可选，作为 fallback，注意只在 workspace 是 repo 时启用）
* `errors`：从 tool_result error 或 invocation status 提取

---

### C4. `digest.handoff.md`（会议纪要）什么时候生成？

两种模式都行，我建议你们先把接口和存储位准备好，然后实现从简：

* **模式 1（推荐）**：Seal 后后台 job 生成 `digest.handoff.md`（使用便宜长窗模型）
* **模式 2（更懒）**：Session 2 启动时发现没有 handoff，就派 sub-agent 生成，再缓存写回

这样 Phase E 不会因为 digest 缺席而卡死。

---

## Phase D：MCP 工具（list/read/detail/search）规格一次定住

你们第 9 节卡住的核心是“工具交互模式”。这里我给一套 V1 工具集，保证：

* A（分页读）强可用
* B（search）接口先定住，内部实现可从全文升级到语义，不破坏调用方
* 输出永远可控（limit / maxBytes / view）

---

### D1. `list_session_chain`

```ts
list_session_chain({
  threadId: string,
  catId?: CatId,
  limit?: number
}) -> {
  sessions: Array<{
    sessionId: string,
    seq: number,
    status: SessionStatus,
    createdAt: number,
    sealedAt?: number,
    model?: string,
    context?: ContextHealth
  }>
}
```

---

### D2. `read_session_events`（分页读）

```ts
read_session_events({
  sessionId: string,
  cursor?: { eventNo: number },     // 或者 string cursor 也行
  limit?: number,                   // 默认 50
  view?: "chat" | "handoff" | "raw", // 默认 chat
  includeToolResults?: "none" | "summary" | "full" // 默认 summary
}) -> {
  events: Array<{
    eventNo: number,
    t: number,
    invocationId?: string,
    kind: "user"|"assistant"|"tool_use"|"tool_result"|"system",
    text?: string,
    tool?: { name: string, input?: unknown, id?: string },
    result?: { ok: boolean, summary?: string, output?: unknown }
  }>,
  nextCursor?: { eventNo: number }
}
```

**view 语义：**

* `chat`：只给 user/assistant 文本（最省 token）
* `handoff`：保留 tool_use，tool_result 默认 summary（适合总结）
* `raw`：尽量接近原始事件（调试）

---

### D3. `read_invocation_detail`

直接对接 InvocationRecordStore：

```ts
read_invocation_detail({
  invocationId: string,
  includeStdout?: boolean
}) -> InvocationDetail
```

---

### D4. `session_search`（接口先定住，先用全文实现）

```ts
session_search({
  threadId: string,
  query: string,
  cats?: CatId[],
  sessionIds?: string[],
  limit?: number,                 // 默认 10
  scope?: "digests"|"transcripts"|"both" // 默认 both
}) -> {
  hits: Array<{
    score: number,
    sessionId: string,
    seq: number,
    kind: "digest"|"event"|"invocation",
    snippet: string,
    pointer: {
      eventNo?: number,
      invocationId?: string
    }
  }>
}
```

**Phase D 实现建议：**

* 先做“朴素全文”：扫描 `digest.*` + `events.jsonl`（有 index 后可以跳读）
* 后面要升级语义检索，只改内部实现，不动 tool schema

---

## Phase E：Session 2 Bootstrap（digest 注入 + 按需深查）

### E1. 启动时注入什么？我建议一个固定结构的 Bootstrap Packet

新 session 开始（第一次 user 消息前）自动注入：

1. **你是谁**：Thread 名称、session seq、前面有几段 session
2. **你有什么能力**：可用 MCP 工具列表 + 何时使用（强提示“别猜”）
3. **你现在拥有什么上下文**：

   * `ThreadMemory`（若有，且有 token 上限）
   * `LastSessionDigest`（handoff 优先，没有则 extractive）
4. **当前用户的最新任务**：这条才是 user 真正的 prompt

> 你们已有 ContextAssembler，可以把它当 “拼装 bootstrap 的唯一入口”。

---

### E2. 让猫“知道自己需要查”的提示语（MVP 就靠这句话起飞）

我建议在 bootstrap system message 里固定加一段（简短但硬）：

* 当你对“之前做过什么、为什么这样做、某个文件/决策来源”不确定时：

  1. 先 `session_search(query)`
  2. 再 `read_session_events(view="handoff")`
  3. 需要细节就 `read_invocation_detail(invocationId)`
* 不要凭空猜测以前的决策

这会显著降低“新 session 自信胡扯”的概率。

---

### E3. 多 session 的传递策略（落地版）

我建议你们 Phase E 就引入一个 `ThreadMemory.md` 的概念，哪怕 V1 很粗：

* 每次 seal 后更新一次 thread memory（可用 LLM，也可规则提取先凑合）
* 内容控制在固定上限（比如 3k 到 6k tokens）
* Session 2 启动时注入 thread memory + last digest

这能解决你 Q4 的核心焦虑：Session 5 不会对 Session 1 完全失明。

---

## 对 Phase A 的两点小“加固建议”（不推翻，但能救命）

### 1) usedTokens 建议语义升级为 “contextTokens”

你 Phase A 用 `usage.inputTokens` 当 usedTokens，这在大多数情况下够用，但未来如果你们开始细分 cached tokens 或 provider 的 usage 语义变化，会出现“计量口径漂移”。

建议在 `TokenUsage` 里新增一个字段（不破坏旧字段）：

```ts
contextTokens?: number; // provider若能给就用它，否则fallback到inputTokens
```

然后 Phase B 的 health 计算用：

```ts
const usedTokens = usage.contextTokens ?? usage.inputTokens ?? 0;
```

这样你以后接 Codex app-server 或更精细 usage 的时候不用重写 ContextHealth。

---

### 2) fallback window sizes 要“可配置 + 可下调”

你现在的硬编码表 OK 作为 fallback，但建议支持一个全局下调系数，比如 0.9（尤其对 approx source）。

```ts
const WINDOW_SAFETY_FACTOR = 0.9; // env 可覆盖
windowTokens = Math.floor(fallback * WINDOW_SAFETY_FACTOR);
```

目的：宁可早一点 seal，也不要晚一点撞上黑箱 compact。

---

## 给你一份 “Phase B-E 开发顺序”建议（避免走死胡同）

如果按最小阻塞路径：

1. **B1**：实现 `requestSeal`（CAS 改状态 + 清 active）
2. **B2**：invoke-single-cat done 分支触发 seal（阈值到了就标记 sealing）
3. **C1**：events.jsonl 落盘（先不做 index 也行，但尽快补）
4. **C2**：seal finalize 生成 index + extractive digest
5. **D1-D3**：MCP list/read/detail 先上（search 可以先 stub）
6. **E1**：Session 2 bootstrap 注入 last digest + 工具说明
7. **D4**：补 `session_search`（先全文）
8. **E2**：ThreadMemory（可选，但我真心建议尽早做）

---

## 最后，把你第 9 节的 5 个问题变成“可写进文档的决策条款”（可直接 copy）

### Decision: Digest Format

* `digest.extractive.json` MUST exist for every sealed session
* `digest.handoff.md` MAY exist; if absent, bootstrapper MAY generate it and persist back
* Both digests MUST include pointers to `sessionId`, `seq`, and `invocationId` references

### Decision: Recall Trigger Priority

1. system bootstrap injection (always)
2. model self-recall via MCP tools (prompted)
3. user manual hint (UI action)
4. system auto-detection (future)

### Decision: MCP Interaction Model

* Provide paginated read tools as ground truth
* Provide `session_search` as stable API; implementation can evolve from full-text to semantic without breaking schema

### Decision: Multi-Session Continuity

* Always inject last session digest
* Maintain bounded thread-level memory (rolling)
* Allow on-demand deep retrieval of any prior session

### Decision: SessionSealer Ownership

* Sealer is a standalone service responsible for lifecycle transitions and finalize jobs
* Invocation pipeline is responsible only for emitting seal requests when thresholds are met

---

你要是同意这套方向，我下一步可以把 “Phase D 工具 schema + Phase E bootstrap packet” 写成一份更像接口文档的 markdown（含示例 request/response），你们前后端和三猫都能直接对齐，不用再在群里靠想象力同步宇宙观 🐾
