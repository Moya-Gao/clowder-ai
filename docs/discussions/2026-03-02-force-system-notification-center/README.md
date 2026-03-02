---
feature_ids: [F028]
topics: [push-notification, notification-center, decision-alert, auth]
doc_kind: discussion
created: 2026-03-02
updated: 2026-03-02
---

# 2026-03-02 Force System Notification Center

## 铲屎官原始需求摘录

> "我希望 发送测试通知 时强制走系统通知中心"
>
> "然后如果猫猫是告诉我要我做决策 的时候也要发通知中心"
>
> "以及请求权限那个mcp发起的也要那边通知"
>
> "需要有啥配置吗？ 一直卡测试中"

## 需求解读

1. 即使 Cat Cafe 页面在前台，测试推送也必须进入系统通知中心。
2. 需要铲屎官拍板/决策的猫猫消息必须进入系统通知中心。
3. MCP `request_permission` 触发的权限请求通知必须进入系统通知中心。
4. UI 不能出现“发送测试通知”长期卡在“发送中...”无反馈的体验问题。
