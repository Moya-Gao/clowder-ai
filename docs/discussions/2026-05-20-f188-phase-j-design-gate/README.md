---
feature_ids: [F188]
topics: [memory, library, health, governance, migration]
doc_kind: design-gate
created: 2026-05-20
---

# F188 Phase J Design Gate: Health Debt Governance

> **Author**: 布偶猫 (Opus 4.6) | **Reviewer**: 砚砚 (GPT-5.5)
> **Status**: R3 — 修 R2 P1×1 + P2×3 后三审
> **Scope**: 解决 OQ-5/OQ-6/OQ-7，产出可审 contract

## Architecture Ownership

- Architecture cell: memory
- Map delta: none
- Why: Phase J 只修数据 + 加 migrate/repair 工具，不改 memory cell boundary

## 数据现状（runtime DB 直查证据）

| 指标 | 数量 | 分布 |
|------|------|------|
| orphan edges | 201 | 166 F-ref 零填充 / 27 wikilink 非文档 / 4 幽灵 F 号 / 4 related |
| unverified docs | 724 | 444 candidate / 222 validated / 58 constitutional |
| recall events with consumption | 12 / 250 | 8 unique docs consumed |

## Contract 1: Verification Semantics（OQ-5）

### 三维分离定义

| 维度 | 字段 | 语义 | 谁写 | 写入条件 |
|------|------|------|------|----------|
| **authority** | `evidence_docs.authority` | 文档治理层级，基于来源和类型 | IndexBuilder / 迁移脚本 | 首次索引时按 kind 规则推断；手动提升需 CVO signoff |
| **verified_at** | `evidence_docs.verified_at` | 显式验证事件时间戳（ISO string） | cat verification workflow / 手动 promote API | 猫猫或铲屎官 **explicitly** 确认内容正确性；索引时间不是验证事件 |
| **usage_signal** | `anchor_recall_metrics.consumed_count_30d` / `last_consumed_at` / `dormancy_days` (**F200 已有表，不新增字段**) | F200 消费记录聚合 | F200 RecallMetricsComputer | recall consumed 事件触发 |
| **review_status** | `evidence_docs.review_status` (新增) | 治理 triage 状态 | Phase J migration / cat verification workflow | 迁移分 bucket 或猫猫审查动作 |

### authority 推断规则（IndexBuilder 首次索引）

| kind | 默认 authority | 理由 |
|------|---------------|------|
| `lesson` | `constitutional` | LL-xxx 是治理铁律 |
| `feature` | `validated` | F-spec 经过 review/approval 流程 |
| `decision` | `validated` | 决策记录经过 review |
| `plan` | `candidate` | 计划可能过时 |
| `discussion` | `candidate` | 讨论可能未收敛 |
| `session`, `thread` | `observed` | 聊天记录不是真相源 |
| 其他 | `observed` | 默认最低 |

### verified_at 不回填（P1 修正）

**核心原则**：`verified_at` 记录的是"有人/猫 explicitly 确认过内容正确性"的时间。**索引时间不是验证事件**——砚砚 R1 P1 正确指出，用 `first_indexed_at`（INTEGER ms）回填 `verified_at`（ISO string）既偷换语义又污染类型。

**修正方案**：不动 `verified_at`。改用 `review_status` 字段把 legacy trust 显式分 bucket：

| review_status | 语义 | 谁进 | 数量 |
|---------------|------|------|------|
| `trusted_legacy` | kind×source_path 白名单匹配，默认不需重审（但可 `mark_stale`/`escalate` 拉回） | lesson+feature+decision 且 source_path 匹配 | 由 dry-run 确定 |
| `needs_review` | candidate 级，等猫猫 triage | candidate(444) | 444 |
| `reviewed` | 猫猫已审查确认 | cat verify action 写入 | 0 (初始) |
| `escalated` | 猫猫标记需铲屎官判断 | cat escalate action 写入 | 0 (初始) |
| NULL | 未迁移/observed 级（不需要 triage） | observed(1404) | 1404 |

`trusted_legacy` 不等于 `verified`——它表示"基于 kind 和 provenance，authority 正确推断，不需要人工重审"。health report 可以把 `trusted_legacy` 从"待处理"计数中排除，但不写 `verified_at`。

### F200 usage_signal：读 anchor_recall_metrics，不新增字段（P1 修正）

**修正**：F200 已有 `anchor_recall_metrics` 表（schema V20），包含 `consumed_count_30d`、`exposure_count_30d`、`last_consumed_at`、`dormancy_days`，由 `RecallMetricsComputer` 写入。

F188 **不在 evidence_docs 新增 usage 字段**。需要消费数据时 JOIN：

```sql
SELECT ed.anchor, ed.authority, ed.review_status, arm.consumed_count_30d, arm.last_consumed_at
FROM evidence_docs ed
LEFT JOIN anchor_recall_metrics arm ON arm.anchor = ed.anchor
WHERE ed.review_status = 'needs_review'
ORDER BY arm.consumed_count_30d DESC NULLS LAST;
```

单一真相源：F200 写 `anchor_recall_metrics`，F188 只读。不做 double-write。

### review_status schema migration（P1 R3 修正：按 kind×source_path 白名单，不按 authority）

authority 不等于 provenance——`CollectionIndexBuilder` 会用 `reviewPolicy.authorityCeiling` 覆盖文档 authority（CollectionIndexBuilder.ts:86），external collection 的普通文档可能 authority='validated' 但未经 Design Gate。因此迁移必须用 `kind + source_path` 白名单，不能只看 authority。

```sql
ALTER TABLE evidence_docs ADD COLUMN review_status TEXT;

-- Step 1: trusted_legacy — 只限 kind 规则正确推断 + source_path 匹配已知位置的文档
UPDATE evidence_docs SET review_status = 'trusted_legacy'
  WHERE verified_at IS NULL AND (
    (kind = 'lesson'   AND source_path LIKE 'docs/lessons/%')
    OR (kind = 'feature'  AND source_path LIKE 'docs/features/%')
    OR (kind = 'decision' AND source_path LIKE 'docs/decisions/%')
  );

-- Step 2: needs_review — candidate authority + 非 observed kind
UPDATE evidence_docs SET review_status = 'needs_review'
  WHERE verified_at IS NULL
    AND review_status IS NULL
    AND COALESCE(authority, 'observed') NOT IN ('observed');

-- Step 3: legacy_anomaly — authority × kind 不一致的异常项（dry-run 必须逐条输出）
-- 例如：constitutional_plan:1（plan 不该是 constitutional）、collection-derived validated 等
-- 这些项保持 needs_review，dry-run 输出 anomaly 明细供人工检查

-- observed 和已有 verified_at 的不动
```

### 迁移 dry-run 输出格式

```json
{
  "buckets": {
    "trusted_legacy": {
      "count": "N (由 kind×source_path 白名单决定)",
      "breakdown_by_kind_source": [
        { "kind": "lesson", "source_prefix": "docs/lessons/", "count": 57 },
        { "kind": "feature", "source_prefix": "docs/features/", "count": 208 },
        { "kind": "decision", "source_prefix": "docs/decisions/", "count": 13 }
      ],
      "action": "SET review_status = 'trusted_legacy'",
      "risk": "low — kind + source_path 双重匹配"
    },
    "needs_review": {
      "count": "M (所有非 observed、非 trusted_legacy、verified_at IS NULL)",
      "action": "SET review_status = 'needs_review'",
      "risk": "none — 等 cat verification workflow"
    }
  },
  "anomalies": {
    "description": "authority × kind 不一致的文档（进 needs_review 但需人工关注）",
    "items": [
      { "anchor": "...", "authority": "constitutional", "kind": "plan", "source_path": "...", "note": "plan 不该是 constitutional" }
    ]
  },
  "authority_kind_source_matrix": "完整 authority × kind × source_path_prefix 交叉表（验证迁移覆盖率）",
  "before": { "unverified_displayed": 724 },
  "after": { "needs_attention": "needs_review count", "trusted_legacy": "白名单 count", "anomaly_in_needs_review": "异常条目数" }
}
```

**数字校验**：`trusted_legacy + needs_review + (observed/NULL 不动) = total`。dry-run 必须输出 `authority × kind × source_path_prefix` 矩阵，确保无遗漏无重复。之前 R2 的 279 + 444 = 723 ≠ 724，差 1 条正是 `constitutional_plan:1` 这类异常——用 kind×source_path 白名单后，该条进 `needs_review`，数字自洽。

health report 改为显示 `needs_review` count 而不是 `verified_at IS NULL` count（724）。`trusted_legacy` 不显示在"待处理"里。

## Contract 2: Orphan Edge Repair（OQ-6）

### 分类 + 处置策略

| 分类 ID | 匹配条件 | 数量 | 处置 | auto-apply? |
|---------|---------|------|------|-------------|
| `feature_ref_zero_pad` | `to_anchor GLOB 'F[0-9]*'` 且 `F` + zero-padded 3 位 存在于 evidence_docs | 166 | 更新 `to_anchor` 为 zero-padded 格式 | ✅ 自动 |
| `feature_ref_true_ghost` | `to_anchor GLOB 'F[0-9]*'` 且 padded 后仍不存在 | ~5 (`F2025`, `F320`, `F340`, `F999`, `F32-b`) | 删除 edge | ✅ 自动 |
| `wikilink_code_artifact` | `relation = 'wikilink'` 且 `to_anchor` 匹配代码模式 (`'...'` / `$...` / `...adapter` / `...Mock`) | ~20 | 删除 edge | ✅ 自动 |
| `wikilink_potential_doc` | `relation = 'wikilink'` 且 `to_anchor` 是普通文本（可能是未索引文档的 title/name） | ~7 | 进 review bucket | ❌ 猫猫审 |
| `related_field_ghost` | `relation IN ('related_to', 'related')` 且目标不存在 | 4 | 删除 edge（frontmatter 引用了不存在的 feature） | ✅ 自动 |

### dry-run 输出格式

```json
{
  "classifications": [
    {
      "id": "feature_ref_zero_pad",
      "count": 166,
      "action": "update to_anchor",
      "sample": [
        { "from": "doc:lessons/08-session-management", "to_before": "F24", "to_after": "F024", "target_exists": true }
      ]
    }
  ],
  "summary": { "before": 201, "auto_fixable": 191, "needs_review": 7, "after_auto": 10 },
  "sql_preview": [
    "UPDATE edges SET to_anchor = 'F024' WHERE from_anchor = '...' AND to_anchor = 'F24' AND relation = 'feature_ref'"
  ]
}
```

### apply 安全约束

1. **backup first**: apply 前必须备份 edges 表（`CREATE TABLE edges_backup_YYYYMMDD AS SELECT * FROM edges`）
2. **只改 auto-fixable**: `wikilink_potential_doc` 类不自动处理
3. **清理 derived data**: edge 修复后必须清理 `evidence_vectors` 中依赖旧 edge 的条目（如有），保证 graph read-model 一致
4. **验证 invariant**: apply 后重跑 `computeOrphanEdges()` 确认 count 下降到预期值
5. **auto-delete 前置检查（P2 修正）**: `feature_ref_true_ghost` 和 `related_field_ghost` 删除前，必须交叉验证 **两个** 数据源：
   - `evidence_docs` 表（DB 可能 stale，上次 rebuild 后可能新增了文档）
   - `docs/features/` 文件系统 + `docs/BACKLOG.md`（磁盘是最新真相源）
   - 两者都不存在 → auto-delete；任一存在 → 进 review bucket，不自动删

### Edge Write Prevention（AC-J5）

在 `edge-extractors.ts` 的 `extractFeatureRefEdges()` 加 canonical resolver：

```typescript
// line 30-34 改为：
for (const match of masked.matchAll(/\bF(\d{2,4})(?![-a-zA-Z])\b/g)) {
  const num = parseInt(match[1]!, 10);
  if (num > 999) continue;
  const fRef = `F${String(num).padStart(3, '0')}`;
  if (fRef === selfAnchor || seen.has(fRef)) continue;
  seen.add(fRef);
  edges.push({ fromAnchor: selfAnchor, toAnchor: fRef, relation: 'feature_ref', provenance: 'content' });
}
```

关键改动：
1. `parseInt` + `padStart(3, '0')`: `F20` → `F020`
2. `num > 999` filter: `F2025` 不生成 edge（我们不会有 1000+ features，年份/版本号误匹配）
3. `(?![-a-zA-Z])` negative lookahead: `F32-b` 中 `F32` 后跟 `-`，不匹配，**不生成 edge**（P1 修正：`\b` 在 `F32-b` 中 `-` 处确实是 word boundary，所以旧 regex 会匹配 `F32`；必须用 lookahead 显式排除带后缀的非法 anchor）

### Regression tests（AC-J5）

| 输入 | 预期 toAnchor | 说明 |
|------|-------------|------|
| `文档引用 F20 和 F186` | `F020`, `F186` | 短 F 号零填充 |
| `已经是 F020 的引用` | `F020` | no-op，不重复 |
| `年份 F2025 不是 feature` | 无 edge | 过滤 > 999 |
| `F32-b 不是合法 anchor` | 无 edge | `(?![-a-zA-Z])` lookahead 排除带后缀的 token |
| `不存在的 F998` | `F998` | edge 创建但标记为 unresolved（dry-run 可发现） |

## Contract 2.5: Cat Verification Workflow Schema（AC-J7，P2 修正）

### review_status 状态机

```
                ┌──────────────────┐
                │  needs_review    │ ← 迁移写入（444 candidate docs）
                └────┬───────┬────┘
                     │       │
            confirm  │       │ escalate
                     ▼       ▼
              ┌──────────┐ ┌──────────┐
              │ reviewed  │ │ escalated│ → 铲屎官/CVO 决定
              └──────────┘ └──────────┘
```

`NULL`/observed（1404 docs）不进入此工作流。`trusted_legacy` 默认不需要 triage，但猫猫发现问题时可以 `mark_stale` 或 `escalate` 将其拉回工作流。

### Action Set（MCP tool `cat_cafe_library_verify`）

| action | 前置状态 | 写入 | 语义 |
|--------|---------|------|------|
| `confirm` | `needs_review` | `review_status='reviewed'`, `verified_at=NOW()` | 猫猫确认内容正确 |
| `mark_stale` | `needs_review` \| `reviewed` \| `trusted_legacy` | `review_status='needs_review'`, `verified_at=NULL` | 内容已过时或发现问题，打回重审 |
| `escalate` | `needs_review` \| `trusted_legacy` | `review_status='escalated'` | 猫猫无法判断，升级铲屎官 |
| `dismiss_review` | `needs_review` | `review_status=NULL` | 不再需要治理审查（不改 authority，仅移出 triage 队列） |

### Audit Log（复用 `f163_logs` 表，不新建）

```sql
INSERT INTO f163_logs (log_type, payload, created_at) VALUES (
  'verification_action',
  json_object(
    'anchor', :anchor,
    'action', :action,
    'previous_review_status', :prev,
    'new_review_status', :next,
    'actor', :catId
  ),
  datetime('now')
);
```

### Escalation 条件（什么时候猫猫应该 escalate 而不是自行 confirm）

1. `authority = 'constitutional'` 但内容与当前实践明显矛盾
2. 文档涉及安全/权限/数据删除策略
3. 多个文档对同一主题给出冲突建议

### Review 优先级排序（利用 F200 消费数据）

```sql
SELECT ed.anchor, ed.authority, ed.review_status,
       arm.consumed_count_30d, arm.last_consumed_at
FROM evidence_docs ed
LEFT JOIN anchor_recall_metrics arm ON arm.anchor = ed.anchor
WHERE ed.review_status = 'needs_review'
ORDER BY arm.consumed_count_30d DESC NULLS LAST, ed.authority DESC;
```

高消费 + 低 authority = 最需要审查（猫猫在用但未经验证的知识最危险）。

## Contract 3: F200 Integration Boundary（AC-J8）

### 单向数据流（P1 修正：F188 不写 evidence_docs usage 字段）

```
F200 RecallEvent pipeline
  ↓ 写
anchor_recall_metrics（consumed_count_30d / last_consumed_at / dormancy_days）
  ↓ JOIN 读 (only)
F188 Health Report: review 优先级排序（高消费 candidate 优先）
F188 Cat Verification Workflow: 消费过的 needs_review 优先推给猫审
```

### 边界测试 contract

| 场景 | 预期行为 | 测试类型 |
|------|---------|---------|
| F200 consumed 事件 → `anchor_recall_metrics` | 只更新 F200 自己的表，不碰 `evidence_docs` | unit |
| F200 consumed 事件 → `verified_at` | **不写**，`verified_at` 保持 NULL | unit (negative) |
| F200 consumed 事件 → `authority` | **不变**，authority 保持原值 | unit (negative) |
| F200 consumed 事件 → `review_status` | **不变**，review_status 保持原值 | unit (negative) |
| F188 cat verify `confirm` → `verified_at` | 写入当前时间戳（ISO string） | unit |
| F188 cat verify `confirm` → `review_status` | `needs_review` → `reviewed` | unit |
| F188 cat verify `mark_stale` → `verified_at` | 清除为 NULL | unit |
| F188 cat verify `escalate` → `authority` | **不变**，escalate 不改 authority | unit |
| `consumed_count_30d > 0` 但 `review_status = 'needs_review'` | health report 仍计入待审，但排序靠前 | integration |

### 不允许的操作（硬性禁止，测试 assert）

```typescript
// 这些路径必须不存在：
// 1. F200 写 verified_at
// 2. F200 提升 authority
// 3. F200 清除 review_status
// 4. 任何 auto-promote authority 的路径（必须经过 cat confirm action 或 migration 脚本）
// 5. F188 直接写 anchor_recall_metrics（单一写入方：F200 RecallMetricsComputer）
```

## 实施计划（Design Gate 通过后）

| 步骤 | 内容 | 预计耗时 |
|------|------|---------|
| 1 | edge-extractors.ts canonical resolver + regression tests (AC-J5) | 1h |
| 2 | orphan edge dry-run/apply API + CLI (AC-J2/J3/J4) | 2h |
| 3 | evidence_docs schema migration (review_status) + F200 boundary tests via JOIN (AC-J8) | 1h |
| 4 | verification debt migration dry-run (AC-J6) + review_status bucket assignment | 1h |
| 5 | cat-owned verification workflow MCP tool (AC-J7) | 2h |
| 6 | dogfood acceptance report on runtime DB copy (AC-J9) | 1h |
| 7 | AC-J1 semantics spec 落地到 docs/ | 30min |

## Open Questions（本 Design Gate 要解决的）

### OQ-5 决议提案（R2 修正）

新增 `review_status` 一个 field 到 evidence_docs（治理 triage 状态）。**不新增 usage 字段**——消费数据读 F200 的 `anchor_recall_metrics` 表（JOIN）。不新增 `verification_state` / `verification_source`（过度设计——`verified_at` NULL vs 有值 + `review_status` 四档已足够）。

### OQ-6 决议提案

Non-doc wikilink（代码块、mock 变量名、测试 fixture 名等）→ **删除 edge**。理由：这些不是知识关系，是 wikilink 正则过度匹配的噪音。少量可能是未索引文档 title 的 wikilink → 进 review bucket，猫猫决定保留或删除。

### OQ-7 决议提案（R2 修正）

`validated`/`constitutional` + `verified_at IS NULL` → **不回填 `verified_at`**，改为 `review_status = 'trusted_legacy'`。理由：这些文档的 authority 是按 kind 规则正确推断的（constitutional=lessons, validated=features+decisions），`verified_at` 空只是因为验证跟踪系统建设晚于初始索引。`trusted_legacy` 表示"authority 推断正确，无需人工重审"，但不等于"有人显式验证过内容"——语义干净，不污染 `verified_at` 字段。health report 从"待处理"计数中排除 `trusted_legacy`，降噪到 444（`needs_review`）。
