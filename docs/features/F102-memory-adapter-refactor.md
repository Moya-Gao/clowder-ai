---
feature_ids: [F102]
related_features: [F024, F100, F042]
topics: [memory, adapter, evidence-store, architecture]
doc_kind: spec
created: 2026-03-11
---

# F102: 记忆组件 Adapter 化重构 — IEvidenceStore + 本地索引

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

Hindsight（外部记忆服务）已停用——铲屎官觉得实在难用。当前 `HindsightClient` 硬编码在路由和启动链路中，无法替换。我们需要：

1. 把记忆组件从 Hindsight 硬绑定改为可插拔 Adapter 接口
2. 实现一个轻量的本地替代方案（结构化索引 + feat 体系自动维护）
3. 避免重蹈覆辙：retain 不能直写长期库（碎片化垃圾入库教训）

> 铲屎官原话："我们希望把我们自己的经验沉淀，自己写一个符合我们实践的记忆组件，就给自己用。"
> 铲屎官补充："面向终态设计，不要搞中间态脚手架。猫猫出征其他项目时，全局记忆跟猫走。"

## 终态架构（P1 面向终态，从这里反推）

```
┌─────────────────────────────────────────────────────────┐
│                    全局层（跟猫走）                        │
│  Skills + 家规 + 猫猫记忆（F100 体系）                    │
│  ├── 猫猫身份/偏好/协作经验                               │
│  ├── 铲屎官画像                                          │
│  ├── 跨项目方法论/教训/踩坑经验                           │
│  └── 存储：skills 文件系统 + MEMORY.md（已有，不变）        │
├─────────────────────────────────────────────────────────┤
│                  项目层（留在项目里）                       │
│  每个项目独立的 IEvidenceStore 实例                        │
│  ├── cat-cafe/evidence.sqlite                            │
│  │   ├── evidence_docs — 结构化元数据（常规表）           │
│  │   ├── evidence_fts (FTS5) — 全文搜索（title+summary） │
│  │   ├── edges — 文档间显式关系                           │
│  │   └── markers — candidate queue（待沉淀事项）          │
│  ├── data-framework/evidence.sqlite                      │
│  └── future-project/evidence.sqlite                      │
└─────────────────────────────────────────────────────────┘
```

**关键设计决策**：
- **全局记忆** = Skills + 家规 + MEMORY.md（F100 Self-Evolution 体系，已有基础设施）
- **项目记忆** = SQLite 数据库（`evidence.sqlite`），每个项目一个文件，物理隔离
- **SQLite 是终态基座**：FTS5 全文搜索 + SQLite vector extension（按当时稳定版本启用） + edges 关系表，Phase 1 建的东西 Phase N 还在
- **SQLite 是编译产物，不是真相源**：真相源始终是 `docs/*.md` 文件；`evidence.sqlite` = gitignore + 启动时 rebuild；accepted marker 必须先 materialize 到稳定 source anchor（.md 文件）才算真正沉淀
- **联邦检索**：`KnowledgeResolver` 在 service 层合并"F100 全局真相源（只读）+ 当前项目 evidence.sqlite"，全局层不写进项目库
- 猫猫出征新项目 → 带走全局层（skills/家规/记忆），新项目自动初始化空的 `evidence.sqlite`

## What

### Phase A: IEvidenceStore 接口 + SQLite 基座 + 解耦

**A1. 接口定义**：一个 DB，两个接口，一个服务，一个联邦检索器。

```typescript
// 项目知识索引（编译产物，从 docs/*.md 重建）
interface IEvidenceStore {
  search(query: string, options?: SearchOptions): Promise<EvidenceItem[]>;
  upsert(items: EvidenceItem[]): Promise<void>;
  deleteByAnchor(anchor: string): Promise<void>;
  getByAnchor(anchor: string): Promise<EvidenceItem | null>;
  health(): Promise<boolean>;
  initialize(): Promise<void>;  // idempotent migrations + schema version + PRAGMA setup
}

// 候选记忆队列（retain 不直写 evidence，先进 marker queue）
interface IMarkerQueue {
  submit(marker: Marker): Promise<void>;
  list(filter?: MarkerFilter): Promise<Marker[]>;
  transition(id: string, to: MarkerStatus): Promise<void>;
}

// 反思服务（独立于存储层，LLM 编排能力）
interface IReflectionService {
  reflect(query: string, context?: ReflectionContext): Promise<string>;
}

// 联邦检索：合并全局层（F100 只读）+ 项目层（evidence.sqlite）
interface IKnowledgeResolver {
  resolve(query: string, options?: ResolveOptions): Promise<KnowledgeResult>;
}

interface SearchOptions {
  kind?: 'feature' | 'decision' | 'plan' | 'session' | 'lesson';
  status?: 'active' | 'done' | 'archived';
  keywords?: string[];
  limit?: number;
}

type MarkerStatus = 'pending' | 'proposed' | 'accepted' | 'rejected' | 'needs_review';
```

**接口关系**：`SqliteProjectMemory` 同时实现 `IEvidenceStore` + `IMarkerQueue`（同一个 DB）。`KnowledgeResolver` 在 service 层聚合全局 + 项目结果。

**A2. SQLite 存储（终态基座）**：`SqliteEvidenceStore` 实现 `IEvidenceStore`。

```sql
-- 结构化元数据表（常规表，精确过滤 + freshness check + join）
CREATE TABLE evidence_docs (
  anchor TEXT PRIMARY KEY,    -- F042, ADR-005, session-xxx
  kind TEXT NOT NULL,         -- feature/decision/plan/session/lesson
  status TEXT NOT NULL,       -- active/done/archived
  title TEXT NOT NULL,
  summary TEXT,
  keywords TEXT,              -- JSON array
  source_path TEXT,           -- docs/features/F042.md
  source_hash TEXT,           -- 变更检测
  updated_at TEXT NOT NULL
);

-- 全文搜索（FTS5 外部内容表，索引 title + summary）
CREATE VIRTUAL TABLE evidence_fts USING fts5(
  title, summary,
  content=evidence_docs, content_rowid=rowid
);

-- 关系表（1-hop 扩展）
CREATE TABLE edges (
  from_anchor TEXT NOT NULL,
  to_anchor TEXT NOT NULL,
  relation TEXT NOT NULL,  -- evolved_from/blocked_by/related
  PRIMARY KEY (from_anchor, to_anchor, relation)
);

-- 候选队列（替代直写 retain）
CREATE TABLE markers (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT NOT NULL,        -- cat_id + thread_id
  status TEXT DEFAULT 'pending',  -- pending/proposed/accepted/rejected/needs_review
  target_kind TEXT,            -- 预期 materialize 的类型
  created_at TEXT NOT NULL
);

-- Schema 版本（idempotent migration）
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

**关键规则**：`accepted` marker 必须先 materialize 到稳定 source anchor（.md 文件），再由自动索引写入 `evidence_docs`。SQLite 是编译产物——rebuild 不会丢知识，因为真相源在文件系统。

**A3. 路由解耦**：所有硬编码文件改为 DI 注入。

改造文件：
- `HindsightClient.ts` → 保留为 `HindsightEvidenceStore`（legacy adapter）
- `evidence.ts` 路由 → 注入 `IEvidenceStore`
- `callback-memory-routes.ts` → 注入 `IEvidenceStore`，retain 改写 markers 表
- `reflect.ts` → 拆为独立 `ReflectionService`（不属于存储层）
- `index.ts` → factory 按配置选实现
- `hindsight-import-p0.ts` → 适配新接口

### Phase B: 自动索引 + SOP 集成

数据源自动索引（解析 frontmatter → upsert 到 SQLite）：
- `docs/features/*.md` — feat-lifecycle 立项/关闭时
- `docs/decisions/*.md` — ADR 创建时
- `docs/plans/*.md` — plan 创建时
- sealed session digest — session 封存时
- `docs/lessons-learned.md` — 教训追加时

检索链路：`metadata filter (kind/status) → FTS5 search → edges 1-hop expand → source read`

### Phase C: 向量增强（按需）

启用 SQLite vector extension（按当时稳定版本），对 summary 字段生成嵌入向量，实现语义 rerank。
**注意**：这是在同一个 `evidence.sqlite` 上加表，不是换存储——P1 合规（终态基座不变）。

## Acceptance Criteria

### Phase A（IEvidenceStore + SQLite 基座 + 解耦）
- [ ] AC-A1: 四个接口定义（`IEvidenceStore` + `IMarkerQueue` + `IReflectionService` + `IKnowledgeResolver`），不含 Hindsight 术语
- [ ] AC-A2: `SqliteProjectMemory` 实现 `IEvidenceStore` + `IMarkerQueue`，使用 `evidence_docs`（常规表）+ `evidence_fts`（FTS5 外部内容表）
- [ ] AC-A3: `HindsightEvidenceStore` 实现 `IEvidenceStore`（legacy 兼容）
- [ ] AC-A4: 所有路由通过 DI 注入接口，不直接 import HindsightClient
- [ ] AC-A5: `ReflectionService` 独立实现，不在 `IEvidenceStore` 接口内
- [ ] AC-A6: `retain-memory` callback 写入 markers 表（candidate queue），marker accepted 必须先 materialize 到 .md 才算沉淀
- [ ] AC-A7: Factory 函数按配置选择实现（`EVIDENCE_STORE_TYPE=sqlite|hindsight`）
- [ ] AC-A8: edges 表支持文档间关系查询（1-hop expand）
- [ ] AC-A9: `KnowledgeResolver` 联邦检索全局层（F100 只读）+ 项目层（evidence.sqlite）
- [ ] AC-A10: `initialize()` 含 idempotent migrations + schema version + PRAGMA setup

### Phase B（自动索引 + SOP 集成）
- [ ] AC-B1: frontmatter 解析器，从 .md 提取 anchor/kind/status/title/summary
- [ ] AC-B2: 索引覆盖 `docs/features/`, `docs/decisions/`, `docs/plans/`, `docs/lessons-learned.md`
- [ ] AC-B3: feat-lifecycle 立项/关闭时自动 upsert 索引（与 SOP 集成）
- [ ] AC-B4: search 支持 kind/status/keyword 过滤，返回摘要+anchor（不返回全文）
- [ ] AC-B5: 比 grep docs/ 信噪比可测量提升（不返回 archive/废案/discussion）
- [ ] AC-B6: 新项目初始化时自动创建空 `evidence.sqlite`

### Phase C（向量增强，按需）
- [ ] AC-C1: SQLite vector extension 启用（按当时稳定版本），summary 嵌入向量生成
- [ ] AC-C2: 语义 rerank 可选开启

## Dependencies

- **Evolved from**: F024（Session Chain — 提供了 sealed session digest 数据源）
- **Related**: F003（原始记忆系统研究）
- **Related**: F042（三层信息架构 — 索引结构参考）
- **Related**: F100（Self-Evolution — 全局记忆/Skills 体系，F102 的项目层与 F100 的全局层互补）

## Risk

| 风险 | 缓解 |
|------|------|
| 索引与文档不同步（stale index） | 索引记录 source_hash，检索时可选 freshness check |
| FTS5 关键词检索精度不够 | Phase C 在同一 SQLite 上加向量表（终态基座不变） |
| 重蹈 retain 碎片化覆辙 | AC-A6 强制 retain 写 markers 表 + accepted 必须 materialize 到 .md |
| 多项目 SQLite 文件管理复杂度 | 每项目根目录一个 evidence.sqlite，gitignore + rebuild |
| rebuild 后丢失 accepted knowledge | 不会——accepted marker 先 materialize 到 .md，SQLite 只是编译产物 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 索引自动更新的触发点：git hook vs feat-lifecycle skill vs 两者都要？ | ⬜ 倾向 feat-lifecycle（零成本集成） |
| OQ-2 | ~~evidence.sqlite 要不要 .gitignore？~~ | ✅ **已决（KD-8）**：gitignore + rebuild，真相源是 .md |
| OQ-3 | ~~markers 审批流~~ | ✅ **已决（KD-9）**：分层审批，见下 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 本地优先，不上外部服务/图数据库 | 三猫全票通过 | 2026-03-11 |
| KD-2 | `reflect` 从存储层拆出 | 它是 LLM 编排能力，不是存储 primitive | 2026-03-11 |
| KD-3 | retain 降级为 candidate/marker queue | 防止碎片化垃圾入库（Hindsight 失败教训） | 2026-03-11 |
| KD-4 | 自动索引 > 手动 retain | 与 feat-lifecycle SOP 集成，90% 记忆沉淀自动化 | 2026-03-11 |
| KD-5 | **面向终态：SQLite 为基座，不搞 JSONL 中间态** | P1 铁律——Phase N 产物 Phase N+1 还在 | 2026-03-11 |
| KD-6 | **全局记忆跟猫走，项目记忆留在项目** | 全局=Skills/家规/MEMORY.md(F100)，项目=evidence.sqlite | 2026-03-11 |
| KD-7 | 每项目一个 evidence.sqlite（物理隔离） | 猫出征新项目不带旧项目 feat 细节 | 2026-03-11 |
| KD-8 | evidence.sqlite = gitignore + rebuild（编译产物不是真相源） | 真相源是 docs/*.md，rebuild 不丢知识 | 2026-03-11 |
| KD-9 | markers 分层审批：项目内知识有 anchor+dedupe → 自动 accept；影响全局层 → needs_review 走 F100 | GPT-5.4 建议，避免全自动/全人工二选一 | 2026-03-11 |
| KD-10 | Schema 拆分：evidence_docs（常规表）+ evidence_fts（FTS5 外部内容表） | 结构化过滤不该塞 FTS5，GPT-5.4 P1 | 2026-03-11 |
| KD-11 | 联邦检索 KnowledgeResolver：全局层只读接入，不写进项目库 | F100 定了"不发明新沉淀库"，GPT-5.4 P1 | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 三猫头脑风暴（opus + gemini + gpt52），方向收敛 |
| 2026-03-11 | 立项 |

## Review Gate

- Phase A: 跨 family review（缅因猫优先）— 接口设计需要多方确认
- Phase B: 同 family review（布偶猫 Sonnet 可）— 实现层面

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-03-11-memory-component-redesign-meeting-notes.md` | 三猫头脑风暴纪要 |
| **Research** | `docs/research/2026-02-25-memory-design/proposal.md` | 原始记忆系统设计（三层/marker/混合检索） |
| **Research** | `docs/research/2026-02-25-memory-design/memory-bench-mark.md` | Benchmark 调研 |
| **ADR** | `docs/decisions/005-hindsight-integration-decisions.md` | 知识共享决策（单 bank） |
| **Feature** | `docs/features/F024-session-chain.md` | Session Chain（数据源） |
