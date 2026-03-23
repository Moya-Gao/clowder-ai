---
feature_ids: [F134]
related_features: [F088, F132, F077]
topics: [gateway, connector, feishu, group-chat, multi-user, chat-platform]
doc_kind: spec
created: 2026-03-24
---

# F134: Feishu Group Chat — 飞书群聊多用户支持

> **Status**: spec | **Owner**: 金渐层 | **Priority**: P1
>
> **Related**: F088（复用公共层 + Phase 7 公共层扩展）| F132（钉钉/企微，同模式独立 Feature）

## Why

Cat Café 目前的飞书接入只支持 **1v1 私聊（DM）**，铲屎官希望把机器人拉进飞书群聊，让群里的人都能 @机器人提问，且猫回复时能 @发送者，区分不同用户。

铲屎官原话：
> *"如果我们的飞书的机器人加入多个群，比如不同的人 at 你，我们需要区分不同的用户，以及加入不同的群，我们可以优化一下 🤔 这样的话得区分到底哪个群聊给哪个 thread 发了信息？"*

> *"改动 1：FeishuAdapter — 解除群聊限制 + 提取用户信息。改动 2：ConnectorRouter — 携带发送者身份。改动 3：回复路由 — 群聊回复应 @发送者。改动 4：权限控制——好像可以先做1-3 然后再做4？"*

### 设计原则

F088 是**公共层架构**（ConnectorRouter / BindingStore / CommandLayer / OutboundDeliveryHook），F134 只做**飞书平台特定**的群聊改动。涉及公共层的改动（如 `ConnectorRouter.route()` 增加 senderId 参数、`ConnectorSource` 扩展 sender 字段）属于 **F088 Phase 7**，在 F134 实现过程中顺带推进，但记录在 F088。

**飞书既有设计参考**：
- `FeishuAdapter.ts` — `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts`
- F088 公共层架构 — `docs/features/assets/F088/architecture-unification.md`
- F088 Phase 进度 — `docs/features/F088-multi-platform-chat-gateway.md`
- F132 钉钉/企微（同模式拆分样板） — `docs/features/F132-dingtalk-wecom-gateway.md`

## What

### 当前限制

```typescript
// FeishuAdapter.ts:134 — 硬编码 p2p 过滤
if (message.chat_type !== 'p2p') return null;
```

```typescript
// ConnectorRouter.route() — 所有消息归属 defaultUserId，无 sender 身份
userId: this.opts.defaultUserId,  // line 187, 248, 268 等多处
```

```typescript
// ConnectorSource — 无 sender 字段
{ connector: 'feishu', label: '飞书', icon: '...' }  // 无法区分群里谁说的
```

### Phase A: 群聊入站 + @Bot 检测（飞书特定）

**FeishuAdapter 改动**：

1. **移除 p2p 过滤**：`parseEvent()` 不再 `return null` 群聊消息
2. **@机器人检测**：群聊消息只有 @了机器人才处理（避免机器人响应所有群消息）
   - 飞书群消息的 `content.text` 里 @机器人表现为 `@_user_1` 占位符
   - 事件 body 中 `event.message.mentions` 数组包含 `{ key: '@_user_1', id: { open_id: 'xxx' }, name: '机器人名' }` 映射
   - 需要匹配 bot 自身的 `open_id`（可从飞书 API 或 env 配置获取）
   - 匹配到后，从 text 中剥离 `@_user_1` 占位符，得到纯文本
3. **提取发送者信息**：从 `event.sender` 解析 `senderId`（open_id）和 `senderName`
4. **返回 chat_type**：让 ConnectorRouter 知道这是群聊还是 DM

**接口变更**：

```typescript
export interface FeishuInboundMessage {
  chatId: string;
  text: string;
  messageId: string;
  senderId: string;
  senderName?: string;       // 新增：发送者显示名
  chatType?: 'p2p' | 'group'; // 新增：会话类型
  attachments?: FeishuAttachment[];
}
```

### Phase B: 公共层 Sender 身份透传（F088 Phase 7 联动）

> 此 Phase 的改动属于 F088 公共层，但在 F134 开发中一起推进。

1. **ConnectorRouter.route() 签名扩展**：
   ```typescript
   async route(
     connectorId, externalChatId, text, externalMessageId, attachments?,
     sender?: { id: string; name?: string },  // 新增
   )
   ```

2. **ConnectorSource 扩展**：
   ```typescript
   export interface ConnectorSource {
     // ... existing fields
     readonly sender?: {
       readonly id: string;
       readonly name?: string;
     };
   }
   ```

3. **messageStore 写入时携带 sender**：在 Cat Café Web UI 中展示"来自群聊的 某某人"

4. **thread 创建标题**：群聊自动创建 thread 时，标题应为 `飞书群聊 {群名/群ID}` 而非 `飞书 DM`

### Phase C: 群聊回复 @发送者（飞书特定）

猫回复时，在群聊场景下应 @发送者，让对方知道这是回复给自己的。

1. **OutboundDeliveryHook 扩展**：传递消息的原始 sender 信息到 adapter
2. **FeishuAdapter.sendReply / sendRichMessage 增强**：
   - 群聊回复时，文本前缀加 `<at user_id="xxx">名字</at>`（飞书 @-mention 语法）
   - DM 回复不变（不需要 @）
3. **ConnectorMessageFormatter 感知 sender**：格式化 envelope 时可包含 replyTo 信息

### Phase D: 权限控制（后续，铲屎官确认后做）

> 铲屎官说"好像可以先做1-3 然后再做4"，此 Phase 暂不开工。

1. **群白名单**：哪些群允许机器人响应（env 配置或 Redis 存储）
2. **用户白名单**：哪些用户允许 @机器人（可选，默认全群可用）
3. **管理命令**：`/allow-group`、`/deny-group`（通过 CommandLayer 实现）

## Acceptance Criteria

### Phase A（群聊入站 + @Bot 检测）
- [ ] AC-A1: 飞书群聊消息在 @机器人时正确解析入站（text + image + post）
- [ ] AC-A2: 群聊消息未 @机器人时静默忽略（不处理、不报错）
- [ ] AC-A3: @机器人占位符（`@_user_1`）从 text 中正确剥离
- [ ] AC-A4: senderId 和 senderName 正确提取并传递
- [ ] AC-A5: DM 消息行为不变（无回归）

### Phase B（公共层 Sender 身份透传）
- [ ] AC-B1: ConnectorRouter.route() 接受可选 sender 参数
- [ ] AC-B2: ConnectorSource 携带 sender 信息存入 messageStore
- [ ] AC-B3: Cat Café Web UI 展示 sender 信息（"来自飞书群聊的 Landy"）
- [ ] AC-B4: 群聊自动创建 thread 标题为 `飞书群聊` 而非 `飞书 DM`
- [ ] AC-B5: 现有 DM / Telegram / 钉钉消息路由不受影响（sender 可选，不传 = 不展示）

### Phase C（群聊回复 @发送者）
- [ ] AC-C1: 猫回复群聊消息时，飞书侧正确 @原始发送者
- [ ] AC-C2: 猫回复 DM 消息时，不添加 @（保持原行为）
- [ ] AC-C3: 多人在群里 @机器人，各自的回复正确 @各自的发送者

### Phase D（权限控制 — 暂不开工）
- [ ] AC-D1: 可配置哪些群允许/禁止机器人响应
- [ ] AC-D2: 未授权群的 @机器人消息被静默忽略或回复权限提示
- [ ] AC-D3: 管理命令 `/allow-group` `/deny-group` 可用

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "飞书机器人加入多个群" | AC-A1, AC-A5 | test + manual | [ ] |
| R2 | "不同的人 at 你，我们需要区分不同的用户" | AC-A4, AC-B2, AC-B3 | test + screenshot | [ ] |
| R3 | "区分到底哪个群聊给哪个 thread 发了信息" | AC-B4 | test + manual | [ ] |
| R4 | 群聊回复应 @发送者（铲屎官确认的改动 3） | AC-C1, AC-C3 | test + manual | [ ] |
| R5 | 先做 1-3 再做 4（权限后做） | Phase D 暂不开工 | — | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— Phase B 有前端展示需求

## Dependencies

- **Evolved from**: F088（Multi-Platform Chat Gateway — 复用三层公共架构，Phase 7 联动）
- **Related**: F132（DingTalk + WeCom — 同模式拆分的兄弟 Feature，未来也需群聊）
- **Related**: F077（Multi-User Secure Collaboration — 权限隔离 Phase D 前置）

## Risk

| 风险 | 缓解 |
|------|------|
| 飞书群消息量大，机器人被无关消息刷爆 | @Bot 检测 + Phase D 权限白名单 |
| Bot 自身 open_id 获取方式可能因飞书 API 变更 | 支持 env 配置 fallback（`FEISHU_BOT_OPEN_ID`） |
| ConnectorSource 扩展 sender 可能影响前端渲染 | sender 字段可选，前端 graceful fallback |
| 公共层改动（Phase B）影响其他 adapter | sender 参数可选，不传 = 不影响 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Bot 自身 open_id 如何获取：API 查询 vs env 配置？ | ⬜ 需调研飞书 API |
| OQ-2 | 群聊 thread 是否需要与 DM thread 共存？（同一人群聊和私聊是不同 thread） | ✅ 是，externalChatId 不同，自然隔离 |
| OQ-3 | 群聊中的 /命令（/new /threads /use）如何处理？ | ⬜ 初版可禁用群聊命令，只允许对话 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 飞书群聊从 F088 拆出为独立 Feature F134 | F088 已有 19 个 ISSUE 太重；F132 已验证拆分模式可行；公共层改动记 F088 Phase 7 | 2026-03-24 |
| KD-2 | 先做 Phase A-C，Phase D 权限控制后做 | 铲屎官确认："好像可以先做 1-3 然后再做 4" | 2026-03-24 |
| KD-3 | 群消息必须 @机器人才处理 | 飞书会推送所有群消息给订阅的 bot，不过滤会导致垃圾消息涌入 | 2026-03-24 |
| KD-4 | 公共层 sender 扩展属于 F088 Phase 7，在 F134 开发中联动推进 | 保持 F088 作为公共层唯一真相源，避免平台特定 Feature 改动公共层接口后忘记更新 F088 | 2026-03-24 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-24 | 立项，从 F088 拆分飞书群聊为独立 Feature |

## Review Gate

- Phase A+B: 跨 family review（缅因猫 @codex），公共层改动需额外审查
- Phase C: 可与 Phase A+B 合并 review
- Phase D: 独立 review（涉及权限模型）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evolved from** | `docs/features/F088-multi-platform-chat-gateway.md` | 复用三层公共架构，Phase 7 联动 |
| **Architecture** | `docs/features/assets/F088/architecture-unification.md` | 三层架构设计文档（Principal Link / Session Binding / Command Layer） |
| **Adapter 样板** | `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts` | 飞书 adapter 当前实现（修改对象） |
| **Router** | `packages/api/src/infrastructure/connectors/ConnectorRouter.ts` | route() 方法需扩展 sender 参数 |
| **ConnectorSource** | `packages/shared/src/types/connector.ts` | 需扩展 sender 字段 |
| **Bootstrap** | `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts` | 飞书 webhook handler 入口 |
| **兄弟 Feature** | `docs/features/F132-dingtalk-wecom-gateway.md` | 同模式拆分样板 |
