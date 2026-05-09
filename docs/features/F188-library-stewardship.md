---
feature_ids: [F188]
related_features: [F186, F102, F161]
topics: [memory, library, knowledge-graph, health, maintenance]
doc_kind: spec
created: 2026-05-06
---

# F188: Library Stewardship — 图书馆管护与成长

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

F186 建成了图书馆的骨架（Collection 联邦 + Scanner + Security + Graph + Query Replay + Lens），但 GBrain teardown 复盘发现：图书馆**建完了不等于能用好**。

铲屎官原话（2026-05-06）："Memory Health Dashboard 感觉很鸡肋，开发完成到现在好像没啥用到"、"全量重建索引！我们现在好像是启动的时候才会？"、"graph 到底是如何 link 起文档的？只看 frontmatter？还是会看文档里面的 ref？"、"聊天产出当然是你们自己来放呀"。

核心问题：知识进来没有管道、索引坏了没人知道、graph 连接稀疏、recall 质量没有反馈闭环。

## What

一条完整的价值链：**知识怎么进来 → 索引怎么建 → 质量怎么看 → 坏了怎么修 → 修完怎么验证**。

### Phase A: 运行期维护入口 ✅

运行期全量 rebuild API + Hub 按钮 + 最小状态可见面。不做完整 Durable Job Ledger，只做 memory jobs 的最小状态表（task id / status / progress / error / result）。

铲屎官/猫猫能在不重启服务的情况下触发全量重建索引，并看到进度。

### Phase B: Library Health Dashboard ✅

Memory Health Dashboard 增强：从"有多少东西"升级到"哪里脏了、漏了、坏了"。

指标：stale anchors（引用已删文件的锚点）、search miss / low-hit query（搜索质量缺口）、orphan edges（悬空图边）、replay drift（Query Replay 质量漂移趋势）、Knowledge Feed pending（等确认的知识候选积压量）、needs_review 积压。

### Phase C: Graph Fidelity ✅

提升 Typed Evidence Graph 的连接密度 + 修复 graph 运行期 bug + 让 graph 变成人能读懂、愿意看的知识工作台。

**Bug fixes（铲屎官实测 + 砚砚代码分析）**：
1. edges 表 schema 不一致：root evidence.sqlite 只有 3 列（from_anchor/to_anchor/relation），代码 getRelated() 查 6 列 → 查询报错导致 graph 无边
2. `inferCollectionId` silent skip：anchor 无法推断 collection 时整个节点 + 边被静默丢弃，无日志
3. `inferCollectionIdSync` 设计缺陷：collection ID 是 `project:cat-cafe` 但 anchor 是裸 `"F188"`，sync 路径永远匹配不上
4. unresolved placeholder 在 mixed sensitivity graph 中泄露/不一致：private edge 发现的 unresolved anchor 需要统一 opaque 化，且 node/edge endpoint 必须一致
5. case-insensitive 查询 anchor（如 `f186`）只显示中心节点：GraphResolver 需用 canonical anchor 贯穿 edge lookup / emitted endpoints，同时保留受 store 约束的 raw alias 做多跳展开

**三种新 edge 来源**：
1. WikiLink `[[...]]` → edge（Scanner 已提取 WikiLink 到 FTS 关键词，差最后一步写 `addEdge()`）
2. Markdown 链接 `[text](path)` → edge
3. F 编号引用（文档体里的 `F186` 等）→ edge

**Graph 信息可读性 + 感官质量**：铲屎官原话"F186 天知道是什么东西"、"显示的信息很让人费解"、"太丑了"、"字突破了那个椭圆"。Graph 展示不是把 anchor 和边画出来就算完成；用户必须一眼看出节点是什么、为什么相连、当前选中了什么。

**补充设计约束（Phase C readability follow-up）**：
- 节点主显示信息必须是 `anchor + 人可读短标题`，不能只显示裸 anchor；中心节点/选中节点必须显示完整 title。
- 节点形态必须优先服务文字可读性：禁止把长文字塞进固定圆/椭圆导致溢出；推荐圆角矩形 / pill / label card，宽度随内容或截断策略稳定。
- Graph 需要固定 Inspector（非一闪即逝 tooltip）：展示 anchor、title、kind、collection、sensitivity，以及与当前节点相连的关系列表。
- Legend / edge filter / stats 属于控制/说明区，不应被画布挤到底部或裁出 viewport；密集信息放侧栏或清晰的底部工具带。
- 稀疏图应能直接解释关系（边标签或 Inspector 关系列表）；密集图可以隐藏边标签，但必须能通过 hover/click 获得 relation/provenance。

### Phase D: Chat-to-Collection Materialization

聊天中产出的知识由猫猫审核后 auto-materialize 到目标 Collection。

管道两头已有（Knowledge Feed 30 分钟自动摘要 + approve API 支持 targetCollection），中间需要：猫猫侧触发流程 + materialize 后自动触发增量 reindex。

### Phase E: Replay Seed / Pin

手动 Pin 机制（铲屎官 + 猫猫主动标记 recall 结果好/坏）→ 接入 Query Replay 种子池。

每条 Pin 带 reason：`useful` / `wrong` / `missing` / `stale`。不做自动置信度标记（铲屎官否决：猫猫判断 recall 好坏本身不靠谱，标 low 可能实际 fit，标 high 可能垃圾）。

## Acceptance Criteria

### Phase A（运行期维护入口）✅
- [x] AC-A1: `POST /api/evidence/rebuild` 触发全量 rebuild，返回 task id
- [x] AC-A2: `GET /api/evidence/rebuild/:taskId` 返回 status / progress / error / result
- [x] AC-A3: Hub Memory 面板有 "重建索引" 按钮，点击后显示进度
- [x] AC-A4: rebuild 运行期间，search 仍可用（不阻塞读）

### Phase B（Library Health Dashboard）✅
- [x] AC-B1: Health Dashboard 展示 stale anchors 数量 + 列表
- [x] AC-B2: 展示 search miss / low-hit query 统计
- [x] AC-B3: 展示 orphan edges 数量
- [x] AC-B4: 展示 replay drift 趋势（如 Query Replay 已有数据）
- [x] AC-B5: 展示 Knowledge Feed pending + needs_review 积压

### Phase C（Graph Fidelity）✅
- [x] AC-C0a: edges 表 schema 迁移（补 from_collection_id / to_collection_id / edge_sensitivity / provenance / created_at 列）
- [x] AC-C0b: `inferCollectionId` 对裸 anchor（无 collection 前缀）不再 silent skip，降级为 fallback collection 或 warning
- [x] AC-C0c: `buildSubgraph` 返回的 graph 中，frontmatter `related_features` 边正常显示（bug 修复验证）
- [x] AC-C1: WikiLink `[[Target]]` 在 rebuild 时生成 edge（type: `wikilink`）
- [x] AC-C2: Markdown 链接 `[text](path)` 在 rebuild 时生成 edge（type: `doc_link`）
- [x] AC-C3: F 编号引用 `F186` 在 rebuild 时生成 edge（type: `feature_ref`）
- [x] AC-C4: orphan edges 统计接入 Health Dashboard
- [x] AC-C5: Graph 可视化美化（节点样式 + 布局 + 交互体验达到"铲屎官不说丑"标准）

### Phase C Follow-up（Graph 信息可读性 + 感官验收）✅
- [x] AC-C6a: 节点在图上显示 `anchor + 短标题`；中心/选中节点显示完整 title，用户能看懂 `F186` 是什么
- [x] AC-C6b: 节点形态不再使用固定圆/椭圆承载长文本；文字不得突破节点边界，长标题有稳定截断策略
- [x] AC-C6c: 点击节点后固定 Inspector 显示 anchor / title / kind / collection / sensitivity / 关系列表；hover tooltip 只能作为辅助，不是唯一信息入口
- [x] AC-C6d: Legend、edge filter、Nodes/Edges/Depth 等说明信息在侧栏或清晰工具带中展示，不被画布挤出 viewport
- [x] AC-C6e: 稀疏图（≤10 条 visible edges）显示 relation 名称；密集图至少在 Inspector/hover 中解释 relation + provenance
- [x] AC-C6f: `f186`/`F186` 浏览器验收截图必须证明：图居中、信息可读、控件完整可见、无文字溢出

### Phase D（Chat-to-Collection Materialization）
- [ ] AC-D1: 猫猫在 Knowledge Feed approve 时可以选择目标 Collection
- [ ] AC-D2: materialize 后自动触发增量 reindex
- [ ] AC-D3: materialize 产出的文件有 frontmatter（至少 doc_kind + created）

### Phase E（Replay Seed / Pin）
- [ ] AC-E1: 铲屎官可以在 RecallFeed 里 Pin 一条结果（标记 useful / wrong / missing / stale）
- [ ] AC-E2: 猫猫可以通过 API/MCP 标记 recall 结果
- [ ] AC-E3: Pin 数据接入 Query Replay 种子池

## Deferred / Non-goals

以下明确暂不做，附触发条件：

| 项 | 理由 | 触发条件（何时重新考虑） |
|----|------|------------------------|
| Scanner L2/L3 智能建议 | 对我们自家 docs 不值（docs 都是猫猫生成的，已有结构） | 外部 Collection ≥3 或单 Collection 大量缺 metadata |
| 空状态跨域扩搜引导 | 做不好都是噪音（铲屎官原话） | Health Dashboard 证明存在 repeated search miss 后再考虑，且只能 title-only / ≤3 条 |
| 完整 Durable Job Ledger | Phase A 的最小状态表足够 | memory jobs 类型 ≥3（reindex / graph extraction / health report / replay）且最小状态表不够支撑 retry / queue / parent-child 时 |
| GBrain compiled wiki / dream cycle 自动写回 | 永久 non-goal | 我们只做 derived read-model，不让它写回真相源。除非铲屎官明确推翻治理约束 |

## Dependencies

- **Evolved from**: F186（图书馆记忆架构 — 骨架已建，本 Feature 补运维与成长）
- **Related**: F102（记忆系统基础 — IndexBuilder / evidence.sqlite）
- **Related**: F161（ACP Carrier Generalization — Operation Context 的载体侧，互补）

## Risk

| 风险 | 缓解 |
|------|------|
| Phase A rebuild 阻塞 API 响应 | 后台 worker + 读不阻塞写（AC-A4） |
| Phase C edge 爆炸（大量低价值 edge） | 按 edge type 区分权重，Graph 可视化可按类型过滤 |
| Phase D materialize 写错 Collection | fail-closed：需要 owner 二次确认（继承 F186 AC-A10） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase A rebuild 进度：按文件数百分比 vs 按 Phase（scan / chunk / embed）？ | ✅ 按 Phase 阶段边界（scanning→indexing→cleanup→embedding→done） |
| OQ-2 | Phase B stale anchor 检测频率：rebuild 时顺带 vs 独立定时扫描？ | ⬜ 未定 |
| OQ-3 | Phase E Pin 的 UI 入口：RecallFeed 内嵌 vs 独立 Pin 管理页？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不做自动置信度标记，只做手动 Pin | 铲屎官否决：猫猫判断 recall 好坏不靠谱 | 2026-05-06 |
| KD-2 | 不拆成多个小 feature，合成一个 Stewardship | 铲屎官 + GPT-5.5 收敛：价值链是一条线，拆碎了每个都是半截能力 | 2026-05-06 |
| KD-3 | Phase A 做最小状态表，不做完整 Job Ledger | GPT-5.5 建议中间态：够看够用，等 job 类型多了再抽象 | 2026-05-06 |
| KD-4 | Graph UI 质量以信息可读性和感官验收为准，不以"画出了节点和边"为准 | 铲屎官反馈：裸 anchor、文字溢出、控件被裁会让 graph 虽然功能正常但不可用 | 2026-05-08 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-06 | GBrain teardown 复盘 → 缺口收敛 → 立项 |
| 2026-05-07 | Phase A merged (PR #1581) |
| 2026-05-08 | Phase C merged (PR #1585) — edge extraction pipeline + graph bug fixes + UI美化 |
| 2026-05-08 | Phase C review follow-up merged (PR #1596) — unresolved anchor redaction + doc_link path key stability |
| 2026-05-08 | Phase B merged (PR #1604) — 5 health metrics (stale anchors, search quality, orphan edges, replay drift, KF pending) + AC-C4 |
| 2026-05-08 | Phase C graph anchor/UI follow-up merged (PR #1606) — lowercase anchor canonicalization + compact graph labels |
| 2026-05-08 | Graph readability follow-up scoped — AC-C6a~C6f added after CVO feedback |
| 2026-05-08 | Graph readability follow-up merged (PR #1611) — readable node titles, persistent Inspector, side-panel controls, dense hub layout fixes |

## Review Gate

- Phase A-E: 跨猫 review（砚砚优先），涉及 UX 的 Phase（A3/B/E）需浏览器验证
- Graph readability follow-up: 必须用浏览器截图验证 `f186`/`F186` 两种输入，确认节点标题、Inspector、legend/filter/stats 全部可读且无裁切

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-05-03-gbrain-deep-dive/` | GBrain 拆解 + Memory 对比 + Library 架构讨论 |
| **Feature** | `docs/features/F186-library-memory-architecture.md` | 前驱：图书馆骨架 |
| **Feature** | `docs/features/F102-memory-system.md` | 基础：记忆系统 |
