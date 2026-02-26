---
feature_ids: []
topics: [hindsight, hygiene, implementation]
doc_kind: plan
created: 2026-02-14
---

# Hindsight Hygiene Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清理 Hindsight P0 导入噪音：仅导入高价值 ADR 段落，添加最小内容长度保护（120），并提供 UUID 文档批量清理与重导后健康检查。

**Architecture:** 在 importer 层新增两道过滤（H2 白名单 + 内容长度阈值），让无效段默认不入库；在脚本层补充“先快照后删除”的 UUID 批量清理流程与导入后 health report，形成可重复运行的 hygiene pipeline。

**Tech Stack:** TypeScript、Node.js、bash、pnpm、Node test runner。

---

### Task 1: 为 H2 白名单和最小长度写 Red 用例

**Files:**
- Modify: `packages/api/test/hindsight-import-p0.test.js`
- Modify: `packages/api/test/hindsight-import/p0-markdown-parser.test.js`

**Step 1: Write failing tests**
- 断言 ADR 中 `## 参考/状态/日期` 不被导入。
- 断言白名单标题但正文长度 < 120 的 section 被跳过。

**Step 2: Verify red**
- Run: `pnpm --filter @cat-cafe/api test -- test/hindsight-import-p0.test.js test/hindsight-import/p0-markdown-parser.test.js`
- Expected: FAIL（当前实现会导入全部 H2 且无长度限制）。

### Task 2: 实现 importer 过滤并转绿

**Files:**
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-markdown-parser.ts`
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`

**Step 1: Minimal implementation**
- 新增 ADR 高价值 H2 白名单（中英别名）。
- 新增 `minChunkContentLength=120` 过滤。
- 保持 lessons/discussion 现有行为不回归。

**Step 2: Verify green**
- Run 同 Task 1 命令，预期 PASS。
- 补跑：`pnpm --filter @cat-cafe/api test -- test/hindsight-import-p0.test.js`

### Task 3: 加 UUID 文档批量清理脚本（先快照后删）

**Files:**
- Create: `packages/api/src/scripts/hindsight-clean-uuid-docs.ts`
- Modify: `packages/api/package.json`
- Create/Modify: `packages/api/test/hindsight-clean-uuid-docs.test.js`（如需）

**Step 1: Behavior**
- 列出 document IDs。
- 筛选非 `adr:*` 且非治理前缀的 UUID ID。
- 删除前导出快照。
- 支持 `--dry-run`、`--yes` 保护。

**Step 2: Verify**
- 先跑 dry-run。
- 再跑脚本自测或单测。

### Task 4: 添加重导后快速健康检查

**Files:**
- Create: `packages/api/src/scripts/hindsight-doc-health-report.ts`
- Modify: `packages/api/package.json`
- Modify: `docs/runbooks/hindsight-p0-health-check.md`

**Step 1: Output**
- 输出 document IDs 总数、chunk 总数、平均内容长度。
- 按文档输出 chunk 数与平均长度，支持排序与阈值告警。

**Step 2: Verify**
- 运行脚本（可 dry-run/mock），确认输出结构稳定。

### Task 5: 全量验证与提交

**Step 1: Verification commands**
- `pnpm --filter @cat-cafe/api test -- test/hindsight-import/p0-markdown-parser.test.js test/hindsight-import-p0.test.js`
- `pnpm --filter @cat-cafe/api test`
- `pnpm -r build`

**Step 2: Commit**
- 单个语义清晰提交，message 包含 `[缅因猫🐾]`，body 含 `Why:`。
