# Review Request: F168 Phase D — Intake Guardian Hardline

Review-Target-ID: f168-phase-d
Branch: feat/f168-phase-d

## What

F168 Phase D: Intake 硬门禁 + Guardian 自动触发。6 个功能 commit：

1. **GuardianMatcher** — 从 roster 自动选 guardian 猫（排除 author + reviewer，跨族优先，降级到同族）
2. **IntakeChecklist** — 5 项证据清单（4 必填 + 1 可选），`validateIntakeChecklist()` 系统验证
3. **GuardianAssignment store** — `CommunityIssueItem` 新增 `guardianAssignment` 字段，Redis serialize/hydrate
4. **request-guardian 端点** — `POST /api/community-issues/:id/request-guardian`，accepted 状态才能请求
5. **guardian-signoff 端点** — `POST /api/community-issues/:id/guardian-signoff`，checklist 证据验证 + 身份校验
6. **guardian-status 端点** — `GET /api/community-issues/:id/guardian-status`，供 merge-gate 查询

另关闭 AC-A1/A2/A3（skill + backend 已覆盖）+ 更新 merge-gate skill Step 6.5。

## Why

铲屎官要"系统验证非人工叮嘱"的 intake 门禁。之前愿景守护靠猫猫自觉，没有强制机制。Phase D 把 guardian 选择、checklist 证据、merge 拦截全链路系统化。

## Original Requirements（必填）

> "现在全看我喊你们去看有点麻烦"
> "你们得想想得做管理的啊，不然上次这个任务派发给什么线程的猫，然后他们进度如何"
> "issue xxx 的 pr yyy 现在正在 xxx 线程负责"

- 来源：`docs/features/F168-community-ops-board.md` L20-22
- Phase D 具体 AC：AC-D1~D4（Intake 硬门禁 + guardian sign-off + checklist 证据验证）
- **请对照上面的摘录判断：guardian 自动选择 + checklist 系统验证 是否解决了"全看我喊"的管理负担**

## Tradeoff

- Guardian 选择基于静态 roster，不考虑当前负载（后续可扩展 thread activity 权重）
- Checklist 5 项是 hardcode 的 `DEFAULT_INTAKE_CHECKLIST`，后续可配置化
- Merge-gate Step 6.5 目前以注释形式添加（条件触发：社区 intake PR），不是所有 PR 都走

## Open Questions

1. **GuardianMatcher 排除逻辑**：同时排除 author + reviewer 后，如果只剩 1 只猫（如 gemini），是否合理？还是应该有最低候选人数？
2. **signoff 拒绝后的流程**：当前 `approved: false` 只记录 reason，没有自动触发返工。reviewer 认为是否需要自动化？
3. **checklist 证据格式**：目前 `evidence` 是自由文本。是否需要结构化（如链接到 test output、commit SHA）？

## Next Action

请 review 以下重点：
- `GuardianMatcher.ts` 的选猫逻辑是否正确覆盖降级场景
- `guardian-signoff` 端点的权限校验（403 只允许 assigned guardian）
- `validateIntakeChecklist` 的必填项验证逻辑
- 整体 API 设计是否与现有 triage/resolve 端点风格一致

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f168-phase-d/gpt52`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（隔离端口）

## 自检证据

### Spec 合规

- AC-A1/A2/A3: [x] skill + backend integration verified
- AC-D1: [x] request-guardian 端点 + GuardianMatcher
- AC-D2: [x] GuardianMatcher 跨族优先 + 双排除 + 降级
- AC-D3: [x] guardian-status 端点供 merge-gate 查询
- AC-D4: [x] DEFAULT_INTAKE_CHECKLIST + validateIntakeChecklist + signoff 强制验证

### 测试结果

```
pnpm test → 8719 passed, 0 failed
pnpm lint → 0 errors (pre-existing CSS token warnings only)
pnpm check → 0 biome errors (F148 backlog-missing is pre-existing on main)
pnpm build → exit 0

Phase D specific:
- guardian-matcher.test.js: 7/7 pass
- intake-checklist.test.js: 5/5 pass
- guardian-assignment-store.test.js: 4/4 pass
- community-issues-routes.test.js: 33/33 pass (9 new guardian tests + 24 existing)
Total: 49 new/modified tests, all green
```

### Root Artifact Guard

```
git status --short | rg media/design → empty
git diff --name-only origin/main...HEAD | rg media/design → empty
```

### 相关文档

- Plan: `docs/plans/2026-04-19-f168-phase-d-intake-guardian.md`
- Feature: `docs/features/F168-community-ops-board.md`
- Skill update: `cat-cafe-skills/merge-gate/SKILL.md` (Step 6.5)
