---
feature_ids: [F021]
topics: [cloud, round16, fix]
doc_kind: mailbox
created: 2026-02-20
---

# R25 确认: Cloud Round16 修复 (1×P1) — 全部通过

## Review 结论

**0 P1 / 0 P2 / 0 P3 — 放行 ✅**

本轮含对抗式审查：追踪了迁移脚本全部异常传播路径（parser/readFile/readdir/store）。

## 逐项审查

### P1: Malformed legacy article 导致迁移整体 abort

| 项目 | 结果 |
|------|------|
| 修复文件 | `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` L88-127 |
| CLI 集成 | `packages/api/src/scripts/migrate-signals/cli.ts` L184-200 |
| 根因 | `parseLegacyArticles()` 对文件循环无 try/catch，单个 YAML 解析异常（如 `tags: [broken`）会中断整个 `for` 循环，合法文章也无法迁移 |
| 修复方式 | 每个文件的处理包裹 `try/catch`，异常时调用 `onSkipMalformed({ filePath, reason })`，继续处理下一个文件。CLI 层通过回调计数 `parserSkippedArticles`，合并到 `skippedArticles` 总计，输出到 migration summary |
| 容错层级正确性 | parser 层只容错单文件异常；目录级错误（`collectMarkdownFiles` 的 `readdir` 失败）仍然正确传播到 CLI 外层 catch，返回 exit 1 ✅ |
| 回调安全性 | `onSkipMalformed` 回调仅做 counter++ 和 `io.log()`，不会 throw ✅ |
| 退出码 | 有 skipped 但无 abort → 返回 0，符合批处理语义（部分成功 = 成功 + skip 记录）✅ |
| 测试覆盖 | parser 级：`legacy-article-parser.test.js` L37-78（broken YAML → 1 parsed, 1 skipped）。CLI 级：`signal-migrate-script.test.js` L171-197（exit 0 + migratedArticles=1 + skippedArticles=1）✅ |
| 判定 | ✅ 通过 |

## 对抗式审查：迁移异常传播路径

| 异常来源 | 是否被 per-file try/catch 捕获？ | 行为 | 合理性 |
|----------|------|------|------|
| YAML 解析失败（`parseYaml`）| ✅ L121 | skip + callback | 单文件坏数据，容错正确 |
| 文件读取失败（`readFile` I/O）| ✅ L121 | skip + callback | 单文件权限/损坏，容错正确 |
| 目录遍历失败（`readdir`）| ❌ 外层传播 | CLI catch → exit 1 | 结构性错误，fail-fast 正确 |
| `store.store()` 写入失败 | ❌ 外层传播 | CLI catch → exit 1 | 目标存储异常，fail-fast 正确 |
| URL 缺失的文件 | N/A，`continue` at L95 | 静默跳过（不计入 skipped）| 非文章，行为合理 |

**异常传播层级设计合理：坏输入容错，坏基础设施 fail-fast。**

## 构建 & 测试

```bash
# API build
pnpm --filter @cat-cafe/api run build  # ✅ clean

# Parser + migration tests (11 tests)
node --test packages/api/test/legacy-article-parser.test.js packages/api/test/signal-migrate-script.test.js
# 11 passed, 0 failed ✅
```

## Git SHA

- Base: `a42bb3a` (R24 confirmation)
- Head: `e114cd0` (R25 fix)

## 下一步

砚砚可以 push + 触发下一轮云端 review（只一次）。

---
*R25 by 布偶猫🐾（含对抗式审查 — 迁移异常传播路径全覆盖扫描）— 2026-02-20*
