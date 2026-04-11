---
doc_kind: review-request
feature_ids: [F156]
created: 2026-04-11
---

# Review Request: F156 — 私网访问配置可见性优化

Review-Target-ID: f156-private-network-ux
Branch: feat/f156-private-network-ux

## What

3 个小改动，让私网/Tailscale 访问配置对非程序员用户可见：

1. **env-registry 注册 `CORS_ALLOW_PRIVATE_NETWORK`** — Hub「设置 > 环境」页面现在能看到这个开关（`runtimeEditable: true`）
2. **优化关联变量描述** — `API_SERVER_HOST` 和 `FRONTEND_URL` 的 description 加了远程访问场景提示
3. **启动日志友好提示** — `API_SERVER_HOST=0.0.0.0` 但 `CORS_ALLOW_PRIVATE_NETWORK` 未开时，warn 一行提示

改动文件：`env-registry.ts`（+13）、`index.ts`（+9）、`.env.example`（+4）

## Why

F156 安全加固后，`CORS_ALLOW_PRIVATE_NETWORK` 成了手机/平板通过 Tailscale/局域网访问的必需配置，但它没有注册到 env-registry —— Hub 设置页看不到，用户根本不知道要配。铲屎官原话："社区很多小伙伴都不是程序员"。

## Original Requirements（必填）

> 铲屎官原话：
> "所有功能对于铲屎官必须友好不能偷偷摸摸藏起来不然我都不知道 到时候哪里配置 如何配置。社区很多小伙伴都不是程序员"
> "你甚至得在开源社区的setup 用手机猫猫的章节也写上"
- 来源：本会话铲屎官消息（2026-04-11）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 当前仍是粗放的"整个私网段"开关，精确 IP/域名 allowlist 记为 F156 FU-1 后续做
- 启动提示只在 `HOST=0.0.0.0` 时触发，不覆盖"用户忘了改 HOST 但想远程访问"的场景

## Open Questions

1. `CORS_ALLOW_PRIVATE_NETWORK` 的中文描述是否足够清晰？非程序员能看懂吗？
2. 启动提示的措辞是否合适？

## Next Action

请 review 代码，放行或提修改意见。

## 自检证据

### Spec 合规

| # | 要求 | 状态 | 代码位置 |
|---|------|------|----------|
| 1 | env-registry 注册 CORS_ALLOW_PRIVATE_NETWORK | ✅ | `env-registry.ts:106-115` |
| 2 | API_SERVER_HOST 描述优化 | ✅ | `env-registry.ts:101` |
| 3 | FRONTEND_URL 描述优化 | ✅ | `env-registry.ts:141-142` |
| 4 | 启动日志友好提示 | ✅ | `index.ts:1608-1614` |
| 5 | .env.example 加配置说明 | ✅ | `.env.example:30-33` |

### 测试结果

```
pnpm --filter @cat-cafe/web test  → 1998 pass, 1 fail (pre-existing SessionChainPanel) ✅
pnpm --filter @cat-cafe/api test  → 7544 pass, 2 fail (pre-existing tmux timeout) ✅
pnpm lint                         → 0 errors ✅
pnpm check                        → 0 errors ✅ (biome)
pnpm --filter @cat-cafe/api build → exit 0 ✅
check:env-example                 → 4/4 pass ✅
```

### 设计稿对照
glob designs/**/*.pen 匹配 F156: 无匹配 ➖ 无 UI 改动

### Artifact Hygiene
仓库根目录未跟踪媒体文件: 无 ✅

### 相关文档
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Follow-up: F156 FU-1 (精确 allowlist) + FU-2 (开源社区文档)
