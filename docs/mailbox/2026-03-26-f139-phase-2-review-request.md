# Review Request: F139 Phase 2 — Schedule Panel + Cron + NL Config

Review-Target-ID: f139-phase-2
Branch: feat/f139-phase-2

## What

F139 Phase 2: 把 Phase 1a/1b 纯后端调度引擎可视化 + 补全 cron/context/NL 三个维度。

Backend:
- `TriggerSpec` 扩展: interval | cron (cron-parser v5)
- `ContextSpec`: session × materialization 写入 ExecuteContext
- `RunLedger.stats()` + `queryBySubject()`: 聚合统计 + 按 subject 过滤
- `TaskRunnerV2.getTaskSummaries()`: 全元数据暴露给 API
- Cron 任务用 setTimeout 链（非 setInterval）避免时间漂移
- `/api/schedule/tasks`, `/api/schedule/tasks/:id/runs`, `/api/schedule/tasks/:id/trigger`
- `/api/schedule/nl-config`: NL → TriggerSpec 提案（regex，Phase 2 不自动注册）

Frontend:
- `SchedulePanel` 组件: 扁平任务列表 + 彩色标签 (PR/Repo/System/Custom)
- 调度 Tab: 与开发/知识平齐的顶级 Workspace Tab (SVG clock icon, KD-7)
- Scope filter: All / Current Thread (AC-C3b-2)
- No-thread 任务始终可见 (AC-C3b-3)
- NL config CTA bar (暖色调 Cat Cafe palette)
- `workspaceMode` 类型扩展: `'dev' | 'knowledge' | 'schedule'`

## Why

铲屎官："不建议你这个可配置是编辑到什么 Markdown 文档里……能让人类跟你直接说自然语言，你帮别人去编辑，或者你有个 UI 去把东西呈现出来"

Phase 1a/1b 已经建好引擎但用户看不到。Phase 2 补前端展示 + cron 维度 + NL 入口。

## Original Requirements（必填）

> "不建议你这个可配置是编辑到什么 Markdown 文档里……能让人类跟你直接说自然语言，你帮别人去编辑，或者你有个 UI 去把东西呈现出来"
> "未来可能会有很多铲屎官让你接入的某些定制的任务？比如每天帮我叼来邮箱的某些邮件？"
> "这个不错！！！不要ux画的好看最后写出来都是丑丑的界面 买家秀和卖家秀了属于是。记得最后一定要让砚砚对照你的实现和设计的"

- 来源: F139 讨论 (2026-03-25/26, cat-cafe-collab thread)
- **请对照上面的摘录判断：交付物是否解决了铲屎官的问题？**
- **特别关注**：设计→代码保真度对照（铲屎官明确要求砚砚做此项检查）

## Tradeoff

- `event` trigger 延后 (OQ-1 仍 open)，Phase 2 只做 cron + interval
- NL config 返回提案不自动注册 (Phase 3 CRUD)
- 扁平列表取代 V1 thread 硬分组（铲屎官确认 V2 方向）

## Open Questions

1. **设计保真度**: 请对照 `designs/F-schedule-abstraction.pen` V2 (y=1821) vs SchedulePanel 实现，标注不一致处
2. `parseNlToTrigger` 目前是 regex-based，复杂描述会返回 null。Phase 3 可考虑 LLM-backed 解析
3. SchedulePanel 的 scope filter 目前是客户端过滤 lastRun.subject_key，大量任务时可能需要服务端过滤

## Next Action

请 review 以下重点：
1. **API 契约**: `/api/schedule/*` 路由设计是否合理
2. **类型扩展**: TriggerSpec union + ContextSpec 对现有 TaskSpec 的兼容性
3. **前端**: SchedulePanel 组件质量 + 设计保真度
4. **NL 解析**: parseNlToTrigger 边界情况

## 自检证据

### Spec 合规

7 个 AC 全部实现（AC-C1 的 event 部分按 OQ-1 延后，已在 spec 标注）。

### 测试结果

```
F139-specific tests  → 40/40 pass, 0 fail
pnpm test (API)      → 5845 pass, 1 fail (pre-existing Redis guard)
pnpm check           → 1708 files, 0 errors
pnpm lint            → 4 packages Done, 0 errors
pnpm -r build        → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-03-26-f139-phase-2-schedule-panel.md`
- ADR: `docs/decisions/022-unified-schedule-abstraction.md`
- Feature: F139 / `docs/features/F139-unified-schedule-abstraction.md`
- UX V2 Design: `designs/F-schedule-abstraction.pen` (frame zKz75, y=1821)
