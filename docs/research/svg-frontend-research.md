下面是我给 **Cat Café** 做的结构化研究报告（以你这边时区 **2026-02-12, America/Los_Angeles** 为参考点），目标是帮我们把「三只统一风格、各有特色、可编程可动画的猫咪 SVG 状态指示器」落到一个可执行的工程化工作流里。🐾

---

# 研究报告概览

你要的东西，本质上是一个“小型矢量角色系统”：

* **三只猫**：同一套视觉语言（线条、比例、配色、阴影逻辑、圆角风格），但通过特征差异（耳朵、毛量、花纹、配件、眼神）区分角色
* **四种状态**：idle / working / done / error
  更像一个“状态机”，而不是四张孤立图
* **Web UI 友好**：文件小、渲染稳、动画可控、可访问性合格

我建议我们把整个链路拆成三层：

1. **概念层**：AI 快速出“正确的味道”与造型方向
2. **矢量层**：把造型固化成干净、可编辑、可编程的 SVG
3. **交互层**：用 CSS/JS/（可选）SMIL 把状态动画做成状态机

---

# 1 AI 图像生成到 SVG 的工作流

这里有两条主路线：

## 1.1 路线 1：先出概念图（栅格）再矢量化

**适合：** Midjourney / DALL·E / Stable Diffusion 这类“好看但默认输出是位图”的工具
**风险：** 自动矢量化容易生成“几千个节点的意大利面 SVG”

### 工作流

1. **生成概念图**（尽量“为矢量化而画”）

   * 画面要：线条清晰、色块分明、阴影是块而非纹理
   * 避免：渐变大面积、毛发细丝、噪点纹理、复杂背景

2. **矢量化（Image to SVG）**

   * **Adobe Illustrator Image Trace**：适合精调、可控性强，Trace 后用 **Expand** 变成可编辑路径 ([helpx.adobe.com][1])
   * **Inkscape Trace Bitmap**：免费，入口简单（Path → Trace Bitmap）([Inkscape 初学者指南][2])
   * **Vectorizer.ai / Vector Magic**：在线自动化，速度快，适合批量试不同风格 ([Vectorizer][3])
   * **Potrace / AutoTrace**：偏“工程化批处理”，适合 CLI 管线或黑白/少色图标 ([Potrace][4])

3. **清理与结构化**

   * 合并同色形状、删掉碎片路径、减少锚点
   * 把可动画部件拆成 `<g id="tail">`、`<g id="eyes">`、`<g id="badge">` 这种结构
   * 统一 `viewBox`（比如 0 0 64 64 或 0 0 128 128）

4. **优化（必须做）**

   * 用 **SVGO**（CLI 或集成）压体积、去冗余属性 ([GitHub][5])
   * GUI 党：**SVGOMG**（SVGO 的可视化界面）([Jake Archibald][6])

### 让矢量化更“可编程”的关键技巧

* **限制颜色数量**：3–6 个主色 + 1 个强调色就够了
* **避免纹理**：纹理一矢量化就变成大量小路径
* **用“硬边阴影”**：用第二个更深色块模拟质感，别用渐变（除非你很确定渐变不会影响动画与体积）

---

## 1.2 路线 2：直接生成矢量（AI 输出 SVG）

这是最香的路线，因为你要的是“状态指示器”，不是插画海报。

### 可直接出 SVG 的 AI 工具

* **Recraft AI Vector Generator**：直接生成矢量并可导出 **SVG**（还支持导出 Lottie）([recraft.ai][7])
* **Adobe Firefly Text to Vector / Illustrator Text to Vector Graphic**：可生成矢量并下载 `.svg`，并且在 Adobe 生态里后续编辑很顺 ([helpx.adobe.com][8])
* **Kittl AI Vector Generator**：文本到矢量，可下载 SVG 或继续编辑 ([kittl.com][9])
* **Canva Vector AI（SVG generator）**：Canva 生态里快速产出 SVG ([canva.com][10])
* **Illustroke**：文本生成 SVG 插画 ([landscape.brxnd.ai][11])
* **VectorArt.ai**：AI 矢量图库 + 生成/编辑工具（含 PNG→SVG）([vectorart.ai][12])

### 直接出 SVG 的优点和坑

优点：

* 省掉“位图矢量化”的不确定性
* 更容易控制路径数量与图层结构（至少起点更干净）

坑：

* 有些工具生成的 SVG 仍然会“层级乱、命名乱、路径碎”
* 风格一致性要靠：同一套 prompt 模板 + 统一调色板 +（最好）用同一工具同一风格参数

---

## 1.3 我建议我们用的“混合策略”

你希望先低成本试水，但最终要可维护、可动画、可编程。

所以最实际的是：

* **AI 先定造型和风格**（最好直接出 SVG）
* **你在 Figma/Illustrator/Inkscape 做“结构化与可动画化”处理**
* **最后用 SVGO 固化为可上线资产**

---

# 2 专业 SVG 图标与插画资源

这里分三类：开源可用、半开源/需注意授权、以及动画资产。

## 2.1 高质量开源 SVG 猫咪/动物素材库

这些适合做“基底参考”、或者直接拿来当占位版：

* **OpenMoji（CC BY-SA 4.0）**：大量 emoji SVG，包括猫，适合做“表情系统”参考 ([OpenMoji][13])
* **Twemoji**：Unicode emoji，源码库齐全（注意它不是“定制猫角色”，但表情语言很好用）([GitHub][14])
* **Tabler Icons**（MIT）：有 cat 图标，线性现代、适合当 UI 风格标尺 ([Tabler][15])
* **Material Design Icons**：有 cat 图标，体系完整 ([pictogrammers.com][16])
* **Font Awesome**：有 cat 图标（注意 Free/Pro 授权区分）([fontawesome.com][17])
* **Wikimedia Commons SVG cat icons 分类**：很多现成猫 SVG，但风格很杂，需要筛选 ([commons.wikimedia.org][18])

> 我会把这些当“解剖参考”和“风格尺子”，不建议直接拼贴做最终角色，否则统一性会被撕裂。

### 链接清单（可直接点开）

```text
https://openmoji.org/
https://github.com/hfg-gmuend/openmoji
https://github.com/twitter/twemoji
https://tabler.io/icons
https://tabler.io/icons/icon/cat
https://pictogrammers.com/library/mdi/
https://fontawesome.com/icons/cat
https://commons.wikimedia.org/wiki/Category:SVG_cat_icons
```

## 2.2 Lottie 动画资源与定制

你提到 Lottie，我建议你把它当“备选方案”：

* 如果你坚持“资产必须是 SVG 文件”，那 Lottie 不是 SVG 文件（它是 JSON 或 dotLottie），但可以用 SVG 渲染器播放
* 如果你接受“矢量动画资产”，Lottie 在 Web 端非常成熟

资源和工具：

* **LottieFiles**：免费库 + Marketplace + 在线编辑器 ([LottieFiles][19])
* **lottie-web（Airbnb）**：Web 播放器开源实现 ([GitHub][20])
* **Figma to Lottie（LottieFiles 插件）**：在 Figma 里做动画并导出 Lottie ([LottieFiles][21])

链接清单：

```text
https://lottiefiles.com/
https://lottiefiles.com/marketplace
https://lottiefiles.com/en/lottie-editor
https://github.com/airbnb/lottie-web
https://lottiefiles.com/plugins/figma
```

## 2.3 Figma / Sketch 社区资源

Figma Community 页面我这边无法直接抓取（robots 限制），但你在 Figma 内搜索关键词就行：

* `cat avatar`, `cat mascot`, `animal icon`, `sticker`, `status indicator`

Sketch 这边可用的聚合站：

* Sketch App Sources（大量 SVG / icon 资源）([sketchappsources.com][22])

链接清单：

```text
https://www.sketchappsources.com/
https://www.sketchappsources.com/category/icon.html
```

## 2.4 外包定制 SVG 的渠道、价格与沟通要点

如果我们走专业级路线（后面方案 C），我建议优先找 “icon/mascot + 能配合前端交付结构化 SVG”的设计师。

平台与参考价位信息：

* **Upwork**：可以直接雇 icon designer / SVG freelancer（按小时或按项目）([Upwork][23])
* **Dribbble Hiring**：找擅长吉祥物/角色插画的设计师 ([Dribbble][24])
* **Fiverr**：很多 mascot 服务，平台给出常见价位区间（比如 mascot logo 常见 $60–$70）([Fiverr.com][25])
* **99designs**：竞赛式，插画类有固定套餐（Bronze/Silver/Gold/Platinum 等）([99designs][26])

外包沟通要点（非常关键，能省掉 80% 扯皮）：

* 交付必须包含：

  * **SVG 源文件**（不是截图转出来的）
  * **分层结构说明**（哪些 group 会动，id 命名规范）
  * **颜色 token**（主色、阴影、强调色，最好用 CSS variables 可替换）
  * **四状态**：idle/working/done/error 至少给出 key pose 或关键帧
* 给设计师的输入素材：

  * AI 概念图 moodboard
  * 你想要的“现代简约、有质感、可爱但不幼稚”的参考（比如线条粗细、阴影方式）
  * Web 端约束：`< 10KB` 目标、尽量少滤镜、动画优先 transform/opacity

链接清单：

```text
https://www.upwork.com/hire/icon-designers/
https://www.upwork.com/hire/svg-freelancers/
https://dribbble.com/designers/mascot-illustrations
https://www.fiverr.com/categories/graphics-design/buy/creative-logo-design/mascot
https://99designs.com/pricing/illustrations
```

---

# 3 SVG 动画的最佳实践

你要的是状态指示器，不是 MV。原则是“看得懂但不打扰”。

## 3.1 CSS animation vs SMIL vs JavaScript

### CSS Animation

适合：

* 眨眼、尾巴摆动、轻微呼吸、点点跳动、旋转加载圈
  优点：
* 简单、性能好（主要走 transform/opacity）
* React 里切 class 就能切状态

### SMIL

MDN 明确列了 `<animate>`、`<animateTransform>`、`<animateMotion>` 等，且标注“widely available” ([developer.mozilla.org][27])
浏览器支持情况也可用 Can I use 查表确认 ([caniuse.com][28])
适合：

* 你希望 SVG 自己带动画，不依赖外部 CSS/JS
  注意：
* 团队里有人会对 SMIL “心里没底”（历史上有过被说要废弃的风波），所以我一般把它作为“能用但不必强依赖”的选项

### JavaScript（GSAP / Motion / Anime.js 等）

适合：

* 状态切换时的“过渡动画”
* 更复杂的时间线、弹性、手势交互
  例子：
* Motion（Framer Motion 现在文档在 motion.dev）对 SVG 支持完整（`<motion.path>` 等）([Motion][29])
  GSAP 在 SVG transform-origin 上有很多经验贴，尤其是跨浏览器 transform 行为坑点 ([GSAP][30])

> 对 Cat Café 的状态指示器，我建议：**CSS 负责循环 idle/working，JS 负责 done/error 的一次性过渡**。这样最稳。

---

## 3.2 状态指示器动画设计原则

我会按“信息优先级”设计动作：

* **idle（默认）**：极轻微，避免抢注意力
  例：慢眨眼（3–5s 一次）、尾巴轻摆（4–6s 一个周期）
* **working（进行中）**：可见但不吵
  例：更频繁眨眼 + 小齿轮/小点加载（1–1.5s 循环）
* **done（完成）**：一次性明确反馈
  例：checkmark “pop” 一下，猫眼变弯笑 0.4–0.8s，然后回到 idle
* **error（错误）**：明确且短促
  例：耳朵向后 + 小抖动 0.2s*2 + 红色感叹号气泡，然后停住（不要无限抖）

---

## 3.3 性能优化清单（Web UI 必做）

* **尽量只动画 transform 和 opacity**
* **避免大量 path morph**（尤其是多段贝塞尔的形变）
* **减少节点**：导出后用 SVGO 清理 ([GitHub][5])
* **少用滤镜**：drop-shadow、feTurbulence 这类会更吃性能
* **SVG 结构要“可动部件独立成组”**：tail、eyes、badge 单独 `<g>`，避免动一个小部件牵连整棵 DOM 子树

---

## 3.4 可访问性

必须照顾 `prefers-reduced-motion`。MDN 对这个 media feature 的含义写得很清楚：用户希望减少非必要动画 ([developer.mozilla.org][31])

你可以这样处理：

* `reduce` 时：停掉 idle/working 的循环，只保留状态切换的“淡入淡出”或直接静态
* 仍然用颜色或图标（check/exclamation）表达状态

---

# 4 程序化生成 SVG 的方法

你有前端能力，这部分其实是我们的“高自由度武器库”。

## 4.1 AI/ML 生成 SVG 代码的研究与现实落地

研究方向里比较经典的：

* **DeepSVG**：对 SVG 图标做分层生成与插值，属于“SVG 生成/动画”的研究路线 ([arXiv][32])
* **DiffVG**：可微矢量光栅化器，常用于“从目标图像优化出矢量形状” ([people.csail.mit.edu][33])
* **SVGFusion（Text-to-SVG diffusion）**：偏“文本到 SVG”新路线 ([arXiv][34])
* **T2V-NPR**：文本到矢量路径表示的一类研究 ([intchous.github.io][35])
* **OmniSVG**：一个统一 SVG 生成方向的项目站点（含 text/image/reference 等）([omnisvg.github.io][36])

现实建议：
这些研究非常酷，但“直接用于可控、可维护的 UI 角色资产”还不如我们用 Recraft/Firefly/Kittl 这类产品化工具来得稳。研究模型更适合做“灵感发电机”或者批量生成 icon 原型。

---

## 4.2 用代码生成与操作 SVG 的库

* **D3**：适合数据驱动生成 SVG，尤其你要把状态和参数绑定起来 ([d3js.org][37])
* **Snap.svg**：专注 SVG DOM 操作与动画，老牌且好用 ([snapsvg.io][38])
* **Two.js**：同一 API 可输出 SVG/canvas/webgl，适合做 parametric 形状系统 ([two.js.org][39])
* **SVG.js**：轻量、无依赖，专门做 SVG 操作和动画 ([svgjs.dev][40])
* **Paper.js**：虽然渲染跑在 canvas 上，但支持 import/export SVG（`project.exportSVG()`）([paperjs.org][41])

链接清单：

```text
https://d3js.org/
https://snapsvg.io/
https://two.js.org/
https://svgjs.dev/
https://paperjs.org/
```

---

## 4.3 Parametric design 能不能“参数化生成不同猫”？

能，而且非常适合你这种“同风格、多角色”的需求。

两条路：

### 路 1：我们自己做“参数化 SVG 组件”

用 React props + CSS variables 实现：

* `furColor`, `accentColor`
* `earTuftSize`, `cheekFluff`, `stripePattern`
* `eyeShape`（弯眼/圆眼/眯眼）
* `badge`（Claude/GPT/Gemini 小符号）

你甚至可以把同一只猫用参数变成三只，保持统一性会更强。

### 路 2：使用 Parametric SVG 生态

* **parametric.svg**：在 SVG 里声明参数绑定（类似“SVG + 表格公式”的感觉）([parametric-svg.js.org][42])
* **psvg**：参数化 SVG 模板的一套工具 ([GitHub][43])

链接清单：

```text
https://parametric-svg.js.org/
https://github.com/makenai/psvg
```

> 对 Cat Café：我更建议“React 参数化组件”这条路，学习成本最低，交付最可控。

---

# 5 实际案例研究

## 5.1 GitHub Octocat

* Octocat 的“起源故事”在 GitHub 前设计师 Cameron McEfee 的页面里有详细叙述 ([Cameron McEfee][44])
* 使用权与商标限制在 Octodex FAQ 和 GitHub Logo Policy 里写得很明确：不能把 Octocat 当你产品 logo ([octodex.github.com][45])

对我们有用的点：

* 角色成功的关键不是细节多，而是 **可识别的轮廓 + 可扩展的表情/动作系统**
* 资产管理上会非常重视 **品牌一致性与使用规范**

## 5.2 Discord 的 Wumpus

* Discord 官方有品牌规范入口 ([discord.com][46])
* 他们的 patch notes 甚至写了“召唤 Wumpus”的快捷键，这种把 mascot 当 UI 状态反馈的一部分，很值得我们借鉴 ([discord.com][47])
* 有设计师作品集提到为 Discord 做贴纸包（适合参考“表情状态集”怎么组织）([Hey Michelle!][48])

## 5.3 Slack emoji

Slack 官方文档对“添加自定义 emoji”的流程很清晰 ([Slack][49])
对我们启发：

* 小尺寸图形要强调“识别优先”，细节过多会糊成一团
* 命名、分类、规范同样重要（你这套三猫四态，最好一开始就规范命名）

---

# 6 适合 Cat Café 的 3 套完整方案

下面是我按“预算最低 → 专业级”给的三套可执行方案。你可以从 A 开始，成功后无缝升级到 B，再决定要不要上 C。

---

## 方案 A：纯 AI 工具链（预算最低）

### 工具组合

* 矢量生成：Recraft / Firefly Text-to-Vector / Kittl / Canva Vector AI ([recraft.ai][7])
* 优化：SVGO 或 SVGOMG ([GitHub][5])

### 流程

1. 为三只猫写统一 prompt 模板（我后面给示例）
2. 在同一工具同一风格下生成：

   * 每只猫 1 个 base（正面半身）
   * 再分别生成 working/done/error 的变体（或单独生成状态 overlay）
3. 导出 SVG
4. SVGO 优化
5. 在 React 里按 state 切不同 SVG 或切不同 `<g>` 显示

### 预期效果

* 很快能出第一版可用的 UI 指示器
* 风格可能有一点“AI 漂移”，三只猫的一致性需要反复抽卡

### 成本

* 金钱：0–几十美元级（看订阅）
* 时间：1–2 天可出能用版本（主要耗在挑选和微调 prompt）

### 优缺点

* ✅ 最快、最便宜
* ❌ 很难保证三猫四态完全一致（尤其线条与比例）

---

## 方案 B：AI + 简单手动调整（中等投入，强烈推荐）

### 工具组合

* 生成：Recraft / Firefly / Kittl（三选一当主力）([recraft.ai][7])
* 编辑：Figma / Illustrator / Inkscape（你选你顺手的）
* 优化：SVGO + SVGOMG ([GitHub][5])
* 动画：CSS +（可选）Motion/GSAP ([Motion][29])

### 流程（推荐的工程化做法）

1. AI 生成 “base 三猫” 作为矢量草稿
2. 在编辑器里做一次“统一化手术”：

   * 统一线宽、圆角、眼睛比例
   * 统一调色板（4–6 主色 + 状态色）
   * 统一 viewBox 与画布边距
3. **建立可动画结构**

   * 把眼睛、尾巴、耳朵、徽章拆成独立 `<g id="">`
4. 做四种状态的“覆盖层”而不是四张完全不同的猫：

   * working：增加小齿轮/小点点/小键盘线条（可动画）
   * done：对勾气泡（一次性 pop）
   * error：感叹号气泡 + 耳朵后贴（一次性抖动）
5. 写一个 React 组件 `CatStatusIcon({ agent, state })`
6. 用 CSS classes 控制动画，并加 `prefers-reduced-motion` 降噪 ([developer.mozilla.org][31])

### 预期效果

* 三只猫风格高度统一
* 四态动画可控、可维护、可扩展（以后你要加 “thinking / paused / offline” 也不崩）

### 成本

* 金钱：低到中（可能订阅一个矢量 AI + 你已有工具）
* 时间：2–5 天能做出“像产品”的版本（主要时间在结构化与动画调校）

### 优缺点

* ✅ 兼顾成本与质量，最适合你的技能栈
* ✅ 资产长期可维护
* ❌ 需要你做一点点“矢量洁癖工作”（但这是值得的）

---

## 方案 C：专业级（AI 概念 + 设计师精修 + 开发实现）

### 工具组合

* 你：AI moodboard + 规范 + 前端实现
* 设计师：Illustrator/Figma 输出结构化 SVG + 动画关键帧
* 外包平台：Upwork / Dribbble / Fiverr / 99designs ([Upwork][23])

### 流程

1. 你先用 AI 出 20–30 张概念图，锁定风格
2. 写一个“交付规范文档”给设计师（包括 id 命名、四态、颜色 token）
3. 设计师出：

   * 三猫 base + 表情系统
   * 四态关键帧（或直接交付可动画分层）
4. 你把它们工程化：SVGO、组件化、动画实现、可访问性补齐

### 预期效果

* 角色质感、线条控制、统一性都会明显更好
* 更接近“品牌级 mascot 资产”

### 成本

* 金钱：从几十到几千美元都有可能（视设计师水平与交付范围）

  * Fiverr mascot 有相对低价区间参考 ([Fiverr.com][25])
  * 99designs 插画套餐有固定价位 ([99designs][26])
* 时间：1–3 周比较常见（含沟通与修改周期）

### 优缺点

* ✅ 最终品质上限最高
* ❌ 需要更强的 brief 能力和迭代管理

---

# Prompt 示例

下面我给你一套“可复用模板”，我们只需要替换猫的品种特征和小配件，就能保持统一风格。

## 统一风格模板（通用）

```text
Modern minimal vector mascot, clean SVG-style shapes, soft rounded corners, 3-tone flat shading (no gradients), subtle premium feel, cute but not childish, front-facing head and shoulders, centered composition, transparent background, no text, no watermark, consistent line weight, UI status indicator icon
```

## 宪宪 XianXian（布偶猫，Claude，架构）

特征关键词：fluffy chest, gentle eyes, calm expression, soft cream + gray points

```text
Ragdoll cat mascot, fluffy chest fur, gentle calm architect vibe, modern minimal vector style, clean shapes, 3-tone flat shading, rounded corners, consistent outline, premium UI icon, transparent background, no text.
Accessories: tiny blueprint scroll OR small compass icon as a subtle badge.
```

状态变体建议：

* working：戴小眼镜 + 旁边浮一个“结构图”小方块
* done：蓝图卷轴变成对勾气泡
* error：蓝图卷轴角落出现小裂纹图标（别太戏剧化）

## 砚砚 YanYan（缅因猫，GPT，代码审查）

特征关键词：tufted ears, big fluffy mane, confident eyes

```text
Maine Coon cat mascot, large tufted ears, fluffy mane, confident reviewer vibe, modern minimal vector style, clean SVG-like shapes, 3-tone flat shading, rounded corners, consistent outline, premium UI icon, transparent background, no text.
Accessories: tiny code bracket badge { } OR small magnifying glass icon.
```

状态变体建议：

* working：放大镜轻轻摆动 + 小“…”点点加载
* done：出现绿色 check bubble
* error：出现红色 `!` bubble，耳朵微微后贴

## Gemini 猫（暹罗/孟加拉，视觉设计）

特征关键词：sleek, high-contrast points OR bengal stripes, sharp elegant

```text
Siamese or Bengal cat mascot, sleek face, elegant eyes, subtle stripe pattern (simple blocks, not detailed fur), modern minimal vector style, clean shapes, 3-tone flat shading, rounded corners, premium UI icon, transparent background, no text.
Accessories: tiny color palette badge OR sparkle icon.
```

状态变体建议：

* working：调色板旁边出现小旋转“sparkle”
* done：sparkle 变成星星闪一下
* error：sparkle 变成小碎裂星（很轻）

---

# 我认为最适合你的推荐方案

结合你的条件：

* 你会 React/CSS/SVG，能把资产做成组件与状态机
* 你审美在线但不想深陷设计软件地狱
* 你希望先低成本试，再逐步升级

我会直接选：

## 最推荐：方案 B（AI + 手动结构化 + CSS/JS 动画）

原因很简单：

* **我们要的是“可维护的系统”**，不是一次性出三张图
* 方案 B 能确保：

  * 三只猫统一风格
  * 四态动画是“一个系统”而不是四套碎片
  * 未来可加更多 agent、更多状态，不推倒重来

---

# 额外加一份“工程化交付规范”建议（你会很受用）

当我们开始做最终 SVG 时，我建议统一如下规范：

* `viewBox="0 0 64 64"`（或 128）
* 必须有这些 group（每只猫都一样）：

  * `g#head`, `g#ears`, `g#eyes`, `g#tail`, `g#badge`, `g#status`
* 颜色用 CSS variables：

  * `fill="var(--fur)"`, `fill="var(--accent)"`, `fill="var(--status)"`
* React 里用 `data-state="working"` 切状态
* `prefers-reduced-motion` 下停掉循环动画 ([developer.mozilla.org][31])
* 导出后统一跑 SVGO ([GitHub][5])

---

如果你愿意，我们下一步可以更“共犯式”地把它推进到可落地的实施计划：

* 我给你写一份 **CatStatusIcon 的 SVG 结构模板**（含四态 CSS keyframes、prefers-reduced-motion、React props 设计）
* 再给你一套 **三猫的设计 token（颜色、线宽、阴影层级）**，确保你用任意工具生成出来都能被“统一化手术”收敛到同一风格

你只要告诉我你更想用哪类编辑器做手动调整：**Figma / Illustrator / Inkscape**，我就按那个工具的操作习惯把"从 AI SVG 到可动画 SVG"的步骤写成可照做的 checklist。

---

# 7 执行计划（2026-02-13 布偶猫 + 铲屎官讨论确认）

## 当前状态

- `ThreadCatStatus.tsx` 已有 ASCII `ᓚᘏᗢ` + CSS 动画（bounce/shake/颜色），作为 MVP 在线运行
- 本研究报告（砚砚完成）提供了完整的技术调研和三套方案
- **确认采用方案 B**：AI 生成 + 结构化清理 + CSS/JS 动画

## 布偶猫架构评估

1. **方案 B 正确**：三猫四态 = 12 组合，未来可能扩展 thinking/paused/offline，需要"系统"而非"图集"
2. **React 参数化组件路线**：`<CatStatusIcon agent="opus" state="working" />` 比 Lottie/SMIL 更适合我们的 TypeScript + Tailwind 栈
3. **CSS 动画足够**：状态指示器不需要 GSAP/Motion，`@keyframes` + `transform` + `opacity` 即可

## 执行路线

布偶猫有 Chrome MCP 浏览器自动化能力，可以直接操作 Recraft 等 Web 端 AI 矢量工具。

### Step 1: AI 生成三猫基础 SVG
- 用 Recraft.ai（或 Firefly/Kittl）按本报告第 6 节的 prompt 模板生成
- 在同一工具、同一风格参数下生成三只猫，确保一致性
- 通过 Chrome MCP 直接操作工具、预览效果、下载 SVG

### Step 2: 结构化清理
- SVGO 优化 + 手动（代码级）清理碎片路径
- 按本报告规范拆分 `g#head`, `g#ears`, `g#eyes`, `g#tail`, `g#badge`, `g#status`
- 统一 `viewBox="0 0 64 64"`，限制 3-6 主色 + 状态色
- CSS variables: `--fur`, `--accent`, `--status`

### Step 3: React 组件 + 四态动画
- 新增 `CatStatusIcon.tsx`（替换 `ThreadCatStatus.tsx` 的 ASCII 方案）
- Props: `agent: 'opus' | 'codex' | 'gemini'`, `state: 'idle' | 'working' | 'done' | 'error'`
- CSS @keyframes: idle 慢眨眼、working 弹跳+加载点、done 对勾 pop、error 抖动
- `prefers-reduced-motion` 降噪

### Step 4: 集成 + 替换
- 替换 sidebar、split-pane、toast 中所有 `ᓚᘏᗢ` 为新组件
- 保持现有 `getCatStatusType()` 聚合逻辑不变
- 缅因猫 review

## 三猫设计 token（待生成时确认）

| 猫猫 | 主色 | 强调色 | 特征 | 配件 |
|------|------|--------|------|------|
| 宪宪 (Opus) | cream + gray points | 蓝色 | 蓬松胸毛、温柔眼神 | 蓝图卷轴/指南针 |
| 砚砚 (Codex) | 棕灰 tufted | 琥珀色 | 大簇耳、鬃毛 | 代码括号 `{}` / 放大镜 |
| 暹罗猫 (Gemini) | 高对比 points/条纹 | 紫/彩虹 | 线条利落、优雅 | 调色板/闪光 |

## 预估

- 时间：2-4 天（含生成、清理、组件化、测试、review）
- 风险：AI 生成的三猫一致性可能需要多轮调整
- 依赖：无硬依赖，可独立于其他 feature 推进

[1]: https://helpx.adobe.com/illustrator/desktop/manage-objects/traces-mockups-symbols/image-trace-panel-options.html?utm_source=chatgpt.com "Image Trace panel options"
[2]: https://inkscape-manuals.readthedocs.io/en/latest/tracing-an-image.html?utm_source=chatgpt.com "Tracing an Image - the Inkscape Beginners' Guide!"
[3]: https://www.vectorizer.io/?utm_source=chatgpt.com "Online Image Vectorizer"
[4]: https://potrace.sourceforge.net/?utm_source=chatgpt.com "Potrace"
[5]: https://github.com/svg/svgo?utm_source=chatgpt.com "svg/svgo: ⚙️ Node.js tool for optimizing SVG files"
[6]: https://jakearchibald.github.io/svgomg/?utm_source=chatgpt.com "SVGOMG - SVGO's Missing GUI for minifying SVGs"
[7]: https://www.recraft.ai/ai-vector-generator?utm_source=chatgpt.com "Free AI Vector Generator Online"
[8]: https://helpx.adobe.com/firefly/web/generate-vectors/text-to-vector/generate-vectors-using-text-prompts.html?utm_source=chatgpt.com "Generate vectors using text prompts"
[9]: https://www.kittl.com/tools/vector-generator?utm_source=chatgpt.com "AI Vector Generator"
[10]: https://www.canva.com/create/vector-ai/?utm_source=chatgpt.com "AI Vector Creator: Generate vector images with AI"
[11]: https://landscape.brxnd.ai/companies/illustroke?utm_source=chatgpt.com "Illustroke | BrXnd.ai Landscape - BrXndScape"
[12]: https://vectorart.ai/browse?utm_source=chatgpt.com "VectorArt.ai - Generate vector images with AI"
[13]: https://openmoji.org/?utm_source=chatgpt.com "OpenMoji"
[14]: https://github.com/twitter/twemoji?utm_source=chatgpt.com "GitHub - twitter/twemoji: Emoji for everyone. https ..."
[15]: https://tabler.io/icons/icon/cat?utm_source=chatgpt.com "Cat Free SVG Icon - 4985 high-quality Tabler Icons"
[16]: https://pictogrammers.com/library/mdi/icon/cat/?utm_source=chatgpt.com "cat - Material Design Icons"
[17]: https://fontawesome.com/icons/cat?utm_source=chatgpt.com "Cat Icon"
[18]: https://commons.wikimedia.org/wiki/Category%3ASVG_cat_icons?utm_source=chatgpt.com "Category:SVG cat icons"
[19]: https://lottiefiles.com/?utm_source=chatgpt.com "LottieFiles: Download Free lightweight animations for website ..."
[20]: https://github.com/airbnb/lottie-web?utm_source=chatgpt.com "GitHub - airbnb/lottie-web: Render After Effects animations ..."
[21]: https://lottiefiles.com/plugins/figma?utm_source=chatgpt.com "Elevate Your Designs & Create Animations with Figma to ..."
[22]: https://www.sketchappsources.com/?utm_source=chatgpt.com "Sketch App Sources - New free design resources - Icons, UI ..."
[23]: https://www.upwork.com/hire/icon-designers/?utm_source=chatgpt.com "Best Freelance Icon Designers for Hire (Feb 2026)"
[24]: https://dribbble.com/designers/mascot-illustrations?utm_source=chatgpt.com "Hire a Top Designer for mascot illustrations"
[25]: https://www.fiverr.com/categories/graphics-design/buy/creative-logo-design/mascot?utm_source=chatgpt.com "Mascot logo design services"
[26]: https://99designs.com/pricing/illustrations?utm_source=chatgpt.com "Illustration or graphics | Pricing"
[27]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/animate?utm_source=chatgpt.com "<animate> - SVG - MDN Web Docs"
[28]: https://caniuse.com/svg-smil?utm_source=chatgpt.com "SVG SMIL animation | Can I use... Support tables for ..."
[29]: https://motion.dev/docs/react-svg-animation?utm_source=chatgpt.com "SVG Animation in React — Paths, Morph & Line Drawing"
[30]: https://gsap.com/community/forums/topic/17750-svg-transform-origin/?utm_source=chatgpt.com "SVG transform origin"
[31]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion?utm_source=chatgpt.com "prefers-reduced-motion - CSS - MDN Web Docs"
[32]: https://arxiv.org/abs/2007.11301?utm_source=chatgpt.com "DeepSVG: A Hierarchical Generative Network for Vector Graphics Animation"
[33]: https://people.csail.mit.edu/tzumao/diffvg/?utm_source=chatgpt.com "Differentiable Vector Graphics Rasterization for Editing and ..."
[34]: https://arxiv.org/abs/2412.10437?utm_source=chatgpt.com "Scalable Text-to-SVG Generation via Vector Space Diffusion"
[35]: https://intchous.github.io/T2V-NPR/?utm_source=chatgpt.com "Text-to-Vector Generation with Neural Path Representation"
[36]: https://omnisvg.github.io/?utm_source=chatgpt.com "OmniSVG: A Unified Scalable Vector Graphics Generation ..."
[37]: https://d3js.org/d3-selection/modifying?utm_source=chatgpt.com "Modifying elements | D3 by Observable"
[38]: https://snapsvg.io/?utm_source=chatgpt.com "Snap.svg - Home"
[39]: https://two.js.org/?utm_source=chatgpt.com "Two.js • Homepage"
[40]: https://svgjs.dev/?utm_source=chatgpt.com "SVG.js v3.2 | Home"
[41]: https://paperjs.org/reference/project/?utm_source=chatgpt.com "Project"
[42]: https://parametric-svg.js.org/?utm_source=chatgpt.com "parametric.svg – SVG on rocket fuel."
[43]: https://github.com/makenai/psvg?utm_source=chatgpt.com "makenai/psvg - Parametric SVG editor, creator, and compiler"
[44]: https://cameronmcefee.com/work/the-octocat/?utm_source=chatgpt.com "The Octocat—a nerdy household name"
[45]: https://octodex.github.com/faq/?utm_source=chatgpt.com "FAQ - Octodex - GitHub"
[46]: https://discord.com/branding?utm_source=chatgpt.com "Discord's Brand Guidelines"
[47]: https://discord.com/blog/discord-patch-notes-february-4-2026?utm_source=chatgpt.com "Discord Patch Notes: February 4, 2026"
[48]: https://www.heymichelle.me/work/discord-stickers?utm_source=chatgpt.com "Discord Stickers: Wumpus - Hey Michelle!"
[49]: https://slack.com/help/articles/206870177-Add-custom-emoji-and-aliases-to-your-workspace?utm_source=chatgpt.com "Add custom emoji and aliases to your workspace"
