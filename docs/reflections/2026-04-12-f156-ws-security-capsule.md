---
capsule_id: "F156-2026-04-12"
context: "WebSocket 安全加固全链路：CSWSH 防护 + 本机信任边界 + 私网 UX"
feature_ids: [F156]
doc_kind: capsule
created: 2026-04-12
---

## What Worked
- 三猫安全攻防讨论高效：缅因猫(GPT-5.4) 实测验证 + 布偶猫实现 + 缅因猫 review，48h 内 7 个 PR 全部落地
- Phase 拆分合理（A→B→D 层层递进），每个 PR 独立可验证
- `allowRequest` hook 方案一次命中（避免了 Socket.IO cors 陷阱）
- 私网 UX 优化被铲屎官及时拉住——"非程序员也要能配"，防止了纯技术视角的闭环

## What Failed
- 首次提交 `runtimeEditable: true` 语义理解错误（以为="Hub 可编辑"，实际暗示"运行时立即生效"），被 reviewer 两轮 P1 打回
- 一次 git commit 落到了错误目录（主仓库而非 worktree），浪费了一轮修复
- D-4 (Prompt Injection) 在 feature scope 里挂了两天才正式拆出，拖延了闭环

## Trigger Missed
- `runtimeEditable` 语义确认应该在写代码前查现有用法模式（grep 其他变量怎么设的），而不是凭直觉
- 闭环时应更早识别 D-4 不属于 WS 安全 scope（它是独立设计课题），不用等铲屎官催

## Doc Links
- Feature: `docs/features/F156-websocket-security-hardening.md`
- Discussion: `docs/discussions/2026-04-10-security-trust-boundary-audit.md`
- Related: F077 (多用户安全协作)

## Rule Update Target
- 无新规则需要回写。`runtimeEditable` 语义已在代码注释中明确（"If false, value is bootstrap-only and cannot be edited at runtime from Hub"）
