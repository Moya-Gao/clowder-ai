---
feature_ids: [F051]
topics: [quota, notification, ui, pwa]
doc_kind: discussion
created: 2026-03-03
updated: 2026-03-03
---

# 2026-03-03 F051 愿景重构讨论（猫粮看板 + 通知 + UI）

## 背景

铲屎官反馈当前状态是“能看到一部分功能，但体验不达标”：

- 猫粮看板有止血与架构改造，但观感与可读性不足
- 通知开关虽存在，但预期是 macOS/iPhone 级系统通知
- 在其他页面工作时经常收不到关键消息

原话核心：

> “希望这次重构后是符合我预期的猫粮看板以及通知能力，而且要好看。”

## 现状诊断

1. F051 Phase 1-2 已完成数据链路与 probe 语义治理，但目标偏“工程正确”，不等于“产品完成”。
2. 通知能力目前是 Web Push 路线，缺少可诊断可观测层（设备状态、投递结果、失败修复引导）。
3. Hub 页面信息密度高但层级弱，状态提示与操作区视觉优先级不足。

## 决策

1. **不新开 feature 编号**，继续在 F051 内推进 Phase 3。
2. F051 愿景升级为三件事同权：
   - 官方同值猫粮看板
   - 系统级通知可达
   - 产品级 UI 与状态可读性
3. 通知能力采用“能力矩阵 + 投递诊断 + 降噪策略”落地，避免只有一个总开关。
4. iPhone 路线在 Phase 3 拍板为 **PWA Web Push**（前提：主屏安装 + 权限同意），原生壳/APNs 留到后续 phase 评估。

## 范围边界

本轮（Phase 3）包含：

- Web 端通知可达性治理（含 iPhone PWA 条件提示）
- 猫粮看板与通知页产品化 UI 重做
- 阈值告警策略与去重策略（防刷屏）

本轮不包含：

- 原生 iOS/macOS App 壳（如 APNs 原生客户端）
- Antigravity 官方抓取完整接入

## 路线图锚点

- **Phase 4（方向）**：macOS 菜单栏 companion（额度摘要 + 手动刷新 + 告警入口）
- **Phase 5（方向）**：Widget/通知中心摘要，补齐轻量常驻可见性

## 开放问题

1. iPhone 端是否仅依赖 PWA Web Push，还是进入原生壳路线。
2. 阈值告警默认策略（剩余阈值 vs 已用阈值）由谁拍板。
3. 是否需要对通知投递做持久化统计（用于可靠性面板）。

## 下一步

- 执行 `docs/plans/2026-03-03-f051-notification-ui-productization-plan.md`
- 开发完成后走 `quality-gate -> request-review -> merge-gate`
