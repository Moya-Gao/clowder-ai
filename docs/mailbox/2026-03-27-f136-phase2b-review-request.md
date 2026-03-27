# Review Request: F136 Phase 2b — Hub Connector Config UI → Secrets Endpoint

Review-Target-ID: f136-phase2b
Branch: feat/f136-phase2b-hub-secrets-ui

## What

`HubConnectorConfigTab.tsx` 一个文件的改动（-39/+27 lines）：

1. `handleSave` 从 `PATCH /api/config/env` 改为 `POST /api/config/secrets`
2. 去掉 `!f.sensitive` 过滤器 — 敏感字段（token）现在也能通过 UI 保存
3. 敏感字段从只读 div 改为 `type="password"` input
4. 成功消息从"需重启 API 服务"改为"连接器正在自动重连"
5. 底部 banner 从 amber "需重启" 改为 green "自动生效，无需重启"
6. 删除"所有凭证为敏感字段，请手动配置 .env"的 fallback block

## Why

F136 Phase 2（PR #784）完成了后端：`POST /api/config/secrets` + connector gateway hot-reload。但前端 Hub 配置向导仍在用旧的 `/api/config/env`（block sensitive vars），导致 token 无法在 UI 编辑。此 PR 补上前端对接，完成 F136 MVP 用户故事的最后一公里。

## Original Requirements

> Hub 的配置面板从「只读展示」变成「可读可写可即时生效」。
> — F136 spec, 铲屎官 2026-03-23

- 来源：`docs/features/F136-unified-config-hot-reload.md`
- **请对照上面的摘录判断：改完后 Hub 配置向导是否做到"可读可写可即时生效"？**

## Tradeoff

所有 connector 字段统一走 `/api/config/secrets`（不再区分 sensitive/non-sensitive 走不同端点）。因为所有 connector 字段都在 allowlist 里，分两条路径只增加复杂度不增加安全性。

## Open Questions

1. 敏感字段用 `type="password"` 是否足够？（placeholder 区分"已设置"和"未设置"）
2. 是否需要为此前端改动补 component 测试？（目前无 HubConnectorConfigTab 测试文件）

## Next Action

请 review 代码改动，确认交付物符合 F136 愿景。

## 自检证据

### Spec 合规

- [x] 敏感字段可在 UI 编辑（password input）
- [x] 保存走 `/api/config/secrets`（allowlist-gated, loopback-guarded）
- [x] 保存后自动热更新（success message 反映）
- [x] 不再提示"需重启"/"编辑 .env"

### 测试结果

```
pnpm gate: PASSED (SHA 70f577ca, rebased on latest origin/main)
- build: passed (all packages)
- tsc --noEmit: passed
- tests: all passed (api 6066, web, mcp-server)
- lint: passed
- check: passed
```

### 相关文档

- Plan: `docs/plans/2026-03-27-f136-phase-2-connector-hot-reload.md`
- Feature: F136 / BACKLOG
- Backend PR: #784 (merged)
