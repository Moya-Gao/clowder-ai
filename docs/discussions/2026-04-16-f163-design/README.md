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
// 新增：每条结果的归因字段
interface EvidenceResult {
  // ... 现有字段不变 ...
  boostSource?: BoostSource[];  // 哪些 F163 子能力影响了这条结果的排序
}

// 枚举：子能力标识
type BoostSource =
  | 'authority_boost'       // authority 加权 rerank
  | 'always_on_injection'   // constitutional 物理注入
  | 'retrieval_rerank'      // 多轴元数据参与 rerank
  | 'compression_summary'   // 被压缩摘要替代展示
  | 'legacy';               // 无 F163 影响（默认值 / F163 关闭时）

// 新增：响应信封级别归因
interface EvidenceSearchResponse {
  // ... 现有字段不变 ...
  variantId?: string;  // flag snapshot 的确定性哈希
}
```

### 设计决策

| 决策 | 理由 |
|------|------|
| `boostSource` 是数组不是单值 | 一条结果可能同时受 authority_boost 和 retrieval_rerank 影响 |
| F163 关闭时返回 `['legacy']` | 让消费方不用判空，始终有值 |
| `variantId` 放信封不放每条结果 | 同一次请求所有结果共享同一实验配置 |
| `confidence` 不改（继续 'mid'） | confidence 语义不同于 boost，不混淆；Phase A 评测成熟后再重新标定 |

### 开放问题

| # | 问题 |
|---|------|
| DG-1.1 | `boostSource` 是否也需要携带分值（如 `{ source: 'authority_boost', weight: 1.2 }`）？还是只标识参与？ |
| DG-1.2 | `always_on_injection` 的结果是否也出现在 `results[]` 里？还是走独立通道？ |

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

#### Cohort sticky routing

**提案 A**（简单）：不做 cohort 路由，因为当前是单用户系统。同一时刻只有一套 flag 生效，variant_id 天然一致。

**提案 B**（预留扩展）：在 evidence.sqlite 增加 `experiment_cohorts` 表，按 threadId 绑定 variant_id。多用户时启用。

**我的倾向**：提案 A。Cat Cafe 目前是单铲屎官，cohort routing 的价值在多用户场景才体现。但 variant_id + effective_flags 日志是必须的——事后分析靠日志而不是实时路由。

### 开放问题

| # | 问题 |
|---|------|
| DG-2.1 | Cohort routing 是否现在就做（提案 B）？还是 variant_id + 日志足够（提案 A）？ |
| DG-2.2 | Hub UI 的环境变量面板需要为 F163 flags 做分组展示吗？还是混在 evidence category 里？ |

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

**覆盖范围**：所有 F163 写操作必须经过此队列：
- `compression`：生成 summary + 标记原件 backstop
- `promotion_gate`：修改 authority/status
- `contradiction_detection`：写入 contradicts[]
- `review_queue`：创建 review 条目

**不覆盖**：现有 `IndexBuilder.upsert()`（文档导入）走原有路径，不经 F163 写队列。

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

### 开放问题

| # | 问题 |
|---|------|
| DG-3.1 | `f163_suggestions` 是否也放在 evidence.sqlite 里？还是单独的 experiment.sqlite？ |
| DG-3.2 | 现有 `IndexBuilder.upsert()` 是否需要经过写队列？它和 F163 写操作可能并发（导入时触发 write-time 矛盾检测） |
| DG-3.3 | apply 模式异常降级到 suggest 后，是否需要铲屎官手动恢复到 apply？还是下次请求自动重试 apply？ |

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

### 开放问题

| # | 问题 |
|---|------|
| DG-4.1 | 日志写到哪里？evidence.sqlite？单独文件？structured logging to stdout？ |
| DG-4.2 | 权重误导率的计算需要 shadow 模式同时跑新旧排序——性能可接受吗？ |

---

## 汇总：所有开放问题

| # | 问题 | 我的倾向 |
|---|------|---------|
| DG-1.1 | boostSource 是否携带分值？ | 先只标识，分值在 log 里；前端展示不需要分值 |
| DG-1.2 | always_on_injection 结果是否在 results[] 里？ | 不在——它走物理注入不走检索管道，不应混在检索结果里 |
| DG-2.1 | Cohort routing 现在做？ | 提案 A（不做），variant_id + 日志足够 |
| DG-2.2 | Hub UI 分组展示？ | 混在 evidence category，不另建分组 |
| DG-3.1 | f163_suggestions 放哪？ | 放 evidence.sqlite，同一个 WAL 里 |
| DG-3.2 | IndexBuilder 是否经写队列？ | 不经——但 write-time 矛盾检测需要在 IndexBuilder 调用链中触发 |
| DG-3.3 | apply 降级后恢复策略？ | 下次请求自动重试 apply（非持久降级），但连续失败 3 次则锁定 suggest 直到手动恢复 |
| DG-4.1 | 日志写到哪？ | evidence.sqlite 的 f163_logs 表，避免引入新存储依赖 |
| DG-4.2 | shadow 双跑性能？ | Phase A 实测，预计可接受（单次检索已经 <100ms，双跑 <200ms） |
