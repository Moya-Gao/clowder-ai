# Review 请求：F21 S6 迁移收尾（migrate-signals + docs）

## What
- 新增迁移 CLI：`packages/api/src/scripts/migrate-signals.ts`
  - 参数：`--from` / `--to` / `--dry-run` / `--redis-url` / `--help`
  - 迁移内容：
    - legacy `config/sources.yaml` 扁平化并合并到 Cat Café `sources.yaml`
    - legacy `library/**/*.md` frontmatter 解析并写入新 `library + inbox`
    - 可选 Redis 索引写入（传 `--redis-url` 时）
- 为控制文件大小，脚本按边界拆为 5 文件：
  - `migrate-signals.ts`（entry，31 行）
  - `migrate-signals/cli.ts`
  - `migrate-signals/source-migration.ts`
  - `migrate-signals/legacy-article-parser.ts`
  - `migrate-signals/shared.ts`
- 新增测试：`packages/api/test/signal-migrate-script.test.js`
- `packages/api/package.json` 增加 `migrate-signals` script
- 文档更新：`README.md`、`docs/BACKLOG.md`
- 计划文档：`docs/plans/2026-02-19-f21-s6-migration-plan.md`

## Why
- F21 S6 目标是把旧 Signal Hunter 的“已有资产”平滑迁入 Cat Café，避免双仓维护和历史数据断层。
- 迁移脚本必须可 dry-run，先看结果再落盘，降低误操作风险。

## Tradeoff
- legacy sources schema 比新 schema 更丰富，本轮只映射核心字段（url/tier/frequency/fetch method/category），其余元信息不迁移。
- legacy 未匹配 source 时自动创建 `enabled=false` 的 fallback source，优先保全文章可追溯性。

## Open Questions
- S5 里 `packages/mcp-server/src/index.ts` 当前 369 行（超过 350 硬上限），是否在 F21 收尾前再拆一轮，避免后续被 merge gate 卡住？

## Next Action
- 请做 R7 review，重点看：
  1. 迁移安全性（dry-run 不落盘、source merge 去重、fallback source 逻辑）
  2. frontmatter 解析与 status/tags 映射是否稳妥
  3. CLI 参数和错误路径是否可运维

## Verification
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-migrate-script.test.js` ✅ (6 pass)
- `pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signal-*.test.js packages/api/test/signals-route.test.js` ✅ (48 pass)
