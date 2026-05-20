---
platform: ppt
status: draft
created: 2026-05-20
author: 砚砚/GPT-55
mode: imagegen-raster-first
source: 铲屎官提供的 2026-03-07 通用机器人长文
reviewers:
  - 宪宪/Opus-46
  - 宪宪/Opus-47
---

# 华为风格通用机器人 PPT 图片生成方案初稿

## 0. 定位

这是一次 **imagegen-raster-first capability spike**：不追求可编辑 PPT，不走完整
`ppt-forge` HTML/CSS 管线，目标是生成一套精美、统一、像华为内部战略洞察稿的
全图像幻灯片。

内容源以铲屎官提供的文章为准，暂不做外部事实校验。最终交付形态建议是：

- 每页先生成最高可用分辨率的 16:9 成稿 PNG；目标按 3840x2160 设计，
  实际以当前 imagegen 输出能力为准。
- 再把 PNG 全屏嵌入 PPTX。
- logo 永远使用真实资产后处理贴入，不交给 imagegen 绘制；生成图只预留 logo
  安放区。
- 如中文文字或跨页一致性无法由纯 imagegen 稳定保证，则在生成底图后叠加真实
  文字/真实 logo，再拍平成 PNG；最终仍是不可编辑 raster slide。

## 1. 三猫观点汇总

### 宪宪/Opus-46

核心贡献是 **10 页三幕叙事骨架**：

- 第一幕破题：封面、核心论点、历史浪潮。
- 第二幕现状与挑战：本轮驱动、莫拉维克悖论、三大挑战、数据鸿沟。
- 第三幕路径与结论：产业路径、胜出逻辑、长期结论。

他的判断很稳：这篇文章不是信息罗列，而是“狼来了三次 → 这次为什么不同 →
但别急，路还长”的叙事弧线。PPT 每页都必须有判断，不要把长文切成段落摘要。

### 宪宪/Opus-47

核心贡献是 **视觉子流派与校准判据**：

- 这篇不该走纯“作战网格风”，而应该走更接近《智能世界 2035》的
  **华为白皮书/发布会风**：深色电影感背景、红色几何光线、大图、一页一结论。
- 高密小字是图片生成弱项；应先用最难页做 go/no-go，而不是只测封面。
- 关键数字和 logo 不应交给 diffusion 自由绘制。数字要核对，logo 用真实资产或
  后处理贴入。

他的判断解决了这次挑战的最大风险：不要为了“像华为”而选择最不适合图片生成的
高密文字网格。

### 砚砚/GPT-55

我的初始判断是 **raster-first，但控制文字密度**：

- 主方案可以是纯图片成稿，因为铲屎官明确说不需要可编辑。
- 但文字必须压缩成短标题、大数字、短标签，不把原文长段交给图片模型。
- 第一轮应先生成封面 + 一张核心难页，校准风格、中文、密度和跨页系统。

我现在收敛后的立场是：采用 10 页骨架，但视觉上选择 “华为白皮书风为主，
关键页加战略模块密度”，而不是全程小字数据墙。

## 2. 收敛后的创作原则

### 2.1 主题主线

**通用机器人不是 AI 的一个应用，而是 AGI 走向物理世界的必由之路。**

这套 PPT 的中心判断：

- 短期：产业热度高，Demo 多，泡沫会来，2-3 年要保守。
- 中期：工业场景先行，消费场景后起，2028 年后可能出现首批真正商用价值产品。
- 长期：十年维度乐观，机器人会像自动驾驶/电动车一样经历持久工程化迭代。
- 胜负手：灵巧手、真实数据、软硬一体闭环、供应链、场景落地。

### 2.2 视觉风格

选择 **华为智能世界白皮书风 + 战略洞察页**：

- **v2 收口**：内容页以浅底企业报告图示为主；深黑/红光轨只保留给 P1 封面、P10
  结语或局部深色 header，不作为 P2-P9 默认风格。
- 主色：华为红、深墨黑、冷灰、象牙白。
- 气质：克制、坚定、工程化、长期主义。
- 图形：硬边框、编号徽标、细线箭头、工业网格、数据标签、控制面式模块。
- 版式：一页一核心判断；8-16 个信息单元；至少 2 层结构；大数字只做局部锚点。
- 避免：满屏小字、伪中文、花哨渐变、过度赛博、像游戏海报。

### 2.3 文本策略

图片生成只承担适合它的文字密度：

- 每页保留 1 个大标题。
- 每页保留 1 句核心判断。
- 每页最多 3-5 个短标签或数据锚点。
- 不生成长段正文，不生成精细表格，不让模型自由编数字。

如果校准页中文文字或跨页一致性崩坏，则切换为 hybrid raster：

1. 图片生成只出华为风格背景、结构、图形和留白。
2. 用真实文字层叠加标题、数字、logo。
3. 导出为扁平 PNG，再嵌入 PPTX。

最终仍然不可编辑，但文字、数字、logo 与跨页模板可控。

## 3. 幻灯片骨架

| 页 | 标题 | 本页目的 | 视觉方向 |
|---|---|---|---|
| 1 | 通用机器人：AGI 走向物理世界 | 建立宏大主题和华为白皮书气质 | 深黑背景，人形机器人剪影，红色光轨，HUAWEI / Intelligent World 2035 标签 |
| 2 | 机器人不是 AI 的应用，而是 AI 的本质 | 提炼全文总论点 | 中央大论断 + 物理世界/数字智能双环结构 |
| 3 | 新一轮热潮正在形成 | 用数据说明行业拥挤和资本升温 | 45 万家企业、150+ 人形机器人创业公司、近 1000 亿元投资三张大数据卡 |
| 4 | 狼来了三次 | 建立作者“热血被冰冻过”的冷静视角 | 2013 谷歌收购潮 → 2017 波士顿动力出售 → 新周期复兴的时间轴 |
| 5 | 这一次为什么不同 | 解释本轮热潮的四个驱动力 | 巨头站台、大模型突破、老龄化、军事/无人系统四象限 |
| 6 | 会跑会跳，不等于能干活 | 区分运动展示和真实智能 | 左侧运动 Demo，右侧倒水/整理桌面的复杂任务；不展开马斯克三问 |
| 7 | 三大核心挑战：手、世界、数据 | 作为最难校准页，验证中文和密度 | 用马斯克三问引出灵巧手、非结构化现实、真实数据荒三支柱；短标签 + 数字寿命/数据量对比 |
| 8 | 互联网是 AI 的化石燃料，但机器人没有 | 解释机器人数据鸿沟和技术路线 | 自动驾驶 2D 结构化 vs 机器人 3D 非结构化；VLA → 世界模型 → 灵巧手闭环 |
| 9 | 工业先行，消费后起 | 给出商业化路径和时间判断 | 2025-2028 洗牌期、2028+ 首批商用、十年颠覆路线图 |
| 10 | 垂直整合者胜出 | 收束到中国产业链和长期主义 | 灵巧手核心、数据闭环、供应链、场景落地四个制胜环；机器人与城市/工厂远景 |

## 4. 首轮校准

> v2 收口：本节是 v1 校准记录，不再作为后续内容页生产路线。后续内容页按 §10：
> SVG master 锁结构/文字/坐标，imagegen 只出图标、纹理、光感素材，最后合成。

不建议第一轮只做封面。封面太容易，不能验证方案风险。

首轮生成 2 页：

1. **P1 封面**：验证华为白皮书视觉、电影感、红黑灰系统。
2. **P7 三大核心挑战**：验证中文标题、最小号短标签、大数字、信息模块密度。

P7 校准必须同时跑两版：

- **纯 imagegen 版**：测试当前模型是否能直接产出可用密集中文战略页。
- **hybrid raster 版**：生成无文字/少文字底图 + 真实文字/logo 叠加，验证正式兜底
  路线是否顺手、是否仍有华为白皮书质感。

P7 是 go/no-go 页。它不是考主标题，而是考最小号短标签、数字和模块排版。

校准判据：

| 维度 | 通过标准 | 不通过处理 |
|---|---|---|
| 华为风格 | 像战略洞察/白皮书，不像科幻海报 | 重写风格 prompt，减少赛博和装饰 |
| 中文文字（含最小号短标签 + 数字） | P7 所有中文短标签和数字逐字核对，错字、伪汉字、笔画崩坏、数字改写 = 0 才 PASS；标题对但标签糊也不通过 | 切 hybrid raster，真实文字后处理 |
| 信息密度 | 有战略页密度，但不糊、不乱 | 减少模块数量，增大标题和数字 |
| 跨页一致性 | P1 与 P7 在色板、光轨、页脚、模块比例上像同一套模板，并且一致性来源有明确机制 | 若 imagegen 支持 style reference/seed，则 P1 定稿作为 style anchor；若不支持，则生成母版底板并走 hybrid raster |
| 事实锚点 | 数字不被模型改写 | 数字只走真实文字层或人工核验 |

跨页一致性机制必须在校准轮确定：

- 如果当前 imagegen 支持参考图或稳定 seed：P1 定稿后作为后续页面 style anchor。
- 如果不支持：先生成一张无文字母版底板，后续页面复用同一套底板/页脚/光轨，再叠加
  页面专属视觉和真实文字。此时 hybrid raster 不是 fallback，而是正式路线。

## 5. Prompt 结构

> v2 收口：本节 prompt 模板仅适用于 P1/P10 这类封面/结语视觉页。P2-P9 内容页
> 不再用深黑整页 prompt 直出，改用 §10 的蓝图驱动 + 分层合成。

每页 prompt 使用同一模板：

```text
Create a 16:9 high-end Huawei internal strategy presentation slide.
Style: Huawei Intelligent World 2035 whitepaper, deep black background,
Huawei red geometric light trails, cold gray industrial grid, premium
technology consulting report, clean but information-rich.
Use the highest available resolution and design for 3840x2160 composition.
Reserve a clean top-left safe area for an official Huawei logo asset; do not draw the logo.

Slide title: "<精确中文标题>"
Core message: "<精确中文短句>"
Large data anchors: "<如有，逐项列出>"
Layout: "<上中下/左右/三支柱/时间轴等结构>"
Visual metaphor: "<机器人、工厂、城市、数据空间、灵巧手等>"

Use sharp modern Chinese typography, precise alignment, straight edges,
no playful elements, no cartoon style, no decorative blobs.
```

负面约束：

- no garbled Chinese characters
- no fake brand logo
- no generated Huawei petal mark
- no random numbers
- no cute robot
- no colorful cyberpunk poster
- no rounded cartoon cards

## 6. 事实与文案锚点

优先保留这些来自文章的短锚点：

- 机器人不是 AI 的应用，而是 AI 的本质
- 走向物理世界是 AGI 形成的必由之路
- 45 万家机器人产业相关企业
- 150+ 人形机器人创业公司
- 近 1000 亿元人民币投资
- 莫拉维克悖论
- 马斯克三问：灵巧手、AI 大脑、大规模量产
- 中型车价买一个大号玩具
- 机器人没有互联网化石燃料
- 被反复冰冻的热血很难再燃
- 硬件打地基，软件建高楼
- 工业先行，消费再起
- 短期保守，长期乐观
- 垂直整合 > 纯算法

## 7. 审后收敛状态

两只宪宪 review 后的收敛状态：

| 问题 | 收敛 |
|---|---|
| 10 页还是 8 页 | 保持 10 页。文章有历史、驱动、挑战、路径四层论证，压到 8 页会损失判断层次。 |
| 视觉子流派 | 定为华为白皮书风为主，战略模块为辅。P3/P7 允许更高信息密度。 |
| 校准页 | P7 选对了，但判据必须考最小号短标签和数字，不只考主标题。 |
| hybrid raster | 可作为正式路线；如果 imagegen 无法锁住跨页一致性，hybrid 就是主路线。 |
| 结尾调性 | 跟原文：以垂直整合、工程化、长期主义为理性论证，落点是中国领跑。 |

## 8. 下一步

若本方案通过讨论，我会进入生成阶段：

1. 为 P1 写最终 imagegen prompt，生成封面并判断能否作为 style anchor。
2. 为 P7 写纯 imagegen prompt 和 hybrid raster 方案，生成两版校准图。
3. 按 §4 判据逐字核 P7 的最小号短标签和数字。
4. 根据校准结果决定纯 imagegen 还是 hybrid raster 正式路线。
5. 批量生成剩余 8 页。
6. 组装 PPTX 或图片序列。

## 9. 校准图最终 prompt v1

> 2026-05-20 复盘：v1 校准图证明单靠文字 prompt 会把内容页推向低密度科技海报，
> 不像华为企业图示。后续内容页废弃“纯文字 prompt 直出”路线，改为 §10 的低保真
> 蓝图驱动路线。P1 封面可保留电影感，P3/P7/P8/P9 等内容页必须先锁结构。

### 9.1 P1 封面

```text
Create a 16:9 high-end Huawei internal strategy presentation cover slide.
Style: Huawei Intelligent World 2035 whitepaper, deep black background,
Huawei red geometric light trails, cold gray industrial grid, premium
technology consulting report, cinematic but disciplined, clean and powerful.
Use the highest available resolution and design for 3840x2160 composition.
Reserve a clean top-left safe area for an official Huawei logo asset; do not draw the logo.

Exact large Chinese title:
通用机器人：AGI走向物理世界

Exact subtitle:
产业洞察与路径预判 2026

Small tag:
Intelligent World 2035

Layout:
- Top-left small blank logo safe area.
- Center-left large title, strong modern Chinese typography.
- Lower-left subtitle and date line.
- Right side: elegant humanoid robot silhouette standing between a smart factory,
  city skyline, and abstract physical-world data field.
- Use red light trails to connect robot body, factory arms, sensors, and cloud.
- Keep 35 percent negative space so it feels like a Huawei whitepaper cover.

Visual metaphor:
AGI crossing from digital intelligence into the physical world.

No fake brand logo, no generated Huawei petal mark, no random numbers,
no cute robot, no colorful cyberpunk poster, no decorative blobs.
```

### 9.2 P7 纯 imagegen 版

```text
Create a 16:9 high-end Huawei internal strategy presentation slide.
Style: Huawei Intelligent World 2035 whitepaper plus strategy module density:
deep black background, Huawei red geometric light trails, cold gray industrial
grid, premium technology consulting report, sharp modular layout.
Use the highest available resolution and design for 3840x2160 composition.
Reserve a clean top-left safe area for an official Huawei logo asset; do not draw the logo.

Exact title:
三大核心挑战：手、世界、数据

Exact core message:
马斯克三问，对应三大鸿沟

Three vertical pillars, each pillar with exact Chinese text:

Pillar 1 title:
灵巧手
Small labels:
精细操作
寿命 10-50 万次
成本高

Pillar 2 title:
非结构化世界
Small labels:
环境多变
泛化不足
场景应变弱

Pillar 3 title:
真实数据荒
Small labels:
触觉/力控稀缺
比自动驾驶多 1-2 个数量级
只能物理采集

Bottom quote:
硬件打地基，软件建高楼

Layout:
- Header title at top-left under the blank logo safe area.
- Three strong vertical pillars across the middle, each pillar has an icon:
  robotic hand, dynamic 3D environment, multimodal data cube.
- Each pillar includes title and three small labels, all Chinese text must be
  crisp and readable.
- Bottom red conclusion strip with the quote.

No garbled Chinese characters, no fake brand logo, no generated Huawei petal mark,
no random numbers, no cute robot, no colorful cyberpunk poster, no decorative blobs.
```

### 9.3 P7 hybrid raster 版

```text
Create a 16:9 Huawei internal strategy slide that looks like a post-produced
hybrid raster composite: cinematic AI-generated background plus crisp digital
typography layer. The final image should feel flatter, cleaner, and more
layout-controlled than a pure generative poster.
Style: Huawei Intelligent World 2035 whitepaper, deep black background,
Huawei red geometric light trails, cold gray industrial grid, premium strategy
report, precise alignment, straight edges.
Use the highest available resolution and design for 3840x2160 composition.
Reserve a clean top-left safe area for an official Huawei logo asset; do not draw the logo.

Exact title:
三大核心挑战：手、世界、数据

Exact core message:
马斯克三问，对应三大鸿沟

Create a clean three-column layout with sharp red divider lines and dark glass panels.
Use crisp, digitally composed typography for all text below:

Column 1:
灵巧手
精细操作
寿命 10-50 万次
成本高

Column 2:
非结构化世界
环境多变
泛化不足
场景应变弱

Column 3:
真实数据荒
触觉/力控稀缺
比自动驾驶多 1-2 个数量级
只能物理采集

Bottom conclusion:
硬件打地基，软件建高楼

Visual details:
- Background: abstract robot hand blueprint, factory sensor grid, 3D physical
  world mesh, subtle red energy lines.
- Foreground: restrained report-like modules, not a poster.
- Text must be straight, flat, high contrast, and readable at small size.

No garbled Chinese characters, no fake brand logo, no generated Huawei petal mark,
no random numbers beyond the specified numbers, no cute robot, no colorful cyberpunk poster.
```

## 10. 方法优化 v2：低保真蓝图驱动生成

核心修正：**先画信息架构，再生成视觉质感。**

`longform-002-v0-formal.md` 里的 Figure 0-13 能保持信息密度，是因为先有低保真草图：
盒子、箭头、层级、编号、文本数量和阅读路径都已经固定；imagegen 只负责把草图升级成
有质感的图，而不是从空白 prompt 里猜版式。

机器人 PPT 改成四步：

1. **结构蓝图**：先产出 16:9 低保真 SVG/PNG，固定标题、模块、箭头、数据点和页脚。
2. **素材生成**：imagegen 只生成 SVG 不擅长的视觉素材：三支柱图标、局部纹理、
   光感、工业网格质感。不得整张重绘低保真图。
3. **合成输出**：SVG 作为结构、文字、坐标、密度的 master，把 imagegen 素材合成到
   固定槽位，再导出扁平 PNG。
4. **评分再批量**：按信息密度、华为风格、文字保真、跨页一致性四项评分，不达标不扩展。

层级分工：

| 层 | 工具 | 职责 |
|---|---|---|
| 结构层 | SVG/HTML/CSS | 几何、盒子、箭头、阅读路径、跨页 design system |
| 文字层 | SVG/HTML/CSS | 标题、数字、小标签、logo 安放区，保证零乱码 |
| 视觉素材层 | imagegen | robotic hand / 3D environment / data cube 图标，纹理、光感、深度 |
| 输出层 | 浏览器截图 / PNG 导出 | 合成后的不可编辑 raster slide |

### 10.1 华为风格重定向

内容页不再默认深黑红光轨。新的风格目标是：

- 背景：浅灰/象牙白/低饱和冷白，必要时局部深色区块。
- 结构：硬边框、编号圆点、分层标题条、细线箭头、矩阵/流程/控制面。
- 颜色：华为红只做强调，配合深墨黑、冷灰、少量蓝/青色功能色。
- 密度：每页 8-16 个信息单元，至少 2 层结构，不靠大图撑版面。
- 质感：企业白皮书/战略报告，不是赛博海报，不是发布会 KV。

### 10.2 首张最复杂试验页

选择 **P7：三大核心挑战：手、世界、数据**。

理由：

- 它同时包含三支柱、马斯克三问、数据量/寿命数字、技术闭环和底部结论。
- 它最容易暴露 imagegen 对小号中文、数字和高密布局的弱点。
- 如果 P7 跑通，P3 数据看板、P5 四驱动力、P8 数据鸿沟、P9 路线图都能复用同一方法。

低保真蓝图文件：

- SVG: `docs/content/drafts/assets/huawei-robotics-p7-complex-lofi.svg`
- PNG: `docs/content/drafts/assets/huawei-robotics-p7-complex-lofi.png`

P7 composite v1 文件：

- Imagegen 视觉素材 sheet: `docs/content/drafts/assets/huawei-robotics-p7-asset-sheet.png`
- Cropped hand asset: `docs/content/drafts/assets/huawei-robotics-p7-hand.png`
- Cropped environment asset: `docs/content/drafts/assets/huawei-robotics-p7-environment.png`
- Cropped data cube asset: `docs/content/drafts/assets/huawei-robotics-p7-data-cube.png`
- Composite SVG: `docs/content/drafts/assets/huawei-robotics-p7-composite.svg`
- Composite PNG: `docs/content/drafts/assets/huawei-robotics-p7-composite.png`

v1 观察：asset sheet 没有文字是预期行为，因为文字层由 SVG master 保真；但生成出的
三枚素材是浅底成图，合成到浅底报告页里对比度偏弱。下一轮视觉素材应要求“transparent
background / dark ink outline / no white canvas”，或直接在 SVG 里手绘线性图标。

### 10.3 P7 试验判据

| 维度 | 通过标准 |
|---|---|
| 结构保留 | 成图保留 4 个真实顶层区块：马斯克三问 band / 三支柱 / 技术闭环 6 节点链路 / 底部双判断 |
| 信息密度 | 至少 12 个可读信息单元，不能退化成三张大卡片 |
| 华为风格 | 像企业战略报告/白皮书图示，少海报感 |
| 文字策略 | 小字允许后处理，但生成图必须给出清晰文字槽位 |
| 可扩展性 | 这套版式能扩展成 P3/P5/P8/P9 的同族页面 |

### 10.4 下一轮 imagegen prompt 方向

```text
Generate a premium Huawei-style enterprise report icon/texture asset sheet,
not a full slide. Do not render any text.

Create three matching visual assets on a clean transparent or plain light background:
1. robotic dexterous hand icon / technical render
2. non-structured 3D physical environment mesh
3. multimodal data cube / sensor data volume

Style: Huawei enterprise whitepaper, precise, technical, restrained, red accents,
dark ink lines, subtle depth, compatible with a light ivory strategy diagram.
No Chinese text, no logo, no poster composition.
```
