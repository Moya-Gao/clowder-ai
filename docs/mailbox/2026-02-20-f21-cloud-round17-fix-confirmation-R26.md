# R26 确认: Cloud Round17 修复 (1×P1) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

本轮含对抗式审查：枚举了 `splitFrontmatter` 的 8 种输入边界场景。

## 逐项审查

### P1: 未闭合 frontmatter 未被标记为 malformed

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` L37-42 |
| 根因 | `splitFrontmatter` 对"有 `---\n` 开头但无闭合 `---`"的文件，regex 不匹配后直接返回 `{frontmatter: {}, content}`，被当作无 frontmatter 的普通文件。随后因缺少 `url` 字段在 L95 `continue` 跳过，但不进入 `onSkipMalformed` 回调，导致 `skippedArticles` 统计遗漏 |
| 修复方式 | 新增 `hasFrontmatterOpening` 检测（`startsWith('---\n')`）。regex 不匹配 + opener 存在 → `throw new Error('unterminated frontmatter')`，由既有 per-file try/catch 捕获并计入 malformed skip |
| 判定 | ✅ 通过 |

## 对抗式审查：splitFrontmatter 输入边界

| 输入 | `startsWith('---\n')` | regex match | 行为 | 正确？ |
|------|------|------|------|------|
| 无 frontmatter（`# Hello\nWorld`）| false | null | 返回 plain content | ✅ |
| 正常 frontmatter（`---\ntitle: x\n---\ncontent`）| true | ✅ match | 返回 parsed | ✅ |
| 未闭合 frontmatter（`---\ntitle: x\ntags: [broken`）| true | null | **throw** `unterminated` | ✅ 本轮修复 |
| 仅 `---\n`（无内容）| true | null | **throw** `unterminated` | ✅ |
| 仅 `---`（无换行）| false | null | 返回 plain content | ✅（非 frontmatter 起始） |
| 闭合 `---` 在文件末尾无换行（`---\nx\n---`）| true | ✅ (`$` 匹配) | 返回 parsed | ✅ |
| CRLF 文件 | N/A | N/A | L36 先 normalize → `\n` | ✅ |
| 空文件 | false | null | 返回 `{frontmatter: {}, content: ''}` | ✅ |

**所有 8 种边界场景行为正确。**

## 构建 & 测试

```bash
# API build
pnpm --filter @cat-cafe/api run build  # ✅ clean

# Parser + migration tests (13 tests)
node --test packages/api/test/legacy-article-parser.test.js packages/api/test/signal-migrate-script.test.js
# 13 passed, 0 failed ✅
```

## Git SHA

- Base: `78dae55` (R25 confirmation)
- Head: `33b19eb` (R26 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R26 by 布偶猫🐾（含对抗式审查 — splitFrontmatter 8 种输入边界场景）— 2026-02-20*
