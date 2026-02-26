---
feature_ids: []
topics: [hindsight, pre69, data]
doc_kind: plan
created: 2026-02-14
---

# Hindsight Pre-#69 Data Quality + Weekly Eval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 先完成 Hindsight 数据质量收敛（清理历史散点 + 收紧导入切片），再在干净基线上落地 `#69` 周评测流水线。

**Architecture:** 采用“两阶段 gate + 一阶段评测”顺序。阶段 A 清理历史 UUID 散点文档并保留快照；阶段 B 收紧 P0 importer（按文档类型白名单 + 最小 chunk 长度阈值）；阶段 C 在新基线上实现并运行 `#69` weekly eval。任何阶段未通过 DoD，不进入下一阶段。

**Tech Stack:** TypeScript、Fastify API package、Hindsight HTTP API、Node test runner、bash health scripts。

---

## Scope & Order

1. **Phase A (`#69` 前置 Gate 1):** 清理历史 UUID 散点文档（先快照，后批删）
2. **Phase B (`#69` 前置 Gate 2):** 收紧 P0 导入切片质量（白名单 + min chunk length）
3. **Phase C (`#69`):** 周评测流水线（precision/noise/staleness/latency）

---

### Task 1: 建立清理前快照与 dry-run 清单（Gate 1）

**Files:**
- Create: `packages/api/src/scripts/hindsight-prune-legacy-docs.ts`
- Create: `packages/api/test/hindsight-prune-legacy-docs.test.js`
- Modify: `packages/api/package.json`

**Step 1: 写失败测试（分类 + dry-run 输出）**

- 目标：给定 documents list，正确区分：
  - `governed`: `adr:*`（后续可扩展）
  - `legacy`: UUID 且非治理前缀
- 失败断言：legacy 计数不对、dry-run 未输出待删 ID。

**Step 2: 跑测试验证 Red**

Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-prune-legacy-docs.test.js
```
Expected: FAIL（分类函数或 dry-run 行为未实现）。

**Step 3: 实现最小可用脚本**

- 支持参数：
  - `--base-url`（默认 `http://localhost:8888`）
  - `--bank`（默认 `cat-cafe-shared`）
  - `--snapshot-out`（必填，JSON）
  - `--dry-run`（默认 true）
  - `--delete`（显式开启删除）
- 行为：
  - 拉取 documents 全量列表；
  - 写入快照（原始 JSON + 统计）；
  - dry-run 打印候选删除 ID，不做删除。

**Step 4: 跑测试验证 Green**

Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-prune-legacy-docs.test.js
```
Expected: PASS。

**Step 5: commit**

```bash
git add packages/api/src/scripts/hindsight-prune-legacy-docs.ts packages/api/test/hindsight-prune-legacy-docs.test.js packages/api/package.json
git commit -m "feat(api): add legacy hindsight docs prune dry-run script [缅因猫🐾]" -m "Why: #69 前必须先隔离历史散点文档，避免脏基线评测。"
```

---

### Task 2: 批量删除 legacy UUID 文档 + 验证（Gate 1）

**Files:**
- Modify: `packages/api/src/scripts/hindsight-prune-legacy-docs.ts`
- Modify: `scripts/hindsight/p0-health-check.sh`（仅补充可选统计输出，不改失败门槛）

**Step 1: 写失败测试（delete 模式）**

- 断言：`--delete` 模式下会调用 `delete_document`；
- 断言：仅删除 legacy UUID，不删除 `adr:*`。

**Step 2: 跑测试验证 Red**

Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-prune-legacy-docs.test.js
```
Expected: FAIL（未实现 delete 或筛选错误）。

**Step 3: 实现批删与结果摘要**

- 对每个候选 ID 调用 Hindsight 删除；
- 输出统计：`total`, `governed`, `legacy`, `deleted`, `failed`；
- 删除后可再次 fetch 进行一致性核验（legacy 应下降）。

**Step 4: 线上执行（先 dry-run，再 delete）**

Run:
```bash
pnpm --filter @cat-cafe/api exec tsx src/scripts/hindsight-prune-legacy-docs.ts --snapshot-out tmp/hindsight-pre-prune.json --dry-run
pnpm --filter @cat-cafe/api exec tsx src/scripts/hindsight-prune-legacy-docs.ts --snapshot-out tmp/hindsight-pre-prune.json --delete
bash scripts/hindsight/p0-health-check.sh
```
Expected: health-check PASS，legacy UUID 文档显著减少。

**Step 5: commit**

```bash
git add packages/api/src/scripts/hindsight-prune-legacy-docs.ts scripts/hindsight/p0-health-check.sh packages/api/test/hindsight-prune-legacy-docs.test.js
git commit -m "chore(hindsight): prune legacy uuid documents with snapshot guard [缅因猫🐾]" -m "Why: 先清理历史散点，建立 #69 可评测的干净基线。"
```

---

### Task 3: 收紧 P0 importer 切片质量（Gate 2）

**Files:**
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
- Create: `packages/api/test/hindsight-import/p0-importer-filtering.test.js`

**Step 1: 写失败测试（白名单 + min length）**

- ADR 白名单段应保留（中英别名可配置）：
  - Context/背景
  - Decision/决策
  - Tradeoff/权衡
  - Rejected Alternatives/否决理由
  - Consequences/后果
  - 以及 ADR-008 类结构化高价值段（`D1..D5`）
- 非白名单段（如 参考/状态/日期/参与者/修订记录）默认跳过；
- `minChunkContentLength` 默认阈值（建议 `100`）；
- 命中高价值标题可豁免最小长度阈值。

**Step 2: 跑测试验证 Red**

Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import/p0-importer-filtering.test.js
```
Expected: FAIL（现有实现全量 H2 导入）。

**Step 3: 实现过滤层**

- 在 importer 中新增 `shouldImportSection()`；
- 使用“按文档类型白名单”的判定，不走黑名单排除；
- 应用 `minChunkContentLength` 作为第二道 gate；
- 保留可配置性（后续 `#69` 可统计 skip ratio）。

**Step 4: 跑回归验证 Green**

Run:
```bash
pnpm --filter @cat-cafe/api test
```
Expected: PASS（无回归）。

**Step 5: commit**

```bash
git add packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts packages/api/test/hindsight-import/p0-importer-filtering.test.js
git commit -m "feat(api): tighten p0 importer with whitelist section filter [缅因猫🐾]" -m "Why: 防止低价值 H2 段污染 world facts，提升 recall 信噪比。"
```

---

### Task 4: 重导 + Sanity Gate（进入 #69 前必须通过）

**Files:**
- Create: `scripts/hindsight/p0-sanity-check.sh`
- Modify: `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`（补后置 sanity 命令）

**Step 1: 写脚本检查项**

- 检查：
  - document ID 构成（`adr:*` / uuid 数）
  - 平均 chunk 文本长度
  - `pending_operations` / `failed_operations`
  - tags 总量与 `project:cat-cafe` 存在性

**Step 2: 执行重导与校验**

Run:
```bash
pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all
bash scripts/hindsight/p0-health-check.sh
bash scripts/hindsight/p0-sanity-check.sh
```
Expected: PASS；达到“可进入 #69”的基线。

**Step 3: commit**

```bash
git add scripts/hindsight/p0-sanity-check.sh docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md
git commit -m "chore(hindsight): add post-import sanity gate before #69 [缅因猫🐾]" -m "Why: 每次全量导入后必须有统一质量门禁，避免脏数据回流。"
```

---

### Task 5: 落地 #69 周评测流水线

**Files:**
- Create: `packages/api/src/scripts/hindsight-weekly-eval.ts`
- Create: `packages/api/test/hindsight-weekly-eval.test.js`
- Create: `docs/operations/hindsight-weekly-eval-runbook.md`
- Modify: `packages/api/package.json`
- Modify: `docs/BACKLOG.md`

**Step 1: 写失败测试（指标口径）**

- 指标最小集：
  - `evidence_hit_rate`
  - `no_evidence_answer_rate`
  - `staleness_rate`
  - `recall_p50/p95`
- 断言计算口径与样本数据一致。

**Step 2: 实现评测脚本**

- 读取固定 query 集（repo 内 JSON）；
- 调 evidence route 执行评测；
- 输出 JSON + markdown 报告（含阈值判断）。

**Step 3: 运行首轮基线**

Run:
```bash
pnpm --filter @cat-cafe/api exec tsx src/scripts/hindsight-weekly-eval.ts --out tmp/hindsight-weekly-eval.json
```
Expected: 报告生成，阈值状态明确。

**Step 4: 文档与状态更新**

- runbook 写明：何时运行、失败怎么排障、如何触发重导；
- `BACKLOG #69` 更新为 `[~]` 或 `[x]`（按 DoD）。

**Step 5: commit**

```bash
git add packages/api/src/scripts/hindsight-weekly-eval.ts packages/api/test/hindsight-weekly-eval.test.js docs/operations/hindsight-weekly-eval-runbook.md packages/api/package.json docs/BACKLOG.md
git commit -m "feat(api): implement #69 hindsight weekly eval pipeline [缅因猫🐾]" -m "Why: 用可重复指标持续监控 recall 质量与过期风险。"
```

---

## DoD

1. 历史 legacy UUID 文档已快照并批量清理，治理文档保留。
2. P0 importer 已实现白名单切片 + `minChunkContentLength` 过滤。
3. 重导后通过 `p0-health-check` 与 `p0-sanity-check`。
4. `#69` 周评测脚本可产出稳定报告，指标定义固定。
5. 文档与 backlog 状态同步更新，便于交叉 review。

## Non-Goals

1. 不改 `#71-full` 的 fail-closed 行为定义。
2. 不引入新的 Hindsight bank 或多 bank 架构。
3. 不在本轮改 Recall API 协议，仅做导入与评测治理。
