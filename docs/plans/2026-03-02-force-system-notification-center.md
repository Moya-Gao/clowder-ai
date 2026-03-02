---
feature_ids: [F028]
topics: [push-notification, notification-center, decision-alert]
doc_kind: plan
created: 2026-03-02
updated: 2026-03-02
---

# Force System Notification Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 让三类事件即使在 Cat Café 页面可见时也进入系统通知中心：测试通知、权限请求、需要铲屎官决策的通知。

**Architecture:** 新增前端通知策略函数（可测），Service Worker 基于策略决定是否绕过“页面可见即抑制”规则；后端为决策类回复打 `cat-decision-*` tag；`sendTest` 增加超时保护，避免“发送中...”无穷等待。

**Tech Stack:** TypeScript, Next.js PWA worker, Fastify API, Vitest, Node test
