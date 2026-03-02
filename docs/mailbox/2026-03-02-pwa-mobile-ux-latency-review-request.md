---
feature_ids: []
topics: [pwa, mobile, performance, review-request]
doc_kind: review-request
created: 2026-03-02
---

# Review Request: PWA 移动端顶部遮挡 + 冷启动消息慢

## What

- 修复 iOS PWA standalone 顶部状态栏遮挡 Header。
- 优化首屏请求优先级：先拿消息，再补充 tasks / task-progress / queue。
- 调整 next-pwa 启动页策略，预缓存 `/`，减少冷启动网络等待。

## Why

- 铲屎官实测反馈了两个直接影响日常使用的问题：
  1. UI 可见缺陷（Header 被挡）
  2. 冷启动等待过长（点开几秒才看到消息）
- 目标是先解决“看得见 + 先看见消息”，不引入消息缓存陈旧风险。

## Original Requirements（必填）

> “猫猫咖啡的pwa版本有点点小问题 我发现你看 这头这很容易出现这样把我们的 上方的任务栏 挡住”  
> “我在家里的时候也是走tailscale速度很快，不知道为什么这几天 速度很慢 点开得好几秒才能看到这些消息，你可以都看看是为什么吗？”

- 来源：[docs/discussions/2026-03-02-pwa-mobile-ux-latency/README.md](../discussions/2026-03-02-pwa-mobile-ux-latency/README.md)
- 请对照上面摘录判断：这次修复是否直接改善了“顶部遮挡 + 点开慢”

## Tradeoff

- `useChatHistory` 将次要面板请求后置，换取“消息优先到达”；代价是 tasks/queue 面板会稍晚几十到几百毫秒完成 hydration。
- PWA 启动页改为预缓存 `/`，提升冷启动速度；代价是 HTML 更新依赖 SW 更新周期（由 revision 管理）。

## Open Questions

1. `dynamicStartUrl: false` 在咱们当前无登录态差异页面下是正确选项，后续若首页变成强动态（按用户返回不同 HTML）是否要改回 `true`？
2. `useChatHistory` 的“先消息后次要面板”是否需要进一步做可观测指标（例如首屏消息首字节时间）？

## Next Action

- 请 `@gpt52` 做 reviewer，重点看：
  1. 请求优先级调整是否有状态一致性风险（thread switch / abort）
  2. PWA 缓存策略变更是否会引入功能回归
  3. safe-area 顶部修复是否覆盖 iOS standalone 场景

## 自检证据

### Spec 合规（Quality Gate 摘要）

- 原始需求已回引并落盘（discussion 文档）
- 根因与修复均落盘到 bug report
- 变更均有对应测试或构建产物证据

### 测试结果

- `pnpm --filter @cat-cafe/web test` → 595 passed, 0 failed
- `pnpm --filter @cat-cafe/web lint` → exit 0, 0 errors（存在历史 warnings 10 条，非本次新增）
- `pnpm --filter @cat-cafe/web build` → success

### 相关文档

- Discussion: [docs/discussions/2026-03-02-pwa-mobile-ux-latency/README.md](../discussions/2026-03-02-pwa-mobile-ux-latency/README.md)
- Bug Report: [docs/bug-report/2026-03-02-pwa-header-overlap-and-cold-open-latency/bug-report.md](../bug-report/2026-03-02-pwa-header-overlap-and-cold-open-latency/bug-report.md)
- 代码改动：`packages/web/src/app/globals.css`, `packages/web/src/components/ChatContainerHeader.tsx`, `packages/web/src/hooks/useChatHistory.ts`, `packages/web/next.config.js`
