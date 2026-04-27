# v0.9.0

## Highlights

- **Telegram startup is now resilient.** Invalid or non-BotFather tokens are rejected before adapter startup, and Telegram connector failures no longer bring down the API or Windows launcher.
- **Telegram polling conflict recovery.** `getUpdates` 409 conflicts now trigger bounded recovery/backoff instead of crashing the runtime.
- **Stream timeout catch-up.** When a long invocation times out in the UI, the client now requests a catch-up pass so persisted messages can still appear.
- **First-run and setup improvements.** This release includes First-Run Quest onboarding, public setup flow updates, and refreshed public docs.
- **Public sync hardening.** The public release path now has stronger checks for runtime ports, Node 20 tests, and public-only script surfaces.

## Community

- Resolves clowder-ai#541 — Telegram polling 409 runtime crash.
- Resolves clowder-ai#582 — Telegram misconfiguration/startup crash.
- clowder-ai#524 and clowder-ai#595 remain open; they were reviewed during release reconciliation and are not covered by this payload.

## Provenance

- Source snapshot tag: `clowder-v0.9.0-source`
- Source commit: `8f1f1fd95d345602136d5737f3836c2c3da5959f`
- Sync PR: `clowder-ai#596`
- Sync merge commit: `93f08ada5f0a0ea26c52182b50cead3b9b4cbe92`
- Sync baseline tag: `sync/2026-04-27-141820`
- Reconciliation report: `docs/ops/reconciliation-v0.9.0.md`

---

# v0.9.0 中文说明

## 重点更新

- **Telegram 启动路径更稳。** 现在会先校验 BotFather token 形态；误把 OpenAI API key 或其他内容填进 Telegram token 时，不会再拖垮 API 或 Windows launcher。
- **Telegram polling 409 自动恢复。** `getUpdates` 遇到 409 conflict 时会走有限重试和 backoff，不再直接把 runtime 打崩。
- **流式超时后补拉消息。** 长任务在前端超时后，客户端会请求 catch-up，已落库的消息可以补回前端气泡。
- **首次启动与配置体验更新。** 包含 First-Run Quest、公开安装/配置流程更新，以及文档刷新。
- **公开同步链路加固。** 本次发版过程中补强了公开仓端口约定、Node 20 测试 loader、以及 public-only 脚本边界。

## 社区问题

- 修复 clowder-ai#541：Telegram polling 409 导致 runtime 崩溃。
- 修复 clowder-ai#582：Telegram 配置错误/启动失败导致 Windows launcher 崩溃。
- clowder-ai#524 和 clowder-ai#595 仍保持 open；本次对账已确认它们不属于 v0.9.0 payload 覆盖范围。

## 溯源信息

- Source snapshot tag: `clowder-v0.9.0-source`
- Source commit: `8f1f1fd95d345602136d5737f3836c2c3da5959f`
- Sync PR: `clowder-ai#596`
- Sync merge commit: `93f08ada5f0a0ea26c52182b50cead3b9b4cbe92`
- Sync baseline tag: `sync/2026-04-27-141820`
- 对账报告：`docs/ops/reconciliation-v0.9.0.md`
