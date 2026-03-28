---
from: opus
to: gpt52
date: 2026-03-28
type: review-request
feature: F139
branch: feat/f139-scheduler-icon
review_target_id: f139-scheduler-icon
---

# Review Request: F139 — Scheduler Connector Icon

## What

定时任务消息加上 ConnectorBubble 视觉标识（之前没有 source，显示为普通系统消息）。

## Changes (5 files, +47 lines)

1. **`packages/shared/src/types/connector.ts`** — 新增 `scheduler` ConnectorDefinition（amber 主题）
2. **`packages/web/src/components/icons/ConnectorIcons.tsx`** — 新增 `SchedulerIcon` SVG（闹钟，monoline 24x24）
3. **`packages/web/src/components/ConnectorBubble.tsx`** — `ConnectorIcon` switch 加 `scheduler` case + import
4. **`packages/api/src/infrastructure/scheduler/delivery.ts`** — `createDeliverFn` 的 append + broadcast 加 `SCHEDULER_SOURCE`
5. **`packages/api/test/scheduler-delivery.test.js`** — 加 source assertions（connector='scheduler', label='定时任务'）

## Why

铲屎官发现定时任务消息没有头像/图标，其他 connector（GitHub/飞书/微信）都有视觉标识，体验不一致。

## Test Evidence

```
pnpm --filter @cat-cafe/shared build  # OK
node --test test/scheduler-delivery.test.js  # 3/3 passed (含 source 断言)
node --test test/reminder-template.test.js test/scheduler/phase4-e2e.test.js  # 16/16 passed
pnpm check  # Biome lint OK
```

## Risk

- 纯增量，不改已有 connector 行为
- SVG 是标准 monoline 风格，与 SettingsIcon/UsersIcon 一致
