# Bug Report: 暹罗猫疑似“双 Session”实为冗余 A2A 子调用

> 日期：2026-02-16
> 报告人：铲屎官（线上观察）
> 严重度：P1（重复调用导致重复回复与额度浪费）

## 1. 报告人

- **发现者**：铲屎官
- **上下文线索**：
  - Thread: `thread_mlorq6a8hkhllvoi`
  - Gemini session: `cb713cc2-d2e5-4085-8fde-2130b2ef2de9`
  - 上一个 invocation: `297357cc-c753-4458-ba76-dd3aae1855f3`
- **现象**：暹罗猫在同一轮里连续多次发言，表现像“被拉起两个 session”。

## 2. 复现步骤（期望 vs 实际）

### 复现步骤

1. 在 callback 链路里发起父调用，`catIds` 已包含目标猫（例如 gemini）。
2. 父调用执行期间，通过 `post-message` 再发送一条行首 `@暹罗猫` 的消息。
3. 触发 `triggerA2AInvocation`。

### 期望行为

- 若父调用仍 active 且已覆盖 target cat，不应再创建 child invocation。
- 同一猫在同一上下文下不应被重复触发。

### 实际行为

- 系统又创建了一条 gemini-only child invocation。
- 从对话表现看像“同一只猫开了两个 session”，导致重复发言与重复执行。

## 3. 根因分析（Root Cause）

### 证据与定位过程

1. Redis 会话键显示 gemini thread 绑定的是单一 session：
   - `cat-cafe:sessions:default-user:gemini:thread_mlorq6a8hkhllvoi = cb713cc2-d2e5-4085-8fde-2130b2ef2de9`
2. `gemini.features.sessionChain=false`，无 `session-active:*` 键属于预期，不等于双 session。
3. invocation 分布显示存在额外 gemini-only 调用（与三猫父调用并存），指向“冗余子调用”而非“重复 session 启动”。
4. 代码层确认：`callback-a2a-trigger.ts` 在 parent active 时，缺少“target 已被 parent 覆盖”的短路判断。

### 根因结论

- **根因不是会话层双开**，而是 **A2A callback mention 在 parent 已覆盖目标猫时仍触发 child invocation**。

## 4. 修复方案（What / Why / Tradeoff）

### What

- 在 `packages/api/src/routes/callback-a2a-trigger.ts` 增加短路：
  - 当 parent invocation active，且 `targetCats` 全部已在 parent `catIds` 中时，直接跳过 child A2A 触发。
- 在 `packages/api/src/domains/cats/services/InvocationTracker.ts` 增加 `getCatIds(threadId)`，用于读取 parent 活跃猫集合。
- 新增回归测试：
  - `packages/api/test/callback-a2a-trigger.test.js`
  - `packages/api/test/callback-a2a-postmsg.test.js`

### Why

- 避免同一只猫在同一父调用上下文中被重复触发，消除“假双 session”表象和重复执行副作用。

### Tradeoff

- 当前 A2A mention 解析是单目标语义（single target）。
- 暂不处理“多目标且部分重叠”分裂触发策略；若后续开放多目标 A2A，需要补充去重策略与测试。

## 5. 验证方式（Verification）

### 代码验证

- Build 通过：
  - `pnpm --filter @cat-cafe/api run build`
- 关键回归测试通过：
  - `node --test packages/api/test/callback-a2a-trigger.test.js packages/api/test/callback-a2a-postmsg.test.js`

### 行为验证

- 新增测试覆盖“parent 已覆盖 target 时不再触发 child”场景。
- 目标行为：避免同一猫在父调用期间被 callback mention 二次拉起。

## 关联变更

- Commit: `4ee660b`
- Message: `fix(api): skip redundant A2A child invocations [缅因猫🐾]`
