---
doc_kind: review-request
feature_ids: [F141]
created: 2026-03-26
---

# Review Request: F141 Phase A — GitHub Repo Inbox Webhook Adapter

## What

GitHub webhook 事件（PR opened / Issue opened / PR ready_for_review）自动投递到 per-repo inbox thread 并触发猫执行 triage。

核心交付：
- `GitHubRepoWebhookHandler`：12 步 pipeline（HMAC → filter → allowlist → draft skip → dedup → normalize → thread binding → deliver → trigger → confirm）
- `RedisDeliveryDedup`：claim/confirm/rollback 三阶段去重
- `verifyGitHubSignature`：raw body HMAC-SHA256 + timingSafeEqual
- `ConnectorWebhookHandler` 接口扩展支持 rawBody
- `github-repo-event` ConnectorDefinition + ConnectorBubble icon 分支
- 条件启动：3 个 env vars + Redis 全配置才注册

## Why

铲屎官和砚砚共识：maintainer 最痛的是"有个新东西出现了，系统完全没感知"。F140 解决已注册 PR 的追踪，F141 补上发现层缺口。

## Original Requirements（必填）

> 铲屎官原话（2026-03-26 thread `F140 讨论`）：
> "你看之前的猫猫是如何知道什么时候要挂PR，什么时候要挂CICD的...有的应该是你们主动注册关注哪个 PR 或者 issue 但是有的又是怎么样的？被通知吗？还是都是要主动注册？"

- 来源：`docs/features/F141-github-repo-inbox.md` Why 节
- **请对照上面的摘录判断：webhook 自动发现 + inbox 投递 + 猫唤醒 triage 是否解决了铲屎官的问题**

## Tradeoff

- Phase B reconciliation（定时扫描补偿）不在本 PR，另开 plan
- 多猫路由不做——Phase A 单点收件 `GITHUB_REPO_INBOX_CAT_ID`
- 并发创建 inbox thread 依赖 Redis binding store 的原子 Lua（KD-20），未加额外分布式锁

## Open Questions

1. `ConnectorWebhookHandler.handleWebhook` 新增第三个参数 `rawBody?: Buffer`——现有 Feishu handler 不用它，但签名变了。请确认向后兼容性
2. `addContentTypeParser` scoped 到 webhook plugin——请确认不会影响其他路由的 JSON 解析
3. `GitHubRepoHandlerDeps` 用了 `Pick<IConnectorThreadBindingStore, ...>` 和函数类型——请确认 DI 接缝设计是否合理

## Next Action

请 **砚砚（codex）** 做 cross-family review：
- 代码质量 + 安全（HMAC verification 路径、Redis dedup 原子性）
- Spec 合规（20 KDs 全覆盖）
- 愿景对照（发现层缺口是否被填上）

Review-Target-ID: f141
Branch: feat/f141-repo-inbox

## 自检证据

### Spec 合规

AC-A1~A8 全覆盖（A9/A10 Design Gate 已完成）。KD-11~KD-20 全覆盖。

### 测试结果

```
node --test packages/api/test/github-repo-webhook.test.js  # 23 passed, 0 failed
node --test packages/api/test/connector-webhook-route.test.js  # 6 passed, 0 failed (no regression)
pnpm check   # Checked 1708 files. No errors.
pnpm lint    # API + Web clean
```

### 相关文档

- Spec: `docs/features/F141-github-repo-inbox.md`
- Plan: `docs/plans/2026-03-26-f141-phase-a-github-repo-inbox.md`
- Skill: `cat-cafe-skills/refs/repo-inbox.md`、`cat-cafe-skills/refs/ownership-gate.md`
- PR: #755
