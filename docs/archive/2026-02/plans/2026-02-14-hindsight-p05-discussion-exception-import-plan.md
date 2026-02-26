---
feature_ids: []
topics: [hindsight, p05, exception]
doc_kind: plan
created: 2026-02-14
---

# Hindsight Discussion 例外导入（#67）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不放开全量 `docs/discussions/**` 导入的前提下，落地 `hindsight: include` 白名单机制，并把例外导入打上 quarantined 标签且写审计事件。

**Architecture:** 复用现有 P0 importer/CLI，不新增独立管道。导入源发现阶段负责“是否允许导入”的准入判定；导入构建阶段负责 tags/metadata 生命周期标注；CLI 在 retain 成功后追加审计事件。默认 evidence 搜索不改，靠 `origin:discussion + visibility:quarantined` 让例外内容默认不可见。

**Tech Stack:** TypeScript、Fastify API 包、Node test runner、Hindsight P0 importer。

---

## Scope / Boundary

### In scope
- `docs/discussions/**/*.md` 仅在 frontmatter 存在 `hindsight: include` 时允许导入。
- discussion 例外导入时强制标签：
  - `kind:discussion`
  - `status:draft`
  - `origin:discussion`
  - `visibility:quarantined`
- CLI 导入后写审计事件（仅非 dry-run）。

### Out of scope
- 不实现 #71-full（fail-closed / auto re-import trigger）。
- 不实现 #69 周评测流水线。
- 不调整默认 evidence tags（仍保持现状）。

---

## Task 1: Frontmatter 准入解析（TDD）

**Files:**
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-markdown-parser.ts`
- Create: `packages/api/test/hindsight-import/p0-markdown-parser.test.js`

**Step 1: Write failing tests**
- 断言 `hindsight: include` 返回 true。
- 断言无 frontmatter / frontmatter 不含 include 返回 false。
- 断言 strip frontmatter 后正文不含 YAML 头。

**Step 2: Run tests (Red)**
Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import/p0-markdown-parser.test.js
```
Expected: FAIL（函数不存在）。

**Step 3: Implement minimal parser**
- 新增 `hasHindsightIncludeDirective(content)`。
- 新增 `stripMarkdownFrontmatter(content)`。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

## Task 2: Source Discovery 白名单（TDD）

**Files:**
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-contract.ts`
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-source-discovery.ts`
- Modify: `packages/api/test/hindsight-import/p0-contract.test.js`
- Modify: `packages/api/test/hindsight-import/p0-source-discovery.test.js`

**Step 1: Write failing tests**
- tracked discussion + include => `collectP0ImportSources` 包含该文件。
- tracked discussion 无 include => 不包含。
- `--source` 指向 discussion 且无 include => 抛错。
- discussion 导入 kind/status 语义可导出（`kind:discussion`,`status:draft`）。

**Step 2: Run tests (Red)**
Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import/p0-source-discovery.test.js packages/api/test/hindsight-import/p0-contract.test.js
```
Expected: FAIL。

**Step 3: Implement minimal discovery rules**
- `isP0AllowedSourcePath` 增加 discussion 路径。
- `collectP0ImportSources` 在 `--all` 时扫描 `docs/discussions`，仅保留 include 文件。
- `--source` 指向 discussion 时强制 include 校验。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

## Task 3: Import Lifecycle Tags + Audit（TDD）

**Files:**
- Modify: `packages/api/src/domains/cats/services/hindsight-import/p0-importer.ts`
- Modify: `packages/api/src/scripts/hindsight-import-p0.ts`
- Modify: `packages/api/test/hindsight-import-p0.test.js`

**Step 1: Write failing tests**
- discussion import items 必须含：
  - `kind:discussion`
  - `status:draft`
  - `origin:discussion`
  - `visibility:quarantined`
- discussion 内容写入时不包含 frontmatter。

**Step 2: Run tests (Red)**
Run:
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/hindsight-import-p0.test.js
```
Expected: FAIL。

**Step 3: Implement minimal tagging + audit**
- importer 根据 `sourcePath` 注入 discussion 专属 lifecycle tags。
- discussion 导入正文使用 strip 后内容。
- CLI retain 成功后写 `hindsight_discussion_exception_imported` 审计事件（非 dry-run）。

**Step 4: Run tests (Green)**
执行同一命令，应 PASS。

---

## Task 4: Verification + Docs + Commit

**Files:**
- Modify: `docs/BACKLOG.md`
- Create: `docs/mailbox/2026-02-14-h67-discussion-exception-review-request-to-opus.md`

**Step 1: Full verification**
Run:
```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api test
```
Expected: 0 fail。

**Step 2: Update tracking docs**
- `docs/BACKLOG.md`：#67 改为 `[~]` 或 `[x]`（按实现完成度）。

**Step 3: Write review request (五件套)**
- 写给宪宪的 review 信，附 Red→Green 证据。

**Step 4: Commit**
```bash
git add <changed-files>
git commit -m "feat(api): implement #67 discussion exception import [缅因猫🐾]" -m "Why: enforce explicit include whitelist for discussion import while keeping quarantined lifecycle and audit traceability."
```

---

## DoD / Acceptance

1. `--all` 仅导入带 `hindsight: include` 的 discussion 文件。
2. discussion retain item 标签包含 `visibility:quarantined` 与 `origin:discussion`。
3. 非 dry-run 导入会落审计事件（事件类型固定，含 source list）。
4. `pnpm --filter @cat-cafe/api test` 全绿。
5. 已写 review 信并请求宪宪交叉复核。
