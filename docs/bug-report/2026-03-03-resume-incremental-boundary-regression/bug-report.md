---
feature_ids: []
debt_ids: []
topics: [incremental-delivery, cursor, resume, a2a]
doc_kind: bug-report
created: 2026-03-03
---

# Bug Report: resume 后历史增量被回退为全量重放

**报告人**: 铲屎官（会话观察）  
**发现方式**: 观察到猫猫 `resume` 后多轮持续收到旧历史，增量窗口退化成全量回放  
**日期**: 2026-03-03

## 1. 复现步骤（期望 vs 实际）

### 期望行为
- 同一线程内，猫猫应只收到 `delivery cursor` 之后的未发送消息。
- 即使一轮里发生 A2A 多跳，最终 ack 的 boundary 也应保持该轮内的**最新**值。

### 实际行为
- 在同一轮里同一只猫被二次唤起时，最终写入 `cursorBoundaries` 的 boundary 可能回退到旧 cursor。
- 下一轮 `resume` 会从旧 cursor 继续拉取，导致旧消息反复进入 `[对话历史增量]`。

### 最小复现（自动化）
- 新增回归测试：`packages/api/test/route-serial-cursor-monotonic.test.js`
- Red 阶段失败断言：
  - 期望 boundary=`000...2`
  - 实际 boundary=`000...1`（发生回退）

## 2. 根因分析

### 定位过程
1. 检查 `assembleIncrementalContext()`：boundary 计算本身正确。
2. 检查 `DeliveryCursorStore.ackCursor()`：持久化层是单调前进（不会回退）。
3. 核心问题在**deferred ack 收集阶段**：
   - `route-serial.ts` / `route-parallel.ts` 在 `options.cursorBoundaries` 存在时直接 `set(catId, boundaryId)`。
   - 同一 invocation 内同猫多次执行时，后一次可能得到更旧 boundary（或只返回旧 cursor），把前一次更新覆盖掉。

### 根因结论
- **不是** Redis / SessionStore 回退。
- **是** invocation 内 boundary 聚合逻辑非单调，导致 ack 前就被旧值覆盖。

## 3. 修复方案

### 方案
- 新增 `upsertMaxBoundary()`（`route-helpers.ts`），对同一 `catId` 仅保留字典序更大的 boundary。
- `route-serial.ts` 与 `route-parallel.ts` 改为调用该 helper，而不是直接 `Map.set`。

### 方案理由
- 保持 ADR-008 S3 的 deferred-ack 设计不变。
- 最小改动，直接封堵“同轮覆盖回退”。
- 与 `DeliveryCursorStore` 的单调语义一致（端到端同调）。

### 放弃的备选
- 取消 deferred ack 改回即时 ack：会破坏“仅 succeeded 才提交”的事务语义。
- 每次都 append 多个 boundary 再排序：复杂度高于实际需要。

## 4. 验证方式

1. **Red**（失败复现）：
   - `pnpm --filter @cat-cafe/api exec node --test --test-force-exit test/route-serial-cursor-monotonic.test.js`
   - 修复前失败，断言显示 boundary 回退。
2. **Green**（修复通过）：
   - 同命令修复后通过（1 pass, 0 fail）。
3. **回归**：
   - `pnpm --filter @cat-cafe/api exec node --test --test-force-exit test/integration/incremental-delivery.test.js`
   - 3/3 通过，增量投递语义未回归。

## 5. 影响与风险评估

- 影响范围：`routeSerial/routeParallel` 的 cursor boundary 收集逻辑。
- 风险：低。仅在 deferred-ack 路径增加“取最大值”约束，不改变消息内容组装与持久化流程。
- 预期收益：避免 `resume` 后历史重复回放，恢复稳定增量投递。

