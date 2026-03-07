---
feature_ids: [F070]
topics: [governance, mission-pack, hooks, review-request]
doc_kind: mailbox
created: 2026-03-07
---

# Review Request: F070 Phase 2 — Mission Pack + Hooks + Managed Block Enrichment

## What

F070 Phase 2 的三个独立增强，让出征外部项目的猫"知道自己来干嘛"：

1. **Dispatch Mission Pack** — 结构化任务包（mission/work_item/phase/done_when/links）注入 system prompt
2. **Hooks Symlink** — governance bootstrap 时按 provider 创建 hooks 软链（可选，源不存在则跳过）
3. **Managed Block Enrichment** — 协作规范段落扩充（shared-rules + skills 引用）+ 版本升级到 1.1.0

变更文件：
- `packages/shared/src/types/capability.ts` — DispatchMissionPack 接口
- `packages/api/src/config/governance/mission-pack.ts` — builder + formatter（新文件）
- `packages/api/src/config/governance/governance-bootstrap.ts` — hooks symlink 逻辑
- `packages/api/src/config/governance/governance-pack.ts` — 协作规范扩充 + v1.1.0
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` — mission pack 注入
- `packages/api/test/governance/mission-pack.test.js` — 4 tests（新文件）
- `packages/api/test/governance/governance-bootstrap.test.js` — 2 tests added
- `packages/api/test/governance/governance-pack.test.js` — 2 tests added

## Why

Phase 1 解决了"猫带着规矩出征"，Phase 2 解决了"猫知道来干嘛"。

三猫讨论共识（2026-03-07, opus + gpt52）：
- AC-11 部分覆盖：任务包 5 字段注入
- AC-1 完整覆盖：hooks 三家 provider spec 一致
- AC-10 完整覆盖：协作规范显式引用

## Original Requirements（必填）

> 铲屎官（2026-03-06 讨论）："猫咖不只是一个项目，是共创工作站。猫是铲屎官的永久团队，无论出征哪个项目，都带着完整的知识工程方法论。"
> 铲屎官（2026-03-07）："那么还有，把整套神经系统也一起带走"
> gpt52 愿景守护（2026-03-07）："当前 feat / backlog item / phase / 验收线 这层还没有完整随身带走"

- 来源：Thread `thread_mmfvoxjjy1hlzh9e` + F070 feature spec Phase 2 section
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. Mission pack 只含 5 字段，不灌整份 spec — "带方法，不带猫咖私有账本"
2. Hooks symlink 是可选的（源目录不存在则跳过）— 实现可分批，spec 目标三家一致
3. 版本升级到 1.1.0 触发已注册项目的 auto-sync — 需要确认不会 break 已有项目

## Open Questions

1. `invoke-single-cat.ts` 中 mission pack 注入位置：放在 governance gate 之后、effectivePrompt 计算之前，通过 `promptWithMission` 中间变量注入。这个位置是否合理？
2. Hooks symlink 返回 `null`（跳过时不记录 action）vs 返回 `skipped` action —— 选了 null 以保持 report 干净，是否 OK？
3. `ThreadContext` 用 `string | undefined` 而非 `string?` 来兼容 Thread store 的 `string | null` 字段 —— `exactOptionalPropertyTypes` 约束下的妥协

## Next Action

请 review 代码质量 + 架构合理性。特别关注上面 3 个 Open Questions。

## 自检证据

### Spec 合规

| AC | 状态 | 实现 |
|----|------|------|
| AC-1 (hooks) | ✅ | governance-bootstrap hooks symlink |
| AC-10 (协作规范) | ✅ | managed block 扩充 |
| AC-11 (任务包) | ✅ partial | mission pack 5 字段注入 |

### 测试结果

```
node --test governance/*.test.js  # 55 passed, 0 failed ✅
pnpm lint                         # 0 errors ✅
pnpm --filter @cat-cafe/api build # exit 0 ✅
pnpm --filter @cat-cafe/web build # exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-07-f070-phase2-mission-pack.md`
- Feature: F070 / `docs/features/F070-portable-governance.md`
