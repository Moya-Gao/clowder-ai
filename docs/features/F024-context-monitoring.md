---
feature_ids: [F024]
related_features: []
topics: [context, monitoring]
doc_kind: note
created: 2026-02-26
---


# F024: 中途消息注入 + Context 存活监控 + 自动交接

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 铲屎官 2026-02-13

## What
- **F24**: 三个子能力全部完成：(1) 中途消息注入 [x]：4e85883 ChatInputActionButton 改为 hasActiveInvocation 时同时展示 Stop + Send 按钮。(2) Context 存活监控 [x]：fcf949d SessionChainPanel + ContextHealthBar。(3) 自动交接触发 [x]：3772cd9 SessionSealer + per-cat seal thresholds + hook 注入。

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。

## Links
- [Bug Report: useAgentMessages 卸载后 timeout 计时器泄漏](../bug-report/use-agent-messages-timeout-unmount-leak/bug-report.md)
- [Bug Report: thread 切换后 timeout 串线到当前线程](../bug-report/thread-timeout-cross-thread-leak/bug-report.md)
- [Bug Report: thread_summary 跨线程泄漏](../bug-report/2026-02-21-thread-summary-cross-thread-leakage/bug-report.md)
- [Bug Report: 分屏 thread 切换时 invocation 状态串线（Stop 方块错位/消失）](../bug-report/2026-02-19-split-pane-invocation-state-leak/bug-report.md)
- [Bug Report: Thread 切换瞬间 UI 串线（刷新后恢复）](../bug-report/2026-02-17-thread-switch-transient-cross-thread-ui/bug-report.md)
- 历史来源：旧 BACKLOG 归档条目（be27a44^:docs/BACKLOG.md）

## Key Decisions
- 历史记录未单列关键决策

## Dependencies
- **Related**: 无
- 无显式依赖声明

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`4e85883`，`fcf949d`，`3772cd9`.
