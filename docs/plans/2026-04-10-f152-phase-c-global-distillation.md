---
feature_ids: [F152]
topics: [memory, distillation, global-knowledge, cross-project]
doc_kind: plan
created: 2026-04-10
---

# F152 Phase C: Global Lesson Distillation — Implementation Plan

**Feature:** F152 — `docs/features/F152-expedition-memory.md`
**Goal:** 猫在外部项目产生的 lesson/decision，可泛化的经验经审核后回流到全局知识层，下次去别的项目能用上。
**Acceptance Criteria:**
- AC-C1: 外部项目的 lesson/decision 可以被标记 `generalizable: true/false`
- AC-C2: 默认 `generalizable: false`（fail-closed）
- AC-C3: `generalizable: true` 的 candidate 走审核流程后才能写入 `global_knowledge.sqlite`
- AC-C4: 回流内容自动脱敏（移除项目私有标识）
- AC-C5: 铲屎官亲手体验一轮完整的"出征→冷启动→干活→经验回流"链路
**Architecture:** 在 EvidenceItem 上扩展 `generalizable` 标记字段 → 新增 DistillationService 管理候选队列 → 审核 API（approve/reject）→ 脱敏管线 → GlobalIndexBuilder 扩展 upsert 到全局层。双层审核路由（KD-11）：事实型猫猫可审，判断型上升铲屎官。
**Tech Stack:** SQLite (evidence.sqlite + global_knowledge.sqlite), Fastify API, TypeScript
**前端验证:** No（Phase C 纯后端 + API，无前端 UI）

---

## What We're NOT Building

- LLM 自动判定泛化性（先人工/猫猫标记）
- 跨项目自动推送通知
- NER 级脱敏（先 regex pattern 替换项目名/路径/URL）
- 前端审核 UI（先用 API + 猫猫 MCP 工具）

## Terminal Schema

```typescript
// 扩展 EvidenceItem（interfaces.ts）
interface EvidenceItem {
  // ... existing fields ...
  generalizable?: boolean;        // AC-C1: null = 未标记, false = 项目私有, true = 候选
}

// 新增：脱敏结果
interface DeidentifiedEvidence {
  original: EvidenceItem;
  sanitizedTitle: string;
  sanitizedSummary: string;
  sanitizedKeywords: string[];
  removedPatterns: string[];      // 被脱敏的内容（审计用）
}

// 新增：候选队列条目
interface DistillationCandidate {
  id: string;                     // uuid
  projectPath: string;
  evidence: DeidentifiedEvidence;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;            // catId or 'user'
  reviewedAt?: string;
  createdAt: string;
}
```

## SQLite Schema Changes

```sql
-- evidence.sqlite: 加 generalizable 列
ALTER TABLE evidence_docs ADD COLUMN generalizable INTEGER DEFAULT NULL;
-- NULL = 未标记, 0 = false, 1 = true (AC-C2: fail-closed)

-- global_knowledge.sqlite: 加 distillation 候选表
CREATE TABLE IF NOT EXISTS distillation_candidates (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  original_anchor TEXT NOT NULL,
  sanitized_title TEXT NOT NULL,
  sanitized_summary TEXT NOT NULL,
  sanitized_keywords TEXT,         -- JSON array
  removed_patterns TEXT,           -- JSON array (审计)
  provenance_tier TEXT,
  provenance_source TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
```

---

## Task 1: Schema Extension — EvidenceItem + generalizable 字段

**Files:**
- Modify: `packages/api/src/domains/memory/interfaces.ts`
- Modify: `packages/api/src/domains/memory/sqlite-evidence-store.ts` (schema migration V12)
- Test: `packages/api/test/memory/sqlite-evidence-store.test.ts`

**Step 1:** Add `generalizable` to `EvidenceItem` interface (interfaces.ts)

**Step 2:** Write failing test — upsert an item with `generalizable: true`, query it back, verify field persists

**Step 3:** Add V12 migration in sqlite-evidence-store.ts: `ALTER TABLE evidence_docs ADD COLUMN generalizable INTEGER DEFAULT NULL`

**Step 4:** Update upsert/query methods to read/write `generalizable`

**Step 5:** Run test → GREEN

**Step 6:** Commit: `feat(F152): add generalizable field to EvidenceItem (AC-C1, AC-C2)`

---

## Task 2: Deidentification Service — 自动脱敏管线

**Files:**
- Create: `packages/api/src/domains/memory/deidentification-service.ts`
- Test: `packages/api/test/memory/deidentification-service.test.ts`

**Step 1:** Write failing tests:
- 项目路径替换为 `[PROJECT]`
- 绝对路径替换为相对路径占位
- URL 替换为 `[URL]`
- 用户名/人名 pattern 替换（configurable blocklist）
- 不改变技术术语和方法论内容

**Step 2:** Implement `DeidentificationService`:
```typescript
class DeidentificationService {
  constructor(private projectPath: string) {}

  sanitize(item: EvidenceItem): DeidentifiedEvidence {
    // regex-based pattern replacement
    // returns sanitized copy + list of removed patterns
  }
}
```

**Step 3:** Run tests → GREEN

**Step 4:** Commit: `feat(F152): add DeidentificationService for lesson reflow (AC-C4)`

---

## Task 3: DistillationService — 候选队列 + 审核流程

**Files:**
- Create: `packages/api/src/domains/memory/distillation-service.ts`
- Test: `packages/api/test/memory/distillation-service.test.ts`

**Step 1:** Write failing tests:
- `nominate(anchor, projectPath)` → 创建 pending candidate（脱敏后）
- `nominate` 对 `generalizable !== true` 的 item 抛错
- `approve(candidateId, reviewerId)` → status = approved, 写入全局层
- `reject(candidateId, reviewerId)` → status = rejected
- `listPending()` → 返回待审候选
- 重复提名同一 anchor → 幂等（不创建重复候选）

**Step 2:** Implement `DistillationService`:
```typescript
class DistillationService {
  constructor(
    private projectStore: IEvidenceStore,
    private globalStore: IEvidenceStore,
    private deidentifier: DeidentificationService,
  ) {}

  async nominate(anchor: string, projectPath: string): Promise<DistillationCandidate>
  async approve(candidateId: string, reviewerId: string): Promise<void>
  async reject(candidateId: string, reviewerId: string): Promise<void>
  async listPending(projectPath?: string): Promise<DistillationCandidate[]>
}
```

**Step 3:** Schema: `distillation_candidates` 表在全局 store 初始化时创建

**Step 4:** `approve()` 实现：从候选中提取脱敏内容 → 构造 EvidenceItem → upsert 到 global store

**Step 5:** Run tests → GREEN

**Step 6:** Commit: `feat(F152): add DistillationService — candidate queue + review flow (AC-C3)`

---

## Task 4: API Endpoints — 标记 + 提名 + 审核

**Files:**
- Create: `packages/api/src/routes/distillation-routes.ts`
- Modify: `packages/api/src/routes/index.ts` (register routes)
- Test: `packages/api/test/routes/distillation-routes.test.ts`

**Step 1:** Write failing tests for 4 endpoints:
- `PATCH /api/evidence/:anchor/generalizable` — 标记 generalizable (AC-C1)
- `POST /api/distillation/nominate` — 提名候选
- `POST /api/distillation/:id/review` — 审核（approve/reject）
- `GET /api/distillation/candidates` — 列出待审

**Step 2:** Implement routes, wire to DistillationService

**Step 3:** Run tests → GREEN

**Step 4:** Commit: `feat(F152): add distillation API endpoints`

---

## Task 5: MCP Tool — 猫猫可用的回流工具

**Files:**
- Modify: `packages/api/src/mcp/tools/memory-tools.ts` (or create distillation-tools.ts)
- Test: via existing MCP tool test pattern

**Step 1:** 新增 3 个 MCP 工具:
- `cat_cafe_mark_generalizable(anchor, generalizable)` — 标记
- `cat_cafe_nominate_for_global(anchor)` — 提名回流
- `cat_cafe_review_distillation(candidateId, decision, reason)` — 审核

**Step 2:** 注册到 MCP_TOOLS_SECTION（不让猫不知道有这个工具）

**Step 3:** Run tests → GREEN

**Step 4:** Commit: `feat(F152): add distillation MCP tools for cat-driven reflow (AC-C3)`

---

## Task 6: Integration — 串联 + 冒烟测试

**Files:**
- Test: `packages/api/test/memory/distillation-integration.test.ts`

**Step 1:** 端到端集成测试:
1. 创建一个 project evidence item (kind=lesson)
2. 标记 `generalizable: true`
3. 提名 → 验证脱敏后候选在 pending 列表
4. 审核 approve → 验证已写入全局层
5. 全局搜索 → 能找到回流的知识

**Step 2:** Run integration test → GREEN

**Step 3:** Commit: `test(F152): add distillation integration test`

---

## Verification

```bash
pnpm --filter @cat-cafe/api test                    # 全部通过
pnpm lint                                            # 0 errors
pnpm check                                           # 0 errors
pnpm -r --if-present run build                       # exit 0
```

## AC 覆盖映射

| AC | Task | 验证 |
|----|------|------|
| AC-C1 | Task 1 (schema) + Task 4 (API) + Task 5 (MCP) | 标记 generalizable |
| AC-C2 | Task 1 (DEFAULT NULL = fail-closed) | 默认不回流 |
| AC-C3 | Task 3 (DistillationService) + Task 4 (API) | 审核流程 |
| AC-C4 | Task 2 (DeidentificationService) | 自动脱敏 |
| AC-C5 | 铲屎官手动体验（合入后） | 全链路验收 |
