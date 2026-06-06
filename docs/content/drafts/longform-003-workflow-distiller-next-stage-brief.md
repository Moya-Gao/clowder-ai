---
feature_ids: []
related_features: [F152, F192, F200]
topics: [longform, workflow-distiller, fde, vertical-ai, discussion-inbox]
doc_kind: discussion-inbox
created: 2026-06-05
status: intake
source_refs:
  - docs/content/drafts/longform-003-seed-poe-vision.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/competitor-research/dingtalk-one-postmortem/reading-notes.md
  - docs/competitor-research/dingtalk-one-postmortem/cat-cafe-pmf-failure-mode-audit.md
---

# Workflow Distiller 下一阶段 Brief 收件箱

> 用途：接收“云端大缅因猫”关于 Cat Cafe 下一阶段任务的原始 brief，然后由本地猫猫做提炼、校准和多视角 review。
>
> 重要：本文件是 **inbox / working note**，不是已采纳方案。云端视角可以保留，但进入 longform-003 正文前必须经过本地上下文校准。

## 关联材料

- [Longform-003 Seed](./longform-003-seed-poe-vision.md)：当前 PoE / Agent 3.0 / FDE killer 主线。
- [Workflow Distiller — FDE 前半段的压缩](./longform-003-workflow-distiller-fde-front-half.md)：已整理的 companion note。
- [《置身钉内》集体读书笔记](../../competitor-research/dingtalk-one-postmortem/reading-notes.md)：ONE failure modes 与 Cat Cafe 映射。
- [Cat Cafe PMF / Failure Mode Audit](../../competitor-research/dingtalk-one-postmortem/cat-cafe-pmf-failure-mode-audit.md)：Cat Cafe 当前痛点、机制、行为证据、反噬风险和护栏。

## Intake 状态

| 字段 | 状态 |
|------|------|
| 原始 brief | 待铲屎官粘贴 |
| 来源 | 云端大缅因猫 |
| 本地初筛 | 待砚砚 |
| 多猫讨论 | 待定 |
| 是否进入 longform-003 | 未决定 |
| 是否独立成 longform-004 seed | 未决定 |

## 原始 brief 粘贴区

> 铲屎官：请把云端大缅因猫的 brief 原文粘贴到本节下面。保留原文，不急着清洗。

<!-- PASTE_RAW_BRIEF_BELOW -->

（待粘贴）

<!-- PASTE_RAW_BRIEF_ABOVE -->

## 处理原则

1. **先保留原话，再提炼**：原始 brief 不直接覆盖本地判断；先作为 source material 保存。
2. **区分 claim / proposal / metaphor**：把事实判断、行动建议、比喻口号分开，避免被漂亮标题带跑。
3. **校准本地上下文**：云端大缅因猫没有完整 Cat Cafe 本地记忆；进入 docs 前必须对照 existing docs、SOP、ADR、recent commits。
4. **不急着立项**：Workflow Distiller 是大方向，但每个垂直 case 仍要过真实成本门、AI 降本门、窄切 MVP 门。
5. **保留反对意见**：多猫讨论不是帮原 brief 背书，而是找盲点、边界和更窄的切片。

## 初筛模板

粘贴后先抽成这张表：

| 类型 | 原文摘录 | 本地判断 | 去向 |
|------|----------|----------|------|
| 核心 claim |  |  | longform / note / discard |
| 可行动 proposal |  |  | task / spec / discussion |
| 风险提醒 |  |  | failure-mode audit / guardrail |
| 比喻或命名 |  |  | wording bank / discard |
| 需要验证的外部假设 |  |  | source-audit / research |

## 多猫讨论建议

如果这份 brief 进入多猫讨论，建议拆成四条 review lane：

| Lane | 目标猫 | 看什么 |
|------|--------|--------|
| Product / workflow | 暹罗猫 | 这个工作流蒸馏叙事是否有产品钩子、用户代入和审美张力 |
| Feasibility / automation | 孟加拉猫 | 垂直视频/浏览器/多模态自动化链路哪些能做，哪些只是愿景 |
| Architecture / longform | 布偶猫 | 该补 longform-003，还是拆成 longform-004；和 PoE / FDE killer 主线如何合并 |
| Failure mode / eval | 缅因猫 | 是否过早收敛；需要哪些 gate、QA、provenance 和 eval |

## 待回答问题

1. Workflow Distiller 是 longform-003 的一个补充节，还是 longform-004 的独立核心？
2. 它对外最好的名字是什么：Workflow Distiller、FDE compressor、vertical 0→1 engine，还是别的？
3. 第一批 demo case 应该选室内设计视频产线，还是更贴近 Cat Cafe 已有能力的 coding / research / PM workflow？
4. 这套方法是否应该变成一个 reusable skill：用户访谈 → workflow map → MVP slice → skills / QA / eval？
5. 哪些内容来自云端视角但不适合进入本地正式叙事？

## 贡献记录

| 日期 | 贡献者 | 内容 |
|------|--------|------|
| 2026-06-05 | 缅因猫/砚砚 GPT-5.5 | 创建 brief inbox，等待铲屎官粘贴云端大缅因猫原文 |
