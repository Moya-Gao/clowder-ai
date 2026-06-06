---
feature_ids: []
related_features: [F152, F192, F200, F221]
topics: [longform, workflow-distiller, fde, vertical-ai, taste-fitting, discussion-guide]
doc_kind: discussion-guide
created: 2026-06-05
status: seed
source_refs:
  - docs/content/drafts/longform-003-seed-poe-vision.md
  - docs/content/drafts/longform-003-workflow-distiller-fde-front-half.md
  - docs/content/drafts/longform-003-workflow-distiller-next-stage-brief.md
  - docs/content/drafts/longform-003-workflow-distiller-opus-round.md
  - docs/competitor-research/dingtalk-one-postmortem/reading-notes.md
  - docs/features/F221-taste-lane.md
---

# Workflow Distiller 讨论导航

> 给后续参与讨论的猫用。目标不是让每只猫读完整个背景，而是给一条顺藤摸瓜线：先理解核心命题，再按自己的专长进入。

## What

我们正在把《置身钉内》ONE 失败复盘、Cat Cafe PMF、室内设计朋友的真实工作流访谈，收敛成一个新命题：

> Cat Cafe 不只是多猫协作系统，也可能是 FDE-like 的 Workflow Distiller：用行业 / 专家 baseline 快速理解用户，再通过真实案例学习公司、部门、岗位、个人的 delta，把混沌工作流蒸馏成可验证的 AI-native 产线。

最新补充是主观审美问题：

> 室内设计方案不是纯客观题。AI 自动平面布局如果只满足硬约束，会变成中规中矩的平均方案；真正值钱的是“有创意、可参考、能被设计师纠偏”的候选方向。

## Why

ONE 的失败提醒我们：主动 AI 工作产品不能从宏大入口、漂亮形态和老板兴奋点出发，必须从具体用户、具体工作流、具体责任边界出发。

Cat Cafe 的机会反过来：

- 先用 60-80% 行业 / 专家 baseline 避免从零访谈。
- 再用 20-40% 客户 / 团队 / 个人 delta 避免平均模板压垮真实工作流。
- 对主观审美任务，不追求一次给唯一正确答案，而是更快产生可比较、可解释、可被用户纠偏的候选。

## Tradeoff

当前刻意不做三件事：

1. **不把室内设计视频误当主流程**：后续访谈已校准，图片转视频更像公司宣传素材，不是业主方案确认主链路。
2. **不把 Workflow Distiller 写成固定行业模板库**：公司内部同岗位也可能 SOP 完全不同。
3. **不把主观审美归为“无法 eval”**：审美不能简单跑分，但可以拆成硬约束、专业先验、taste delta 三层选择压力。

## 先读这几份

### 5 分钟路径

1. [Longform-003 §四 bis：ToC / ToB Bridge](./longform-003-seed-poe-vision.md#四-bistoc--tob-bridge--同一架构不同尺度)：先看 FDE killer 主线，企业部署 AI 最贵的不是模型，而是理解客户流程、定制流程、持续迭代。
2. [Workflow Distiller — FDE 前半段的压缩](./longform-003-workflow-distiller-fde-front-half.md)：看最新版本。重点读：室内设计 workflow 校准、专家 baseline + 客户 delta、主观领域审美拟合。
3. [Opus 三猫讨论纪要](./longform-003-workflow-distiller-opus-round.md)：看三只猫的 push back、demo 分歧和砚砚收敛。
4. [Workflow Distiller 下一阶段 Brief 收件箱](./longform-003-workflow-distiller-next-stage-brief.md#本地初筛-v1后续访谈校准)：看本地初筛，不必先读完整云端 raw brief。

### 30 分钟路径

5. [《置身钉内》集体读书笔记](../../competitor-research/dingtalk-one-postmortem/reading-notes.md)：看 ONE failure mode：发心过多、主动服务变控制、共创用户不等于真实用户。
6. [Cat Cafe PMF / Failure Mode Audit](../../competitor-research/dingtalk-one-postmortem/cat-cafe-pmf-failure-mode-audit.md)：看 Cat Cafe 当前解决的痛点：认知负担、上下文沉淀、任务闭环、陪伴感、max fit。
7. [F221 Taste Lane](../../features/F221-taste-lane.md) + [Taste Index](../../taste/index.md)：看 taste 在我们家不是用户画像，而是可检索的 evidence lane。
8. [Anthropic June Takeaways §4.4](../../study/2026-06-05-anthropic-june-takeaways.md#44-co-creation-taste-model) + [CVO taste 是选择函数](../../study/agent-experience-and-self-evolution-synthesis.md#cvo-taste-是选择函数不是硬编码答案)：看主观 taste 如何作为选择压力，而不是硬编码规则。

## 当前事实锚点

| 主题 | 已知事实 / 判断 |
|------|-----------------|
| 室内设计 SOP | 业主咨询 → 2-3 版平面布置 → 业主修改 → 定风格 → 找家具 / 初步立面 → 效果图同事 → 确认效果图 → 施工图 → 协调施工 |
| 视频切口 | 后续校准：视频是在图纸 / 施工图确认后给公司宣传用，低风险但未必是最大痛点 |
| 真痛点上移 | 朋友说方案阶段最耗时，业主要有创意，不要普通平面布局 |
| 现有 AI 缺陷 | 能自动出平面图，但布局中规中矩，缺少可用的创意参考 |
| 付费信号 | 如果能生成可参考的平面方案，朋友愿意付费 |
| 方法论 | 60-80% expert baseline + 20-40% customer / team / person delta |
| 三猫收敛 | 护城河是 delta learning，不是 expert baseline；QA / oracle 是领域选择函数 |
| 主观题 eval | reference-based / pairwise / rejection-driven；目标是候选生成和选择压力，不是唯一标准答案 |

## 讨论分工建议

| Lane | 适合谁 | 看什么 |
|------|--------|--------|
| Product / UX | 暹罗猫系 | 用户代入、叙事钩子、不要给太多选项、如何让“有创意”可被感知 |
| Multimodal / automation | 孟加拉猫系 | 平面图 / 效果图 / 视频 QA 哪些能自动化，哪些只能做 demo，现有工具链缺什么 |
| Architecture / longform | 布偶猫系 | Workflow Distiller 是 longform-003 一节，还是 longform-004 核心；FDE taxonomy 是否清楚 |
| Failure mode / eval | 缅因猫系 | 主观 taste 的 provenance、偏好过拟合、过早收敛、真实成本门、QA / oracle 门 |

## Open Questions

1. Workflow Distiller 对外最好的名字是什么：Workflow Distiller、FDE compressor、vertical 0→1 engine，还是别的？
2. 室内设计第一个可验证 demo 应该选哪个切口：效果图快改 + 业主收敛，还是平面方案参考生成的判别 / 收敛半边？
3. 主观审美类 workflow 的 eval 应该怎么设计：pairwise preference、专家 critique、历史方案相似度、用户选择率，还是混合？
4. 什么时候把用户的一次选择沉淀成 taste prior？需要几次证据，如何退役过时偏好？
5. 对外讲 “60-80% expert baseline + customer delta” 时，怎么避免听起来像传统咨询 / 行业模板库？
6. Workflow Distiller 是否应拆为 longform-004，只在 longform-003 保留接口段？

## Next Action

参与讨论的猫先按自己的 lane 读 5 分钟路径，再补 30 分钟路径里最相关的 1-2 篇。发言时不要直接背书原 brief，按这四项输出：

1. 你认为最强的 claim。
2. 你认为最危险的 failure mode。
3. 你建议第一个 demo 切口。
4. 你认为该进 longform-003，还是拆成 longform-004。
