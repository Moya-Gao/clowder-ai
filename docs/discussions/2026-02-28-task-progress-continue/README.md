---
feature_ids: [F045]
topics: [plan, checklist, task-progress, redis, resume]
doc_kind: discussion
created: 2026-02-28
---

# Discussion: Task Progress Persistence + Continue（计划持久化 + 继续按钮）

## Context

F045 已实现 NDJSON 可观测性（plan/checklist/telemetry/thinking 等），但早期的 Plan 恢复只覆盖 “浏览器 F5/页面重载”，不覆盖服务重启或 CLI 进程被杀的场景。

铲屎官提出：即使进程被杀，**todo/checklist 仍有价值**，应该能继续看到“上次进度”，并提供明确语义的继续入口（触发新 invocation，而不是恢复死进程）。

## 铲屎官原始需求摘录（≤5 行）

> “这个 Gap 是挺重要的。因为我们现在调用的 Codex CLI 以及 Claude Code，他们跑着跑着把他们的进程杀了。他们其实的 to-do list 是还在的。”  
> “我希望‘进程被杀/出错’的调用，显示为‘已中断（上次进度）’，并提供‘一键继续’（新 invocation）。”  
> “选 a！静默有点恐怖。”（继续必须是**可见消息**，可审计）  
> “右侧看板。”（继续入口放右侧看板）

## Decision

1. **持久化到 Redis**：按 `(threadId, catId)` 存 task progress snapshot（带 TTL），解决刷新/重启/进程被杀后“上次进度不可见”的问题。  
2. **右侧看板继续按钮**：仅在 `interrupted` 时展示 `继续`，点击确认后发送一条**可见** `🔁` 消息（包含上次 checklist 上下文）并触发新 invocation。  
3. **不做“恢复旧进程”**：继续语义是新 invocation；UI 明确标注 `已中断（上次进度）`，避免误导“还在跑”。

