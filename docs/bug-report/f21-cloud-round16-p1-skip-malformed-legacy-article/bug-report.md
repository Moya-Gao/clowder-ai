# Bug Report: F21 Cloud Round16 — 迁移脚本遇到 malformed legacy article 会整体中断

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round16）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P1

## 1. 报告人

- 报告来源：cloud round16 自动 review。
- 问题：`migrate-signals` 在解析 legacy library 时，只要某个 markdown/frontmatter malformed，整个迁移流程会直接失败退出。

## 2. 复现步骤（期望 vs 实际）

1. 准备 legacy library，其中包含：
   - 一篇合法文章；
   - 一篇 malformed 文章（例如 YAML frontmatter 语法错误）。
2. 执行迁移 CLI：
   - `pnpm --filter @cat-cafe/api run migrate-signals -- --from <legacy> --to <target>`

期望行为：
- 跳过 malformed 文章，继续迁移其他合法文章，整体返回成功。

实际行为（修复前）：
- 迁移直接报错退出（exit code 1），合法文章也无法完成迁移。

## 3. 根因分析

- `parseLegacyArticles()` 按文件循环解析时，`splitFrontmatter` 内的 YAML 解析异常会直接抛出。
- 异常未在“单文件粒度”捕获，冒泡到 `runMigrateSignalsCli()` 顶层 `catch`，导致整个迁移中断。

## 4. 修复方案（为何选择）

- 在 legacy article 解析阶段增加“单文件容错”：
  - 读取/解析失败时仅跳过当前文件，不抛出全局异常；
  - 通过回调把跳过计数回传给 CLI；
  - 迁移 summary 的 `skippedArticles` 包含这类 malformed 跳过量。
- 增加回归测试，验证“存在 malformed 文件时迁移仍成功且不丢合法文件”。

Why：
- 迁移属于批处理，单条脏数据不应阻断全量迁移任务。

Tradeoff：
- 选择“容错跳过”而非“严格失败”，牺牲了对单条异常的强一致阻断，但提升了迁移可用性和恢复效率。

## 5. 验证方式

### Red（先失败）

- 新增测试：
  - `packages/api/test/signal-migrate-script.test.js`
  - `continues migration when one legacy article file is malformed`
- 修复前实际失败：`1 !== 0`（`signal-migrate-script.test.js:193`），CLI 因单文件 malformed 直接失败退出。

```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-migrate-script.test.js
# => 1 failed, 8 passed
```

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/legacy-article-parser.test.js \
  packages/api/test/signal-migrate-script.test.js
# => 11 passed, 0 failed
```
