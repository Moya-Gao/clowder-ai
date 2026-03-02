---
feature_ids: [F045]
debt_ids: []
topics: [codex, todo_list, task_progress, status-panel]
doc_kind: bug-report
created: 2026-03-02
---

# Bug Report: Codex 计划不显示（todo_list schema 漂移）

## 1) 报告人

- 报告人：铲屎官（thread `thread_mm4w2nv7197ysmp0`）
- 现象：右侧状态栏看不到 Codex 的执行计划 checklist（仅显示“等待调用/历史参与”）。

## 2) 复现步骤（期望 vs 实际）

1. 让 Codex 在任务中输出 todo plan（或运行带 checklist 的长任务）。
2. 打开线程 `http://localhost:3001/thread/thread_mm4w2nv7197ysmp0`。
3. 查看右侧状态栏。

期望：出现 Codex 的“执行计划 (x/y)” checklist。  
实际：`/api/threads/:id/task-progress` 里 `codex.tasks=[]`，前端无可渲染计划。

## 3) 根因分析

- F045 的 Codex transform 仍按旧字段解析：`item.todo_items[{id,content,status}]`。
- 当前 `codex-cli 0.106.0` 的 `todo_list` 事件使用新字段：`item.items[{text,completed}]`。
- 结果：transform 将任务解析为空数组，后续快照始终是空 plan。

实测证据（本地复现命令）：

```bash
codex exec --json "Please use your todo list feature..." > /tmp/codex-todo.ndjson
```

样例事件：

```json
{"type":"item.started","item":{"type":"todo_list","items":[{"text":"Todo 1","completed":false}]}}
```

## 4) 修复方案

- `transformCodexEvent()` 的 `todo_list` 解析改为兼容双 schema：
  - 旧 schema：`todo_items[{id,content,status}]`
  - 新 schema：`items[{text,completed}]`
- 统一映射到内部 `tasks[{id,subject,status}]`：
  - `completed=true` → `status='completed'`
  - 其他 → `status='pending'`
- 保持空列表仍下发（清理 UI 的既有语义不变）。

## 5) 验证方式

- Red：新增单测覆盖 `item.items` 新 schema（未修前失败）。
- Green：修复后单测通过，并回归旧 schema 用例。
- 手工：右侧状态栏可显示 Codex checklist。
