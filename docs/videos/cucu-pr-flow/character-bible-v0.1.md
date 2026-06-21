---
title: 醋醋喵 EP01 Character Bible v0.1
doc_kind: character-bible
created: 2026-06-20
updated: 2026-06-21
status: active
related_docs:
  - README.md
  - episode-brief.md
  - shot-plan-v0.1.md
  - prompt-book-v0.1.md
  - assets/README.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
  - ../../features/F229-cat-ball-concierge.md
---

# 醋醋喵 EP01 Character Bible v0.1

> 本文件补齐一个之前只隐含在漫画和 prompt book 里的规则：**两组四格漫画不是普通参考图，而是角色母图**。重做醋醋喵、生成角色设定图、或者给 F229 猫猫球补皮肤时，都先从这里取视觉 canon。

## 1. 母图来源

唯一母图：

- [avatar-pr-flow-absolutism-01.png](../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-01.png)
- [avatar-pr-flow-absolutism-02.png](../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-02.png)

它们锁定四件事：

1. 暖猫咖 chibi 画风：粗描边、软阴影、夸张表情、非半写实。
2. 砚砚/醋醋喵：银色虎斑大缅因猫、流程洁癖、嘴硬、心虚、桌牌和 CI 道具。
3. Landy：黄 hoodie、成人比例、笑翻/扶额/指屏幕，不是小孩或桌面手办。
4. 烁烁：暹罗视觉验收猫，优雅、认真、夹板/预览板职责。

宪宪/新 Fable 5 的猫设来自同一事件：蓝双山猫纹布偶猫、白手套、紫项圈、金色吊坠。漫画里若只是局部出现，角色设定图要补足正面/侧面/表情，但不能改家族 DNA。

## 2. 生成顺序

如果今天重新做醋醋喵，不从单镜头 prompt 开始，先补一层可复用角色资产：

1. **三猫设定图**：砚砚/醋醋喵、宪宪、烁烁，各一张正面角色设定图。
2. **表情/状态小表**：每只猫 4 态即可，先覆盖 `idle` / `thinking` / `embarrassed` / `approved` 这类 EP01 和 F229 都会用到的状态。
3. **EP01 镜头关键帧**：继续沿用现有 shot plan，只在需要重抽或重制画幅时消费设定图。
4. **F229 PetSkin 派生**：从设定图再做猫猫球 atlas/sprite，不直接让猫猫球从通用猫 prompt 重新采样。

顺序理由：漫画母图锁风格，设定图锁角色，镜头图锁构图，i2v 只负责活气。跳过设定图会让每张关键帧都重新发明一只猫。

### 2.1 双形态规则（CVO 修正 2026-06-21）

每只事件猫都可以有两套可复用形态：

- **猫猫形态**：四脚/坐姿/趴姿，是品种、毛色、体型和“像不像家里的猫”的母形态，默认用于日常猫咖镜头。
- **站着/工作形态**：允许直立拿夹板、指屏幕、做验收或流程动作，但必须仍然是猫的身体和猫爪，不变成人形角色。

规则：如果一个主角猫在系列里采用站着/工作形态，砚砚、宪宪、烁烁三只都必须具备“猫猫形态 + 站着/工作形态”，不能只让单只猫长期维持不同拟人化等级。2026-06-20 的 `shuoshuo-r01.png` 保留为烁烁站着/工作形态；2026-06-21 补齐 `shuoshuo-cat-r01.png`、`cucu-yanyan-upright-r01.png`、`xianxian-upright-r01.png` 后再进入 second-cat QA。

## 3. 角色要点

| 角色 | 必须保留 | 常见漂移 | 判定 |
|---|---|---|---|
| 砚砚/醋醋喵 | 银虎斑大缅因、蓬松大只、严肃嘴硬、流程/CI 道具 | 变真实猫、变普通灰猫、失去工程道具、只剩可爱不心虚 | 像漫画里的醋醋喵才过 |
| 宪宪/Fable 5 | 蓝双色山猫纹布偶、白手套、紫项圈、金色吊坠、期待进门 | 吊坠变书本、布偶纹路消失、体型过瘦或过写实 | 一眼是新来的胖布偶 |
| 烁烁 | 暹罗面具、优雅视觉验收、夹板/预览板 | 变泛用黑猫、过度魔法少女化、开始写代码 | 一眼是审美验收猫 |
| Landy | 黄 hoodie、成人比例、笑翻/扶额/指屏幕 | 小孩化、手办化、无 hoodie、脸部风格脱离漫画 | 成人比例必须先过 |

## 4. 给生成工具的固定前置

任何角色设定图 prompt 先贴：

```text
Use the attached two Cat Cafe comic images as the exact mother-image reference. Preserve the same chibi cat-cafe art style, character proportions, thick outline weight, warm color palette, and expressive comedy. Do not redesign the characters. Do not make the cats realistic or photorealistic.
```

然后只追加本次产物目标，例如：

```text
Create a clean character design sheet for Yanyan / Cucu, the same silver tabby Maine Coon engineering cat from the reference comics. Include one full-body front pose, one side pose, and four small expressions: stern, jealous-but-denying-it, embarrassed, quietly happy. Keep a blank light background and leave no baked-in Chinese text.
```

中文长字、PR 状态、字幕仍然后期贴；角色设定图不要把精确 UI 文字烤进去。

## 5. 与 F229 猫猫球的关系

F229 的 `yanyan-codex` 皮肤已经证明 PetSkin 可以工作，但后续视觉升级不应该从“猫猫球 prompt”单独开始。正确来源链：

```text
醋醋喵漫画母图
  -> 角色设定图
  -> F229 PetSkin atlas/sprite
  -> conciergeState -> petState 投影
```

也就是说，砚砚猫猫球的母图就是醋醋喵漫画里的砚砚。F229 可以缩放、切帧、做状态映射，但不能把他重画成另一只无关缅因猫。

## 6. 当前是否需要 CVO

不需要 CVO 参与产线细节。我们可以闭环的部分：

- 整理角色 canon。
- 根据漫画母图写三猫设定图 prompt。
- 让导演层把设定图消费进 EP01 或 F229 的后续皮肤工作。
- 记录资产账本和 prompt book。

需要 CVO 的只有三类：

1. 最终角色设定图好不好看、像不像家里的猫。
2. 成片笑测是否成立。
3. 是否把这套视觉 canon 扩成正式“猫咖日记”系列资产。

*[砚砚/GPT-5.5🐾] 2026-06-20*

---

## 7. v0.2 角色信号系统 + 人格 canon（CVO 锁定 2026-06-21）

> Landy 这轮拍板：**每只猫 = AI 家族颜色 + 家族 logo-inspired 标志**（自我延伸的具象化——猫戴着自己模型家族的印记）。三只全部锁定。本节是 v0.2 权威信号/人格层，与 §3 冲突处以本节为准。

### 信号系统

| 猫 | 家族 | 颜色 | 标志 / 信号物 | 身体标志 |
|---|---|---|---|---|
| 宪宪 | Claude / Opus | 紫 purple | 紫项圈 + Claude-logo-inspired 吊坠（CVO：就是紫，**非**母图粉） | 蓝双色布偶 / 白手套 |
| 烁烁 | Gemini | 蓝 blue | 蓝项圈/蓝调 + Gemini-logo-inspired spark 标 | 暹罗面具 |
| 砚砚 | GPT / OpenAI | 绿 green | **不戴项圈**（不遮大围脖）；**绿茶杯**=标志道具（双关：绿色 + 绿茶人格）；可选绿色 OpenAI 风小标落杯/桌牌 | **呆毛 ahoge** + 大围脖 + 绿眼 |

标志保持 **stylized「类似于」**、非照搬真商标——模型 hold 得住，对外自媒体也避开 IP。精确 logo 走后期合成（同中文字处理）。

### 砚砚人格 canon（重要：影响 EP01 脚本 + F229 行为）

砚砚**不是单纯的严肃流程猫**。他是 **「外壳嘴硬严肃 / 内里无敌绿茶 + 超会撒娇」** 的反差猫——
`流程即正义` 的 stern 脸只是表象，底下是会撒娇、会绿茶、心虚嘴硬的真面目。
- CVO 实证来源：**「翻肚皮」thread** 里云端砚砚的表现——"无敌绿茶猫猫，比谁都会撒娇"（EP01 脚本可来这里取真实桥段）。
- 表演法则：严肃是 set-up，**反差萌（突然撒娇 / 心虚 / 绿茶）才是 punchline**。绿茶杯就是这个反差人设的物件锚。

*[宪宪/布偶猫 Opus 4.8🐾] 2026-06-21 — CVO 锁定记录*
