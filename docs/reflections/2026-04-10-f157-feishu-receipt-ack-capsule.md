---
capsule_id: "F157-A-2026-04-10"
context: "F157 Phase A: Feishu receipt ack 替代思考中撤回"
feature_ids: [F157]
doc_kind: capsule
created: 2026-04-10
---

## What Worked
- 社区 PR (#24 relay-claw) 作为起点验证了"不撤回"路线可行，在此基础上加猫味+流式能力，方向对了
- `finalizeStreamCard` 作为 `deleteMessage` 的替代方案，架构上干净——adapter 能力分支，无侵入
- 复用 F124 voice comfort 文案体系，12 猫词库半天内搞定，不用从零写
- `binding.connectorId === 'feishu'` 精准作用域，AC-A8 回归零风险

## What Failed
- spec OQ-2 写了"复用 F134 prependAtMention"但实际只做了 sender name hint。愿景守护才抓到这个 spec/实现不一致——说明 quality-gate 自检时没逐条对 OQ
- R2 review 发现 `handleUrgentTrigger` 有两个 `executeInBackground` 调用点，第一个漏了 sender 参数。说明改调用链时需要 grep 所有调用点，不能只找第一个
- CatId 是 branded type，不能直接用作 Record key——类型系统的防呆在运行时不报错但编译报错，浪费了一轮调试

## Trigger Missed
- 改 `ConnectorInvokeTrigger.executeInBackground` 签名时应该触发"所有调用点全 grep"检查，但第一轮只改了一处
- spec 写完 OQ-2 状态后没有回头对照实际代码，应该在 quality-gate 时逐条验 OQ

## Doc Links
- [F157 spec](../features/F157-feishu-receipt-ack.md)
- [F124 voice comfort callout](../features/F124-voice-comfort-callout.md)
- [F134 群聊 @mention](../features/F134-feishu-group-chat.md)

## Rule Update Target
- `quality-gate` skill: 建议增加"OQ 状态逐条验证"检查项——OQ 标 ✅ 的必须有代码证据
- `receive-review` skill: 改函数签名时提示"grep 全部调用点"（当前只提醒改接口时查实现方，不够）
