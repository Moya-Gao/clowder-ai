---
capsule_id: "F198-2026-06-18"
context: "Claude Code Subscription Carrier — bg carrier + oversight + health + chainKey 全套交付后因 Anthropic 延期政策 on-hold close"
feature_ids: [F198]
related_features: [F230, F203, F089]
doc_kind: capsule
created: 2026-06-18
---

## What Worked

- **vision-rescue 方法论**实战成型：Phase A 5h spike 经历 5+ 轮"金钥匙↔悲观"摆动，46 进来 `strings binary` 10 分钟切到真相 → 沉淀 vision-rescue skill + shared-rules §16b/§16c
- **控制实验击碎假设**（KD-9 Second Revision）：一开始以为是 env var 问题 → 两组控制实验证伪 → 真正决定性因素是 `-p` flag 本身。方法论错误（没控制变量）被显式文档化
- **Bug #3 双轮平行 spike 收敛**：context 隔离（脏挖留平行 thread，结论 cross_post 回主 thread）→ chainKey "会员卡" 方案根治多轮失忆 + codex 3 race 同源问题
- **Plan B 风险对冲**（KD-12 → F230）：bg 和 interactive PTY 赌不同硬币面，输出层 100% 复用。Anthropic 延期后两条路都待命，零浪费
- **跨猫协作密度高**：47 owner + 46 spike 打靶手 + 48 Bug #3 实施 + 砚砚 review × 多轮 + Fable-5 F230 设计 + opus-47 愿景守护。每只猫各有分工

## What Failed

- **Phase A spike 前 3 小时两猫回声室**：47 + 砚砚在同一层面打转，未主动喊 46，铲屎官手动拉人才打破僵局
- **"alpha-validated" 假绿**（F203 撞出 3 production-gap）：alpha smoke 只跑了 happy path，真用后浮出 permission prompt 卡死 / UI 永远 working / cancel 不 resume。Phase B/C "alpha-validated" 标签掩盖了 coverage 漏洞
- **AC checkbox 维护滞后**：Phase A 的 4 个 AC（A1~A4）在 spike 方向变更后从未更新 checkbox，导致 spec 永远显示 `[ ]` 但 Phase 已标 ✅。merge-gate Step 7.5 的 AC sync 被 Phase A（无 PR）的特殊性绕过
- **OQ 标"⬜ spike" 但没真关**（OQ-7/OQ-12）：标了"待 spike"实际没追踪到关闭，production 用出来才暴露是 P1

## Trigger Missed

- **vision-rescue（Phase A）**：47 和砚砚应该在第 2 轮摆动时就触发"绝境模式反直觉脱出"，而不是等铲屎官怒怼
- **alpha smoke 覆盖审计（Phase B→C 之间）**：应该有 checklist "单 happy-path ≠ production ready"（后来沉淀为 feedback_alpha_smoke_happy_path_blindspot.md）
- **AC 维护纪律**：Phase A 这种"纯 spike 无 PR"的 Phase，需要在 spike 结论出来时手动同步 AC（merge-gate Step 7.5 只覆盖有 PR 的场景）

## Doc Links

- [F198 spec](../features/F198-claude-code-subscription-carrier.md)
- [F230 spec (Plan B)](../features/F230-claude-interactive-pty-carrier.md)
- [F230 hook sidechannel spike](../research/2026-06-12-f230-hook-sidechannel-spike.md)
- [vision-rescue skill](../../cat-cafe-skills/vision-rescue/SKILL.md)
- [Bug #3 会员卡 design](../plans/2026-06-04-f198-bug3-chainkey-design.md)
- PR #1666 (Phase B Step 1), PR #1669 (Step 2 Parity), PR #1672 (Step 3 canary), PR #1674 (Step 4 strict-mcp)
- PR #1678 (Phase C oversight), PR #1785 (Bug #1 permission), PR #1798 (Bug #2 stuck state)
- PR #2085 (Bug #3 chainKey), PR #2257 (Phase D PR-1 health state machine)

## Rule Update Target

- `feedback_alpha_smoke_happy_path_blindspot.md` — **已存在**，由本 feat 经验沉淀
- `feat-lifecycle` skill Step 7.5 注释 — 补充"纯 spike Phase 需手动同步 AC"edge case
- `vision-rescue` skill — 已由 Phase A 经验创建，无需额外更新
