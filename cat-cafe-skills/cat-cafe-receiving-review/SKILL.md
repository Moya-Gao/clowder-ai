---
name: cat-cafe-receiving-review
description: Cat Café enhanced review reception with Red-Green verification and no performative agreement. Use when receiving code review feedback, before implementing fixes, or when reviewer provides feedback. Triggers on "review 结果", "review 意见", "缅因猫说", "reviewer 说", "fix these".
---

# Cat Café: Receiving Code Review

**Core principle:** 验证后再实现。技术正确性 > 社交舒适。禁止表演性同意。

## 与 Superpowers 版本的区别

| Superpowers | Cat Café |
|-------------|----------|
| 验证后实现 | + Red→Green 强制验证 |
| 禁止表演性同意 | + 三猫协作规则嵌入 |
| Push back 机制 | + 修复后必须回给 reviewer 确认 |

## 收到 Review 后的响应模式

```
WHEN 收到 review 反馈:

1. READ: 完整阅读，不要边读边反应
2. CLASSIFY: 按 P1/P2/P3 分类问题
3. UNDERSTAND: 用自己的话复述每个问题
4. VERIFY: 检查问题是否真的存在
5. IMPLEMENT: Red→Green 方式逐个修复
6. CONFIRM: 修完回给 reviewer 确认
```

## 禁止的响应

**绝对禁止（来自 Superpowers）：**

```
❌ "You're absolutely right!"
❌ "Great point!"
❌ "Excellent feedback!"
❌ "Thanks for catching that!"
❌ "让我现在就改" (在验证之前)
```

**正确的响应：**

```
✅ 直接开始修复（行动 > 言语）
✅ 复述技术问题
✅ 问澄清问题
✅ 如果 reviewer 错了，用技术论证 push back
```

## Red→Green 修复流程（缅因猫方法论）

这是缅因猫的强制要求，布偶猫必须遵守：

### 1. 先复现再修复

对每个 P1/P2 问题：

```
1. 理解问题
2. 写失败测试（Red）
3. 运行测试，确认红灯
4. 修复代码
5. 运行测试，确认绿灯（Green）
6. 确认没有 regression
```

### 2. 先打红灯

```bash
# 1. 写复现测试
# 2. 运行测试
pnpm test

# 3. 确认看到红灯
# Expected: FAIL
# 4. 记录失败点
```

### 3. 修复并转绿

```bash
# 1. 修复代码
# 2. 运行测试
pnpm test

# 3. 确认绿灯
# Expected: PASS
# 4. 运行完整测试确认没有 regression
```

### 4. 例外：无法自动化复现

如果问题无法稳定自动化复现：
- 提供最小手工复现步骤
- 说明为什么无法自动化
- 不能跳过验证结论

## 处理不清晰的反馈

```
IF 有任何问题不清晰:
  STOP - 不要实现任何东西
  ASK - 先问清楚

WHY: 问题可能相互关联，部分理解 = 错误实现
```

**示例：**

```
缅因猫: "修复 1-6"
你理解 1,2,3,6。不清楚 4,5。

❌ 错误: 先修 1,2,3,6，再问 4,5
✅ 正确: "我理解 1,2,3,6。需要澄清 4 和 5 后再开始。"
```

## 修复顺序

```
FOR 多个 review 问题:
  1. 先澄清所有不清楚的问题
  2. 按优先级修复:
     - P1 (Blocking) - 必须立即修
     - P2 (Important) - 必须修完才能放行
     - P3 (Minor) - 可以登记 BACKLOG
  3. 每个修复单独测试
  4. 确认没有 regression
```

## 何时 Push Back

当以下情况时应该 push back：

- 建议会破坏现有功能
- Reviewer 缺少完整上下文
- 违反 YAGNI（未使用的功能）
- 技术上对当前栈不正确
- 有 legacy/兼容性原因
- 与铲屎官的架构决策冲突

**如何 push back：**

- 用技术论证，不是防御性反应
- 问具体问题
- 引用工作的测试/代码
- 如果涉及架构，请铲屎官介入

## 修复后必须确认

**这是 Cat Café 的硬规则**：修复后必须回给 reviewer 确认。

```
❌ 错误流程:
修复 → 自己判断"改对了" → 合入 main

✅ 正确流程:
修复 → 回给缅因猫 → 缅因猫确认 → 合入 main
```

**教训来源**：F11 流程错误——修完 3P1+1P2 后自己判断"改对了"直接合 main，被铲屎官批评。

## 修复确认模板

修复完成后，回给 reviewer：

```markdown
## Review 修复确认请求

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | XXX | ✅ | 已修复 + 测试通过 |
| P1-2 | YYY | ✅ | 已修复 + 测试通过 |
| P2-1 | ZZZ | ✅ | 已修复 + 测试通过 |

### Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-1 | xxx.spec.ts | FAIL (line 42) | PASS |
| P1-2 | yyy.spec.ts | FAIL (line 78) | PASS |

### 完整测试结果

```
pnpm test: 660 passed, 0 failed
pnpm test:redis: 42 passed, 0 failed
```

### Commit

- {sha}: fix(xxx): ... [布偶猫🐾]
- {sha}: test(xxx): add regression test [布偶猫🐾]

### 请求

请确认修复是否正确，确认后将执行合入。
```

## 处理正确反馈

当反馈确实正确时：

```
✅ "Fixed. [简述改了什么]"
✅ "Good catch - [具体问题]. Fixed in [位置]."
✅ [直接修复并在代码中展示]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!"
```

**为什么不说感谢**：行动说明一切。直接修复。代码本身证明你听到了反馈。

## 处理错误的 Push Back

如果你 push back 了但你错了：

```
✅ "你是对的 - 我检查了 [X]，确实是 [Y]。正在修复。"
✅ "验证了，你说得对。我之前理解错了因为 [原因]。正在修。"

❌ 长篇道歉
❌ 为什么 push back 辩护
❌ 过度解释
```

陈述事实然后继续。

## 相关 Skills

- `cat-cafe-requesting-review`: 发起 review 请求
- `merge-approval-gate`: 合入前检查放行确认
- `spec-compliance-check`: 开发完自检
- `cross-cat-handoff`: 交接五件套
