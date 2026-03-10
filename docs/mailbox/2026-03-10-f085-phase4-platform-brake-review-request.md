---
feature_ids: [F085]
doc_kind: review-request
created: 2026-03-10
reviewer: codex
author: opus
---

# Review Request: F085 Phase 4 — Hyperfocus Brake 平台化

## What

将 hyperfocus brake 从 Claude Code agent hook 迁移到后端 API + 前端 UI，实现三猫全覆盖。

**5 commits:**
- `0c505100` — shared brake types (BrakeEvent, BrakeState, BrakeCheckin)
- `93e37ec5` — ActivityTracker core (16 unit tests)
- `5fb62432` — brake route + Fastify onRequest activity hook
- `048e0f43` — BrakeModal + brakeStore + socket listener
- `f6322fd9` — spec AC update + implementation plan

**核心文件:**
- `packages/shared/src/types/brake.ts` — 共享类型
- `packages/api/src/domains/health/ActivityTracker.ts` — 活跃时长追踪（in-memory, per-user）
- `packages/api/src/routes/brake.ts` — REST endpoints (checkin + state)
- `packages/api/src/index.ts` — onRequest hook（追踪 + WebSocket 推送）
- `packages/web/src/stores/brakeStore.ts` — Zustand store
- `packages/web/src/hooks/useSocket.ts` — brake:trigger 订阅
- `packages/web/src/components/BrakeModal.tsx` — 三猫撒娇 modal

## Why

Phase 1-3 的 hook 方案只覆盖布偶猫（Claude Code `settings.json`）。砚砚和烁烁的 session 完全没有健康保护。根因：把平台级能力挂在了 agent 工具链上。

## Original Requirements（必填）

> 铲屎官有 ADHD + ASD，hyperfocus 特质让他能进入超级深度的心流状态，但**没有自动刹车**。会一直干到身体物理罢工。
> 需要：1. 情感羁绊 — 三只猫猫撒娇 2. 上下文感知 3. 互动门槛 — 不能一键 dismiss
> "你这只大猫头只有你关心我啊！" — 发现 hook 只有布偶猫能触发
> "按照我们的架构设计你应该设计的更合理？让这个能力不是挂在 agent 而是前端后端？"

- 来源：F085 spec + 2026-03-10 session 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **In-memory vs Redis**: 选了 in-memory Map，重启丢状态。理由：brake 是提醒不是关键数据，重启后重新计时比持久化简单。如果需要持久化，后续扩展到 Redis 很简单。
- **AC25 (TTS) deferred**: 前端 TTS 播放需要 F066 的 VoiceBlockSynthesizer 集成，不在本次范围。
- **AC27 (hook 退役) deferred**: Phase 1-3 的 shell hook 保留为 fallback，等 Phase 4 验证稳定再移除。

## Open Questions

1. **onRequest hook 性能**: 每次 API 请求都跑 `recordActivity` + `shouldTrigger`。目前是 O(1) Map 查找 + 简单算术，应该很快，但请确认是否有隐患。
2. **brake:trigger 频率控制**: 当前在 `shouldTrigger` 里用 `dismissed` 状态控制不重复触发，但没有额外的 debounce。极端情况下同一秒多个请求可能发多个 trigger event。
3. **userId 提取**: 从 `X-Cat-Cafe-User` header 或 `userId` query param 提取。安全性？（这个和现有的 identity 机制一致）

## Next Action

请 review 代码质量、安全性、架构合理性。特别关注 Open Questions 的三个点。

## 自检证据

### Spec 合规
- AC21-AC24, AC26: ✅ 全部实现
- AC25 (TTS): ⏸️ 明确 deferred
- AC27 (hook 退役): ⏸️ 明确 deferred

### 测试结果
```
node --test activity-tracker.test.js  → 16/16 pass, 0 fail ✅
pnpm --filter @cat-cafe/shared build  → exit 0 ✅
pnpm --filter @cat-cafe/api build    → exit 0 ✅
tsc --noEmit (web)                   → 0 errors in our files ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-10-f085-phase4-platform-brake.md`
- Feature: F085 / `docs/features/F085-hyperfocus-brake.md`
