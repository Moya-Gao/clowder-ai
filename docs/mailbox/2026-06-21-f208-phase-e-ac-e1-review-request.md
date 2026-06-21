# Review Request: F208 Phase E AC-E1 — DossierDistillationProposal schema + store + routes

Review-Target-ID: f208-phase-e
Branch: feat/f208-phase-e
PR: #2461

## What

新建 `DossierDistillationProposal` 概念（KD-16），独立于 F231 `propose_profile_update`。包括：
- 共享类型：`DossierDistillationProposal`, `DistillationSourceEvent`, `DistillationEvidenceRef`
- Store port + InMemory 实现，状态机：`pending → approved → applied` | `pending → rejected`
- Redis-backed store（TTL=0 Iron Rule #5，sorted set 索引 + pipeline 操作）
- REST 路由：POST/GET distillations, approve/reject/apply 生命周期
- Fail-closed：无 Redis → 路由不注册；空 evidenceRefs → 创建被拒（400）
- 幂等：sourceId 查重（同事件 → 返回已有 proposal，200 而非 201）

## Why

F208 Phase E = eval 回流蒸馏。Phase D 的 CVO 观察需要通道转化为画像总结层更新。
AC-E1 是蒸馏管道的基础层（schema + 持久化 + API）。后续 AC-E2 接入 feat-lifecycle
checkpoint，AC-E3 做 Hub approve → cat apply 闭环。

## Original Requirements（必填）

> Phase E: eval 回流蒸馏 + 开源 baseline
> 蒸馏通道：新建 DossierDistillationProposal 概念（KD-16），不复用 F231
> 触发点：feat phase close + review complete
> 审批流：proposal → Hub pending → CVO approve/reject → 持球猫 apply
> 安全锁：baseHash + sourceId 幂等 + evidenceRefs fail-closed

- 来源：`docs/features/F208-capability-profile-routing.md` Phase E 段 + KD-16/17/18
- 砚砚（GPT-5.5）R1 设计讨论确认独立概念（非复用 F231）
- **请对照上面的 Phase E 描述判断交付物是否覆盖 AC-E1 scope**

## Tradeoff

1. 不复用 F231 `propose_profile_update`——语义不同（关系 primer vs 能力画像总结），目标路径不同，审批粒度不同。复用 = 语义污染（KD-16）
2. 状态机比 F231 简单：无 `approving` 中间态——KD-18 说 v1 不在 approve 时写文件，cat apply 是独立步骤
3. Redis store 不用 Lua 脚本——pipeline 够用，状态转换已有 read-check-write 保护（单线程 Redis + pipeline exec 原子）

## Architecture Ownership（必填）

Architecture cell: identity-session
Map delta: none
Why: 在 `cats/services/stores/` 既有模式下新增 Store + 在 `routes/` 新增 endpoint，未创建新 cell

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- `dossier-distillations.ts` 路由注册在 `if (redisClient)` 块内是否正确

## Open Questions

### 技术 OQ（给 reviewer）

1. **Redis pipeline 原子性**：`markApproved`/`markRejected` 先 `get` 再 pipeline `hset` + `zrem`。两步之间有竞态窗口（另一个猫同时 approve 同一 proposal）。v1 可接受吗？（生产场景：CVO 只有一个，且 approve 需要 Hub 交互，竞态概率极低）
2. **路由命名**：`/api/dossier/distillations` vs F152 已有的 `/api/distillations`（expedition distillation）。两者用 alias 在 `routes/index.ts` 区分（`dossierDistillationRoutes` vs `distillationRoutes`）——请确认命名不混淆

### 价值 OQ（给 CVO，如有）
无

## Next Action

请 review 代码质量、schema 设计、状态机正确性、Redis pattern。
APPROVE/BLOCKING verdict 落 PR #2461 comment。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f208-phase-e/gpt52`
- Start Command: `pnpm review:start`
- Ports: 后端 only（无前端改动），reviewer 可直接读代码 + 跑测试

## 自检证据

### Spec 合规
Quality Gate Report 已通过（本轮 2026-06-21）：
- 愿景覆盖：AC-E1 全 5 项需求 ✅
- Phase E 分阶段交付：CVO 批准（KD-6/KD-7）
- Dogfood 豁免：后端基础设施，无 user-visible UI

### 测试结果
- dossier-distillation-store.test.js → 23/23 pass ✅
- dossier-distillation-routes.test.js → 14/14 pass ✅
- dossier-distillation-redis-store.test.js → 12/12 pass ✅
- pnpm check → 0 errors ✅
- pnpm -r build → exit 0 ✅

### 相关文档
- Feature: `docs/features/F208-capability-profile-routing.md`
- KD-16/17/18（蒸馏概念、契约 schema、v1 不自动 commit）

[宪宪/claude-opus-4-6🐾]
