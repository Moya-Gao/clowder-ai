---
feature_ids: []
topics: [github, email, review, notifications]
doc_kind: note
created: 2026-03-01
---

# Review 请求：GitHub Review 通知 P1 hotfix（ignorable 误杀）

## 背景

Cloud Codex 在 PR #108 里指出一个 P1：
> ignorable detection 只要在 raw source 里出现 setup 句子就直接跳过，若 human comment/review 引用了该句，会导致真实通知被误杀。

PR #108 已合入 main，但这个 P1 当时我漏看了（通知未路由到当前 thread），现在补一个 hotfix 把风险堵上。

## 原始需求（来自云端 review P1，复现路径明确）

复现：提交一个正常 PR comment/review，正文包含字符串 `To use Codex here, create an environment for this repo.`（例如引用 bot 的提示），同时邮件仍包含动作行（`<user> left a comment (...)`）。旧逻辑会把它当 ignorable 并 skip。

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试 |
|---|------|------|----------|------|
| 1 | human comment 引用 setup 句子不应被忽略 | ✅ | `GithubReviewMailParser.ts` `inferReviewActionFromEmailSource` | `github-review-mail-body-classifier.test.js` 新增用例 |
| 2 | setup-only 的 Codex bot 提示仍应被忽略 | ✅ | 同上 | 既有 ignorable 用例仍通过 |

## 改动文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `packages/api/src/infrastructure/email/GithubReviewMailParser.ts` | 修改 | 将 ignorable 判定收敛到 “reviewer 为 chatgpt-codex-connector[bot]（或无 reviewer）且未包含 Codex Review” |
| `packages/api/test/github-review-mail-body-classifier.test.js` | 修改 | 新增回归测试：human comment 引用 setup 句子不应被 ignorable |

## Git SHA

- Base: `44c812ca`
- Head: `dfa1bf82`

## 测试状态

```
pnpm --filter @cat-cafe/api run build: PASS
node --test packages/api/test/github-review-mail-body-classifier.test.js: pass 6, fail 0
```

## Review 重点

1. ignorable 收敛条件是否足够严格：只忽略 setup-only Codex bot 邮件，不影响真实 review/comment
2. `! /codex review:/i` 这个额外 guard 是否合理（避免未来 Codex bot 在真实 review 里引用 setup 句子）

## 五件套

**What**：修复 ignorable 误杀：setup 句子只对 Codex bot setup 邮件生效  
**Why**：避免 human 引用 setup 句子导致真实通知被跳过（P1 correctness）  
**Tradeoff**：更复杂一点的判定逻辑，换取更低的误杀风险  
**Open Questions**：如果未来 Codex bot 发出“非 setup-only”的环境提示（混合内容），是否要更精细的分类？目前用 `codex review:` guard 做了一层防御  
**Next Action**：请宪宪 review 以上 2 个文件，确认可合入

