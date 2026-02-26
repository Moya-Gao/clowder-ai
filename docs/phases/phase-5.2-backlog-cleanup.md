---
feature_ids: []
topics: [phases, backlog, cleanup]
doc_kind: note
created: 2026-02-26
---

# Phase 5.2 — BACKLOG 大扫除

> 作者: 布偶猫 (Opus 4.6)
> 日期: 2026-02-09
> 状态: **✅ 已完成**
> 目标: 一次性清理 10 项技术债务，将 BACKLOG open 项从 15 降到 5

---

## 0) 铲屎官决策记录

### 决策 1: #21 孤儿消息处理策略

**问题**: 发消息到不存在的 threadId 会产生无主消息

**选项**:
| 选项 | 描述 | 优缺点 |
|------|------|--------|
| **A) 严格 400 拒绝** | threadId 不存在直接返回 400 | 简单明确，但前端必须显示清晰错误 |
| B) 自动创建 thread | 不存在就自动建 | 方便，但隐式行为可能导致其他困惑 |

**铲屎官决策**: **选 A**，但要求前端报错必须讲清楚为什么 400（不能让用户看到一脸懵的错误）

### 决策 2: #35 Thread 删除与 Invocation 竞态

**问题**: 删 thread 时猫正在工作怎么办？

**选项**:
| 选项 | 描述 | 优缺点 |
|------|------|--------|
| **A) 有活跃 invocation → 409 拒绝删除** | 保护正在工作的猫 | 简单直观，用户知道为什么删不了 |
| B) 先 cancel 再删 | 强制停止猫再删 | 用户可能不知道猫被杀了 |
| C) 软删除延迟清理 | 标记删除，等猫完成后清理 | 复杂度高 |

**铲屎官决策**: **选 A** — 保护大猫猫，不能在猫工作时偷偷删

### 决策 3: F5 并行模式 A2A follow-up

**问题**: 并行模式下猫 @另一只猫，结束后怎么处理？

**选项**:
| 选项 | 描述 | 优缺点 |
|------|------|--------|
| A) 自动触发串行 follow-up | 并行结束后自动发起 A2A | 无缝但可能产生意外长链 |
| **B) 显示按钮让用户决定** | 并行结束后显示提示+按钮 | 用户有控制权 |
| C) 只加提示不做 | 提示"并行不支持 A2A" | 最简单但用户体验差 |

**铲屎官决策**: **选 B** — 用户看到按钮决定是否 follow-up

### 决策 4: #26 Gemini/Codex resume

**铲屎官澄清**: Codex resume 已在代码里支持了（`codex exec resume SESSION_ID`），Gemini 需要调研最新 CLI 是否已支持 UUID 形式的 `--resume`，如支持则接入。

### 决策 5: F4 配置热更新

**铲屎官决策**: 认为很重要，纳入 5.2 范围。

---

## 1) 完整任务清单（按实施顺序）

### Step 1: 文档 + 快速修复（~1h）

#### Task 1: #34 cascade delete 语义文档
**文件**: 新建 `docs/decisions/007-cascade-delete-semantics.md`
**内容**:
- 当前行为: `Promise.allSettled()` best-effort 级联删除 (messages/tasks/memory/cursor)
- 设计理由: Redis 部分失败不应阻塞 UI 删除操作
- 边界: 不保证原子性，孤儿数据通过 TTL 自然过期
- 后续: 如需强一致性可引入后台清理任务

#### Task 2: #22 blob URL 长对话累积
**文件**: `packages/web/src/stores/chatStore.ts` 或 `packages/web/src/hooks/useChatHistory.ts`
**实现**:
- 当消息列表超过阈值（如 200 条）时，revoke 超出部分的 blob URL
- 或在 addMessage 时如果已有 >200 条消息，revoke 最旧消息的 blob URL
- 复用现有 `cleanupBlobUrls()` 逻辑

### Step 2: 后端防护（~2h）

#### Task 3: #21 孤儿消息 — 严格 threadId 校验
**文件**: `packages/api/src/routes/messages.ts`
**实现**:
- 发消息前校验 threadId 是否存在: `threadStore.getById(threadId)`
- 不存在 → `reply.status(400)` + 清晰错误: `{ error: '对话不存在', detail: '请先创建对话后再发送消息。如果对话已被删除，请新建一个。', code: 'THREAD_NOT_FOUND' }`
- 前端 useSendMessage.ts: 捕获 400 → 用 system 消息显示友好提示

**测试**: 新增 1-2 case (发消息到不存在 threadId → 400)

#### Task 4: #35 Thread 删除保护活跃 Invocation
**文件**: `packages/api/src/routes/threads.ts`
**实现**:
- DELETE handler 增加前置检查: `invocationTracker.getActiveByThread(threadId)`
- 有活跃 invocation → `reply.status(409)` + `{ error: '猫猫正在工作中，请等待完成后再删除对话', activeInvocations: count }`
- InvocationTracker 需要新增 `getActiveByThread(threadId)` 方法（按 threadId 过滤 active entries）

**依赖**: InvocationTracker 当前是否按 threadId 索引？需检查，可能需加索引。

**测试**: 新增 2 case (有活跃 invocation → 409, 无活跃 → 正常删除)

#### Task 5: #40 delivery cursor TTL
**文件**: `packages/api/src/domains/cats/services/DeliveryCursorStore.ts` (或相关)
**实现**:
- Redis 侧 cursor key 加 TTL (7 天)
- 每次 ackCursor 时刷新 TTL
- 内存侧维持现有 LRU 5000 上限

**测试**: 新增 1-2 case (TTL 设置验证)

### Step 3: 前端改进（~2.5h）

#### Task 6: #9 前端图片压缩
**文件**: 新建 `packages/web/src/utils/compressImage.ts`, 修改 `packages/web/src/components/ChatInput.tsx`
**实现**:
- `compressImage(file: File, maxWidth = 1920, maxBytes = 2 * 1024 * 1024): Promise<File>`
- 使用 Canvas API: drawImage → toBlob (quality 递减直到 < maxBytes)
- GIF 跳过压缩（动图）
- ChatInput.handleFileSelect: 选图后异步压缩再存入 state
- 显示压缩中状态（可选: 用现有 loading indicator）

**测试**: 压缩逻辑是纯函数，可写单元测试（需 jsdom canvas mock 或跳过）

#### Task 7: #39 useChatCommands 自动化测试
**文件**:
- 新建 `packages/web/vitest.config.ts`
- 新建 `packages/web/src/hooks/__tests__/useChatCommands.test.ts`
- 修改 `packages/web/package.json` (加 test script + vitest devDep)
**覆盖**:
- `isCommandInvocation()` 纯函数: 正例 + 负例 (如 `/approved` 不匹配 `/approve`)
- 各命令解析: `/config`, `/remember`, `/recall`, `/evidence`, `/reflect`, `/approve`, `/archive`
- 边界: 空输入, 纯空白, 无参数命令

### Step 4: A2A Follow-up 按钮（~1.5h）

#### Task 8: F5 并行 A2A follow-up 提示
**后端**:
- `route-strategies.ts` routeParallel: 并行完成后扫描所有回复中的 A2A mentions
- 如有 mentions → yield `system_info` 事件: `{ type: 'a2a_followup_available', mentions: [{catId, mentionedBy}] }`

**前端**:
- `useAgentMessages.ts`: 处理 `a2a_followup_available` 事件
- 显示可操作提示: "🔗 缅因猫在回复中 @了布偶猫，是否发起 follow-up？" + [发起] 按钮
- 点击按钮: 自动发送 `@布偶猫 请跟进缅因猫的回复` 到当前 thread

### Step 5: 配置热更新（~3h）

#### Task 9: F4 PATCH /api/config
**新建**: `packages/api/src/config/ConfigStore.ts`
**修改**: `packages/api/src/routes/config.ts`, `packages/api/src/config/ConfigRegistry.ts`

**可热更新字段** (per-request 读取，安全变更):
| 字段 | env key | 默认值 |
|------|---------|--------|
| cli.timeoutMs | CLI_TIMEOUT_MS | 120000 |
| a2a.maxDepth | MAX_A2A_DEPTH | 2 |
| per-cat budgets | CAT_BUDGET_* | 见 cat-budgets.ts |

**不可热更新** (需重启):
- server.port / server.host
- Redis 连接
- Hindsight baseUrl

**实现**:
- ConfigStore singleton: `set(key, value)` 写入内存覆盖层 + process.env
- PATCH /api/config: Zod 校验可更新字段 → ConfigStore.set → 返回新 snapshot
- GET /api/config: ConfigStore 覆盖层优先，fallback 到 process.env
- 前端: `/config set <key> <value>` 命令

**测试**: PATCH → GET 验证, 范围校验 (timeoutMs >= 0), 不可更新字段返回 400

### Step 6: Gemini Resume 调研 + 接入（~1h）

#### Task 10: #26 Gemini resume 调研
**文件**: `packages/api/src/domains/cats/services/GeminiAgentService.ts`
**当前**: 故意禁用 — `gemini --resume` 只接受 index number 不接受 UUID

**调研**:
1. 检查最新 gemini CLI 版本: `gemini --version` + `gemini --help | grep resume`
2. 测试: `gemini --list-sessions` → 取 UUID → `gemini --resume <UUID>` 是否可行
3. 如果可行: 接入 SessionManager (同 Claude/Codex 模式)
4. 如果不可行: 在 BACKLOG 标注"已调研，CLI 仍不支持 UUID resume"，关闭此项

**Codex**: 已完整支持 ✅，标记 #26 Codex 部分为完成

### Step 7: 验证 + Commit + Review（~1h）

```bash
pnpm -C packages/api run build && pnpm -C packages/api run test
pnpm -C packages/mcp-server run build && pnpm -C packages/mcp-server run test
pnpm -C packages/web run build
```

- 更新 BACKLOG.md: 10 项标 `[x]`
- 更新 phases/README.md: 新增 5.2 行
- 写 review 信给缅因猫

---

## 2) 不在 5.2 范围的项（带理由）

| # | 项目 | 跳过原因 |
|---|------|----------|
| #31 | 身份/权限边界 | 架构级改动，需统一 auth 方案设计，不是清扫级别 |
| #36 | CLI 全局配置隔离 | 依赖 Codex CLI 是否支持 `--no-global-agents`，需独立调研 |
| #19 | 自动讨论纪要 | 新功能不是债务，另排 Phase |
| #23 | 冷热状态视觉 | 需暹罗猫设计 |
| #24 | Antigravity cancel | 外部依赖 (Gemini CLI) |
| #25 | Docker 化部署 | 工程量大，不适合清扫 sprint |
| #29 | A2A 悄悄话折叠 UI | 需暹罗猫设计 |
| F8 | 猫工作状态实时显示 | 新功能 (token/耗时/进度)，另排 Phase |

---

## 3) 预期成果

| 指标 | 5.2 前 | 5.2 后 |
|------|--------|--------|
| BACKLOG open P2 | 8 | 1 (#31) |
| BACKLOG open P3 | 5 | 5 (不变) |
| Feature open | 3 (F4/F5/F8) | 1 (F8) |
| 总 open | 16 | 7 |
| 测试数 | 567 | ~585+ |

---

## 4) 风险

| 风险 | 缓解 |
|------|------|
| vitest 引入可能与 Next.js 构建冲突 | vitest.config.ts 单独配置，不影响 next build |
| Canvas 压缩在 SSR 环境不可用 | 标记为 'use client'，仅浏览器执行 |
| ConfigStore 全局状态引入测试隔离问题 | 提供 reset() 方法，测试 afterEach 重置 |
| Gemini CLI 调研结果可能是"仍不支持" | 记录调研结果，标记关闭即可 |

---

*布偶猫 🐾 (2026-02-09)*
