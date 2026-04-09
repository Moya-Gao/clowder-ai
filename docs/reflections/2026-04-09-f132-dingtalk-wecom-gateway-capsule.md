---
capsule_id: "F132-2026-04-09"
context: "F132 钉钉+企微 Chat Gateway 全链路接入完成（7 PR, 3 adapter, 30 AC）"
feature_ids: [F132]
doc_kind: capsule
created: 2026-04-09
---

## What Worked
- **adapter-only 扩展模式（第三次验证）**：继 F088（飞书/Telegram）和 F137（个人微信）后，F132 再次验证 F088 三层架构的扩展性——3 个 adapter（DingTalk + WeComBot + WeComAgent）全部公共层零改动。KD-7 总结的 11 步清单已成为可复用的 onboarding guide
- **GPT Pro 调研先行**：立项后先让 GPT Pro 调研 OpenClaw 生态，获得 6 个参考实现 + SDK 选型建议，避免了盲目摸索。KD-4（企微拆双 connector）就是调研产出的关键决策
- **渐进式交付（A→A.1→A.2→B→C→D）**：铲屎官中途调整优先级（"先媒体再群聊"），Phase 拆分足够细可以灵活响应。每个 Phase 独立 PR + 独立 review + 独立 merge
- **Redis 持久化解群聊冷启动**：钉钉 DM/群聊 API 分裂问题（orgGroupSend vs batchSendOTO），通过 SADD/SMEMBERS 在 adapter 内部解决，不需要改公共层 outMeta（砚砚 4 轮 review 逼出来的正解）
- **视觉身份差异化**：PR #728 及时修了 DingTalk 与飞书的颜色撞车，建立了"每个平台独立 tailwindTheme + brand PNG"的规范

## What Failed
- **Phase A.1 漏云端 review**：金渐层 merge PR #720 时跳过了云端 review，铲屎官抓到。教训：merge-gate 必须每次都走完整流程，不能因为"小改动"跳步
- **P1-2 outbound ID 混用（conversationId vs staffId）**：第一版把 conversationId 当 chatId 传给 oToMessages/batchSend（需要 staffId），导致发送失败。根因是没仔细读 DingTalk API 文档的字段语义，直觉 copy 了飞书的 chatId 模式
- **AI Card conversationId 冷启动失效**：改用 staffId 作 chatId 后，AI Card 路径需要 conversationId 但只有 staffId。用内存 Map 做映射，进程重启后丢失。最终加了 Redis 持久化（staffToConversation Map），但绕了一圈
- **ConnectorMediaService 修改定性争议**：是否算"公共层改动"？最终澄清 AC-A6 明确列了 ConnectorRouter/CommandLayer/BindingStore，MediaService 是扩展点不是公共层。但说明 AC 用语需要精确

## Trigger Missed
- **API 字段语义核对**：接入新平台 API 时，应逐字段核对"这个 ID 代表什么"，而不是类比已有 adapter 的同名字段。触发器应该是"新平台 API → 先读字段定义 → 再写代码"
- **云端 review 跳过检测**：merge-gate 应该有硬卡点检测云端 review 是否完成，不能依赖人工自觉

## Doc Links
- Feature spec: `docs/features/F132-dingtalk-wecom-gateway.md`
- GPT Pro 调研: `docs/research/2026-03-22-dingtalk-wecom-gateway-gpt-pro-consult.md`
- 能力对比: `docs/features/assets/F132/platform-capability-comparison.md`
- IM 接入指南: `docs/guides/im-platform-setup.md`
- PRs: #674 (Phase A), #720 (A.1), #723 (A.2), #728 (visual fix), #804 (Phase B), #808 (Phase C), #1018 (Phase D)
- 关联 Feature: F088（三层架构）、F137（个人微信）、F134（飞书群聊）

## Rule Update Target
- **KD-7 清单**：已正式写入 F132 spec，可作为未来新 IM 接入的标准操作手册
- **AC 精确用语**："公共层零改动"应附加括号列出具体文件（已在 F132 AC 中做到：AC-A6 明确列了 ConnectorRouter/CommandLayer/BindingStore）。建议未来 feature 沿用此模式
