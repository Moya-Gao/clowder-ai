---
capsule_id: "F134-2026-03-26"
context: "飞书群聊多用户支持 Phase A-E 全量完成"
feature_ids: [F134]
doc_kind: capsule
created: 2026-03-26
---

## What Worked
- **Message-level sender binding (KD-9)** 比 thread-level 绑定准确得多，用 `triggerMessageId` 贯穿全链路是正确的架构决策，并发群聊没有出现 @错人
- **分 Phase 交付**：A-E 五个 Phase 每个独立 PR + review，scope 可控，缅因猫每轮 review 精准命中真 bug
- **WSClient factory injection** 解决测试稳定性：不 mock 整个 SDK module，只注入创建函数，改动最小且测试完全可控
- **`requiredWhen` + `defaultValue` 模式** 让 connector config 系统支持条件必填字段，其他 adapter 可直接复用

## What Failed
- **KD-8 错误禁用群聊 /command**：加了 `chatType !== 'group'` guard 导致群里所有 slash command 失效，猫猫"扮演系统"回复 /threads，铲屎官笑死。根因是改 A 功能时没回归 B 路径
- **权限 tab 放错位置**：放进了 CatCafeHub 而非 HubListModal（IM Hub），铲屎官 live testing 才发现。应该在 Design Gate 阶段就确认 tab 归属
- **非法 mode 值归一化遗漏**：status 页和 runtime 各自归一化逻辑不同，导致 `'ws'` 这种非法值在两处表现不一致。缅因猫 Round 2 才捕获
- **DM 路径误 @ 发送者（AC-C2）**：sender 绑定没限定 `chatType === 'group'`，DM 也会尝试 @ mention。缅因猫 local review 发现

## Trigger Missed
- **"改了公共层先跑全量回归"触发器缺失**：改了 ConnectorRouter（加 sender/chatType 参数）后没立即跑其他 adapter 的测试，导致 DM 路径回归遗漏
- **"前端 tab 归属确认"应在 Design Gate 做**：权限 tab 放哪个 modal 是 UX 决策，不是实现细节，应该在 wireframe 阶段就确认

## Doc Links
- Feature spec: `docs/features/F134-feishu-group-chat.md`
- F088 公共层架构: `docs/features/F088-multi-platform-chat-gateway.md`
- Phase E spec: `docs/features/F134-feishu-group-chat.md` (Phase E section)
- IM Hub 设计: `designs/f088-im-hub-config-wizard-ux.pen` (Screen D)

## Rule Update Target
- `shared-rules.md`: 可补"改了公共层参数签名 → 必须跑所有 consumer 的回归测试"触发器
- `lessons-learned.md`: 非法枚举值归一化必须在所有读取点统一（不能 runtime 归一化了但 status 页没跟上）

## One-Liner Takeaway
消息级绑定 > 线程级绑定；公共层改签名 → 必须全量回归。
