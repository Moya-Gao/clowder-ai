# Review Request: F139 Phase 3A — Conversational Task Registration + Panel Final State

Review-Target-ID: f139-phase-3a
Branch: feat/f139-phase-3a

## What

13 commits delivering 9 ACs (F1-F4, G1-G5):

**Backend (7 commits):**
- Schema V8: `dynamic_task_defs` table + `error_summary` column on `task_run_ledger`
- `DynamicTaskStore` — CRUD for persistent dynamic task definitions
- `TemplateRegistry` + 3 MVP templates (reminder, web-digest, repo-activity)
- `error_summary` capture in RunLedger (truncated to 500 chars)
- `hydrateDynamic()` in TaskRunnerV2 — load persisted tasks on startup
- API endpoints: `GET /templates`, `POST /tasks`, `DELETE /tasks/:id`, `PATCH /tasks/:id`
- Startup wiring in `index.ts`: create store, hydrate before `start()`

**MCP (1 commit):**
- 3 tools in collab surface: `list_schedule_templates`, `register_scheduled_task`, `remove_scheduled_task`

**Frontend (1 commit):**
- NL input box deleted, replaced with conversational CTA
- Footer: `All healthy` / `Attention needed` based on lastRun outcome (not cumulative)
- Status dots: green/red/gray per task
- `error_summary` inline for failed tasks
- Source badge ("user") + delete button for dynamic tasks

**Cleanup (4 commits):**
- Biome formatting, dead NL test removal, schema version assertion updates, feature index regen

## Why

铲屎官发现 Phase 2 有两个致命问题：(1) "3 failed" 累计计数器无可操作性且无错误日志，(2) NL 输入框完全不工作——API 只解析不注册。更关键的是 NL 输入框违反 W1 愿景（猫是 Agent 不是 API）。

方向修正：不止血，直接面向最终状态开发。

## Original Requirements（必填）

> "你这里3 failed是什么意思？以及这里用自然语言添加任务好像也不支持吧？没打通？" — 铲屎官 02:48
> "笨蛋 NL 解析我们不能这个！！而是你下面引导用户直接在thread里和任何一只猫对话注册任务！！" — 铲屎官 02:58
> "呃，我感觉我们直接面向最终状态开发，而不是止血。你直接按照我们最终的愿景直接开发就行了" — 铲屎官 03:12

- 来源：当前 thread 对话（F139 Phase 3A 讨论，2026-03-27 凌晨）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 模板目前是 code-defined（不是 JSON/YAML runtime），需要发版才能加新模板。Phase 3B 可做 Pack marketplace。
- `execute` 函数在 3 个 MVP 模板中都是 stub（log only）——这一期只负责"注册链路通了"，真实执行逻辑属于各模板自身的 feature。
- 前端未做 detail 展开面板（task row 可查历史通过 `/tasks/:id/runs` API，但 UI 上没有展开交互），留给后续迭代。

## Open Questions

1. **execute stub 够不够？** 3 个模板的 gate 返回 `run=true` 但 execute 只 log。对"愿景有没有真正从假入口变成对话驱动"这个判断点，注册链路完整但任务不会真正产出内容。
2. **callbackDelete 实现方式**：MCP server 原来没有 DELETE helper，我在 `schedule-tools.ts` 里局部写了一个。是否应该提到 `callback-tools.ts` 成为公共 helper？

## Next Action

请审查代码，重点关注：
- 注册链路完整性：MCP tool → API → SQLite → hydrate → runtime
- 前端是否真正体现"对话驱动"（CTA 引导 vs 旧 NL 输入框）
- error_summary 是否从 catch → ledger → API → frontend 全链路通达
- 模板 paramSchema 设计是否合理

## 自检证据

### Spec 合规

| AC | Status | Evidence |
|----|--------|----------|
| F1 | Done | NL input deleted, CTA text in SchedulePanel.tsx |
| F2 | Done | `hasAttention = tasks.some(t => t.lastRun?.outcome === 'RUN_FAILED')` |
| F3 | Done | `error_summary` in schema V8 + RunLedger record/query |
| F4 | Done | Status dots (green/red/gray) + error_summary inline display |
| G1 | Done | `GET /templates` + `cat_cafe_list_schedule_templates` MCP tool |
| G2 | Done | `cat_cafe_register_scheduled_task` MCP tool |
| G3 | Done | DynamicTaskStore + hydrateDynamic + startup wiring in index.ts |
| G4 | Done | Source badge + delete button + `DELETE /tasks/:id` + unregister |
| G5 | Done | 3 templates: reminder, web-digest, repo-activity |

### 测试结果

```
pnpm gate                                    # ✅ GATE PASSED (SHA: 363c59ec)
  - Scheduler tests: 40 passed, 0 failed (store/registry/hydration/display-contract/ledger)
  - MCP tests: 14 passed, 0 failed (schedule-tools + tool-registration)
  - Schedule route tests: 11 passed, 0 failed
  - Full test suite: all passed
  - Lint + check + build: all passed
```

### 相关文档

- Plan: `docs/plans/2026-03-27-f139-phase-3a-conversational-registration.md`
- Feature: `docs/features/F139-unified-schedule-abstraction.md`
- Key Decisions: KD-10 (对话驱动), KD-11 (模板化先行), KD-12 (不止血直接最终态)
