---
feature_ids: [F102]
topics: [materialization, knowledge-feed, marker, truth-source]
doc_kind: plan
created: 2026-04-01
---

# F102 Batch 1: IMaterializationService 终态 Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** `approved` marker 通过 `IMaterializationService.materialize()` 写入 `docs/*.md` 真相源，附带 git commit + reindex trigger + 冲突处理，完成知识沉淀的最后一跳。
**Acceptance Criteria:**
- AC-A11: IMaterializationService 实现 approved → .md patch → trigger reindex
- Batch 1 补充: git commit、冲突处理（文件已存在）、目录自动创建、reindex trigger
**Architecture:** MaterializationService 接受 IIndexBuilder 依赖注入，materialize() 写文件 → commit → incrementalUpdate。冲突时 append 唯一后缀而非覆盖。
**Tech Stack:** Node.js fs, child_process (git), existing IIndexBuilder/IMarkerQueue
**前端验证:** No — 纯后端服务

---

## Not Building

- MCP 工具暴露（后续 Phase，Batch 3 体验层）
- API endpoint（Knowledge Feed 已有 approve UI，materialize 作为内部服务调用）
- 自动 materialize-on-approve（需铲屎官确认触发策略后再做）

## Terminal Schema

```typescript
// Interface unchanged — only implementation evolves
interface IMaterializationService {
  materialize(markerId: string): Promise<MaterializeResult>;
  canMaterialize(markerId: string): Promise<boolean>;
}

interface MaterializeResult {
  markerId: string;
  outputPath: string;
  anchor: string;
  committed: boolean;   // NEW: whether git commit succeeded
  reindexed: boolean;   // NEW: whether incrementalUpdate succeeded
}
```

## Tasks

### Task 1: Expand MaterializeResult + interface

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts` (MaterializeResult)
- Test: `packages/api/test/memory/materialization-service.test.js`

**Step 1: RED** — Add test for `committed` and `reindexed` fields in result

```javascript
it('materialize returns committed and reindexed status', async () => {
  const marker = await queue.submit({ content: 'Test', source: 'opus:t1', status: 'captured', targetKind: 'lesson' });
  await queue.transition(marker.id, 'approved');
  const result = await service.materialize(marker.id);
  assert.equal(typeof result.committed, 'boolean');
  assert.equal(typeof result.reindexed, 'boolean');
});
```

**Step 2: GREEN** — Add fields to MaterializeResult interface + return them from materialize()

**Step 3: Commit** — `feat(F102): expand MaterializeResult with committed/reindexed`

### Task 2: Directory auto-creation + conflict handling

**Files:**
- Modify: `packages/api/src/domains/memory/MaterializationService.ts`
- Test: `packages/api/test/memory/materialization-service.test.js`

**Step 1: RED** — Two tests:
1. materialize creates missing subdirectory (e.g. `docs/research/` doesn't exist)
2. materialize handles file-exists conflict (appends `-2` suffix)

```javascript
it('creates missing subdirectory', async () => {
  // Don't pre-create docs/research/ — let service do it
  const marker = await queue.submit({ content: 'Research note', source: 'opus:t1', status: 'captured', targetKind: 'research' });
  await queue.transition(marker.id, 'approved');
  const result = await service.materialize(marker.id);
  assert.ok(existsSync(result.outputPath));
});

it('handles file-exists conflict with unique suffix', async () => {
  const marker = await queue.submit({ content: 'First', source: 'opus:t1', status: 'captured', targetKind: 'lesson' });
  await queue.transition(marker.id, 'approved');
  const r1 = await service.materialize(marker.id);

  // Create another marker that would map to same path
  const marker2 = await queue.submit({ content: 'Second', source: 'opus:t2', status: 'captured', targetKind: 'lesson' });
  await queue.transition(marker2.id, 'approved');
  // Manually write a file at the expected path to simulate conflict
  writeFileSync(join(docsDir, 'lessons', `lesson-${marker2.id}.md`), 'existing');
  const r2 = await service.materialize(marker2.id);
  assert.notEqual(r1.outputPath, r2.outputPath);
  assert.ok(existsSync(r2.outputPath));
});
```

**Step 2: GREEN** — Add `mkdirSync(dirname, { recursive: true })` + existsSync check with `-{n}` suffix

**Step 3: Commit** — `feat(F102): materialization mkdir + conflict handling`

### Task 3: Git commit after write

**Files:**
- Modify: `packages/api/src/domains/memory/MaterializationService.ts`
- Test: `packages/api/test/memory/materialization-service.test.js`

**Step 1: RED** — Test that materialize() runs git add + commit

```javascript
it('commits the materialized file to git', async () => {
  // Init a git repo in tmpDir
  execSync('git init && git add -A && git commit -m "init"', { cwd: tmpDir });
  const marker = await queue.submit({ content: 'Committed lesson', source: 'opus:t1', status: 'captured', targetKind: 'lesson' });
  await queue.transition(marker.id, 'approved');
  const result = await service.materialize(marker.id);
  assert.equal(result.committed, true);
  // Verify git log contains the commit
  const log = execSync('git log --oneline -1', { cwd: tmpDir }).toString();
  assert.ok(log.includes('materialize'));
});
```

**Step 2: GREEN** — Add `execSync('git add ... && git commit ...')` wrapped in try/catch (committed=false on failure, not throw)

**Step 3: Commit** — `feat(F102): materialization git commit`

### Task 4: Reindex trigger via IIndexBuilder

**Files:**
- Modify: `packages/api/src/domains/memory/MaterializationService.ts` (constructor accepts optional IIndexBuilder)
- Modify: `packages/api/src/domains/memory/factory.ts` (pass indexBuilder to MaterializationService)
- Test: `packages/api/test/memory/materialization-service.test.js`

**Step 1: RED** — Test with mock IIndexBuilder

```javascript
it('triggers incrementalUpdate after writing file', async () => {
  let reindexedPaths = [];
  const mockIndexBuilder = { incrementalUpdate: async (paths) => { reindexedPaths = paths; } };
  const svcWithIndex = new MaterializationService(queue, docsDir, mockIndexBuilder);
  const marker = await queue.submit({ content: 'Reindexed', source: 'opus:t1', status: 'captured', targetKind: 'lesson' });
  await queue.transition(marker.id, 'approved');
  const result = await svcWithIndex.materialize(marker.id);
  assert.equal(result.reindexed, true);
  assert.equal(reindexedPaths.length, 1);
  assert.ok(reindexedPaths[0].includes('lesson'));
});
```

**Step 2: GREEN** — Add optional `indexBuilder` param to constructor, call `incrementalUpdate([outputPath])` after commit

**Step 3: Update factory.ts** — Pass `indexBuilder` to `MaterializationService` constructor

**Step 4: Commit** — `feat(F102): materialization reindex trigger via IIndexBuilder`

### Task 5: Knowledge Feed approve → materialize integration

**Files:**
- Modify: `packages/api/src/routes/knowledge-feed.ts` (approve endpoint calls materialize)
- Test: `packages/api/test/knowledge-feed-materialize.test.js` (new)

**Step 1: RED** — Test that POST /api/knowledge/approve triggers materialize

**Step 2: GREEN** — In approve handler, after transition to 'approved', call `materializationService.materialize(markerId)`

**Step 3: Commit** — `feat(F102): auto-materialize on Knowledge Feed approve`

### Task 6: Full integration test

**Files:**
- Test: `packages/api/test/memory/materialization-service.test.js` (add integration describe block)

**Step 1** — End-to-end: submit marker → approve → materialize → verify .md exists + marker=materialized + reindexed

**Step 2: Commit** — `test(F102): materialization e2e integration test`

## Verification

```bash
node --test packages/api/test/memory/materialization-service.test.js  # all pass
node --test packages/api/test/knowledge-feed-materialize.test.js      # approve→materialize
pnpm gate                                                              # full gate
```
