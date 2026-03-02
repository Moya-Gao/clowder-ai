---
feature_ids: [F039]
topics: [websocket, diagnostics, debug]
doc_kind: discussion
created: 2026-03-02
updated: 2026-03-02
---

# Ghost Active 调试探针（Ring Buffer）

## 背景

在 F039 的 active-invocation 修复后，我们仍需保留一套低侵入排障手段，用于后续偶发“前端 active 状态与后端实际调用状态不一致”的时序定位。

## 需求边界（铲屎官语境）

- 这不是用户功能，是排障能力。
- 默认不干扰正常日志/性能。
- 隐私安全优先：不能采集消息正文、token、headers、用户输入。

## 本轮方案

- 默认关闭（不开开关不挂 `window.__catCafeDebug`）
- 内存 ring buffer（不落盘）
- 白名单字段记录（事件元数据）
- `dump()` 默认脱敏 threadId
- `dump({ rawThreadId: true })` 才输出原始 threadId，并标记 `RAW`
- TTL 默认 30 分钟，到期自动关闭并清空

## 风险与取舍

- 取舍：默认不落盘导致跨刷新证据丢失，但显著降低隐私与误外发风险。
- 风险：debug 配置被误设过大导致开销上涨。
- 缓解：`size` 强制 clamp 到 `50..500`。

## 下一步

- 先走本地 review（@gpt52）。
- 通过后开 PR，请铲屎官决定是否合入。
