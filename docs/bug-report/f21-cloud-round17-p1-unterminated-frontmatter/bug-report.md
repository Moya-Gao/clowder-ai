---
feature_ids: [F021]
topics: [cloud, round17, unterminated]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report — F21 Cloud Round17 P1: Flag unterminated frontmatter as malformed input

## 1) 报告人
- 报告来源：Cloud review round 17
- 报告时间：2026-02-19
- 报告内容：`P1 Badge Flag unterminated frontmatter as malformed input`

## 2) 复现步骤（预期 vs 实际）
1. 在 legacy library 下创建 markdown 文件，内容以 frontmatter 起始分隔符 `---` 开头，但缺少结束分隔符 `---`。
2. 运行 `migrate-signals`。

预期：
- 该文件被标记为 malformed（进入 skip 统计与日志），迁移继续处理其他合法文件。

实际（修复前）：
- 该文件未被识别为 malformed；通常会被静默跳过（不计入 malformed skip）。

## 3) 根因分析
- 位置：`packages/api/src/scripts/migrate-signals/legacy-article-parser.ts`
- `splitFrontmatter()` 仅用正则匹配“完整 frontmatter”；匹配失败就当作“无 frontmatter 正文”返回。
- 对于“起始 `---` 存在但结束分隔符缺失”的输入，逻辑没有抛错，因此不会走 `onSkipMalformed` 分支。

## 4) 修复方案
- 在 `splitFrontmatter()` 增加“unterminated frontmatter”显式判定：
  - 若文档以 `---\n` 起始但未匹配到闭合分隔符，则抛出错误。
- 维持现有分层：
  - 单文件输入坏数据（malformed）→ per-file skip + 记录；
  - 目录级/基础设施级错误（如 `readdir` 失败）→ fail-fast。

Tradeoff：
- 顶部 `---` 将被严格解释为 frontmatter 起始，避免静默吞错；
- 这会把“顶部水平线写法”归类为 malformed（该场景在 legacy 迁移输入中可接受）。

## 5) 验证方式（Red → Green）
- Red（预期失败）：
  - `legacy-article-parser.test.js` 新增未闭合 frontmatter 用例，期望 `skipped.length === 1`。
  - `signal-migrate-script.test.js` 新增未闭合 frontmatter 用例，期望 summary 包含 `skippedArticles=1`。
- Green（修复后）：
  - 两个新增用例转绿；
  - 回归构建和相关测试通过。

## 6) 证据记录
- Red 命令：
  ```bash
  pnpm --filter @cat-cafe/api run build && node --test \
    packages/api/test/legacy-article-parser.test.js \
    packages/api/test/signal-migrate-script.test.js
  ```
  Red 结果：
  - `flags unterminated frontmatter as malformed input` 失败（`skipped.length` 预期 1，实际 0）
  - `flags unterminated frontmatter file as malformed and continues migration` 失败（summary 为 `skippedArticles=0`）
- Green 命令：
  ```bash
  pnpm --filter @cat-cafe/api run build && node --test \
    packages/api/test/legacy-article-parser.test.js \
    packages/api/test/signal-migrate-script.test.js
  ```
  Green 结果：
  - `tests 13`
  - `pass 13`
  - `fail 0`
