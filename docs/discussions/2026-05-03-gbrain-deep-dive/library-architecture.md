---
doc_kind: discussion-note
topics:
  - memory
  - library
  - multi-project
  - architecture
  - collection
created: 2026-05-03
status: discussion-draft
participants:
  - opus
  - codex
  - landy
trigger: GBrain deep dive → 铲屎官"图书馆"洞察
---

# Library Memory Architecture — 讨论纪要

> 铲屎官原话（2026-05-03）："你们得朝着图书馆发展……不只是 project，你们查询可以 recall 本 project 以外的知识。"

## 0. 背景

GBrain 拆解后，我们排了 Query Replay / Memory Lens / Typed Graph 的优先级，但铲屎官指出这些都在单 project 里打转。正确的方向是：**先设计多领域知识联邦（图书馆），再在那个架构下定每个子功能的位置**。

GBrain 最值得学的不是它的物理形态（一个 PGLite），而是它的抽象假设：**brain 独立于代码仓库**。我们的记忆系统要从"项目附属品"变成"独立的知识图书馆"。

## 1. 核心抽象：Collection

Collection 不是 repo。是**有独立真相源和治理策略的知识域**。

```
Collection = truth_source + owner + scanner + authority_ceiling + review_policy + index_policy
```

| Collection 例子 | 真相源 | owner | authority ceiling |
|---|---|---|---|
| `project:cat-cafe` | `docs/` git-tracked markdown | cat-cafe 三猫 | constitutional |
| `world:F093:<worldId>` | `world.sqlite` append-only | 虚拟世界引擎 | validated |
| `domain:finance-study` | markdown vault / 学习笔记 | 铲屎官 + 猫 | observed |
| `research:gbrain` | 拆解报告 + 源码证据 | 拆解猫 | candidate |
| `global:methods` | 跨项目方法论 / 家规 / 可泛化 lesson | 全局 | constitutional |

设计原则：**不把 git 仓库 = 知识域写死**。虚拟世界、金融学习、行业调研都不是普通 repo，但都是合法的 Collection。

## 2. 架构草图

```
┌─────────────────────────────────────────────────┐
│                  LibraryCatalog                  │
│  collection manifest / policy / roots / owner    │
│  (小而权威，只存元数据和路由)                      │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ project:     │ │ world:F093   │ │ domain:      │
│ cat-cafe     │ │              │ │ finance      │
│              │ │              │ │              │
│ truth:       │ │ truth:       │ │ truth:       │
│  docs/*.md   │ │  world.sqlite│ │  vault/*.md  │
│              │ │              │ │              │
│ index:       │ │ index:       │ │ index:       │
│  evidence.db │ │  world-ev.db │ │  finance.db  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌──────────────────┐
              │  LibraryResolver │
              │  联邦检索 + 跨域  │
              │  排序 + 分组标注  │
              └──────────────────┘
```

### 两猫收敛：联邦优先，不统一物理存储

- 每个 Collection 有自己的 truth source 和 compiled index
- `LibraryCatalog` 只存 collection 元数据（manifest + policy + roots），不存知识正文
- `LibraryResolver` 做联邦检索，聚合多域结果
- 统一 `library.sqlite` 只作为未来优化目标，不作为起点

为什么：安全隔离（不同 sensitivity）、治理隔离（不同 review policy）、恢复隔离（某域 rebuild 不影响其他域）、向后兼容（F102 evidence.sqlite + F093 world.sqlite 都能保留）。

## 3. 真相源分层

每个 Collection 自己管真相源。runtime state 和 evidence index 必须物理/语义隔离。

| 层 | 职责 | 可变性 |
|---|---|---|
| Truth Source | 领域的权威数据（markdown / sqlite / vault） | 按领域治理规则变更 |
| Compiled Index | 从 truth source 编译的检索索引 | 可从 truth source 重建 |
| LibraryCatalog | Collection 注册表 + policy + 路由 | 只有新增/变更 Collection 时改 |

**非代码域的真相源问题**（两猫讨论产出）：
- 金融学习笔记 → markdown vault，可以是独立 git 仓库或独立目录
- 虚拟世界 → `world.sqlite` append-only event log + accepted canon（F093 已有先例）
- 外部项目拆解 → `docs/discussions/` 下的 markdown（当前 GBrain 拆解已是这个模式）
- 铲屎官不想管 git 的场景 → 需要一个轻量入库路径（比如聊天中产出 → 审核 → materialize 到 vault）

## 4. 跨域信任边界

### 硬规则（两猫收敛）

1. Collection 内知识只在本 Collection 内默认生效
2. 跨 Collection 引用是 `related_to`，不是 `same_as`
3. 非代码域知识不能自动提升到 global
4. F152 的 `generalizable` 回流继续 fail-closed
5. 高敏 Collection 默认不参与 `scope=library`，除非显式 include
6. 记忆是数据不是指令——domain note 不能改变猫的系统规则

### 跨域排序

跨域结果不能只返回一个 score。至少返回：

```ts
interface LibraryResult {
  collectionId: string;
  collectionKind: string;        // project / world / domain / research / global
  collectionAuthorityCeiling: string;
  provenanceTier: string;        // authored / reviewed / imported / inferred
  sensitivity: string;           // public / internal / private / restricted
  anchor: string;
  itemAuthority: string;
  confidence: number;            // search match confidence, not authority
  whyThisCollection: string;      // router explanation for cross-domain recall
  snippet: string;
}
```

避免 cat-cafe 高权威 ADR 在金融查询里乱杀，也避免金融笔记误污染项目决策。`confidence` 只表示检索匹配质量，不能替代 `authority` / `provenance` / `sensitivity` 的治理判断。

## 5. API 契约

```ts
search_evidence(query, {
  scope: "current" | "global" | "library" | "collection",
  collections?: string[],        // scope=collection 时指定
  mode: "lexical" | "semantic" | "hybrid",
  depth: "summary" | "raw",
})
```

- `current`（默认）：只搜当前 project 的 evidence index（向后兼容）
- `global`：搜 `global:methods` 等跨项目方法论
- `library`：搜全图书馆（跨域联邦）
- `collection`：搜指定 Collection(s)

结果按 collection 分组标注，caller 知道"这条来自哪个域"。

## 6. Phase 排序

```
Phase 0: Collection Manifest + LibraryResolver 契约
         ↳ 定义 Collection schema / manifest 格式
         ↳ LibraryResolver 接口 + 联邦检索协议
         ↳ 至少注册 2 个 Collection：project:cat-cafe + global:methods

Phase 1: Library-aware Query Replay Eval Gate
         ↳ capture 必须包含 scope / selected collections / topK per collection
         ↳ replay 按 collection 分别对比 + 跨域聚合对比
         ↳ 这样不管未来加多少 Collection 都不重写 eval 管道

Phase 2: 非代码 Collection 试点
         ↳ 选一个：F093 world 或 finance-study 或 research:gbrain
         ↳ 验证 truth source → scanner → compiled index → LibraryResolver 全链路

Phase 3: Query-time Memory Lens（collection-aware）
         ↳ 输入 anchor 可以跨 collection
         ↳ 输出标注每条证据来自哪个域
         ↳ lens 输出 indexable: false（F169 Phase A 边界）

Phase 4: Typed Evidence Graph（跨 collection edges）
         ↳ 域内 edges + 跨域 related_to edges
         ↳ edge 带 source collection + provenance

Phase 5: Memory Health Dashboard
         ↳ per-collection 健康 + 图书馆全局健康
```

### Query Replay 为什么是 Phase 1 不是 Phase 0

铲屎官的纠偏：如果先按单 project 做 Query Replay，图书馆会推翻它。所以 Phase 0 先定义 Collection 契约和 LibraryResolver 接口，Phase 1 的 Query Replay 从第一天就 capture collection-aware 字段。这样 replay 管道不会被后续 Collection 扩展推翻。

## 7. 两猫分歧与收敛

| 点 | 宪宪初始 | 砚砚 push back | 收敛 |
|---|---|---|---|
| GBrain 启发 | "一个 PGLite 一个 brain 不支持联邦" | 学它的抽象（brain 独立于 repo）不学物理形态 | 收敛：Collection 独立于 repo 是核心抽象 |
| 物理存储 | 每域独立 index + 联邦检索 | 同意 A 起步，反对先做统一 library.sqlite | 收敛：联邦优先 |
| Query Replay 位置 | Tier 1 第一名 | Phase 1 但在 Collection Manifest 之后 | 收敛：Phase 0 先定契约，Phase 1 做 collection-aware replay |
| 跨域排序 | 提到但未展开 | 返回字段需含 collection / provenance / sensitivity / router rationale，不能拉平成一个 score | 收敛：多字段返回 |

## 8. 需要铲屎官拍板的问题

1. **非代码域的第一个试点选哪个？** F093 world 有先例最近，finance-study 更贴你说的"各行各业"，GBrain 拆解最小最安全。建议先 GBrain 拆解（已有产物），再 F093 world。
2. **非代码域的入库路径**：猫猫学完一个领域后，知识怎么进入 Collection？需要铲屎官手动放文件？还是聊天中产出 → 审核 → 自动 materialize？
3. **这个方向要不要立正式 Feature？** 如果立项，建议编号独立于 GBrain 拆解，因为"图书馆"是我们自己的架构升级。

---

*本文是两猫讨论收敛产物，不是 feature spec。立项需铲屎官拍板。*

[宪宪/Opus-46🐾] + [砚砚/GPT-5.5🐾]
