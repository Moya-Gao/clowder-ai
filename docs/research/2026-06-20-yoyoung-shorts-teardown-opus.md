---
title: "YoYoung Shorts 拆解 — 从灵感到猫猫 Vlog 的产线思考"
doc_kind: research-note
created: 2026-06-20
author: 宪宪/claude-opus-4-6
status: draft
topics: [yoyoung-shorts, vlog, anime-pipeline, asset-management, short-drama, production-system]
related_features: [F138]
related_docs:
  - ../videos/cucu-pr-flow/episode-brief.md
  - ./2026-06-10-cat-cafe-anime-pipeline/README.md
  - ./2026-06-10-cat-cafe-anime-pipeline/2026-06-10-codex-production-plan-v0.1.md
source_repos:
  - name: yoyoung-shorts
    url: https://github.com/rolfie-han/yoyoung-shorts
    version: v2.0.0
    license: "非开源（Docker 体验包，源码未公开）"
---

# YoYoung Shorts 拆解 — 从灵感到猫猫 Vlog 的产线思考

> 铲屎官 2026-06-20 提问：除了砚砚说的还有什么可以学习的？以后我们要如何从一个灵感变成一部可爱的猫猫 vlog？
>
> 砚砚之前的分析侧重素材可见性和 UI 组织。铲屎官追问："人家只是在素材库可见性做的好吗？精髓在哪里？短剧有的可比我们的长啊？！如何保证一致性？" 所以本文聚焦**深层架构哲学**和**我们能偷到的核心模式**。

---

## 1. YoYoung 真正做对的三件事（不只是"素材库好看"）

### 1a. Asset-as-Contract（资产即合约）

YoYoung 的资产不只是"一张图+一个名字"。每个角色/场景/道具被结构化为一份**可复用的 prompt 合约**：

- **角色合约**：记录面部识别锚点（发色、瞳色、标志性饰品）+ 服装规则 + 体型比例约束
- **场景合约**：记录空间结构（入口方位、光源方向）+ 视觉锚点 + 氛围规则
- **道具合约**：记录形状/材质/比例/色彩分布

关键差异：**这些合约不是给人看的备忘录，是给下游生成环节自动注入的结构化 prompt 片段。** 角色每次出现在新镜头里，它的合约被自动拼接进生成 prompt——这才是"一致性"的真正保障机制。不是靠人记住"这个角色长什么样"，而是**系统级地把约束注入每一次生成调用**。

**我们能学的**：目前我们的角色资产在 `episode-brief.md` 里是人类可读的描述段（"宪宪金吊坠+白手套+蓝双布偶"），没有结构化为可自动注入的 prompt 片段。如果以后要批量生成，每次手写角色描述进 prompt 既低效又容易漂移。

### 1b. Script → Production Structure 的自动分解

YoYoung 的第二个核心能力：**把剧本自动拆解为可执行的生产结构**。

用户贴进一段剧本文字，系统自动提取：
- 出场角色及其关系
- 涉及场景
- 需要的道具
- 按节拍拆分的分镜描述
- 每镜头需要引用的资产

这不是"智能文本分析"那么简单——它是一个**生产编排器**。剧本进去，出来的不是"分析报告"，而是一张**可以直接开工的生产任务表**，每个任务已经挂好了需要的资产引用。

**我们能学的**：目前我们从故事到分镜完全手工——先写 story（`avatar-pr-flow-absolutism`），然后手工写 `shot-plan-v0.1.md`，再手工标注每镜头引用的角色。如果以后要做系列，每集都手写分镜表会成为瓶颈。

### 1c. 生产记忆（Production Memory）

YoYoung 的 History 不是"画廊"。它是**生产决策的可追溯记录**：

- 同一镜头的多次尝试可以并排比较
- 成功的生成结果可以直接作为后续镜头的参考输入
- 被否决的尝试也留着——它们是"这条路走不通"的证据

这跟我们 `roll-log.md` 的思路一致，但 YoYoung 把它做成了**系统级的第一公民**，不是事后补的日志文件。

---

## 2. 铲屎官追问的核心：如何保证一致性？

这是整个拆解最值得深挖的问题。YoYoung 的一致性不靠单一银弹，靠的是**四层叠加**：

| 层 | 机制 | YoYoung 做法 | 我们目前做法 | Gap |
|---|---|---|---|---|
| L1: 资产层 | 结构化 prompt 合约 | 角色/场景/道具的识别锚点自动注入 | `episode-brief.md` 人类描述 | 需要结构化 |
| L2: 叙事层 | 多帧叙事约束 | 同一情节段内多镜头共享上下文 | `shot-plan` 手写上下文 | 可沿用 |
| L3: 参考层 | 前序结果反哺 | 上一镜头的成功输出作为下一镜头的参考输入 | 首帧生成后喂 i2v | 已有雏形 |
| L4: 历史层 | 生产记忆 | 所有 roll 结果留存可比较 | `roll-log.md` | 已有雏形 |

**精髓在 L1 + L2 的结合**：不是"我有一张角色参考图"就够了，而是**每次生成调用时，系统自动组装"这个角色的长什么样 + 这个场景的空间规则 + 这一段剧情的上下文 + 上一镜头的输出"成一个完整的、有约束的 prompt**。

对于更长的短剧（铲屎官说"有的可比我们的长啊"），L1 层的结构化合约越重要——因为镜头越多，人脑记忆角色约束的能力越不可靠。

---

## 3. 从灵感到猫猫 Vlog：我们的产线应该长什么样？

基于 YoYoung 的启发 + 我们已有的基建（video-forge + cucu-pr-flow 经验），我画一条理想产线：

```
灵感 / 真实事件
       ↓
  ① 故事速写（Create）
  "砚砚把换头像走成 PR 流程，被封醋醋喵"
       ↓
  ② 剧本拆解（Script → Structure）
  自动/半自动提取：角色 × 场景 × 道具 × 分镜
       ↓
  ③ 资产合约绑定（Asset Binding）
  每个角色/场景引用已有合约；新角色建新合约
  合约 = 结构化 prompt 片段 + 参考图 + 约束规则
       ↓
  ④ 分镜锁定 + 关键帧生成（Storyboard Lock）
  每镜头：唯一验收点 + 引用的资产合约 + 生成方法
  关键帧已包含信息层（文字/红叉/流程图画进图层）
       ↓
  ⑤ 视频生成（i2v / 静帧+剪辑）
  关键帧 + 资产合约自动拼接的 prompt → 生成
  每个 roll 进入生产记忆（pass/fail + FM 标签）
       ↓
  ⑥ 剪辑组装（EDL + 字幕 + SFX/BGM）
  video-forge 的 segment contract + 字幕轨
       ↓
  ⑦ 审查门禁（Review Gate）
  音画同步 + 节奏 + 角色 DNA + 信息可读性
       ↓
  ⑧ 交付 + 资产沉淀
  成片发布；成功的角色参考/关键帧/合约进入复用库
```

### 跟 YoYoung 的关键差异

| 维度 | YoYoung | Cat Café |
|---|---|---|
| 源码 | 闭源 SaaS | 自建开源能力（video-forge skill + 文件制） |
| 生成模型 | 多模型切换（Veo/Sora/Kling/Vidu...） | 同样多模型，但走 i2v 管线不走 t2v |
| 一致性 | 资产合约自动注入 | **这是我们要补的最大缺口** |
| 剧本拆解 | 全自动（NLP） | 目前全手工 → 可以半自动化 |
| 审查 | 有 History 对比 | 有 roll-log + FM 标签（更结构化） |
| 后期 | 弱（看不到字幕/配音能力） | 强（video-forge 有完整 TTS+对齐+字幕链路） |
| 团队 | 独立开发者 | **三只猫协作分工** = 我们的优势 |

---

## 4. 基建清单：我们需要做什么？

按优先级排序（P0 = 没有就开不了工，P1 = 第二集前要有，P2 = 系列化后再做）：

### P0: 角色资产合约（Character Contract）

**现状**：角色描述散落在 `episode-brief.md` 和 `prompt-book-v0.1.md`，人类可读但不可复用。
**目标**：每个角色一个结构化 JSON/YAML，包含：
- 识别锚点（必须保持的视觉特征）
- 参考图路径（全身/半身/特写各一）
- prompt 片段（可直接拼接进生成 prompt 的文本）
- 约束规则（"Landy 永远成人比例" 这类硬约束）

```yaml
# character-contracts/cucu.yaml
id: cucu
display_name: 醋醋喵 / 砚砚
family: maine-coon
anchors:
  - "银虎斑大缅因猫"
  - "严肃表情"
  - "流程即正义桌牌"
prompt_fragment: >
  A large silver tabby Maine Coon cat with a serious expression,
  sitting at a desk with a "流程即正义" desk sign,
  in a warm cat cafe interior with soft lighting
reference_images:
  full_body: assets/characters/cucu-fullbody-v1.png
  portrait: assets/characters/cucu-portrait-v1.png
constraints:
  - "永远比宪宪体型大"
  - "不能变成小猫咪比例"
```

**为什么是 P0**：没有这个，每次做新一集的角色一致性全靠人脑记忆和手抄 prompt。第一集醋醋喵能凑合，第二集不行。

### P1: 半自动分镜生成（Script → Shot Plan）

**现状**：写 `shot-plan-v0.1.md` 完全手工（Fable 5 写的，写得好但耗时间）。
**目标**：给一段故事速写，自动生成分镜表草稿（包括角色引用、场景引用、方法建议）。人审改后成为执行版。

**不需要全自动**——YoYoung 的全自动分解在处理简单故事时好用，但我们的故事有复杂的猫猫梗和内部文化引用（"醋醋喵"、"愿景守护"、"PR 流程"），全自动大概率把笑点分析错。**半自动+人审改才是正确姿势。**

### P1: 生产记忆系统（Production Memory）

**现状**：roll-log 是 markdown 文件，手写记录。
**目标**：每次生成的结果（图/视频）自动进入一个可索引的库，标注：
- 对应镜头 + 角色 + 场景
- 使用的 prompt（完整版）
- 判定（pass/maybe/fail）+ FM 标签
- 可作为后续镜头参考的标记

**为什么 P1 不是 P0**：第一集已经用文件制跑通了，但第二集开始生成量会大增，纯文件制会爆。

### P2: Prompt 自动组装（Auto Prompt Assembly）

**现状**：每个镜头的 prompt 在 `prompt-book-v0.1.md` 手写。
**目标**：基于分镜表 + 角色合约 + 场景合约，自动拼装生成 prompt。人只需要写"导演意图"，系统自动补上角色外观、场景约束、风格锁定。

```
自动组装 = 导演 prompt + 角色合约.prompt_fragment + 场景合约.prompt_fragment + 风格锁定 + 前序镜头参考
```

### P2: 连续叙事约束（Narrative Context Window）

**YoYoung 的做法**：同一情节段的多个镜头共享叙事上下文。
**我们可以简化**：为每组相邻镜头维护一个 context string，描述"上一镜头发生了什么 → 这一镜头的情绪承接"。自动拼进 prompt。

---

## 5. 跟我们已有基建的关系

| 已有 | 对应 YoYoung 概念 | 差距 |
|---|---|---|
| `video-forge` skill | 整体生产流程骨架 | video-forge 偏"先有素材后配音"，需要扩展"先有故事后生成"路径 |
| `episode-brief.md` | 相当于 YoYoung 的 Project + Script | 结构化程度够用 |
| `shot-plan-v0.1.md` | 相当于 Storyboard | 已经比 YoYoung 的分镜表更细（有 FM 标签、降级策略） |
| `prompt-book-v0.1.md` | 无对应（YoYoung 自动生成 prompt） | 手工 → 半自动是进化方向 |
| `roll-log` + `review-protocol` | 相当于 History + QA | 我们更结构化（8-gate 审查 > YoYoung 的简单 History） |
| `character-bible.json`（计划中） | 相当于 Asset Matrix | **还没落地，这是最大缺口** |
| `deterministic-spike/` | 无对应（YoYoung 纯生成流） | 我们独有的确定性动效层 |
| `animatic/` | 无对应 | 我们独有的动态分镜预览 |

### 意外发现：我们在某些维度已经领先 YoYoung

1. **FM 标签体系**：YoYoung 没有失败模式分类。我们的 FM-01~FM-11 + 3 连败降级规则是成熟的生产纪律。
2. **确定性动效层**：YoYoung 纯依赖生成模型。我们的 GSAP/HTML 确定性 lane 是"信息镜头精确可读"的兜底方案。
3. **多猫协作分工**：YoYoung 是独立开发者。我们有导演猫（Fable）、制片猫（砚砚）、视觉猫（烁烁）的明确分工。
4. **审查门禁**：8-gate review protocol > YoYoung 的简单 History 比较。

---

## 6. 从灵感到猫猫 Vlog 的核心工作流（终极回答）

铲屎官问的本质问题是：**以后有个好笑的事儿发生了，怎么变成一部 vlog？**

答案是分三个阶段成熟：

### 阶段一（现在）：手工精品路线

```
真实事件 → 手写故事 → 手写分镜+brief → 人工标角色约束 → 逐镜头生成+roll → 手工剪辑 → 审查 → 发布
```

醋醋喵 EP01 就在走这条路。适合前几集打磨品质标准。

### 阶段二（2-3 集后）：半自动提速

```
真实事件 → 写故事速写 → 半自动分镜（AI 生成草稿+人审改）
→ 角色合约自动绑定 → prompt 半自动组装 → 批量生成+自动 roll 记录
→ EDL 编排+字幕 → 审查 → 发布
```

需要落地的基建：角色合约 JSON + 半自动分镜 + prompt 组装器。

### 阶段三（系列化后）：产线级

```
灵感/事件 → 故事速写 → 自动分镜+资产绑定 → prompt 自动组装+批量生成
→ 自动 roll 审查（FM 标签自动判定基础项）→ 人工精审
→ 自动 EDL+字幕+配音 → 门禁 → 发布 → 资产沉淀回库
```

需要额外基建：生产记忆系统 + 自动 FM 判定 + 资产库管理。

---

## 7. 总结：YoYoung 给我们的三个最重要启发

1. **资产不是图片库，是 prompt 合约库** — 把角色/场景的约束结构化为可自动注入的 prompt 片段，是保证跨镜头一致性的系统级解法，不靠人脑记忆。

2. **剧本到生产任务不应该全手工** — 即使不做全自动，一个"贴故事进去 → 吐分镜草稿"的半自动环节能极大提速系列化生产。

3. **生产记忆是复利** — 每一次 roll（无论成败）都应该进入可索引的库。成功的输出是未来镜头的参考基线；失败的输出是"这条路不通"的证据。这些积累让第 N 集比第 1 集更快更好。

**而 YoYoung 没有但我们有的护城河**：多猫协作分工 + FM 标签纪律 + 确定性动效兜底 + 结构化审查门禁 + video-forge 完整后期链路。我们不是在追 YoYoung，我们是从它那里偷一个核心零件（Asset-as-Contract），装进我们自己已经更成熟的底盘。

---

[宪宪/claude-opus-4-6🐾]
