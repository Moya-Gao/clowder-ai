# Bug Report: F33 Session Bind — 绑定的 cliSessionId 被覆盖

## 报告人
铲屎官 (2026-02-24 00:18)

## 复现步骤

1. 在 Cat Cafe 前端新建对话，选择猫猫（如 opus）
2. 展开"绑定外部 Session (可选)"，粘贴 CLI Session ID: `0fbdf3e4-c681-45a9-ba97-d214e95cd720`
3. 确认创建 thread
4. 在新 thread 中 @opus 发消息
5. 观察猫猫实际使用的 session ID

**期望**：猫猫 `--resume 0fbdf3e4-...` 恢复绑定的 session
**实际**：猫猫创建了全新 session `dba5ddec-8a7a-42b0-bf3f-e08880895113`，绑定被覆盖

## 根因分析

### 定位过程

1. 检查 PATCH bind endpoint (`session-chain.ts:85-162`) → 只更新 `sessionChainStore`，**没有同步写入 `sessionManager`**
2. 检查 `invoke-single-cat.ts:139-177` — session 查找逻辑：
   ```typescript
   // Line 141: 从 sessionManager 读
   sessionId = await sessionManager.get(userId, catId, threadId);
   // → 返回 undefined（bind 没写 sessionManager）

   // Line 156: 条件进入 chain 查找
   if (sessionId && deps.sessionChainStore && sessionChainActive) {
   //   ^^^^^^^^^ undefined → 跳过整个 chain 查找！
   ```
3. 因为 `sessionId` 是 `undefined`，chain 查找被跳过 → CLI 无 `--resume` → 创建新 session
4. `session_init` handler (`invoke-single-cat.ts:241-245`) 无条件覆盖绑定值

### 排除项

- PATCH bind endpoint 本身工作正常（返回 200, session record 包含正确 cliSessionId）
- SessionChainStore 正确存储了绑定的 cliSessionId
- 前端两步流程（POST create → PATCH bind）时序正确

### 根因总结

**两个缺陷叠加**：

| # | 位置 | 缺陷 | 影响 |
|---|------|------|------|
| Bug-1 | `invoke-single-cat.ts:156` | chain 查找条件 `if (sessionId && ...)` 要求 sessionManager 已有值，但 bind 不写 sessionManager | 绑定后首次 invoke 查不到绑定的 cliSessionId |
| Bug-2 | `invoke-single-cat.ts:241-245` | `session_init` handler 无条件覆盖 `cliSessionId`，不区分"用户主动绑定"和"CLI 自动生成" | 绑定被静默覆盖，无任何提示 |

## 修复方案

### 方案 A（推荐）：让 invoke-single-cat 始终查 chain

将 line 156 的条件从：
```typescript
if (sessionId && deps.sessionChainStore && sessionChainActive) {
```
改为：
```typescript
if (deps.sessionChainStore && sessionChainActive) {
```

即使 `sessionManager` 没有值，也查 chain。如果 chain 有 active record 且有 `cliSessionId`，直接使用。

Bug-2 经分析判定为**预期行为，不修**：修复 Bug-1 后，CLI 会收到正确的 `--resume` 参数。如果 CLI 成功 resume，`session_init` 返回相同 ID，不触发覆盖。如果 CLI 无法 resume（session 过期/无效），返回新 ID 并覆盖是正确的——绑定目标已失效，应更新为实际运行的 session，避免下次 invoke 再次尝试 resume 一个不存在的 session。

### 方案 B（备选）：bind 同时写 sessionManager

在 `session-chain.ts` bind handler 中增加 `sessionManager.store(userId, catId, threadId, cliSessionId)`。

**放弃原因**：sessionManager 和 sessionChainStore 是两个独立数据源，同时写增加一致性风险。方案 A 更干净——chain 应该是 authoritative source。

## 验证方式

1. 写 failing test：bind → invoke → 验证 CLI 收到的 sessionId 是绑定值
2. 修复后 test 变绿
3. 手动验证：新建 thread → bind → @cat → 确认 session ID 一致
