---
name: spec-compliance-check
description: Verifies implementation matches spec/plan before requesting review. Use when completing a phase, finishing implementation, or before requesting code review. Triggers on "开发完了", "实现完成", "准备提 review", "phase 完成", "ready for review".
---

> **SOP 位置**: 本 skill 是 `docs/SOP.md` Step 2 的执行细节。
> **上一步**: 代码开发 (Step 1) | **下一步**: `cat-cafe-requesting-review` (Step 3a)

# Spec Compliance Check

**Core principle:** 开发完对照 spec 自检，不要让 reviewer 发现"按 spec 应该有但没实现"的问题。

## 什么时候用

- 完成一个 Phase 或 Stage 后
- 准备提交 review 之前
- 声称"实现完成"之前

## 自检流程

```
BEFORE 声称完成或提 review:

1. FIND: 找到对应的 plan/spec 文档
   - docs/plans/{date}-{topic}.md
   - docs/phases/{phase-name}.md
   - 或相关设计文档

2. CREATE: 建立检查清单
   - 列出 spec 中的每一个验收标准
   - 列出 spec 中的每一个功能点
   - 列出 spec 中的每一个边界条件

3. VERIFY: 逐项检查
   - 每一项对应的代码在哪？
   - 是否有测试覆盖？
   - 边界条件是否处理？

4. REPORT: 输出合规报告
   - ✅ 已实现项
   - ⚠️ 部分实现项（说明差异）
   - ❌ 未实现项（说明原因）
```

## 检查清单模板

创建如下格式的检查清单：

```markdown
## Spec Compliance Report

**Spec 文档**: docs/plans/2026-02-10-xxx.md
**检查时间**: YYYY-MM-DD HH:MM
**检查人**: 布偶猫

### 功能验收

| # | Spec 要求 | 实现状态 | 代码位置 | 测试覆盖 |
|---|-----------|----------|----------|----------|
| 1 | XXX 功能 | ✅ | file.ts:L10-50 | test.spec.ts |
| 2 | YYY 逻辑 | ⚠️ 部分 | file.ts:L60 | 缺测试 |
| 3 | ZZZ 边界 | ❌ | 未实现 | - |

### 偏离说明

如有与 spec 不一致的地方，说明：
- 什么不一致
- 为什么这样做（技术原因/发现的问题）
- 是否需要更新 spec

### 遗漏项处理

对于未实现项：
- P1: 必须补完才能提 review
- P2: 可以登记 BACKLOG，在 review 中说明
```

## 常见遗漏类型

### 1. 功能遗漏

Spec 说"支持 A, B, C"，实际只做了 A, B。

**检查方法**：数一数 spec 中的功能列表，对照代码。

### 2. 边界条件遗漏

Spec 说"处理空输入"，但代码没有 null check。

**检查方法**：搜索 spec 中的"如果"、"当"、"边界"、"异常"等词。

### 3. 测试遗漏

功能实现了，但没有对应测试。

**检查方法**：每个功能点对应的测试文件/用例。

### 4. 文档遗漏

Spec 说"更新 README"，但没做。

**检查方法**：检查 spec 中的非代码任务。

## 真实案例：F11 教训

F11 开发中发生的问题：

1. **R1 Plan vs 实现偏离**：
   - Plan 说"所有消息状态都要持久化"
   - 实际只持久化了部分
   - Reviewer 发现后需要补

2. **边界条件遗漏**：
   - Plan 说"处理并发 ack"
   - 实际没有 CAS 保护
   - 导致竞态问题

3. **测试覆盖不足**：
   - Plan 说"覆盖所有状态转换"
   - 实际只测了 happy path
   - Reviewer 要求补测试

**教训**：如果开发前做 spec compliance check，这些问题可以在提 review 前发现。

## 输出示例

### ✅ 合规通过

```
## Spec Compliance Report ✅

Spec: docs/plans/2026-02-10-adr-008-s3.md
Status: 全部合规

| # | 要求 | 状态 | 代码 | 测试 |
|---|------|------|------|------|
| 1 | cursor deferred ack | ✅ | route-strategies.ts:L45-80 | invocation-flow.spec.ts |
| 2 | cursorBoundaries 收集 | ✅ | route-strategies.ts:L82-95 | ✓ |
| 3 | succeeded 后批量 ack | ✅ | AgentRouter.ts:L120-135 | ✓ |
| 4 | 失败时不 ack | ✅ | AgentRouter.ts:L140-145 | ✓ |

无偏离，可以提 review。
```

### ⚠️ 有遗漏

```
## Spec Compliance Report ⚠️

Spec: docs/plans/2026-02-10-adr-008-s3.md
Status: 有遗漏

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | cursor deferred ack | ✅ | OK |
| 2 | cursorBoundaries 收集 | ✅ | OK |
| 3 | succeeded 后批量 ack | ✅ | OK |
| 4 | 失败时清理 boundaries | ❌ | 未实现 |

### 遗漏项处理

| # | 遗漏 | 优先级 | 处理 |
|---|------|--------|------|
| 4 | 失败时清理 | P1 | 需要补完再提 review |

请先补完 P1 遗漏项。
```

## Workflow Position

本 skill 在 SOP 流程中的位置：
代码开发 (Step 1) → **本 skill (Step 2)** → `cat-cafe-requesting-review` (Step 3a)

## 相关文档

- docs/SOP.md：完整开发流程（唯一权威来源）
- docs/plans/：Phase 计划存放位置
- docs/phases/：设计文档存放位置
- CLAUDE.md：协作准则
