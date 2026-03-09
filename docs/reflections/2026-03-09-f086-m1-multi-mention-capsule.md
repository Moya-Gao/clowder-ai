---
capsule_id: "F086-M1-2026-03-09"
context: "M1 multi_mention 编排运行时实现"
feature_ids: [F086]
doc_kind: capsule
created: 2026-03-09
---

# F086 M1 Multi-Mention 反思胶囊

## What Worked

- 回流状态机设计清晰（6 state: pending→running→partial|done|timeout|failed），部分失败策略让调用者不被阻塞
- 复用 F055 `targetCats` 做回流路由，没有造新轮子
- Anti-cascade guard（被 @ 猫禁止二次扩散）用 `isActiveTarget` + 409 guard 双保险
- 先做 MCP 体系侦查再动手（铲屎官在 Design Gate 要求的），避免了重复造轮子
- TDD 节奏好：92 个测试全过，包括状态机、超时、幂等键、回流路由

## What Failed

- PR #321 merge conflict with F079（voting 和 multi-mention 同时改 callback-tools.ts）—— 说明大文件是冲突磁铁
- 首版没做 sequential 模式，有场景（如需要 A 回答后再问 B）不能覆盖
- 云端 Codex review 比本地 review 更严格，首版没预期到这么多轮

## Trigger Missed

- 实现前虽然搜了 F055，但没搜 F079 voting 的实现模式——导致 merge conflict 可以更早预见
- 应该在开 worktree 前先 `git log --oneline --since=3days` 看看 main 上最近合了什么（trigger D: 信息不足）

## Doc Links

- [F086 spec](../features/F086-cat-orchestration-multi-mention.md)
- [F055 A2A MCP Structured Routing](../features/F055-a2a-mcp-structured-routing.md)
- [F079 Voting System](../features/F079-voting-system.md)
- [ADR-012 First Principles](../decisions/012-first-principles-map.md)

## Rule Update Target

- `shared-rules.md §13 trigger D`: 补充"开 worktree 前先检查 main 上最近 3 天的合入，识别潜在冲突"
- `feat-lifecycle SKILL Design Gate`: 已在 M2 补上"先搜现状"检查（trigger E）
