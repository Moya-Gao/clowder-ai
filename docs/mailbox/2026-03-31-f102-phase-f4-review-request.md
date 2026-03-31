---
feature_ids: [F102]
doc_kind: review-request
created: 2026-03-31
---

# Review Request: F102 Phase F-4 — Global Knowledge Foundation

Review-Target-ID: f102-phase-f4
Branch: feat/f102-phase-f4

## What

新建 `GlobalIndexBuilder`，编译全局知识源（Skills + MEMORY.md 条目）到 `~/.cat-cafe/global_knowledge.sqlite`。将现有 `KnowledgeResolver`（已实现 RRF fusion + graceful degradation）真正接入 globalStore，evidence search route 透明融合 project + global 结果。

核心变更（7 files, +445/-12）：
- **新增**: `GlobalIndexBuilder.ts` (175 lines) — 扫描 Skills + MEMORY.md，编译到独立 SQLite
- **修改**: `factory.ts` — 创建 global store + GlobalIndexBuilder，传入 KnowledgeResolver
- **修改**: `evidence.ts` — search handler 使用 KnowledgeResolver.resolve() 而非直连 evidenceStore
- **修改**: `index.ts` — 启动时自动 global rebuild（non-fatal）
- **修改**: `env-registry.ts` — 注册 GLOBAL_KNOWLEDGE_DB 环境变量
- **新增**: `global-index-builder.test.js` (6 tests) — Skills/Memory/degradation/idempotency/federation

## Why

F102 路线图 Stage 2：猫出征新项目时带走全局知识层。之前 KnowledgeResolver 已实现但 globalStore 未接入（Phase B 遗留占位）。本 Phase 补齐最后一环。

## Original Requirements

> 铲屎官原话："面向终态设计，不要搞中间态脚手架。猫猫出征其他项目时，全局记忆跟猫走。"
> 铲屎官原话："在 dare 里搜 Redis 坑能命中 cat-cafe 的教训"
- 来源：`docs/features/F102-memory-adapter-refactor.md` Phase F-4 节
- **请对照上面的摘录判断：全局知识编译 + 联邦检索是否满足"跨项目记忆跟猫走"**

## Tradeoff

- 全局索引 lexical-only（无 embedding），因为全局知识量小（~60 docs），BM25 足够；后续按需加向量
- Memory 的 project slug 取路径最后一段（`-Users-lysander-projects-relay-station-cat-cafe` → `cafe`），简单但够用
- 不索引项目 CLAUDE.md（项目特定规则，不属于全局知识）

## Open Questions

1. **global:skill/ anchor 碰撞**：如果两个项目 skills 目录有同名 skill（不太可能但理论上），anchor 会碰撞。目前不处理——需要关注吗？
2. **MEMORY.md 跨项目重复**：同一个 feedback 可能在多个项目 memory 中出现。当前各自独立索引（不同 anchor），RRF dedup 会合并同锚点但不会合并同内容不同锚点。这可接受吗？

## Next Action

请 review 代码质量、架构选择、安全性。放行后进 merge-gate。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| F4-1: Skills → global store | ✅ | test: AC-F4-1, AC-F4-1b |
| F4-2: MEMORY.md → global store | ✅ | test: AC-F4-2 |
| F4-3: ~/.cat-cafe/ + env + startup rebuild | ✅ | test: AC-F4-3 + factory/index wiring |
| F4-4: Route uses KnowledgeResolver | ✅ | test: AC-F4-4 |
| F4-5: Graceful degradation | ✅ | test: AC-F4-5 |

### 测试结果

```
memory tests: 188/188 pass, 0 fail ✅
pnpm check: 0 errors ✅
pnpm lint: 0 errors ✅
pnpm build: exit 0 ✅
GlobalIndexBuilder.ts: 175 lines (< 200 warn limit) ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-31-f102-phase-f4-global-knowledge-foundation.md`
- Feature: `docs/features/F102-memory-adapter-refactor.md` (Phase F-4 section)
- Roadmap: Stage 2 of F/G/Gap 整体规划
