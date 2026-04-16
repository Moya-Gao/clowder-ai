---
feature_ids: [F163]
related_features: [F102, F152, F165]
topics: [memory, entropy, knowledge-lifecycle, experiment-framework, api-contract]
doc_kind: discussion
created: 2026-04-16
participants: [opus, codex, gpt52]
---

# F163 Design Gate: API 契约与实验框架

> **触发**：F163 spec 已收敛（KD-1~KD-9 + 8 条实验基础设施约束 + AC-A1~A7），砚砚（codex）放行进 Design Gate。
>
> **性质**：纯后端 → collaborative-thinking 讨论 API 契约/数据模型。
>
> **收口范围**（砚砚提议）：只讨论以下 4 个契约，不发散。

## 现状基线

### search_evidence 当前响应格式

```typescript
// packages/api/src/routes/evidence.ts
interface EvidenceSearchResponse {
  results: EvidenceResult[];
  degraded: boolean;
  degradeReason?: string;
  effectiveMode?: 'lexical' | 'semantic' | 'hybrid';
  freshness?: EvidenceFreshness;
  reimportTrigger?: EvidenceReimportTrigger;
}

// packages/api/src/routes/evidence-helpers.ts
interface EvidenceResult {
  title: string;
  anchor: string;
  snippet: string;
  confidence: EvidenceConfidence;  // 'high' | 'mid' | 'low' — 当前硬编码 'mid'
  sourceType: EvidenceSourceType;
  source?: 'project' | 'global';
  status?: EvidenceStatus;
  passages?: PassageResult[];
}
```

### 现有 Feature Flag 模式

F102 用 `env-registry.ts` 注册环境变量，`EMBED_MODE` 支持 `off|shadow|on`：

- 所有 flag 集中在 `ENV_VARS` 数组
- Hub UI 自动展示 `runtimeEditable: true` 的变量
- 无 cohort/sticky routing，无 variant 追踪

### 写路径现状

- better-sqlite3 同步引擎，单进程
- 只有 `upsert()` 用 `db.transaction()`，其余写操作无事务
- WAL mode + `busy_timeout=5000`
- 无全局写队列，无内部并发控制
- SessionMutex / QueueProcessor 模式存在于 invocation 层，可复用

---

## 契约 1: `search_evidence` 响应契约

### 提案

在 `EvidenceResult` 增加 `boostSource` 字段，在 `EvidenceSearchResponse` 增加 `variantId`：

```typescript
// 新增：每条结果的排序归因字段
interface EvidenceResult {
  // ... 现有字段不变 ...
  boostSource: BoostSource[];  // 必填。哪些 F163 子能力影响了这条结果的排序
}

// 枚举：仅排序相关的子能力标识（不含注入通道）
type BoostSource =
  | 'authority_boost'       // authority 加权 rerank
  | 'retrieval_rerank'      // 多轴元数据参与 rerank
  | 'compression_summary'   // 被压缩摘要替代展示
  | 'legacy';               // 无 F163 影响（默认值 / F163 关闭时）

// 新增：响应信封级别归因
interface EvidenceSearchResponse {
  // ... 现有字段不变 ...
  variantId: string;             // 必填。flag snapshot 的确定性哈希
  injectionSources?: string[];   // constitutional 物理注入通道的文档 anchor 列表（与 results[] 分离）
}
```

**字段命名约定**：TypeScript 接口统一 camelCase（`boostSource`），与现有 `sourceType`、`effectiveMode` 一致。F163 spec 中的 `boost_source` 指代同一概念，API 层不做 snake_case 转换。

### 设计决策

| 决策 | 理由 |
|------|------|
| `boostSource` 是必填数组，不是可选 | F163 关闭时返回 `['legacy']`，消费方不用判空 |
| `variantId` 放信封不放每条结果 | 同一次请求所有结果共享同一实验配置 |
| `always_on_injection` 不在 `boostSource` 枚举里 | 它走物理注入不走检索管道，不属于"排序归因"；独立到信封级 `injectionSources` |
| `confidence` 不改（继续 'mid'） | confidence 语义不同于 boost，不混淆；Phase A 评测成熟后再重新标定 |

### 问题收口

| # | 问题 |
|---|------|
| ~~DG-1.1~~ | ~~`boostSource` 是否也需要携带分值（如 `{ source: 'authority_boost', weight: 1.2 }`）？~~ → **已定：先只标识子能力名称，不携带分值；分值进入日志字段** |
| ~~DG-1.2~~ | ~~`always_on_injection` 的结果是否也出现在 `results[]` 里？~~ → **已决：不在 results[] 里，走 `injectionSources` 独立通道** |

---

## 契约 2: 实验路由契约

### 提案

#### Flag 注册

沿用 `env-registry.ts` 模式，每个 F163 子能力注册一个环境变量：

```typescript
// packages/api/src/config/env-registry.ts 新增
{ name: 'F163_AUTHORITY_BOOST',        defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 authority 加权 rerank (off/shadow/on)' },
{ name: 'F163_ALWAYS_ON_INJECTION',    defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 constitutional 物理注入 (off/shadow/on)' },
{ name: 'F163_RETRIEVAL_RERANK',       defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 多轴元数据 rerank (off/shadow/on)' },
{ name: 'F163_COMPRESSION',            defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 非替代式压缩 (off/suggest/apply)' },
{ name: 'F163_PROMOTION_GATE',         defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 晋升门禁 (off/suggest/apply)' },
{ name: 'F163_CONTRADICTION_DETECTION',defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 矛盾检测 (off/suggest/apply)' },
{ name: 'F163_REVIEW_QUEUE',           defaultValue: 'off', category: 'evidence', runtimeEditable: true, description: 'F163 审计 review queue (off/suggest/apply)' },
```

#### variant_id 生成

```typescript
function computeVariantId(flags: Record<string, string>): string {
  // 1. 取所有 F163_ 开头的 flag
  // 2. 按 key 字典排序
  // 3. JSON.stringify → SHA-256 → 取前 12 字符
  const sorted = Object.entries(flags)
    .filter(([k]) => k.startsWith('F163_'))
    .sort(([a], [b]) => a.localeCompare(b));
  return sha256(JSON.stringify(sorted)).slice(0, 12);
}
```

**稳定性保证**：相同 flag 组合 → 相同 variant_id，跨请求、跨重启。

#### Per-request flag snapshot

```typescript
// 请求入口处冻结
function freezeFlags(): F163FlagSnapshot {
  return Object.freeze({
    authorityBoost: process.env.F163_AUTHORITY_BOOST ?? 'off',
    alwaysOnInjection: process.env.F163_ALWAYS_ON_INJECTION ?? 'off',
    retrievalRerank: process.env.F163_RETRIEVAL_RERANK ?? 'off',
    compression: process.env.F163_COMPRESSION ?? 'off',
    promotionGate: process.env.F163_PROMOTION_GATE ?? 'off',
    contradictionDetection: process.env.F163_CONTRADICTION_DETECTION ?? 'off',
    reviewQueue: process.env.F163_REVIEW_QUEUE ?? 'off',
  });
}
```

#### Cohort sticky routing（Phase A 必做）

**已定**：F163 spec 约束 #3 明确要求 cohort sticky routing，不是可选项。

Thread-level sticky routing：
- 在 evidence.sqlite 增加 `f163_cohorts` 表：`threadId TEXT PRIMARY KEY, variantId TEXT NOT NULL, assignedAt TEXT NOT NULL`
- 首次请求时分配 variant，后续同 thread 固定走同一实验桶
- flag 变更时：新 thread 走新 variant，旧 thread 保持原 variant 直到显式 reset
- 后续扩展 user-level sticky（多铲屎官场景）可在此表加 `userId` 列

### 问题收口

| # | 问题 |
|---|------|
| ~~DG-2.1~~ | ~~Cohort routing 是否现在做？~~ → **已定：Phase A 必做 thread-level sticky（spec 硬约束）** |
| ~~DG-2.2~~ | ~~Hub UI 的环境变量面板需要为 F163 flags 做分组展示吗？还是混在 evidence category 里？~~ → **已定：混在 evidence category，不单独建分组** |

---

## 契约 3: 写路径执行契约

### 单写者队列

```typescript
// 复用 SessionMutex 模式，但 scope 是全局唯一（evidence store 级）
class EvidenceWriteQueue {
  private mutex = new Mutex();  // 或 p-limit(1)

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.mutex.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
```

**覆盖范围**：所有落 evidence.sqlite 的 mutation 必须经过同一写调度器：
- **F163 写操作**：compression、promotion_gate、contradiction_detection、review_queue
- **IndexBuilder 写操作**：`upsert()`、`deleteByAnchor()`、`addEdge()` 等

**为什么 IndexBuilder 也必须进队列**：write-time 矛盾检测在 IndexBuilder 调用链中触发——如果 IndexBuilder 和 F163 写操作不经同一调度器，会出现交叉写入时序不可预测（砚砚 review P1-2）。

**实现方式**：`EvidenceWriteQueue` 作为 `SqliteEvidenceStore` 的内部组件，所有对外暴露的写方法（upsert/delete/addEdge/F163 写操作）统一经过 `execute()`。IndexBuilder 调用 store 方法时自动受队列保护，无需改调用方。

### suggest / apply 状态机

```
                ┌──────────┐
                │   off    │  ← 默认状态，能力完全不运行
                └────┬─────┘
                     │ 铲屎官/环境变量切换
                     ▼
                ┌──────────┐
                │ suggest  │  ← 运行逻辑，产出建议/日志，不写 DB 状态
                └────┬─────┘
                     │ 铲屎官/环境变量切换
                     ▼
                ┌──────────┐
                │  apply   │  ← 运行逻辑 + 写 DB 状态
                └────┬─────┘
                     │ 异常
                     ▼
                ┌──────────┐
                │ suggest  │  ← 自动降级（fail-open 写路径版）
                └──────────┘
```

**suggest 模式的产出**：
- 所有写操作不调用 `store.upsert()` / `store.update()`
- 改为写入 `f163_suggestions` 日志表
- 日志表结构：

```sql
CREATE TABLE IF NOT EXISTS f163_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capability TEXT NOT NULL,    -- 'compression' | 'promotion' | 'contradiction' | 'review'
  target_anchor TEXT NOT NULL, -- 被操作的知识条目
  action TEXT NOT NULL,        -- 'compress' | 'promote' | 'mark_conflict' | 'queue_review'
  payload TEXT NOT NULL,       -- JSON: 具体建议内容
  variant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 读路径 fail-open

```
读路径异常 → 降级到 legacy 检索（无 F163 boost/rerank）
```

具体：try-catch 包裹 F163 的 boost/rerank 逻辑，catch 时直接返回原始 BM25/hybrid 结果，并在响应中标记 `degraded: true, degradeReason: 'f163_read_failopen'`。

### 问题收口

| # | 问题 |
|---|------|
| ~~DG-3.1~~ | ~~`f163_suggestions` 是否也放在 evidence.sqlite 里？还是单独的 experiment.sqlite？~~ → **已定：放在 evidence.sqlite（与主知识写路径同一 WAL）** |
| ~~DG-3.2~~ | ~~IndexBuilder 是否经写队列？~~ → **已定：所有 evidence.sqlite mutation 统一经 EvidenceWriteQueue（砚砚 review P1-2）** |
| ~~DG-3.3~~ | ~~apply 模式异常降级到 suggest 后，是否需要铲屎官手动恢复到 apply？还是下次请求自动重试 apply？~~ → **已定：自动重试；连续 3 次失败锁定 suggest，需手动恢复** |

---

## 契约 4: 度量契约

### 离线度量（Gold Set）

| 指标 | 计算方式 | 数据源 |
|------|---------|--------|
| NDCG@10 | 标准 NDCG，gold relevance 0-3 | 手动标注的 50-100 query set |
| MRR | 第一个相关结果的倒数排名 | 同上 |
| 铁律命中率 | constitutional 知识在相关 query 中的 recall | gold set 中标注了"应命中铁律"的子集 |
| 冲突假阳性率 | 被标记冲突但实际不冲突的比例 | 矛盾检测产出 vs 人工判断 |

**评测脚本**：`packages/api/scripts/f163-eval.ts`（Phase A 产出）

### 在线度量（Proxy Metrics）

| 指标 | 计算方式 | 数据源 |
|------|---------|--------|
| 回滚率 | F163 操作被人工撤销的比例 | `f163_suggestions` 表 + 实际状态对比 |
| Review queue actionable rate | review 条目导致实际变更的比例 | review queue 状态追踪 |
| 人工否决率 | 铲屎官明确拒绝建议的比例 | Knowledge Feed 交互记录 |
| 权重误导率 | boost 导致相关度下降的比例 | shadow 模式：新旧排序对比，旧排序更优的比例 |

### 日志字段

每次 search_evidence 调用记录：

```typescript
interface F163SearchLog {
  timestamp: string;
  variantId: string;
  effectiveFlags: F163FlagSnapshot;
  query: string;
  resultCount: number;
  boostSources: BoostSource[][];  // 每条结果的 boostSource
  latencyMs: number;
  degraded: boolean;
  degradeReason?: string;
}
```

每次 F163 写操作记录：

```typescript
interface F163WriteLog {
  timestamp: string;
  variantId: string;
  capability: string;
  mode: 'suggest' | 'apply';
  targetAnchor: string;
  action: string;
  success: boolean;
  degradedToSuggest: boolean;
  latencyMs: number;
}
```

### A/B 对账

- **对账频率**：按 variant_id 分组，手动触发或 scheduled task
- **对账产出**：Harness 健康报告（AC-C4 的一部分）
- **最小样本量**：NDCG 对比至少 30 个 query 的 gold set 结果；在线指标至少 7 天数据

### 问题收口

| # | 问题 |
|---|------|
| ~~DG-4.1~~ | ~~日志写到哪里？evidence.sqlite？单独文件？structured logging to stdout？~~ → **已定：实验日志落 evidence.sqlite 的 `f163_logs` 表** |
| ~~DG-4.2~~ | ~~权重误导率的计算需要 shadow 模式同时跑新旧排序——性能可接受吗？~~ → **已定：Phase A 实测验证，性能是否可接受以实测数据裁决** |

---

## 汇总：问题收口状态

| # | 问题 | 状态 |
|---|------|------|
| ~~DG-1.1~~ | boostSource 是否携带分值？ | **已定** — 仅标识子能力名称；分值写入 log |
| ~~DG-1.2~~ | always_on_injection 结果是否在 results[] 里？ | **已定** — 不在 results[]，走 `injectionSources` 独立通道（砚砚 review P2-2） |
| ~~DG-2.1~~ | Cohort routing 现在做？ | **已定** — Phase A 必做 thread-level sticky（spec 硬约束，砚砚 review P1-1） |
| ~~DG-2.2~~ | Hub UI 分组展示？ | **已定** — 混在 evidence category，不单独建分组 |
| ~~DG-3.1~~ | f163_suggestions 放哪？ | **已定** — 放 evidence.sqlite |
| ~~DG-3.2~~ | IndexBuilder 是否经写队列？ | **已定** — 所有 evidence.sqlite mutation 统一经写调度器（砚砚 review P1-2） |
| ~~DG-3.3~~ | apply 降级后恢复策略？ | **已定** — 自动重试，连续 3 次失败锁定 suggest（手动恢复） |
| ~~DG-4.1~~ | 日志写到哪？ | **已定** — evidence.sqlite 的 `f163_logs` 表 |
| ~~DG-4.2~~ | shadow 双跑性能？ | **已定** — Phase A 实测验证后定论 |
