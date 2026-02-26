---
feature_ids: []
topics: [hindsight, lessons, import]
doc_kind: plan
created: 2026-02-13
---

# Hindsight P0 Lessons Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不引入过度工程的前提下，建立可验证的 Hindsight P0 导入基线：稳定导入白名单文档、强制治理标签、默认 strict evidence 检索、具备最小可观测告警。  

**Architecture:** 采用“Git 文档为事实源，Hindsight 为检索层”的单向同步。P0 只覆盖高信号来源（`docs/decisions/**`、`CLAUDE.md`、`AGENTS.md`、`docs/lessons-learned.md`），并在写入前做治理校验（必填 tags + metadata 锚点）。检索层默认使用 strict 过滤（`project:cat-cafe` + `origin:git`），避免无标签/草案内容污染默认 evidence。  

**Tech Stack:** TypeScript、Node.js、Fastify 路由、Hindsight HTTP API、pnpm、Node test runner。

---

### Task 1: 固化 P0 导入契约（schema + 白名单 + ID 规则）

**Files:**
- Create: `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
- Create: `packages/api/test/hindsight-import/p0-contract.test.js`
- Modify: `docs/decisions/005-hindsight-integration-decisions.md`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildP0DocumentId, validateP0Tags } from '../../dist/domains/cats/services/hindsight-import/p0-contract.js';

test('buildP0DocumentId derives stable ids for ADR paths', () => {
  assert.equal(buildP0DocumentId('docs/decisions/005-hindsight-integration-decisions.md'), 'adr:005');
});

test('validateP0Tags rejects missing required governance tags', () => {
  assert.throws(() => validateP0Tags(['project:cat-cafe']), /missing required tag: kind:/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api test -- test/hindsight-import/p0-contract.test.js
```

Expected: FAIL（模块不存在或断言失败）。

**Step 3: Write minimal implementation**

- 导出白名单源：
  - `docs/decisions/**`
  - `CLAUDE.md`
  - `AGENTS.md`
  - `docs/lessons-learned.md`
- 实现 ID 规则：
  - ADR：`adr:<number>`
  - 其他：`path:<normalizedPath>`（P0 fallback）
- 必填 tag 前缀：`project:`、`kind:`、`status:`、`author:`、`origin:`、`sourcePath:`、`sourceCommit:`、`anchor:`。
- `anchor` 派生规则（避免非 ADR 源歧义）：
  - ADR 文档：`anchor:adr:<number>#<heading-slug>`
  - `CLAUDE.md` / `AGENTS.md`：`anchor:section:<heading-slug>`
  - `docs/lessons-learned.md`：`anchor:ll:<id>`（如 `anchor:ll:018`）

**Step 4: Run test to verify it passes**

Run same test command, expect PASS.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts packages/api/test/hindsight-import/p0-contract.test.js docs/decisions/005-hindsight-integration-decisions.md
git commit -m "feat(api): define hindsight p0 import contract and id rules [缅因猫🐾]" -m "Why: 先锁导入契约，避免并行实现阶段出现标签漂移与ID不一致。"
```

---

### Task 2: 实现 P0 文档导入器（白名单 + 切片 + retain upsert）

**Files:**
- Create: `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
- Create: `packages/api/src/scripts/hindsight-import-p0.ts`
- Create: `packages/api/test/hindsight-import-p0.test.js`
- Modify: `packages/api/package.json`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportItemsFromMarkdown } from '../dist/domains/cats/services/hindsight-import/p0-importer.js';

test('buildImportItemsFromMarkdown emits retain items with required tags', () => {
  const items = buildImportItemsFromMarkdown({
    sourcePath: 'docs/decisions/005-hindsight-integration-decisions.md',
    sourceCommit: 'abc1234',
    content: '# ADR-005\n\nDecision text',
    author: 'codex'
  });
  assert.ok(items.length > 0);
  assert.ok(items[0].tags.some((t) => t.startsWith('project:cat-cafe')));
  assert.ok(items[0].tags.some((t) => t.startsWith('anchor:')));
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api test -- test/hindsight-import-p0.test.js
```

Expected: FAIL（导入器未实现）。

**Step 3: Write minimal implementation**

- 基于 Markdown 标题切片（至少保证每个一级/二级标题可独立成为 item）。
- `docs/lessons-learned.md` 仅导入 `### LL-\d{3}:` 条目；跳过模板/规则/维护段落（§1-4 与维护约定）。
- 每个 item 写入：`document_id`、`content`、`tags`、`metadata`（string 值）。
- 从条目正文提取 `来源锚点` 与 `关联` 字段，写入 metadata（至少保留 `sourceAnchors`、`related`）。
- `sourceCommit` 从 git HEAD 读取。
- 复用现有 `createHindsightClient()` + `client.retain()`，不要重复封装 HTTP retain 调用。
- CLI 脚本支持：
  - `--dry-run`
  - `--source <path>`（单文件）
  - `--all`（白名单全量）

**Step 4: Run test to verify it passes**

Run same test command, expect PASS.

**Step 5: Commit**

```bash
git add packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts packages/api/src/scripts/hindsight-import-p0.ts packages/api/test/hindsight-import-p0.test.js packages/api/package.json
git commit -m "feat(api): add hindsight p0 doc importer and cli entry [缅因猫🐾]" -m "Why: 把P0导入从手工调用变为可重复执行流程，降低漏导与格式不一致风险。"
```

---

### Task 3: 收紧 evidence 默认检索策略（strict + origin:git）

**Files:**
- Modify: `packages/api/src/routes/evidence-helpers.ts`
- Modify: `packages/api/src/routes/evidence.ts`
- Modify: `packages/api/src/routes/callback-memory-routes.ts`
- Modify: `packages/api/src/config/hindsight-runtime-config.ts`
- Modify: `packages/api/test/evidence-route.test.js`
- Modify: `packages/api/test/callback-routes.test.js`

**Step 1: Write the failing test**

- 断言 `/api/evidence/search` 未传 tags 时默认包含 `project:cat-cafe` 与 `origin:git`。
- 断言 callback search-evidence 未传 tags 时也注入同样默认 tags。
- 断言默认 `tagsMatch` 由 runtime config 提供且为 `all_strict`（不在路由层硬编码）。

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @cat-cafe/api test -- test/evidence-route.test.js
pnpm --filter @cat-cafe/api test -- test/callback-routes.test.js
```

Expected: FAIL（默认过滤尚未收紧）。

**Step 3: Write minimal implementation（明确采用 A+B）**

- A：在 `normalizeTags()`（`evidence-helpers.ts` + callback 路由内部同名 helper）注入默认 tags：`project:cat-cafe` 与 `origin:git`。
- A：保持允许用户显式扩展 tags，但不得移除 `project:cat-cafe`。
- B：`tagsMatch` 默认值保持由 `hindsight-runtime-config.ts` 管理（`all_strict`），路由层仅读取配置，不硬编码。
- 在 degraded 场景下保持原有降级消息语义。

**Step 4: Run test to verify it passes**

Run same tests, expect PASS.

**Step 5: Commit**

```bash
git add packages/api/src/routes/evidence-helpers.ts packages/api/src/routes/evidence.ts packages/api/src/routes/callback-memory-routes.ts packages/api/src/config/hindsight-runtime-config.ts packages/api/test/evidence-route.test.js packages/api/test/callback-routes.test.js
git commit -m "feat(api): enforce strict evidence defaults for hindsight recall [缅因猫🐾]" -m "Why: 默认检索必须屏蔽无标签噪音，先保证 evidence 结果可治理可审计。"
```

---

### Task 4: 建立 P0 可观测检查（stats/tags/version 三件套）

**Files:**
- Create: `scripts/hindsight/p0-health-check.sh`
- Create: `docs/runbooks/hindsight-p0-health-check.md`
- Modify: `docs/lessons-learned.md`

**Step 1: Write the failing test**

- 用 shellcheck 或最小断言脚本验证：
  - 当 `tags.total == 0` 时返回非 0。
  - 当 `stats.total_nodes == 0` 时返回非 0。

**Step 2: Run test to verify it fails**

Run:

```bash
bash scripts/hindsight/p0-health-check.sh --self-test
```

Expected: FAIL（脚本未实现）。

**Step 3: Write minimal implementation**

- 检查端点：
  - `/v1/default/banks/cat-cafe-shared/stats`
  - `/v1/default/banks/cat-cafe-shared/tags`
  - `/version`
- 输出统一摘要（PASS/WARN/FAIL + reason）。

**Step 4: Run test to verify it passes**

Run same command, expect PASS。

**Step 5: Commit**

```bash
git add scripts/hindsight/p0-health-check.sh docs/runbooks/hindsight-p0-health-check.md docs/lessons-learned.md
git commit -m "chore(obs): add hindsight p0 health checks and runbook [缅因猫🐾]" -m "Why: P0 需要最小可观测基线，防止无标签或空库状态无声退化。"
```

---

### Task 5: 验收与 P0/P0.5 边界固化

**Files:**
- Modify: `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`
- Modify: `docs/BACKLOG.md`
- Modify: `docs/decisions/005-hindsight-integration-decisions.md`

**Step 1: Run full verification**

```bash
pnpm -r --if-present run build
pnpm --filter @cat-cafe/api test
bash scripts/hindsight/p0-health-check.sh
```

Expected:
- 测试全绿
- `tags.total > 0`
- `stats.total_nodes > 0`

**Step 2: Verify acceptance gates**

- 前置条件：完成 lessons 交叉复核，`validated` 条目数达到门槛后再执行本步骤。
- 导入覆盖：白名单源均有对应 document（抽样验证）。
- 标签合规：抽样 item 均含必填 tag 前缀。
- 检索合规：默认 evidence 请求为 strict + git-origin 过滤。

**Step 3: Write delivery notes**

- 明确 P0 已完成项与 P0.5 延后项：
  - P0.5：discussion 例外机制、历史 ADR 全量否决理由回填、自动化周评测。

**Step 4: Commit**

```bash
git add docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md docs/BACKLOG.md docs/decisions/005-hindsight-integration-decisions.md
git commit -m "docs(p0): record hindsight lessons import acceptance and boundaries [缅因猫🐾]" -m "Why: 把P0交付边界写死，防止后续把P0与P0.5混在一起造成范围漂移。"
```

---

## P0 验收门槛（执行后状态）

1. ✅ `docs/lessons-learned.md` 已建并在交叉复核完成后包含 validated 条目（>= 12）。
2. ✅ Hindsight `cat-cafe-shared` 的 `tags.total > 0`（2026-02-13 实测 `tags.total=23`）。
3. ✅ 默认 evidence 检索为 `tagsMatch=all_strict`，且含 `project:cat-cafe` + `origin:git`。
4. ✅ 可观测脚本可报告 stats/tags/version 三项状态（`version` 缺失按 WARN，不阻断）。
5. ✅ P0/P0.5 边界在计划与 ADR 中均有明确文字。

---

## P0.5 延后项（明确不在 P0）

1. discussion 例外导入机制（白名单标记 + quarantined 生命周期）。
2. ADR 历史“否决理由”全量回填。
3. 自动化周评测（precision@k/latency/noise/staleness）完整流水线。

---

## 执行快照（2026-02-13）

### Task 4 落地结果

- 新增 `scripts/hindsight/p0-health-check.sh`（`stats/tags/version` 三件套 + `--self-test`）。
- 新增 `docs/runbooks/hindsight-p0-health-check.md` 运行手册。
- `docs/lessons-learned.md` 新增 `LL-022`（治理基线必须脚本化）。

### Task 5 验证结果

- `pnpm -r --if-present run build`：⚠️ 未全绿（`packages/web` 存在既有 lint/type 阻塞，见 BACKLOG #70）。
- `pnpm --filter @cat-cafe/api test`：✅ `984 pass / 0 fail / 1 skip`。
- `bash scripts/hindsight/p0-health-check.sh`：✅ 通过（`stats.total_nodes=66`，`tags.total=23`，`/version` 返回 WARN）。

### 执行中发现并修复的 P0 导入器风险

- 导入源枚举改为 **只读取 git-tracked 决策文档**，避免未提交文件误入库。
- 新增 `document_id` 冲突检测（如双 `009-*.md`）并在导入前 fail-fast。
- retain 改为 `async=true`，避免同步写入超时导致导入中断。
