---
capsule_id: "F121-2026-03-16"
context: "社区前端 UX 6 issue 侦查分诊 + 上游完整修复 + 愿景守护"
feature_ids: [F121]
doc_kind: capsule
created: 2026-03-16
---

## What Worked

- **三猫分工侦查效率高**：6 个 issue 在一轮对话内完成全部猫爪印报告，每猫 2 个，各自用代码定位而非猜测
- **社区 PR inbound 评审流程清晰**：Phase C 发现 PR#40/#43 方向正确但质量不达标，按 B2 路线上游完整修复，避免了合入后再补丁的技术债
- **口径收窄决策透明**：#28 实际修了 RightStatusPanel 而非 chat pane，主动在社区说明，不硬关单
- **rAF retry + anchor 双语义**解决了 #27 scroll restore 的根因（container 未到可滚动高度时 scrollTop 被截断），比简单的 scrollTop 保存/恢复更健壮
- **Module-level Map** 绕开了 Next.js App Router 页面重挂载丢 useRef 的问题，是可复用模式

## What Failed

- **#27 scroll restore 前两轮修复失败**：没有真正读懂 useChatHistory 的渲染时序就开始修，猜了"store sync guard"和"useEffect 触发顺序"两个方向都不对。铲屎官原话："布偶猫他根本修不好，他现在修 bug，他根本不看代码，瞎猜一个可能性乱修。" 最终砚砚(gpt52)接手，用浏览器实际调试定位到 container height 根因
- **#88 术语表后续跟踪**最初没想清楚：差点把它留在 F121 阻塞关闭，后来才确定拆出为独立社区 issue

## Trigger Missed

- **debugging skill 未加载**：#27 前两轮修 bug 时应该加载 debugging skill（系统化根因调查），而不是直觉猜测修法。如果走了"复现 → 假设 → 最小验证"流程，可能不需要砚砚救场
- **浏览器验证未前置**：修 scroll 相关 bug 应该第一时间在浏览器里看 scrollHeight/clientHeight/scrollTop 的实际值，而不是纯看代码推理

## Doc Links

- [F121 Feature Spec](../features/F121-community-frontend-ux-triage.md)
- [F095 Thread Sidebar](../features/F095-sidebar-collapse-memory.md) — #89 回归来源
- [F110 Bootcamp Vision](../features/F110-bootcamp-vision-elicitation.md) — #16 吸收目标
- [PR #449](https://github.com/zts212653/cat-cafe/pull/449) — #22/#89/#28 修复
- [PR #455](https://github.com/zts212653/cat-cafe/pull/455) — #27 scroll restore
- [PR #457](https://github.com/zts212653/cat-cafe/pull/457) — pinned section auto-expand hotfix

## Rule Update Target

- `feedback_iron_rules.md`：补充"修 bug 必须先复现+看实际值，不许猜可能性乱修"（来源：铲屎官 #27 原话）
- `shared-rules.md` 或 `debugging` skill：前端 scroll/layout bug 必须先在浏览器看 computed values（scrollHeight/clientHeight/scrollTop），纯代码推理不够
