# Review Request: F136 Phase 2 — Connector Hot Reload + Secrets Endpoint

Review-Target-ID: f136
Branch: feat/f136-phase2-connector-hot-reload

## What

F136 Phase 2 实现 connector 热更新 MVP：
1. **`POST /api/config/secrets`** — 新 endpoint，allowlist 限定 10 个 connector env vars（含 sensitive），loopback guard + 审计日志（keys only）
2. **ConnectorGateway hot reload** — configEventBus subscriber 监听 connector key 变更，500ms debounce 后执行 stop → start → re-wire hooks
3. **Hook re-wiring** — 提取 `wireGatewayHooks()` 和 `gatewayDeps` 避免重复，restart 后自动重新绑定 invokeTrigger/queueProcessor/messagesOpts/callbackOpts

新增文件（4 production + 5 test）：
- `packages/api/src/config/connector-secrets-allowlist.ts` (24 lines)
- `packages/api/src/routes/config-secrets.ts` (109 lines)
- `packages/api/src/infrastructure/connectors/connector-gateway-lifecycle.ts` (27 lines)
- `packages/api/src/infrastructure/connectors/connector-reload-subscriber.ts` (57 lines)
- 修改：`packages/api/src/index.ts` (+30 lines: imports + wiring + shutdown cleanup)
- 修改：`packages/api/src/routes/config.ts` (+2 lines: export helpers)

## Why

F136 愿景：Hub 配置面板从只读变成可读写可即时生效。Phase 1 建了 event bus 基座，Phase 2 实现 MVP — 改 IM connector 配置后不用重启 API。

## Original Requirements（必填）

> "connector 这个指的是？ im？ 我记得 F127 有一个烂摊子没收拾，他搞了个他自己的 Hot Reload 但是不用 cat config yaml 而是自己搞了一套。所以按照「脚手架」「喵约」理论我们是不是先梳理一下，我们有哪些配置项？"
> — 铲屎官（2026-03-23，F088 Phase 8 讨论）

> "Hub 的配置面板从只读展示变成可读可写可即时生效"
> — F136 Vision（铲屎官 2026-03-27 确认）

- 来源：`docs/features/F136-unified-config-hot-reload.md` Vision + Why 段落
- **请对照上面的摘录判断：secrets endpoint + hot reload 是否解决了 connector 配置改了要重启的痛点？**

## Tradeoff

1. **Full gateway restart vs partial adapter reload** — 选择 full restart（简单正确，adapter 状态复杂），代价是 restart 期间有短暂的消息空窗（Telegram/DingTalk 有 server-side retry）
2. **Separate secrets endpoint vs extending PATCH /api/config/env** — 选择新 endpoint（保留现有安全模型不变，allowlist 更严格）
3. **Generic startFn injection vs direct bootstrap dependency** — lifecycle 函数通过 startFn 注入解耦，方便测试

## Open Questions

1. **Loopback guard 是否足够？** — 当前只检查 `request.ip ∈ {127.0.0.1, ::1, ::ffff:127.0.0.1}`。部署场景下可能需要更严格（e.g. CSRF token）
2. **Restart 期间的消息丢失** — Telegram server retries + DingTalk stream auto-reconnect 应该能覆盖，但 Feishu webhook 返回非 200 的 retry 策略需确认
3. **`wireGatewayHooks` 从 index.ts 提取后** — 复杂度是否合理？每次 restart 都重新 wire 所有 consumers

## Next Action

请 review 代码质量、安全边界、热更新时序。重点关注 secrets endpoint 的 allowlist 完整性和 restart 后 hook 一致性。

## 自检证据

### Spec 合规
- AC-1~8 全部覆盖（见 Quality Gate Report）
- 愿景覆盖：secrets write + hot reload = Hub 可写可即时生效

### 测试结果
```
F136 tests (Phase 1 + Phase 2): 37 passed, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → biome clean ✅ (check:features F095 pre-existing on main)
pnpm build → exit 0 ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-27-f136-phase-2-connector-hot-reload.md`
- Feature: F136 / `docs/features/F136-unified-config-hot-reload.md`
- Phase 1 PR: #778 (merged)
