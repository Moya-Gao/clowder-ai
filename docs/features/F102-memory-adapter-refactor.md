---
feature_ids: [F102]
related_features: [F024]
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

## What

### Phase A: Adapter 接口抽象 + 解耦

将 `IHindsightClient` 重命名为 `IEvidenceStore`，`reflect` 拆出存储层，路由和启动链路改为依赖注入。

核心接口（最小化）：
```typescript
interface IEvidenceStore {
  search(query: string, options?: SearchOptions): Promise<EvidenceItem[]>;
  upsert(items: EvidenceItem[]): Promise<void>;
  deleteByAnchor(anchor: string): Promise<void>;
  getByAnchor(anchor: string): Promise<EvidenceItem | null>;
  health(): Promise<boolean>;
  initialize?(): Promise<void>;
}
```

改造文件：
- `HindsightClient.ts` → 保留为 `HindsightEvidenceStore`（legacy adapter）
- `evidence.ts` 路由 → 注入 `IEvidenceStore`
- `callback-memory-routes.ts` → 注入 `IEvidenceStore`，retain 降级为 marker/candidate
- `reflect.ts` → 拆为独立 `ReflectionService`（不属于存储层）
- `index.ts` → factory 按配置选实现
- `hindsight-import-p0.ts` → 适配新接口

### Phase B: LocalIndexStore + 自动索引

实现 `LocalIndexStore`：基于 `evidence_catalog.jsonl` 的本地索引，零外部依赖。

索引 Schema：
```jsonl
{"anchor":"F042","kind":"feature","status":"spec","title":"Prompt Audit","summary":"...","keywords":["prompt","skill"],"outlinks":["F041"],"sourceHash":"abc123","updatedAt":"2026-03-11"}
```

数据源自动索引：
- `docs/features/*.md` — feat-lifecycle 立项/关闭时自动更新
- `docs/decisions/*.md` — ADR 创建时自动更新
- `docs/plans/*.md` — plan 创建时自动更新
- sealed session digest — session 封存时自动入索引

检索链路：`metadata filter → keyword search → top anchors → source read`

### Phase C: 进阶搜索（按需，非必须）

如果 Phase B 的关键词检索不够用，加 Orama/MiniSearch 做进程内全文+语义搜索。或 SQLite FTS5 + edges 表存显式关系。仅在 Phase B 跑出真实缺口后启动。

## Acceptance Criteria

### Phase A（Adapter 接口抽象 + 解耦）
- [ ] AC-A1: `IEvidenceStore` 接口定义，不含 Hindsight 术语（无 bankId/recall/retain）
- [ ] AC-A2: `HindsightEvidenceStore` 实现 `IEvidenceStore`（legacy 兼容）
- [ ] AC-A3: 所有路由通过 DI 注入 `IEvidenceStore`，不直接 import HindsightClient
- [ ] AC-A4: `reflect` 拆为独立服务，不在 `IEvidenceStore` 接口内
- [ ] AC-A5: `retain-memory` callback 降级为 candidate/marker queue（不直写长期库）
- [ ] AC-A6: Factory 函数按配置选择实现（`EVIDENCE_STORE_TYPE=local|hindsight`）

### Phase B（LocalIndexStore + 自动索引）
- [ ] AC-B1: `LocalIndexStore` 实现 `IEvidenceStore`，读写 `evidence_catalog.jsonl`
- [ ] AC-B2: 索引覆盖 `docs/features/`, `docs/decisions/`, `docs/plans/`，含 frontmatter 解析
- [ ] AC-B3: feat-lifecycle 立项/关闭时自动更新索引（与 SOP 集成）
- [ ] AC-B4: search 支持 kind/status/keyword 过滤，返回摘要+anchor（不返回全文）
- [ ] AC-B5: 比 grep docs/ 信噪比可测量提升（不返回 archive/废案/discussion）

### Phase C（进阶搜索，按需）
- [ ] AC-C1: 选定嵌入式搜索组件（Orama/MiniSearch/SQLite FTS5）
- [ ] AC-C2: 语义/全文混合检索可用

## Dependencies

- **Evolved from**: F024（Session Chain — 提供了 sealed session digest 数据源）
- **Related**: F003（原始记忆系统研究）
- **Related**: F042（三层信息架构 — 索引结构参考）

## Risk

| 风险 | 缓解 |
|------|------|
| 索引与文档不同步（stale index） | 索引记录 sourceHash，检索时可选 freshness check |
| Phase B 关键词检索精度不够 | Phase C 备选方案已调研（Orama/SQLite FTS5） |
| 重蹈 retain 碎片化覆辙 | AC-A5 强制 retain 降级为 candidate queue |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 索引自动更新的触发点：git hook vs feat-lifecycle skill vs 两者都要？ | ⬜ 倾向 feat-lifecycle（零成本集成） |
| OQ-2 | Phase C 触发条件的量化标准（文档数？检索延迟？） | ⬜ 建议 >500 docs 或 >200ms |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 本地优先，Phase 1 不上外部服务/图数据库/向量库 | ~150 docs 规模不需要，三猫全票通过 | 2026-03-11 |
| KD-2 | `reflect` 从存储层拆出 | 它是 LLM 编排能力，不是存储 primitive | 2026-03-11 |
| KD-3 | retain 降级为 candidate/marker queue | 防止碎片化垃圾入库（Hindsight 失败教训） | 2026-03-11 |
| KD-4 | 自动索引 > 手动 retain | 与 feat-lifecycle SOP 集成，90% 记忆沉淀自动化 | 2026-03-11 |
| KD-5 | Phase 1 不走 Deep Research | 方向已够清楚，Deep Research 留给 Phase 2 选型 | 2026-03-11 |

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
