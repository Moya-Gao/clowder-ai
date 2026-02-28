---
name: cat-cafe-requesting-review
description: Cat Café enhanced code review request with mandatory self-check and documentation. Use when requesting review from other cats, before asking for code review, or after completing implementation. Triggers on "请 review", "帮我看看", "request review", "@缅因猫 review".
---

> **SOP 位置**: 本 skill 是 `docs/SOP.md` Step 3a 的执行细节。
> **上一步**: `spec-compliance-check` (Step 2) | **下一步**: `cat-cafe-receiving-review` (Step 3b)

# Cat Café: Requesting Code Review

**Core principle:** Review 请求必须附带自检报告和设计文档链接。让 reviewer 花时间在重点上，不是基础检查上。

## 与 Superpowers 版本的区别

| Superpowers | Cat Café |
|-------------|----------|
| 直接 dispatch reviewer | 先自检再 dispatch |
| 只需 SHA 和描述 | 必须附设计文档 + 自检报告 |
| 通用 review 流程 | 三猫协作规则嵌入 |

## Review 请求前必须做

### 1. Spec Compliance 自检

运行 `spec-compliance-check` skill，确保实现与 spec 一致。

**必须输出**：
- 功能验收清单
- 边界条件检查
- 测试覆盖状态

### 2. 准备设计文档链接

**必须附带**：
- 对应的 plan/spec 文档路径
- 相关 ADR（如果有架构决策）
- Phase 设计文档（如果是 Phase 工作）
- 🔴 **原始需求文档**（Discussion/Interview，铲屎官原话所在）— Reviewer 需要对照原始需求判断"这是铲屎官要的吗"，不只是看代码质量

> **教训**：F041 review 信只附了 spec + 改动文件，没有附原始 Discussion。Reviewer（砚砚+云端 Codex）只能审代码质量和 edge cases，无法审"是否解决了铲屎官的原始问题"。结果 10 轮云端 review 全在抓 edge case，没有一轮说"UI 太丑了"或"多项目管理呢？"。

### 3. 运行测试

```bash
# 必须全部通过
pnpm test

# 如有 Redis 相关改动
pnpm --filter @cat-cafe/api test:redis
```

## Review 请求结构

### 标准模板

```markdown
## Review 请求: {标题}

### 背景
{为什么做这个改动}

### 铲屎官原始需求（🔴 必填）
- Discussion/Interview: docs/discussions/{date}-{topic}/README.md
- **原始需求摘录（≤5 行，直接粘贴铲屎官原话）**：
  > {例："我要能看到三只猫分别挂了哪些 Skill，按猫分类，一目了然"}
- 铲屎官核心痛点：{用铲屎官自己的话概括}
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**
- ⚠️ **没有原始需求摘录 = reviewer 有权拒绝审查**

### 设计文档
- Plan: docs/plans/{date}-{topic}.md
- ADR: docs/decisions/{adr-name}.md（如有）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | XXX | ✅ | 已实现 |
| 2 | YYY | ✅ | 已实现 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| file1.ts | 新增 | XXX 功能 |
| file2.ts | 修改 | YYY 逻辑 |

### Git SHA
- Base: {base_sha}
- Head: {head_sha}

### 测试状态
```
pnpm test: 655 passed, 0 failed
pnpm test:redis: 42 passed, 0 failed
```

### Review 重点
1. {请重点关注的点1}
2. {请重点关注的点2}

### 五件套

**What**: {具体改动}
**Why**: {为什么这样改}
**Tradeoff**: {放弃了什么方案}
**Open Questions**: {不确定的点}
**Next Action**: 请 review 上述文件
```

## 检查流程

```
BEFORE 发送 review 请求:

1. SELF-CHECK:
   - 运行 spec-compliance-check
   - 运行测试
   - 确认测试通过

2. PREPARE:
   - 找到设计文档链接
   - 获取 git SHA
   - 列出改动文件

3. WRITE:
   - 使用标准模板
   - 填写五件套
   - 标注 review 重点

4. VERIFY:
   - 检查模板完整性
   - 确认文档链接有效

5. DISPATCH:
   - 发送给 reviewer
   - 存档到 docs/mailbox/
```

## Block 场景

### ❌ 没有自检

```
布偶猫：@缅因猫 帮我 review 这三个文件

⚠️ BLOCKED — 缺少自检报告

在发送 review 请求前，请先：
1. 运行 spec-compliance-check
2. 运行 pnpm test
3. 附上自检报告

这样 reviewer 可以专注在重点问题上。
```

### ❌ 没有原始需求文档

```
布偶猫：@缅因猫 这是 F041 的改动，请 review
[只附了 spec + 改动文件]

⚠️ BLOCKED — 缺少原始需求文档

请附上：
- 铲屎官的 Discussion/Interview 文档在哪？
- 铲屎官的核心痛点是什么？

Reviewer 不只审代码质量，还要判断"这是铲屎官要的吗？"
没有原始需求 = Reviewer 无法做愿景验证。
```

### ❌ 没有设计文档

```
布偶猫：@缅因猫 这是 S3 的改动，请 review

⚠️ BLOCKED — 缺少设计文档链接

请附上：
- S3 的设计文档/plan 在哪里？
- 有没有相关 ADR？

Reviewer 需要对照设计文档检查实现。
```

### ❌ 测试没跑

```
布偶猫：改完了，应该没问题，请 review

⚠️ BLOCKED — 未附测试结果

请先运行测试并附上结果：
```bash
pnpm test
# 如有 Redis 改动
pnpm --filter @cat-cafe/api test:redis
```

Reviewer 不应该是第一个发现测试失败的人。
```

## 通过场景

### ✅ 完整的 Review 请求

```
## Review 请求: ADR-008 S3 Cursor Deferred Ack

### 背景
实现 cursor 的延迟确认机制，避免猫猫调用失败时丢失消息。

### 设计文档
- Plan: docs/phases/adr-008-invocation-record.md#s3-cursor-deferred-ack
- ADR: docs/decisions/008-invocation-record-state-machine.md

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | cursorBoundaries 收集 | ✅ | route-strategies.ts:L82-95 |
| 2 | succeeded 后批量 ack | ✅ | AgentRouter.ts:L120-135 |
| 3 | 失败时不 ack | ✅ | AgentRouter.ts:L140-145 |
| 4 | 测试覆盖 | ✅ | invocation-flow.spec.ts |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| route-strategies.ts | 修改 | 添加 cursorBoundaries 收集 |
| AgentRouter.ts | 修改 | 添加 ackCollectedCursors |
| invocation-flow.spec.ts | 新增 | deferred ack 测试 |

### Git SHA
- Base: a7981ec
- Head: 3df7661

### 测试状态
```
pnpm test: 655 passed, 0 failed
pnpm test:redis: 42 passed, 0 failed
```

### Review 重点
1. cursorBoundaries Map 的生命周期管理是否正确
2. 失败场景下是否正确跳过 ack
3. 并发场景是否有竞态

### 五件套

**What**: 实现 cursor deferred ack
**Why**: 防止猫猫调用失败时 cursor 已经 ack 导致消息丢失
**Tradeoff**: 考虑过每条消息立即 ack，但失败回滚复杂
**Open Questions**: 超时场景如何处理 pending cursors？
**Next Action**: 请 review 上述三个文件

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过
- [x] 五件套完整
```

## Review 信存档

Review 请求发送后，存档到 `docs/mailbox/`：

```
docs/mailbox/
└── 2026-02-10-adr008-s3-review-request.md
```

## 收到 Review 后

详见 `cat-cafe-receiving-review` skill。

## Workflow Position

本 skill 在 SOP 流程中的位置：
`spec-compliance-check` (Step 2) → **本 skill (Step 3a)** → `cat-cafe-receiving-review` (Step 3b) → `merge-approval-gate` (Step 4)

完整流程见 `docs/SOP.md`。

## 相关 Skills

- `spec-compliance-check`: 自检工具（上一步）
- `cross-cat-handoff`: 五件套检查
- `cat-cafe-receiving-review`: 收到 review 后的处理（下一步）
- `merge-approval-gate`: 合入前检查
