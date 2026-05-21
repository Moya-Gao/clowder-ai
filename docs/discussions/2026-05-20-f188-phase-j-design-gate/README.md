---
feature_ids: [F188]
topics: [memory, library, health, governance, migration]
doc_kind: design-gate
created: 2026-05-20
---

# F188 Phase J Design Gate: Health Debt Governance

> **Author**: 布偶猫 (Opus 4.6) | **Reviewer**: 砚砚 (GPT-5.5)
> **Status**: 提案 — 待 reviewer 审核
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
| **verified_at** | `evidence_docs.verified_at` | 显式验证事件时间戳 | Phase J migration / cat verification workflow | 猫猫或铲屎官 explicitly 确认内容正确性 |
| **usage_signal** | `evidence_docs.last_consumed_at` (新增) + `evidence_docs.consumption_count` (新增) | F200 消费记录聚合 | F200 RecallEvent pipeline | recall consumed 事件触发 |

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

### verified_at 回填规则

**核心原则**：`verified_at` 记录的是"有人/猫 explicitly 确认过内容正确性"的时间，不是自动推断。

- **constitutional (57 lessons)**：回填 `verified_at = first_indexed_at`。理由：lessons learned 在写入时就经过 review（SOP 要求 Red→Green + reviewer 确认），首次索引等价于首次验证
- **validated (208 features + 14 decisions)**：回填 `verified_at = first_indexed_at`。理由：feature spec 经过 Design Gate + review + merge 流程；decision 经过讨论收敛
- **candidate (444)**：不回填。`candidate` 明确表示"有价值但未验证"，等 cat-owned workflow 处理
- **observed (1404)**：不回填。观测级文档不需要验证

### F200 usage_signal 字段

新增两个字段到 `evidence_docs`：

```sql
ALTER TABLE evidence_docs ADD COLUMN last_consumed_at TEXT;
ALTER TABLE evidence_docs ADD COLUMN consumption_count INTEGER DEFAULT 0;
```

F200 RecallEvent 写 consumed 记录时，同步更新这两个字段。这是 **usage signal**，不是 verification：
- ✅ 可以用于：排序加权、review candidate 推荐、stale 判断
- ❌ 不能用于：自动写 `verified_at`、提升 `authority`、清除 unverified 状态

### 迁移 dry-run 输出格式

```json
{
  "buckets": {
    "backfill_verified": {
      "count": 280,
      "breakdown": { "constitutional_lesson": 57, "constitutional_plan": 1, "validated_feature": 208, "validated_decision": 14 },
      "action": "SET verified_at = first_indexed_at",
      "risk": "low — authority already correct by kind rule"
    },
    "keep_candidate": {
      "count": 444,
      "action": "no change — wait for cat verification workflow",
      "risk": "none"
    }
  },
  "before": { "unverified": 724 },
  "after": { "unverified": 444 }
}
```

迁移后 724 → 444。剩余 444 是真正的 candidate 需要 cat review。

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

### Edge Write Prevention（AC-J5）

在 `edge-extractors.ts` 的 `extractFeatureRefEdges()` 加 canonical resolver：

```typescript
// line 30-34 改为：
for (const match of masked.matchAll(/\bF(\d{2,4})\b/g)) {
  const num = parseInt(match[1]!, 10);
  // 防误抽取：纯数字 > 999 不是 feature（年份如 F2025）
  if (num > 999) continue;
  // 带非数字后缀的不是 feature（F32-b）
  // 已被 \b 边界排除，但额外检查 match context
  const fRef = `F${String(num).padStart(3, '0')}`;
  if (fRef === selfAnchor || seen.has(fRef)) continue;
  seen.add(fRef);
  edges.push({ fromAnchor: selfAnchor, toAnchor: fRef, relation: 'feature_ref', provenance: 'content' });
}
```

关键改动：
1. `parseInt` + `padStart(3, '0')`: `F20` → `F020`
2. `num > 999` filter: `F2025` 不生成 edge（我们不会有 1000+ features，年份/版本号误匹配）
3. `F32-b` 已被 `\b` 排除（`b` 不是 word boundary），但 `\d{2,4}` 匹配 `32` 的部分已通过 canonical 转成 `F032`

### Regression tests（AC-J5）

| 输入 | 预期 toAnchor | 说明 |
|------|-------------|------|
| `文档引用 F20 和 F186` | `F020`, `F186` | 短 F 号零填充 |
| `已经是 F020 的引用` | `F020` | no-op，不重复 |
| `年份 F2025 不是 feature` | 无 edge | 过滤 > 999 |
| `F32-b 不是合法 anchor` | `F032` | `\b` 只匹配 `F32`，canonical 到 `F032` |
| `不存在的 F998` | `F998` | edge 创建但标记为 unresolved（dry-run 可发现） |

## Contract 3: F200 Integration Boundary（AC-J8）

### 单向数据流

```
F200 RecallEvent pipeline
  ↓ 写
evidence_docs.last_consumed_at / consumption_count
  ↓ 读 (only)
F188 Health Report: 用于 stale 判断、review 优先级排序
F188 Cat Verification Workflow: 消费过的 candidate 优先推给猫审
```

### 边界测试 contract

| 场景 | 预期行为 | 测试类型 |
|------|---------|---------|
| F200 consumed 事件 → evidence_docs | 只更新 `last_consumed_at` + `consumption_count` | unit |
| F200 consumed 事件 → `verified_at` | **不写**，`verified_at` 保持 NULL | unit (negative) |
| F200 consumed 事件 → `authority` | **不变**，authority 保持原值 | unit (negative) |
| F188 cat verify action → `verified_at` | 写入当前时间戳 | unit |
| F188 cat verify action → `authority` | 可提升（candidate→validated 需确认） | unit |
| consumption_count > 0 但 verified_at NULL | health report 仍计入 unverified | integration |

### 不允许的操作（硬性禁止，测试 assert）

```typescript
// 这些路径必须不存在：
// 1. F200 写 verified_at
// 2. F200 提升 authority
// 3. F200 清除 review_status
// 4. 任何 auto-promote authority 的路径（必须经过 cat confirm 或 migration 脚本）
```

## 实施计划（Design Gate 通过后）

| 步骤 | 内容 | 预计耗时 |
|------|------|---------|
| 1 | edge-extractors.ts canonical resolver + regression tests (AC-J5) | 1h |
| 2 | orphan edge dry-run/apply API + CLI (AC-J2/J3/J4) | 2h |
| 3 | evidence_docs schema migration (last_consumed_at, consumption_count) + F200 boundary tests (AC-J8) | 1h |
| 4 | verification debt migration dry-run (AC-J6) + verified_at backfill | 1h |
| 5 | cat-owned verification workflow MCP tool (AC-J7) | 2h |
| 6 | dogfood acceptance report on runtime DB copy (AC-J9) | 1h |
| 7 | AC-J1 semantics spec 落地到 docs/ | 30min |

## Open Questions（本 Design Gate 要解决的）

### OQ-5 决议提案

新增 `last_consumed_at` + `consumption_count` 两个 field 到 evidence_docs。不新增 `verification_state` / `verification_source`（过度设计——`verified_at` NULL vs 有值已经足够区分）。

### OQ-6 决议提案

Non-doc wikilink（代码块、mock 变量名、测试 fixture 名等）→ **删除 edge**。理由：这些不是知识关系，是 wikilink 正则过度匹配的噪音。少量可能是未索引文档 title 的 wikilink → 进 review bucket，猫猫决定保留或删除。

### OQ-7 决议提案

`validated`/`constitutional` + `verified_at IS NULL` → **backfill `verified_at = first_indexed_at`**（不降级 authority）。理由：这些文档的 authority 是按 kind 规则正确推断的（constitutional=lessons, validated=features+decisions），`verified_at` 空只是因为验证跟踪系统建设晚于初始索引。
