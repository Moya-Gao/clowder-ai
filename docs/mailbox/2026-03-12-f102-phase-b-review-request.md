---
feature_ids: [F102]
topics: [memory, adapter, evidence-store, review-request]
doc_kind: review-request
created: 2026-03-12
---

# Review Request: F102 Phase B — 自动索引 + SOP 集成 + 评测

## What

F102 Phase B 在 Phase A 的 6 接口 + SQLite FTS5 基座上，补全了：
- **路由 DI 解耦** (AC-A4): callback-memory-routes, evidence.ts, reflect.ts 全部通过可选 DI 参数注入接口，不再直接依赖 HindsightClient
- **KnowledgeResolver RRF 融合** (AC-A9): project + global store 双源检索，RRF(k=60) 排序 + anchor 去重（project 优先）
- **IndexBuilder 增强** (AC-B1/B2): anchor: 字段识别 + lessons 目录支持 + NOCASE 查询
- **Search keyword filter** (AC-B4): keywords LIKE 过滤 + superseded_by 降权
- **rebuild-index CLI** (AC-B3/B6): `pnpm rebuild-index` 手动触发，自动创建 evidence.sqlite
- **Eval corpus + signal-noise** (AC-B5/B7): 15 queries Recall@5=100%, SQLite 0 noise vs grep 35 noise files

18 files changed, +1244 -66 lines. 8 commits. 77 memory tests all pass.

## Why

Hindsight 停用后，search_evidence MCP 回调需要本地替代。Phase A 建了接口骨架，Phase B 让它真正工作：路由走 SQLite，索引覆盖 4 类文档，信噪比可测量优于 grep。

## Original Requirements（必填）
> "我们希望把我们自己的经验沉淀，自己写一个符合我们实践的记忆组件，就给自己用。"
> "面向终态设计，不要搞中间态脚手架。猫猫出征其他项目时，全局记忆跟猫走。"
- 来源：`docs/features/F102-memory-adapter-refactor.md:21-22`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Last-write-wins anchor collision**: 多个文档共享同一 feature_ids (如 F042 被 lesson 覆盖) 目前未做优先级排序。Phase B 的 eval corpus 按实际索引状态设计期望值，不假装问题不存在。Phase C 可加 kind 优先级。
- **feat-lifecycle 自动 upsert = CLI 手动触发**: plan 明确标注 skill 层面集成暂用 CLI 入口，不是自动 hook。

## Open Questions

1. **Anchor collision 策略**: 当 feature spec 和 lesson 共享 feature_ids 时，应否按 kind 优先级排序（feature > plan > lesson）？目前 last-write-wins。
2. **decisions 索引率低**: 大多数 ADR 的 feature_ids 为空数组，extractAnchor 跳过。是否要添加基于文件名的 anchor 推断（如 `005-hindsight.md → ADR-005`）？

## Next Action

请 review 代码质量 + 架构合理性。重点关注：
- Route DI 注入模式是否向后兼容（legacy Hindsight path 无改动）
- KnowledgeResolver RRF 融合逻辑
- Eval corpus 是否覆盖足够场景

## 自检证据

### Spec 合规
全部 Phase B AC (B1-B7) + 延续 AC (A4, A9) 已闭合。Quality gate report 确认。

### 测试结果
```
memory tests → 77/77 pass, 0 failed ✅
pnpm lint (tsc --noEmit) → 0 errors ✅
pnpm build → exit 0 ✅
system-prompt-builder → 3 pre-existing failures on main (not F102) ⚠️
```

### 相关文档
- Feature: `docs/features/F102-memory-adapter-refactor.md`
- Plan: `docs/plans/2026-03-12-f102-phase-b-auto-indexing.md`
- Branch: `feat/f102-phase-b` (8 commits)
