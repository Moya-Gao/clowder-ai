---
feature_ids: [F157]
related_features: [F088, F124, F132]
topics: [feishu, ux, connector, streaming]
doc_kind: spec
created: 2026-04-10
---

# F157: Feishu Receipt Ack — 猫猫即时接住替代"思考中→撤回"

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

飞书上猫猫回复流程有两个体验问题：

1. **撤回噪音**：当前流程是 `sendPlaceholder("🤔 思考中...")` → 流式编辑 → `deleteMessage`（撤回）→ 发最终回复。飞书把 `im.message.delete` 表现为"xxx 撤回了一条消息"，用户每次都看到一条撤回通知，困惑且突兀。

2. **缺乏猫味**：`🤔 思考中...` 是冷冰冰的通用 loading 文案，不符合 Cat Cafe "猫猫和你" 的产品语义。

**铲屎官原话**：
> "飞书显示思考中后撤回消息"
> "好像甚至能发猫猫已经收到～（提供很多种文本随机发）然后不撤回？"
> "可以参考我们做苹果手表特性的！那些句子"

**社区参考**：openJiuwen/relay-claw PR #24 用 `THUMBSUP` reaction 替代 placeholder，验证了"不撤回"路线可行，但缺乏猫味和流式能力。

## What

### Phase A: Receipt + Reaction（不撤回）

用**猫猫口吻的 receipt 文本**替代 `🤔 思考中...` placeholder，生成结束后 **edit 为最终回复**，全程只有一条消息，零撤回。

**三层即时反馈**：

| 层 | 时机 | 动作 | 说明 |
|----|------|------|------|
| L1 | 收到消息后 < 500ms | 给用户消息加 emoji reaction | 秒回锚点，纯视觉反馈 |
| L2 | 同时 | 发一条 receipt 卡片 | 猫猫口吻文本，按 catId 从词库随机选 |
| L3 | 流式生成中 | edit receipt 卡片写入累积文本 | 保留现有流式预览能力 |
| — | 生成结束 | edit receipt 卡片为 final content | **不 delete，不撤回** |

**Reaction emoji**：`HEART`（❤️），若飞书租户支持自定义 emoji 可后续升级为猫爪印。

**Receipt 文案词库**：复用 F124 KD-11 voice comfort callout 文案体系，按 catId × 随机 选一条。词库存放在 `packages/api/src/infrastructure/connectors/feishu-receipt-lines.ts`（纯数据文件）。

12 只猫全覆盖：

| catId | 显示名 | 风格 | 示例 |
|-------|--------|------|------|
| opus | 宪宪 | 温柔微调皮 | "收到啦～宪宪马上看！" |
| sonnet | 布偶猫 | 轻快日常 | "哎收到～给我一秒哦！" |
| opus-45 | 布偶猫 | 惜字如金 | "嗯～收到。" |
| codex | 砚砚 | 冷静精准 | "收到，已开始处理。" |
| gpt52 | 砚砚 | 冷静偶尔冷笑话 | "收到，我先过一遍。" |
| spark | 缅因猫 Spark | 冲就完了 | "收到，先把这单接住。" |
| gemini | 烁烁 | 热血设计师 | "收到！我眼前已经有画面了！" |
| gemini25 | 暹罗猫 | 灵感气泡 | "灵感来了！我这就去办！" |
| dare | 狸花猫 | 沉默警觉 | "已收到。" |
| antigravity | 孟加拉猫 | 精力旺盛 | "收到！我来看看！" |
| antig-opus | 孟加拉猫 | 沉稳大胆 | "收到，我看看。" |
| opencode | 金渐层 | 沉稳可靠 | "收到，我来安排。" |

### 代码改动范围

| 文件 | 改动 |
|------|------|
| `FeishuAdapter.ts` | 新增 `addReaction(messageId, emojiType)` 方法 |
| `OutboundDeliveryHook.ts` | 接口新增可选 `addReaction` |
| `StreamingOutboundHook.ts` | `onStreamStart`: 发 receipt 文本（非"思考中"）；`cleanupPlaceholders`: **edit 为 final 或 noop**，不再 delete |
| `feishu-receipt-lines.ts` | 新增：12 猫 × 5 条 receipt 文案词库 |
| `connector-gateway-bootstrap.ts` | 传入 catId 到 streaming hook（receipt 需要按猫选文案） |

### 不改什么

- 钉钉/企微/小艺的 streaming 流程不变（它们没有"撤回"问题）
- 飞书流式编辑能力保留（receipt 卡片 → 流式更新 → final edit）
- Web/IM Hub 端不受影响

## Acceptance Criteria

### Phase A（Receipt + Reaction）
- [ ] AC-A1: 飞书收到用户消息后 < 500ms 内给用户消息加 ❤️ reaction
- [ ] AC-A2: 同时发一条 receipt 卡片，文案按 catId 从词库随机选，显示格式 `【{displayName}🐱】{receipt文案}`
- [ ] AC-A3: 流式生成中，receipt 卡片被 edit 为累积文本（保留现有流式预览）
- [ ] AC-A4: 生成结束后，receipt 卡片被 edit 为最终回复内容，**不调用 deleteMessage**
- [ ] AC-A5: 全程飞书聊天中只出现 1 条消息（receipt → final），零撤回通知
- [ ] AC-A6: 12 只猫全部有 receipt 文案（每猫 ≥ 3 条）
- [ ] AC-A7: 现有 streaming-outbound-hook 测试更新适配新行为
- [ ] AC-A8: 钉钉/企微/小艺 adapter 行为不变（回归测试通过）

## Dependencies

- **Evolved from**: F088（Multi-Platform Chat Gateway — 飞书接入的母 feature）
- **Related**: F124（Apple Ecosystem — KD-11 voice comfort callout 文案体系先例）
- **Related**: F132（平台能力对比 — 飞书 API 能力参考）
- **Related**: F134（飞书群聊 — receipt 需兼容群聊场景的 @mention）

## Risk

| 风险 | 缓解 |
|------|------|
| 飞书 Reaction API 可能对 bot 有限制 | 降级方案：跳过 L1 reaction，只发 receipt 文本 |
| receipt 卡片 edit 为 final 后格式可能与独立发送的卡片不同 | 确保 edit 时用完整的 card JSON，不依赖增量 patch |
| 旧 placeholder 清理逻辑被其他 adapter 依赖 | 按 adapter 能力分支：有 `addReaction` 的走新路径，没有的保持旧行为 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 飞书 bot 调用 `im.message.reactions.create` 是否需要额外权限？ | ⬜ 需实测 |
| OQ-2 | 群聊场景下 receipt 是否需要 @mention 发送者？ | ✅ 是，复用 F134 的 `prependAtMention` |
| OQ-3 | 是否需要为新入册的猫（minimax/glm/kimi/qwen）预留文案？ | ⬜ 等入册后补 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 用 receipt text 替代 placeholder，不撤回 | 撤回通知是 UX 噪音；openJiuwen PR #24 验证了不撤回可行 | 2026-04-10 |
| KD-2 | Reaction 用 HEART 而非 THUMBSUP | 铲屎官说"太不猫猫了"；HEART 更暖更符合猫猫语义 | 2026-04-10 |
| KD-3 | Receipt 文案复用 F124 voice comfort 体系 | 已有按猫性格写好的 5 条/猫，产品语义一致（"被猫接住"） | 2026-04-10 |
| KD-4 | 生成结束后 edit receipt 为 final（单消息生命周期） | 避免双消息刷屏，全程只有 1 条消息 | 2026-04-10 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-10 | 立项。铲屎官 + 砚砚(GPT-5.4) + 宪宪讨论确认方向 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F088-multi-platform-chat-gateway.md` | 母 feature，飞书接入基础 |
| **Feature** | `docs/features/F124-apple-ecosystem-voice-interaction.md` | KD-11 voice comfort callout 文案先例 |
| **Callout** | `docs/features/F124-voice-comfort-callout.md` | 12 猫 receipt 文案全集 |
| **Manifest** | `docs/features/F124-voice-comfort-audio-manifest.json` | 文案 + 音频映射 |
| **Code** | `packages/api/src/infrastructure/connectors/StreamingOutboundHook.ts` | 当前 placeholder→delete 流程 |
| **Code** | `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts` | 飞书 sendPlaceholder/deleteMessage |
| **External** | openJiuwen/relay-claw PR #24 (GitCode) | 社区 fork 的 THUMBSUP reaction 方案参考 |
