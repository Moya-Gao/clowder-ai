---
feature_ids: []
topics: [pwa, mobile, performance, ui]
doc_kind: discussion
created: 2026-03-02
---

# PWA 移动端状态栏遮挡 + 首屏变慢讨论记录

> 日期：2026-03-02  
> 参与者：铲屎官、缅因猫（砚砚）

## Original Requirements（铲屎官原话摘录）

> “猫猫咖啡的pwa版本有点点小问题 我发现你看 这头这很容易出现这样把我们的 上方的任务栏 挡住”  
> “我在家里的时候也是走tailscale速度很快，不知道为什么这几天 速度很慢 点开得好几秒才能看到这些消息，你可以都看看是为什么吗？”

## 问题定义

1. iOS PWA standalone 模式下，顶部系统状态栏会遮挡应用 Header 内容。
2. 移动端打开 PWA 时，首屏“看到历史消息”的体感延迟变长。

## 调查结论（摘要）

- 顶部遮挡根因：Web 端仅实现了 `.safe-area-bottom`，缺失顶部安全区处理。
- 首屏慢根因（前端可控部分）：
  1. `useChatHistory` 首屏并发触发 4 个请求（messages/tasks/task-progress/queue），关键路径与次要面板抢带宽。
  2. PWA 配置使用 `dynamicStartUrl: true`（默认），启动页依赖网络拉取，未预缓存 `/`。

## 决策

- 补齐 `.safe-area-top` 并作用于 Header。
- 调整 `useChatHistory` 首屏请求优先级：先加载消息，再补 tasks/task-progress/queue。
- 调整 next-pwa 策略：`dynamicStartUrl: false` + `extendDefaultRuntimeCaching: true`，并保留 API `NetworkOnly`。
