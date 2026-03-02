---
feature_ids: [F039]
topics: [bugfix, observability, websocket]
doc_kind: bug-report
created: 2026-03-02
updated: 2026-03-02
severity: P1
status: fixed
---

# Bug Report: Ghost Active 时序缺证据

## 现象

偶发场景下，前端 `hasActiveInvocation` 与后端调用真实状态不同步，导致“正在回复中/Stop/steer 可用性”表现异常。现有日志难以复盘事件先后顺序。

## 根因

缺少 thread 维度的最小时序证据采样机制（`queue_updated` / `intent_mode` / `done` / reconnect 等），排障依赖人工猜测。

## 修复

新增前端调试 ring-buffer 探针（默认关闭）：

- 只采集事件元数据白名单
- 默认脱敏 threadId
- 显式 raw 导出才允许原值
- TTL 到期自动关闭并清空
- 内存内存储，不写磁盘

## 回归测试

- `src/debug/__tests__/invocationEventDebug.test.ts`
- `src/hooks/__tests__/useSocket-thread-guard.test.ts`

## 风险评估

- P0 风险（隐私泄漏）已通过字段白名单 + 默认脱敏压制。
- P1 风险（长期开启）通过 TTL 自动失效压制。
