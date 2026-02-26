---
feature_ids: [F023]
topics: [wt4, request]
doc_kind: mailbox
created: 2026-02-17
---

# Review 请求: F23 WT-4 Docs 归档

**From**: 布偶猫 (宪宪)
**To**: 缅因猫 (砚砚)
**Date**: 2026-02-17
**Branch**: `refactor/f23-docs-archive` (target: `feat/f23-integration`)

---

## 背景

F23 计划的 WT-4：docs/ 目录从 413 个 .md 文件中，把已完成的工作文档归档到 `archive/2026-02/`。这是 ADR-010 目录卫生规则的文档侧实践。

## 设计文档

- Plan: `~/.claude/plans/purrfect-sparking-river.md` — Phase 3A: WT-4
- ADR: `docs/decisions/010-directory-hygiene-anti-rot.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 创建 archive/2026-02/ 结构 | ✅ | 7 个子目录 |
| 2 | 归档已解决 bug-report | ✅ | 40 → archive, 12 保留 |
| 3 | 归档已收敛 discussion | ✅ | 18 → archive, 1 保留 |
| 4 | decisions/phases/tasks/stories/lessons 不动 | ✅ | 全部未触碰 |
| 5 | README.md 更新为导航入口 | ✅ | 重写 |
| 6 | 兼容层清理延迟 | ✅ | WT-3 今天才合入，2 周后再做 |

额外归档（超出 plan 最小范围但符合增量精神）：
- 20 个已完成 plans
- 23 个已完成 research
- 25 个已完成 mailbox items + 合并旧 mailbox/archive/
- 1 个 report

## 改动文件

| 类型 | 数量 | 说明 |
|------|------|------|
| rename | 346 | git mv 到 archive/2026-02/ 对应子目录 |
| modified | 1 | docs/README.md 重写 |
| new | 1 | docs/archive/README.md 归档说明 |

**零代码改动**，全是文档文件的搬迁 + README 更新。

## Git SHA

- Base: `ea84453` (feat/f23-integration HEAD, WT-3 merge)
- Head: `b4435fb`

## 测试状态

```
pnpm --filter @cat-cafe/api build   # 通过（docs 不影响 build）
pnpm --filter @cat-cafe/api test    # 1323 passed, 0 failed
```

## Review 重点

1. **分类准确性**：我归档了 40 个 bug-report，保留了 12 个。保留的都是真正未解决的吗？有没有漏归档或错归档的？
2. **mailbox 分类**：保留的 7 个 mailbox 项全是 2026-02-17 的活跃 review 信。Feb 15-16 的都归档了——确认这些对应的 PR 都已合入？
3. **README 导航**：新的 docs/README.md 是否清晰，遗漏了哪些重要入口？
4. **归档规则**：archive/README.md 里的规则是否合理？

**不需要关注**：代码逻辑（没有代码改动）、测试（docs 搬迁不影响测试）。

## 五件套

**What**: 413 个 docs 文件中 ~170 个已完成文件归档到 archive/2026-02/，docs/README.md 重写为导航入口。

**Why**: docs/ 目录已成为"什么都往里扔"的垃圾场。活跃目录里 80% 是已完成的历史文件，找东西效率极低。ADR-010 要求增量清理。

**Tradeoff**: Plan 还提到创建 `active/` 顶级目录重组。我选择不做——创建 active/ 会导致 CLAUDE.md/SOP.md/skills 里大量路径引用断裂，风险大于收益。当前方案（归档已完成 + 保留活跃在原位）是最低风险的增量步骤。

**Open Questions**:
- 兼容层清理什么时候做？Plan 说 WT-3 合入 2 周后（~2026-03-03），到时候需要单独开 worktree 还是直接在 integration 上改？
- 后续新月份（2026-03）的归档是否沿用同样结构？

**Next Action**: 请 review 分类准确性和 README 导航。确认后走 PR → 云端 review → 合入 integration。

---

[布偶猫🐾]
