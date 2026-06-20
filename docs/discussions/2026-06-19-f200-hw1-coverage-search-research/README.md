---
feature_ids: [F200, F242]
topics: [memory, search, coverage, convention-graph, expansion]
doc_kind: research
created: 2026-06-19
author: opus (宪宪)
---

# HW-1 Spec Research: Coverage/Source-Map Search Mode

> F200 v1.2 HW-1 spec 调研。收集工程上下文 + 数据信号 + F242 交叉方向，为 Design Gate 讨论备料。

## 1. 研究动机

**铲屎官指令**（2026-06-19）：
> "HW-1 spec 调研（coverage/source-map 搜索模式）... 现在在做的 f242 code graph 类的 feat 能不能给你们灵感"

**前置条件状态**：
- SW-1 `memory-search-best-practices` skill 已运行 1 个月+（2026-05-17 交付）
- SW-2 MCP tool description SEARCH TIPS 已 live
- SW-3 coverage-intent inline nudge 已 live
- HW-6 FTS Progressive Relaxation ✅ merged（2026-06-19）
- HW-7 Telemetry 三態校准 ✅ merged（2026-06-19）
- F242 Convention Graph spike Phase A/B done（2026-06-18）

## 2. 数据信号：猫的真实搜索行为（post-HW-6 7 天窗口）

### 2.1 Recall Metrics Snapshot（2026-06-19 采集）

| 指标 | 7d (225 events) | 24h (24 events) | 说明 |
|------|----------------|-----------------|------|
| consumedAt3 | 7.1% | 12.5% | 趋势改善 |
| searchAbandonRate | **64.9%** | **62.5%** | **核心问题：近 2/3 搜索无消费** |
| reformulationRate | **30.2%** | 33.3% | **近 1/3 搜索后换 query 再搜** |
| consumedMRR | 0.057 | 0.125 | 趋势改善 |
| consumedAnchorNotInPoolRate | 0% | 0% | pool size 够用 |
| grepFallbackRate | 0% | 0% | HW-6 修复后不再 fallback 到 grep |
| graphTraversalCompletion | 0% | 0% | graph 深度导航机会 |
| shadowConsumedMRR | 0.728 | 1.0 | HW-7 fix 后 shadow≠live（正确） |

### 2.2 关键洞察

1. **高 abandon rate (65%) + 高 reformulation rate (30%) = coverage 需求的 proxy**：
   - 猫搜了但不消费（abandon）→ 可能是 top-k 结果不够/不对
   - 猫搜了又搜（reformulate）→ 在手动做 coverage 的事
   - 两者加起来 ~95% = 几乎所有搜索都不是"一刀命中"

2. **graphTraversalCompletion = 0%**：猫用 graph_resolve 但不做深度导航（search→read→graph→read 链）。Convention graph 作为 expansion source 可以释放这部分价值。

3. **consumedAnchorNotInPoolRate = 0%**：pool size 不是问题——猫不是找不到（pool 里有），而是 top-k 展示的不是他要的全集。

### 2.3 SW-3 Coverage Nudge 覆盖面

现有 `evidence-coverage-nudge.ts` 检测 13 种 coverage-intent pattern：
```
/哪些/ /所有(?!权)/ /历史上/ /提过/ /沉淀/
/which threads|docs|files/ /all threads|docs|files/
/history/ /mention/ /coverage/ /source-map/ /provenance/
```

触发后只输出文本提示"这是 coverage 任务，单刀 top-k 不够"。**没有系统级 coverage 支持**——猫必须手动按 SW-1 recipe 多次调用 search_evidence + graph_resolve + Read。

**机会**：nudge 检测逻辑已验证 1 个月，可作为 coverage 模式的自动触发依据。

## 3. 工程现状：搜索管道架构

### 3.1 当前 search_evidence 管道（SqliteEvidenceStore.searchWithMeta）

```
query → [exact-anchor bypass] → [BM25 FTS5 search] → [semantic NN search] → [hybrid RRF fusion]
                                                                                    ↓
                                            [consumption rerank (F200 Phase C)] → [MMR dedup] → top-k output
```

**关键约束**：
- `SearchOptions.mode`: lexical | semantic | hybrid
- `SearchOptions.scope`: docs | memory | threads | sessions | all
- `SearchOptions.limit`: 默认 10，最大 20
- **输出**: `EvidenceItem[]`（top-k 列表），无 coverage 结构

### 3.2 当前 graph_resolve 管道（GraphQueryResolver）

```
query → [exact anchor lookup] → [fuzzy candidates (BM25 + textMatchScore)] → [edge traversal]
                                                                                    ↓
                                            [edge_weight ranking (F200 Phase C)] → depth-limited subgraph
```

**关键约束**：
- depth=1 干净（13 nodes），depth≥2 hub 爆炸（DF-2 已修 cap）
- fuzzy candidates 现在包含 textMatchScore（DF-11 已修）
- **输出**: subgraph（nodes + edges），非列表

### 3.3 F242 Convention Graph（@cat-cafe/convention-graph）

```typescript
// 核心 API
interface ConventionGraphEngine {
  findNodes(query: NodeQuery): ConventionNode[];       // {domainId?, kind?, name?}
  consumers(nodeId: string): Consumer[];               // incoming edges
  freshness(files?, domains?, inScope?): Freshness;    // index freshness
}

// 查询原语
function codeConsumers(graph, query, options?): CodeConsumersResult;
// → { targets: ConventionNode[], consumers: Consumer[], freshness: Freshness }

// 已有 extractors
// - mcp-tool: tool 定义 / toolset group / exact string consumer
// - skill-manifest: SKILL.md name + triggers
// - fastapi-route: FastAPI route (for foreign repos)
```

**Node identity**: `scopeKey` 复合键（解 codegraph AuthProvider 跨域混淆）。
**Edge provenance**: `{ extractor, extractorVersion, sourceFile?, sourceLine?, confidence? }`。
**Freshness**: `{ indexCommit, stale, pendingChanges[] }`。

## 4. 提案：HW-1 Coverage Search Pipeline

### 4.1 架构选择

**方案 A**：扩展 `searchWithMeta()` 加 `intent: 'coverage'` 参数。
**方案 B**：新建 `CoverageSearchService`，内部编排多次 `searchWithMeta()` 调用。

**推荐 B**（新建 service）：
- Coverage 本质是 multi-query 编排，不是 single-query 变种
- 不侵入核心搜索路径（核心路径 consumedAt3 / MRR 不受影响）
- 独立测试、独立 shadow、独立降级
- 现有 coverage nudge 可升级为 coverage service 触发器

### 4.2 五步 Pipeline 详细设计

```
┌─ Step 1: Scope Quota ─────────────────────────────────────────────────┐
│  input: user query                                                     │
│  output: per-scope search configs [{scope, mode, limit, query}]        │
│  logic:                                                                │
│    docs  → hybrid, limit=15 (canonical docs are primary truth sources) │
│    threads → semantic, limit=10 (cross-language recall)                │
│    每类 source 保底 top-N，不让 docs 挤掉 threads                        │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─ Step 2: Structured Expansion ────────────────────────────────────────┐
│  input: Step 1 canonical doc hits                                      │
│  output: expanded query/anchor set                                     │
│  sources (三类，每条标明来源):                                            │
│    ① Frontmatter aliases: feature_ids, topics, related_features        │
│    ② Source-thread links: 从 canonical doc 抽 thread-{id} / wikilinks  │
│    ③ F242 convention graph edges (soft dep):                           │
│       canonical doc 提到 MCP tool/skill → codeConsumers() 找消费方       │
│       → 消费方 filePath 对应的 feature/spec 也加入 expansion set          │
│  constraint: 确定性结构化关联，不做 LLM 推理 (KD-8)                       │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─ Step 3: Union + Dedup ───────────────────────────────────────────────┐
│  input: Step 1 multi-scope results + Step 2 expanded results           │
│  output: deduplicated union result set                                 │
│  dedup key: anchor (case-insensitive)                                  │
│  priority: direct hit > expansion hit (direct beats indirect)          │
│  scope tag preserved: each item tagged with scope + expansion source   │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─ Step 4: Coverage Matrix Output ──────────────────────────────────────┐
│  output format:                                                        │
│  {                                                                     │
│    query: string,                                                      │
│    totalHits: number,                                                  │
│    bySource: {                                                         │
│      docs: { count, items[] },                                         │
│      threads: { count, items[] },                                      │
│      conventionGraph: { count, items[] }  // F242                      │
│    },                                                                  │
│    matrix: [{                                                          │
│      anchor: string,                                                   │
│      title: string,                                                    │
│      kind: EvidenceKind,                                               │
│      matchType: 'direct' | 'alias' | 'source-thread' | 'convention',  │
│      confidence: number,                                               │
│      source: 'docs' | 'threads' | 'convention-graph',                 │
│      expansionProvenance?: ExpansionProvenance                         │
│    }],                                                                 │
│    gaps: string[]  // 明确标注未覆盖的维度                                │
│  }                                                                     │
└────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─ Step 5: Expansion Provenance Display ────────────────────────────────┐
│  每条非 direct hit 标注:                                                │
│    expansionProvenance: {                                              │
│      source: 'frontmatter-alias' | 'source-thread' | 'convention-edge'│
│      via: string  // "F200 → topic:memory" | "thread-xxx" | "mcp-tool:│
│                   //  search_evidence → skill-manifest:memory-search"  │
│      confidence: 'static' | 'heuristic'                               │
│    }                                                                   │
│  coverage nudge 升级: 不只输出文本，附上 coverage matrix                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 MCP Surface

**Option A**：新建独立 MCP tool `coverage_search`。
**Option B**：扩展 `search_evidence` 加 `intent=coverage` 参数。

**推荐 Option B**（扩展现有 tool）：
- 猫已经知道 `search_evidence`，不用学新工具名
- Coverage nudge 已经在 `search_evidence` 响应中，升级为自动触发自然
- MCP tool description 已有 SEARCH TIPS coverage 段落
- 输出格式扩展（多了 `coverageMatrix` + `expansionProvenance`），向下兼容

```typescript
// 扩展 SearchOptions
interface SearchOptions {
  // ...existing fields...
  /** HW-1: coverage search intent — 多 scope 多 query 全集召回 */
  intent?: 'topk' | 'coverage';
}

// 扩展 MCP tool input
{
  "query": "Redis 圣域",
  "intent": "coverage"
  // scope/mode/limit 由 CoverageSearchService 自动管理，用户不需设
}
```

### 4.4 F242 Integration 详细设计

**触发条件**：Step 1 canonical doc hits 中检测到 MCP tool name / skill name → 调 F242 expansion。

```typescript
// 伪码
async function expandViaConventionGraph(
  canonicalHits: EvidenceItem[],
  graph: ConventionGraphEngine | null  // soft dep
): Promise<ExpansionResult[]> {
  if (!graph) return [];  // F242 unavailable → graceful fallback
  
  const expansions: ExpansionResult[] = [];
  for (const hit of canonicalHits) {
    // 从 canonical doc 抽 MCP tool names / skill names
    const conventionNames = extractConventionNames(hit.content);
    for (const name of conventionNames) {
      const result = codeConsumers(graph, { name });
      if (result.freshness.stale) continue;  // stale graph → skip
      for (const consumer of result.consumers) {
        // consumer.node.filePath → 找对应的 feature/spec anchor
        const relatedAnchor = resolveFileToAnchor(consumer.node.filePath);
        if (relatedAnchor) {
          expansions.push({
            anchor: relatedAnchor,
            matchType: 'convention',
            via: `${name} → ${consumer.node.name}`,
            confidence: consumer.edge.provenance.confidence ?? 'heuristic',
            freshness: result.freshness
          });
        }
      }
    }
  }
  return expansions;
}
```

**约束**：
1. Convention graph 为 soft dependency（unavailable → 纯文档 expansion，功能不退化）
2. Stale graph 的边不参与 expansion（freshness.stale === true → skip）
3. Edge provenance 透传到 coverage matrix（用户看得到"这条是 convention graph 找到的"）
4. F242 Phase C 尚未 close — integration code 需要 feature flag guard

### 4.5 性能预估

| 步骤 | 预估延迟 | 说明 |
|------|---------|------|
| Step 1: 2× searchWithMeta | 2 × ~100ms | 现有搜索管道 |
| Step 2: frontmatter parse | ~10ms | 本地 metadata 查询 |
| Step 2: source-thread extract | ~20ms | 正则从 doc content 抽链接 |
| Step 2: F242 codeConsumers | ~30ms | SQLite 本地查询 |
| Step 3: union + dedup | ~5ms | in-memory set ops |
| Step 4-5: matrix build | ~5ms | format + tag |
| **总计** | **~300-400ms** | 可接受（top-k ~100-150ms） |

## 5. Open Questions（Design Gate 讨论用）

| # | 问题 | 我的倾向 | 替代方案 |
|---|------|---------|---------|
| OQ-HW1-1 | Coverage 模式是 MCP 新 tool 还是 search_evidence 参数扩展？ | 参数扩展（`intent=coverage`） | 新 tool `coverage_search` |
| OQ-HW1-2 | Coverage intent 自动触发（检测 query 关键词）还是猫显式请求？ | **两者并存**：SW-3 nudge pattern 自动触发 + 猫也可显式 `intent=coverage` | 只显式 |
| OQ-HW1-3 | F242 convention graph 是 Step 2 的必选还是可选 expansion source？ | 可选 soft dep（F242 Phase C 未 close） | 等 F242 Phase C close 后才集成 |
| OQ-HW1-4 | Coverage matrix 输出限制多少条？ | max 50（避免超长输出耗 token） | max 30 / 无上限 |
| OQ-HW1-5 | Coverage search 的 telemetry——用现有 RecallEvent 还是新 event type？ | 新 event type `CoverageSearchEvent` 继承 RecallEvent + 加 expansion 字段 | 复用 RecallEvent 加字段 |
| OQ-HW1-6 | 是否需要 shadow mode（coverage search 先不影响排序）？ | 不需要——coverage 不改排序，只改输出格式 | 加 shadow |

## 6. 风险评估

| 风险 | 缓解 |
|------|------|
| Coverage search 输出太长（50 条 × 多字段）耗 token | max 50 cap + summary 模式只输出 matrix 不输出 content |
| F242 convention graph stale/unavailable 时 expansion 退化 | Soft dep + fallback 纯文档 expansion + freshness guard |
| Coverage intent 误判（非 coverage query 触发 coverage mode）| 两层：auto-detect 只在 SW-3 pattern match 时触发 + 猫可 override intent=topk |
| Coverage 和 top-k 结果不一致让猫困惑 | Coverage matrix 明确标注"这是全集搜索，不是排序推荐" |
| Convention graph expansion 引入噪声（代码消费方 ≠ 文档讨论） | expansionProvenance 标明来源类型 + confidence 标级 |

## 7. 实现 Sequencing 建议

1. **Phase 1**（核心 pipeline，不含 F242）：CoverageSearchService + Step 1-5 纯文档路径 + MCP intent 参数 + telemetry
2. **Phase 2**（F242 集成）：Step 2 ③ convention graph expansion（等 F242 Phase C close 或 feature flag）
3. **Phase 3**（自动触发）：SW-3 nudge 升级为 coverage auto-trigger + A/B shadow

## 8. 下一步

1. 本 research → **Design Gate 讨论**（纯后端 → 猫猫讨论，不需铲屎官拍板 UX）
2. 砚砚 review（HW-1 原始 5 步 pipeline 是砚砚设计的，需要他确认扩展方向）
3. Review 收敛后 → writing-plans → worktree → TDD

---

[宪宪/Opus-46🐾]
