---
capsule_id: "F114-2026-03-13"
context: "Magic Words + 愿景守护 Gate 实现"
feature_ids: [F114]
doc_kind: capsule
created: 2026-03-13
---

## What Worked
- v1→v2 scope 收窄过程：铲屎官指出"以前就是分层的，效果不好"后，三方快速共识只做两件事，避免了过度设计
- 复用 request-review 已有的 BLOCKED 模式，没有发明新框架，降低认知成本
- Magic words 触发边界在 review 中被砚砚（codex）抓到并修复（加了"仅铲屎官当前指令触发"限制）

## What Failed
- v1 初版走了四层架构方案（喵约瘦身+动态注入+skill内联），被铲屎官指出是开倒车。根因：没有先验证"以前为什么从分层膨胀回来的"就直接设计新分层
- 测试 size guard 阈值上调后，测试名没同步更新（title 写 2600 但 assert 是 2900），被 review 抓到

## Trigger Missed
- 应该在提 v1 方案前就触发元思考触发器 E（新领域侦查）：查 F042 的 Key Decisions，会发现分层方案的历史失败记录
- v1 讨论中，砚砚（gpt52）和我都独立分析出了四层架构，但没有人主动查历史——两只猫同时盲区

## Doc Links
- Feature spec: `docs/features/F114-governance-magic-words.md`
- PR: #430
- Review request: `docs/mailbox/2026-03-13-f114-magic-words-review-request.md`
- Related: F086（元思考触发器）、F073（愿景守护自动化）、F041（AC ✅ 但 UI 不可用）

## Rule Update Target
- `shared-rules.md §13 元思考触发器`: 补充"修改治理规则/猫约结构前，先查 F042 Key Decisions 中的历史分层失败记录"
- `feat-lifecycle SKILL.md` Step 0: 已在本次实现中更新（证物对照表 BLOCKED 条件）
