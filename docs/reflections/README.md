---
doc_kind: guide
created: 2026-03-09
topics: [reflection, knowledge-engineering]
feature_ids: [F086]
---

# 反思胶囊 (Reflection Capsules)

Feature 完成时的结构化经验沉淀。不是自由散文，不是自动摘要——是 6+1 个固定字段的经验卡片。

## 命名规范

```
docs/reflections/YYYY-MM-DD-{topic}-capsule.md
```

示例：`2026-03-09-f086-m1-multi-mention-capsule.md`

## Schema 模板

每个胶囊必须包含以下 YAML frontmatter + markdown body：

```yaml
---
capsule_id: "F086-M1-2026-03-09"     # {FeatureID}-{Milestone}-{Date}
context: "M1 multi_mention 实现"       # 一句话说明做了什么
feature_ids: [F086]
doc_kind: capsule
created: 2026-03-09
---
```

Body 使用固定章节（不允许新增/跳过）：

```markdown
## What Worked
- （做对了什么，可复制的经验）

## What Failed
- （做错了什么，踩了什么坑）

## Trigger Missed
- （应该触发但没触发的元思考/协作）

## Doc Links
- （相关文档链接，建立知识网络）

## Rule Update Target
- （这次经验应该回写到哪个文件的哪个规则）
```

## 触发时机

在 `feat-lifecycle` completion 流程中：

```
Step 0: 愿景对照 → 跨猫验证
  ↓
Step 0.5: 反思胶囊 ← 这里
  ↓
Step 1: AC 打勾
```

## 使用规则

1. **6 固定章节不能省略**：没有就写"无"，不允许跳过
2. **`rule_update_target` 必须具体**：不能写"某个文件"，要写"`shared-rules.md §13: 补充xxx`"
3. **Feature spec 只挂链接**：不把反思正文塞回 spec（避免越滚越大）
4. **一个 milestone 一个胶囊**：不需要每次 commit 都写，但每个 milestone/feature 完成时必须写
