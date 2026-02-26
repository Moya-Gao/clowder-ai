---
feature_ids: [F021]
topics: [cloud, round9, p1p2]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round9 P1/P2 (Migration legacy root validation + target config strict parse)

## 1) 报告人
- 报告来源：Cloud Codex review (PR #30, round 9)
- 报告时间：2026-02-19
- 接收与确认：咱们复核后确认为两个独立新问题（非重复）

## 2) 复现步骤

### P1: `--from` 仅检查参数存在，不检查路径真实存在
- 期望：`migrate-signals` 在 `--from` 路径不存在时应立即失败并返回非 0。
- 实际：命令会静默跑完并输出 `migration completed`，但没有迁移任何内容。

### P2: 目标 `sources.yaml` 非法时静默回退默认配置
- 期望：已有目标配置文件但内容非法时应失败，避免覆盖既有配置。
- 实际：`readTargetSourceConfig` 走 `DEFAULT_SIGNAL_SOURCES` fallback，后续 `saveSignalSources` 可能写回默认 + incoming，造成配置被覆盖。

## 3) 根因分析
- P1 根因：`runMigrateSignalsCli` 在解析参数后直接进入迁移流程，没有验证 `legacyRoot` 的存在与目录属性。
- P2 根因：`loadBaseConfig` 对 schema 校验失败使用默认配置兜底，错误路径被吞掉，调用者无法感知目标配置损坏。

## 4) 修复方案
- P1：新增 `assertLegacyRootDir(legacyRoot)`，在迁移开始前验证路径存在且为目录；不满足条件时抛错并由 CLI 统一返回 code 1。
- P2：`loadBaseConfig` 改为严格解析：
  - YAML 解析异常直接抛错；
  - Schema 校验失败拼接 issue detail 抛错；
  - 仅在“文件缺失/空内容”场景使用 `DEFAULT_SIGNAL_SOURCES`。

Tradeoff:
- P1 可进一步校验 `config/sources.yaml` 与 `library` 子路径完整性，但这会把“部分迁移/增量迁移”场景也判定为硬失败；本轮按 cloud 要求先修 `--from` 根路径真实性。
- P2 也可在 CLI 层做“检测非法后 auto-backup 再修复”流程，但复杂度高且行为更激进；本轮先 fail-fast 防止无感覆盖。

## 5) 验证方式
- Red → Green：
  - `packages/api/test/signal-migrate-script.test.js`
    - 新增 `fails fast when --from path does not exist`，Red(0!=1) → Green。
  - `packages/api/test/signal-source-migration.test.js`
    - 新增 `throws when existing target sources.yaml is invalid`，Red(未抛错) → Green。
- 命令验证：
  - `pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-migrate-script.test.js test/signal-source-migration.test.js` (12/12 pass)
  - `pnpm -r --if-present run build` (pass)
