# Review Request: F088 Phase 5+6 + AC-14 — Media, Voice, Card Actions

## What

F088 剩余三块能力的完整实现：
1. **AC-14**: 飞书卡片按钮交互回调 → ConnectorRouter
2. **Phase 5 (AC-19~21)**: 双向图片/文件收发 — 平台媒体下载→本地存储→传猫 + 猫图片回复→sendMedia
3. **Phase 6 (AC-22~24)**: 语音消息 STT/TTS — 服务端 Whisper STT + VoiceBlockSynthesizer→sendMedia + provider 可配置

核心新增：
- `ISttProvider` 接口 + `SttRegistry`（镜像 TTS 架构）
- `WhisperSttProvider` — OpenAI-compatible `/v1/audio/transcriptions` HTTP 客户端
- `ConnectorMediaService` — 平台媒体下载→本地存储
- `ConnectorRouter.route()` 扩展：可选 attachments 参数 + processAttachments() 中间件
- `OutboundDeliveryHook` 扩展：media_gallery 图片 + audio block 出站
- `/api/connector-media/` 静态路由 + `WHISPER_URL` / `CONNECTOR_MEDIA_DIR` env

## Why

铲屎官要求完成 F088 所有剩余 AC。worktree `feat/f088-media` 已有 adapter 层半成品（媒体解析+发送），本次补齐中间件层（下载/上传/STT转换）闭环。

## Original Requirements

> 铲屎官："。。。 那你怎么就提了个pr ？然后和我说做完了！ 来吧这三个做一下"
> 铲屎官："对！要做完！ 然后和你的小伙伴gpt54一起完成闭环！"
- 来源：thread_mmj4lhqgcy0najsb，2026-03-11 00:13 / 01:02
- AC 来源：`docs/features/assets/F088/acceptance-criteria.md` Phase 5+6 + AC-14
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **STT 服务端而非客户端**：前端已有 Whisper（useVoiceInput.ts），但 connector 消息不经过前端，必须服务端转写
- **本地 fs 存储而非 S3**：复用 TTS cache / uploads 的本地 fs 模式，够用不过度
- **download 函数注入而非硬编码 SDK 调用**：ConnectorMediaService 接受 `feishuDownloadFn` / `telegramDownloadFn`，测试可注入 mock，生产环境 bootstrap 注入真实 SDK 调用

## Open Questions

1. **STT 降级策略**：当前 STT 失败时回退到 `[语音]` 占位文本。是否需要向用户发送"语音识别失败"提示？
2. **媒体过期**：Feishu 文件 key 有 TTL，下载后本地存储无清理策略。是否需要类似 TTS cache cleaner 的定时清理？
3. **图片传猫方式**：当前把 localUrl 拼入 message text（`[图片] /api/connector-media/xxx.jpg`）。是否应该用 contentBlocks ImageContent？

## Next Action

请 review 代码质量 + spec 对齐，重点关注：
- ConnectorRouter.processAttachments() 的错误处理链
- OutboundDeliveryHook media_gallery 类型断言安全性
- ISttProvider 接口设计是否和 ITtsProvider 对称

## 自检证据

### Spec 合规
7/7 AC 覆盖（AC-14, AC-19~24）。Telegram 原生媒体发送，Feishu 文本链接 fallback（原生上传为 follow-up）。

### 测试结果
```
node --test (10 test files) → 110 pass, 0 fail ✅
pnpm biome check (our files) → 0 errors ✅
pnpm lint (tsc --noEmit) → 0 errors ✅
pnpm check:dir-size → OK (warnings pre-existing) ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-11-f088-phase5-6-media-voice.md`
- Feature: F088 / `docs/features/F088-multi-platform-chat-gateway.md`
- AC: `docs/features/assets/F088/acceptance-criteria.md`

### Commits (7)
```
287a7aea chore: biome format + lint fixes
fd297234 feat(F088): connector-media route + STT env config + outbound image delivery
dec0596c feat(F088): outbound image + audio media delivery integration (AC-21/23)
77fbaca6 feat(F088): wire media download + STT into ConnectorRouter (AC-19~22)
08514c0c feat(F088): ConnectorMediaService — platform media download + local storage (AC-19/20)
588b0410 feat(F088): ISttProvider + SttRegistry + WhisperSttProvider (AC-22/24)
b713cceb feat(F088): adapter-layer media parsing + sendMedia + AC-14 card actions
```

### Files changed
```
New:
  packages/shared/src/types/stt.ts
  packages/api/src/infrastructure/connectors/media/SttRegistry.ts
  packages/api/src/infrastructure/connectors/media/WhisperSttProvider.ts
  packages/api/src/infrastructure/connectors/media/ConnectorMediaService.ts
  packages/api/src/routes/connector-media.ts
  packages/api/test/stt-provider.test.js (4 tests)
  packages/api/test/whisper-stt-provider.test.js (3 tests)
  packages/api/test/connector-media-service.test.js (4 tests)
  packages/api/test/connector-router-media.test.js (6 tests)
  packages/api/test/outbound-delivery-media-integration.test.js (4 tests)

Modified:
  packages/shared/src/types/index.ts (STT re-export)
  packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts (media parsing + card actions)
  packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts (media parsing)
  packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts (sendMedia for audio + image)
  packages/api/src/infrastructure/connectors/ConnectorRouter.ts (attachments + processAttachments)
  packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts (media + STT wiring)
  packages/api/src/config/env-registry.ts (WHISPER_URL + CONNECTOR_MEDIA_DIR)
  packages/api/src/routes/index.ts (connectorMediaRoutes export)
  packages/api/src/index.ts (connector-media route registration)
```
