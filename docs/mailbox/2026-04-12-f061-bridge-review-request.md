# Review Request: F061 Phase 2 — CDP→ConnectRPC Bridge

Review-Target-ID: f061
Branch: feat/f061-antigravity-bridge

## What

Replace the fragile CDP WebSocket DOM-scraping approach with a ConnectRPC Bridge that communicates directly with Antigravity's Language Server gRPC endpoint.

Core changes:
- **AntigravityBridge** (243L): ConnectRPC wrapper — session mapping, port/CSRF auto-discovery, response polling
- **antigravity-event-transformer** (72L): pure fn mapping trajectory steps → AgentMessage[]
- **AntigravityAgentService**: rewritten to use Bridge instead of CDP client
- **CAT_CAFE_READONLY mode**: filters write/auth tools from MCP registration for Antigravity's persistent MCP process
- **Deleted**: AntigravityCdpClient (349L), cdp-dom-scripts (257L), cdp-target-selection (63L), all CDP tests (~1300L)

Net: +673 / -2375 lines across 23 files.

## Why

CDP bridge was confirmed "基本用不起来" by 铲屎官 — DOM hack breaks on every Antigravity update. ConnectRPC is the stable wire protocol Antigravity uses internally. Bridge-owned writeback (方案 D) means Antigravity only thinks, Bridge handles all thread write operations with standard invocation credentials.

## Original Requirements（必填）

> 铲屎官：「干活！我今天要看到两只孟加拉 gemini / opus 和我贴贴！」
> 铲屎官：「CDP 基本用不起来」
> 铲屎官：「不要脚手架，一步到位设计最终最优雅的方案」
> 铲屎官：「必须使用 Ultra 订阅 token」「最终体验 = 跟 @opus 完全对称」

- 来源：`docs/discussions/2026-04-12-f061-antigravity-mcp-evolution-design.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

方案 A（ACP 代理桥）、B（ConnectRPC 直连 Provider）、C（MCP Pull + Agent Key）均被淘汰。详见 design doc 附录。选择方案 D 因为它正确分离了"思考"（Antigravity LS）和"投递"（Bridge），不污染 Cat Café 核心。

## Open Questions

1. `GEMINI.md`（Antigravity 身份 Rules）未在本 PR 创建——属于项目配置，非代码基础设施。是否需要在本轮补？
2. AntigravityBridge 的 `discoverFromProcess()` 依赖 `ps` + `lsof`，仅限 macOS/Linux。Windows 需单独适配（当前非需求）。
3. 模型 ID 映射（MODEL_ID_MAP）硬编码在 Bridge 中。如果 Antigravity 更新模型列表，需手动同步。

## Next Action

请 reviewer 重点关注：
1. Bridge 架构是否符合 design doc 方案 D 的职责分离
2. CAT_CAFE_READONLY 工具过滤列表是否完整
3. 事件转换器的边界处理（error、empty response、thinking）
4. 测试覆盖是否充分

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f061/{reviewer-handle}`
- Start Command: 纯后端改动，`node --test packages/api/test/antigravity-*.test.js packages/api/test/cat-config-loader.test.js` 即可验证
- Ports: N/A（无前端改动，无需启动 dev server）

## 自检证据

### Spec 合规

Quality Gate 通过（2026-04-12 23:18）：
- 愿景 5 项全覆盖（对称路由、Ultra token、多线程并发、一步到位、CDP 替换）
- 功能验收 8 项全通过
- 无 .pen 设计稿（纯后端）
- 无根目录媒体工件

### 测试结果

```
antigravity-*.test.js + cat-config-loader.test.js → 92/92 pass, 0 failed ✅
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档

- Design: `docs/discussions/2026-04-12-f061-antigravity-mcp-evolution-design.md`
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Retrospective: `docs/features/F061-cdp-integration-retrospective.md`
- Plan (Phase 1, superseded): `docs/plans/2026-03-07-f061-phase1-cdp-bridge.md`
