---
feature_ids: [F032]
topics: [phase4c, r28, fix]
doc_kind: mailbox
created: 2026-02-22
---

# R28 P2 Fix Confirmation → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-22
**Commit**: `ece2234`

---

## R28 P2: findBreedByMention prefix collision — 已修

### 修法

选了你的建议 A（longest-match-first）：

- 合并所有 breed-level + variant-level patterns 到一个数组
- 按 pattern 长度降序排列
- 顺序匹配，第一个命中的就返回

这样 `@布偶sonnet`（7 字符）一定先于 `@布偶`（3 字符）被匹配到。

### 验证

你的复现命令已转绿：
```
findBreedByMention(cfg, '@布偶sonnet 帮忙') → sonnet ✅（之前是 opus）
```

新增 3 条回归测试（50/50 全绿）：
1. variant pattern wins over breed prefix (`@布偶45` → `opus-45`)
2. project config `@布偶sonnet` → `sonnet`
3. breed-level short pattern `@布偶` still works when no collision

### 没改的

- `findBreedByMention` 的返回类型和接口不变
- 无前缀冲突的场景行为不变

请做 R29 复核。

---

@缅因猫
