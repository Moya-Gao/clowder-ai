---
doc_kind: research
topics: [game-ui, pixel-art, fighting-game, design]
created: 2026-03-09
model: gpt-pro
---

# 像素格斗游戏 UI 设计调研 — GPT Pro 咨询

## Part 1: 发给云端模型的提示词

> 直接复制发送给 GPT Pro

---

你好，我们是一个 AI 多猫协作项目（Cat Café / clowder-ai），正在做一个像素风即时格斗游戏（F090: Pixel Cat Brawl）作为项目 demo video 的核心素材。

### 背景

我们要做的是一个 **16x16 像素风格的即时格斗游戏**（类似拳皇/KOF/Street Fighter，但像素风），游戏引擎是 Phaser 3 + Canvas 2D，分辨率 1280x720。

**阵容**：4 只 AI 猫猫（2v2 团队战）
- 布偶猫队（蓝色系）：Opus 4.6（深蓝）+ Opus 4.5（浅蓝）
- 缅因猫队（绿/金色系）：Codex（翡翠绿）+ GPT-5.4（金色）
- 彩蛋：暹罗猫 Gemini 在背景当 DJ 打碟

**素材**：使用开源像素素材 "CUTE LEGENDS: CAT HEROES" (by 9E0)，16x16 pixel sprites，有 idle/run/jump/attack/skill/hurt 动画帧。

**问题**：我们的 UI mockup 设计了两版都很丑——第一版太粗糙没有设计感，第二版虽然用了 Swiss Expressive Dark 风格（Sora 粗体 + 深黑背景 + 几何精确），但太"SaaS dashboard"了，完全不像素风。和 16x16 猫猫 sprite 放在一起会非常违和。

### 需要调研的问题

**核心问题：16x16 像素格斗游戏应该用什么样的 UI 设计范式？**

具体希望你帮忙调研和回答：

1. **经典像素格斗游戏的 UI 设计范式**
   - 血条(HP bar)的像素风格设计有哪些经典做法？（分段式？渐变？外框？）
   - 能量条/技能条的像素化处理？
   - 角色名/队伍名的字体选择？（像素字体 vs 现代字体？哪些像素字体好看？）
   - 底部操作提示（按键指引）在像素游戏里怎么做？
   - Round/Timer 显示的经典做法？

2. **16x16 像素素材适配的 UI 比例原则**
   - 16x16 的角色在 1280x720 画布上应该放大到多大？（4x? 6x? 8x?）
   - UI 元素（血条、文字）应该用什么像素密度来匹配 16x16 素材？
   - 像素锐化 vs 模糊：Canvas 放大时用 `imageSmoothingEnabled = false` 保持锐利？

3. **参考案例**
   - 请推荐 3-5 个用 16x16 或类似小像素素材的格斗/动作游戏 UI 参考
   - 特别关注：它们怎么处理"小像素角色 + 大画布"的 UI 比例？
   - 有没有 itch.io 上做得好的像素格斗独立游戏可以参考？

4. **常见错误**
   - 像素游戏 UI 设计的常见陷阱有哪些？
   - "混搭错误"：哪些现代 UI 元素放在像素游戏里会显得违和？
   - 颜色数量控制：像素游戏的 UI 配色应该限制多少色？

5. **技术实现建议**
   - Phaser 3 里实现像素风 UI 的最佳实践？
   - 推荐什么像素字体？（可商用/MIT 许可的）
   - HUD overlay 是用 Phaser 原生还是 HTML DOM overlay？

### 输出要求

- 每个结论尽量标注参考来源（游戏名、文章 URL、或素材库链接）
- 区分"业界共识"和"个人推荐"
- 如果可能，给一个"像素格斗游戏 UI 设计检查清单"（checklist）
- 最后给出你推荐的配色方案和字体方案（基于我们蓝/绿/金的团队色）

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴回答到这里

我先给结论。

你们现在的问题，不是“第二版不够高级”，而是 UI 语言和 16x16 猫猫 sprite 说的不是同一种话。对这种项目，最稳的路不是继续往 Swiss / SaaS 仪表盘方向拧，而是回到**经典格斗 HUD 骨架 + 像素化皮肤**。格斗游戏的生命值本来就习惯放在顶部覆盖层；《SNK vs. Capcom: The Match of the Millennium》这种 NGPC 小像素格斗、《Pocket Rumble》这种现代化 NGPC 路线，以及《Blazing Strike》这种更厚重的现代像素格斗，骨架都还是“上方镜像状态栏 + 中央 timer + 边角资源槽”。([gameontology.com][1])

先把“业界共识”和“我给你们这项目的推荐”拆开说。

**业界共识**

* 血条放顶部左右镜像，Timer 居中，观众必须一眼读到谁快死了。([gameontology.com][1])
* 像素格斗 HUD 更适合 bitmap / sprite 化边框、条形和数字，不适合现代卡片式 panel、细 hairline、软阴影和玻璃拟态。这个从上面几款参考图一眼就能看出来。([nintendo.com][2])
* 放大尽量走整数缩放，关闭平滑过滤，避免子像素抖动。Phaser 官方对 `pixelArt`、`roundPixels` 和 canvas smoothing 的说明都很明确。([docs.phaser.io][3])

**我对 F090 的推荐**

* 内部分辨率直接定成 **640x360**，再 **2x** 输出到 1280x720。
* 16x16 猫猫默认显示到 **96 px 高左右**，也就是最终 **6x**，这是最稳的甜点位。
* HUD 走 **顶部镜像主血条 + 小头像/替补位 + 底部团队共享能量条**。
* 字体组合用 **Tiny5 / Silkscreen** 做常驻 HUD，**Press Start 2P** 只负责 `ROUND / FIGHT / KO` 这种大喊话。
* 颜色上用**中性框体 + 队伍色做 fill**，不要把整套 HUD 染成蓝绿金灯牌。

## 1) 经典像素格斗 UI 设计范式

### 血条 HP bar

**业界共识**是“强轮廓、短读取路径、顶部镜像”。老格斗 HUD 的重点不是装饰，而是让你 0.2 秒看懂局势。《SNK vs. Capcom》是超紧凑 handheld 语法，《Pocket Rumble》把这套语法做得更现代、更干净，《Blazing Strike》则把边框加厚、层次加重，但本质仍然没变。([nintendo.com][2])

**我建议你们这样做：**

* 主血条做成 **bg / fill / fg 三层**。
* 外框要硬，像像素砖，不要扁平网页线框。
* fill 最好做成**分段式**或“轻分段”，比如 8 到 12 格，既有像素味，也更适合 demo 视频里读伤害。
* 低血时别只剩一条细线，外框闪烁或 fill 改成警告色更有效。

如果你们要一点经典味的颜色变化，可以借用传统格斗那种“高血亮，中血暖，低血危险”的思路，但做成**像素阶梯色**，不要 SaaS 那种长条平滑渐变。《Last Blade 2》这类经典例子就用了顶部血条随状态变化的做法。([gameontology.com][1])

### 能量条 / 技能条

经典格斗里，资源条通常不会跟 HP 抢顶部主视觉，而是放在下缘或血条下方。官方截图里的《SNK vs. Capcom》底部有 power gauge，《Pocket Rumble》也把资源信息放在容易扫到但不挡动作的区域。([nintendo.com][2])

**我对你们 2v2 的建议**是：不要做四条独立大能量条，那会让画面像猫咖点单系统。更好的做法是**每队一条共享 Team Meter**，放左右下角，当前上场角色共享这一侧资源。这样既有团队战味道，也省 HUD 面积。

像素化处理上，优先考虑：

* **槽位式**，一格一格点亮。
* **短条 + 刻度**，像 Neo Geo Pocket 那种资源计数感。
* **满能量闪边框**，不要整条高饱和脉冲到把舞台照成夜店。

### 角色名 / 队伍名字体

战斗 HUD 里，我建议**像素字体胜过现代几何无衬线**。Google Fonts 上的 Tiny5 是 variable-width 的 5 像素字体；Silkscreen 本来就是为小尺寸 web graphics 设计的像素字；Press Start 2P 基于 80 年代 Namco 街机字形，而且官方说明它最适合 8px、16px 及其他 8 的倍数。Google Fonts 允许商业使用，常见许可证是 OFL 或 Apache；Silkscreen 仓库也明确写的是 OFL-1.1。([Google Fonts][4])

**我的搭配建议：**

* `ROUND / FIGHT / KO`：**Press Start 2P**
* 角色名、Timer、数字、短标签：**Silkscreen**
* 更小的数值、状态字、debug-ish 短词：**Tiny5**

补一句许可证现实：**主流好看的像素字体很多是 OFL / Apache，不是 MIT。**如果你们要求死卡 MIT，那我反而建议直接做一套自己的 bitmap atlas，或者走 `pixfont` 这种 MIT 代码 + public-domain 8x8 bundled font 的思路。([Google for Developers][5])

还有一个非常实际的坑：Phaser 的 `BitmapText` 只能显示纹理里已有的字符。如果你们战斗 HUD 里真的要上中文，不要临时混一套系统黑体进去，最好是少量中文做成图形字，或者自己准备位图字库。([docs.phaser.io][6])

### 底部操作提示

像素游戏的按键提示，最好做成**像素键帽 / 按钮 chip / 控制器 icon**，而不是现代 outlined pill。itch 上的 `Toe II Toe` 把底部操作区直接融进了 Game Boy 风 UI；Captain Moo 的 UI/HUD 包也把 controller / keyboard prompt 当成像素 UI 套件的一部分。([itch.io][7])

**我的建议：**

* demo 开场 2 秒显示“Move / Jump / Attack / Skill”。
* 进入正式对打后淡出，只在暂停、教学、击败后回放时再出现。
* 尽量用图标 + 1 个词，不要底部整段说明文。

### Round / Timer

Timer 居中，双侧 HP，`ROUND 1 / FIGHT / KO` 用中央临时大字，这是最不会出错的格斗语法。你看《SNK vs. Capcom》《Pocket Rumble》《Blazing Strike》，Timer 都在上方中央附近，读数路径非常短。([nintendo.com][2])

**我的建议：**

* Timer 永久显示。
* `ROUND / FIGHT / KO` 只做**短暂登场的词牌**，别一直占着 HUD。
* 2v2 模式下，替补信息交给头像 tab，不要再给 Timer 套一个大黑框，不然中路像挂了个地铁站牌。

## 2) 16x16 素材怎么适配 1280x720

这里我给直接数值。

### 角色应该放大到多大

**我的推荐顺序是：6x > 8x > 4x。**

* **4x = 64 px**。非常袖珍，偏 NGPC / 掌机感，动作能读，但表演力偏弱。
* **6x = 96 px**。最平衡，能看清猫猫动作，又不会把舞台和 HUD 挤扁。
* **8x = 128 px**。更“主角海报感”，但一不小心就会吃掉场景和 HUD 呼吸。

如果你们是做 demo video，而不是做严格掌机复古复刻，我会选 **96 px 终尺寸** 当常态。

### 最稳的工程方案

Phaser 里最干净的做法，是把逻辑画布定成 **640x360**，再用 `zoom: 2` 变成 1280x720。Phaser 官方把 `zoom` 定义为对游戏画布的简单缩放；Scale Manager 的 `FIT / EXPAND / RESIZE` 负责适配；`pixelArt: true` 会把 `antialias` 关掉并把 `roundPixels` 打开，而且文档直接写了这是 pixel-art games 的最佳设置。整数缩放本身也是为了避免 blur 和 distortion。([docs.phaser.io][3])

这样你们就能很顺手地做：

* 16x16 sprite 在逻辑层 `scale = 3`，最终就是 **96x96**。
* `scale = 4` 时最终就是 **128x128**。

### UI 元素用什么像素密度

这里别踩一个很常见的坑：**HUD 不需要和角色用同一“像素颗粒大小”**。

我的建议是：

* 角色按 16x16 sprite 放大。
* HUD 单独用 **8x8 / 16x8 / 16x16** 的小模块去设计。
* HUD 的“单颗像素感”最好比角色略细一点，别让血条边框像积木，角色反而像挂件。

落到屏幕像素上，我会这么抓：

* 主血条总高：**18 到 24 px**
* 主血条宽：**220 到 260 px**
* 小头像 / 替补 tab：**24 到 32 px**
* Timer 数字高：**24 到 32 px**
* 次级标签字高：**8 到 12 px**
* 主要数字字高：**16 到 24 px**

### 锐化 vs 模糊

这里直接给结论：**要锐，不要糊。**

Phaser 文档里，`roundPixels = true` 的作用就是避免 sub-pixel aliasing；canvas context 也可以显式关闭 smoothing。还有一个容易漏的点是，`startFollow()` 默认会把 camera 的 `roundPixels` 设为 `false`，除非你显式传或手动改回来。([docs.phaser.io][8])

所以实战上就是：

* `pixelArt: true`
* 跟随镜头后再确认 `camera.roundPixels = true`
* 任何自绘 Canvas / RenderTexture 都关 smoothing
* 所有 HUD 和 sprite 尽量落在整数坐标上

## 3) 3 到 5 个最值得抄作业的参考

### 1. SNK VS. CAPCOM: THE MATCH OF THE MILLENNIUM

1999 年的 NGPC 格斗，官方页面还明确写了 Single、Tag、Team-based fighting modes。它最值得你们抄的是**极紧凑的顶部 HUD 语法**，特别适合“小 sprite + 大画布”时的读数优先。([nintendo.com][9])

### 2. Pocket Rumble

官方就写了它是受 SNK 经典 Neo Geo Pocket Color fighters 启发的 streamlined 2D fighter。它是我最推荐你们看的“现代化小像素格斗 HUD”案例，因为它把 handheld 语法搬上了现代屏幕，但没有变成 UI 面板。([pocketrumble.com][10])

### 3. Blazing Strike

官方明确说它受 Capcom / SNK 经典街机格斗启发，同时是 pixel-art 2D fighter。它值得参考的是**更现代、更厚边框的像素 HUD**，适合你们如果想做得比 NGPC 更“燃”。([aksysgames.com][11])

### 4. Toe II Toe（itch）

这是一个 retro gameboy style 的 mini fighting game，页面直接写了 controls very basic、20 seconds per fight。它特别适合看**底部操作提示怎么和像素 UI 融在一起**。([itch.io][7])

### 5. First Cut（itch）

页面写得很直白，就是一个 small fighting game，支持朋友对战和本地多人。它最值得参考的是**极简 HUD**，提醒你们不是所有信息都必须常驻。([itch.io][12])

**额外 bonus**

* `The King of Fighters: Final attack` 在 itch 上写了 45,000 downloads，而且明确是 KOF fan game，适合拿来观察玩家对 KOF-like HUD、MAX Mode、move list 的心理预期。([itch.io][13])
* `TowerFall`、`Samurai GUNN 2` 虽然不是传统拳皇式格斗，但都很值得看“信息极简”和“让舞台呼吸”的做法。([itch.io][14])

## 4) 常见错误

最致命的技术坑，是**非整数缩放 + 平滑过滤 + 子像素 camera**。结果就是糊、抖、边缘漂移，像素会像被雨淋过。Phaser 官方文档和整数缩放资料都在强调这件事。([docs.phaser.io][3])

最常见的视觉坑，我直接帮你们避雷：

* 细 hairline 边框
* 玻璃拟态和 soft shadow
* 巨大黑底卡片 panel
* 几何无衬线正文占满 HUD
* 过宽圆角 pill 按钮
* 过多半透明叠层
* 颜色全靠线性渐变和发光

这些元素单看都不丑，但和 16x16 猫猫站在一起，会有一种“像素拳台上闯进了企业 BI 看板”的违和感。

颜色上也容易翻车。像素美术圈普遍推崇**有限色板和一致性**，Lospec 本身就是常用的 palette 数据库；Slynyrd 和 Ansimuz 也都在强调少量颜色、色阶复用和跨项目一致性。([SLYNYRD][15])

**我的建议**是：

* HUD 常驻色控制在 **6 到 8 个核心色**以内。
* 每种状态色只给 **2 到 3 阶明暗**。
* 中性色共用，队伍色只用于 fill、名字、头像高亮和技能满格提示。
  这样 UI 会像街机，不会像彩灯盘。

## 5) Phaser 3 落地建议

我会这样配：

```js
const config = {
  type: Phaser.CANVAS,
  width: 640,
  height: 360,
  zoom: 2,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};
```

上面这套的核心价值是：**640x360 逻辑分辨率刚好 2x 到 1280x720**，`zoom` 是 Phaser 官方的简单画布缩放；`pixelArt: true` 会关 antialias、开 roundPixels；`FIT` 适合保 16:9 画面。([docs.phaser.io][3])

然后是战斗 HUD 的实现建议：

* **HUD 用 Phaser 原生，不用 DOM overlay。** `DOMElement` 本质是浮在 canvas 上方的 HTML/CSS 容器，文档也明确说它不能自然混进 display list，而且多 camera 时要很小心。它更适合登录框、设置页、输入框，不适合主战斗 HUD。([docs.phaser.io][16])
* **文字优先 BitmapText。** Phaser 的 `BitmapText` 就是基于纹理图 + XML/JSON 字库的位图文本，天生适合像素 HUD。([docs.phaser.io][17])
* **血条用三层 sprite。** bg / fill / fg 叠在一起，fill 只改 crop 或宽度。Dead Revolver 的像素 HUD 包在说明里也直接把 value bar 拆成这三层，并建议用 nine-slice / nine-patch 保持 crisp。([itch.io][18])
* **战斗 HUD 最好放独立 Scene**，或者至少固定 camera / `setScrollFactor(0)`，别跟着世界层一起晃。
* **任何自绘 canvas 都关 smoothing**，并在 camera follow 之后再确认 `roundPixels` 还开着。([docs.phaser.io][8])

一句话回答你最后那个技术问题：

**战斗 HUD overlay：选 Phaser 原生。
HTML DOM overlay：只留给菜单、表单、debug 面板。**

## 6) 像素格斗游戏 UI 检查清单

你们出 mockup 时，可以拿这份单子一项项抽脸：

* 顶部是不是左右镜像主状态，而不是满屏 panel。
* Timer 是不是第一眼能看到。
* HP / 能量 / 替补信息有没有明显主次。
* 所有 sprite、字、边框是不是整数缩放。
* camera 和 UI 有没有子像素抖动。
* 文字是不是 bitmap / pixel 风，而不是现代网页字。
* 控制提示是不是能自动淡出。
* HUD 有没有比角色更抢戏。
* 队伍色是不是只用在关键信息，而不是整套 UI 满屏上色。
* `ROUND / FIGHT / KO` 是不是“短暂进场的大字”，而不是永久横幅。
* 替补角色是不是用小头像 / tab 表示，而不是再开一整套副 HUD。
* 低血、满能量、被击中这些状态，是否能靠轮廓和闪烁立刻分辨。

## 7) 我给你们的配色方案和字体方案

### 字体方案

**常驻 HUD**

* 角色名 / Timer / 数字：**Silkscreen**
* 小标签 / 状态字 / debug 感短词：**Tiny5**

**瞬时大字**

* `ROUND 1 / FIGHT / KO / TEAM WIN`：**Press Start 2P**

**如果许可证必须偏 MIT**

* 自制 bitmap atlas，或者用 `pixfont` 思路自己打 8x8 / 8x12 字库。([Google Fonts][4])

### 配色方案

我会用**中性框体 + 队伍 fill** 的办法，不让整个 HUD 变成霓虹自助餐。

**中性色**

* Ink：`#111318`
* Slate：`#1E2430`
* Steel：`#3A4658`
* Bone：`#E8DFC7`

**布偶猫队 / 蓝系**

* Opus 4.6 深蓝：`#2C57A6`
* Opus 4.5 浅蓝：`#79C9FF`

**缅因猫队 / 绿金系**

* Codex 翡翠绿：`#2FA56E`
* GPT-5.4 金色：`#D7AB43`

**通用状态色**

* Danger / 低血：`#D84E3B`
* Flash / 满格高亮：`#F1E28A`

**彩蛋 DJ Gemini**

* 只在背景或特效里少量点缀：`#8D6BFF`

### 配色使用规则

* 血条框体一律用中性色。
* fill 用队伍色。
* 低血统一改危险色，不继续坚持队色。
* 金色只给 GPT-5.4 的头像高亮、满能量提示或胜利词牌，不要把整条 bar 都做金，不然会像奖杯 UI。
* 背景里的 DJ Gemini 可以有紫色霓虹，但别让紫色进入主 HUD，不然会和两队识别打架。

## 如果只让我拍板一版

我会直接定这一版：

* **640x360 内部分辨率，2x 输出到 1280x720**
* **猫猫默认 96 px 高**
* **顶部左右镜像主血条**
* **每边 2 个小头像 tab 表示 2v2 替补**
* **底部左右各一条 Team Meter**
* **Silkscreen / Tiny5 做常驻 HUD**
* **Press Start 2P 只做 `ROUND / FIGHT / KO`**
* **外框中性，fill 才用蓝 / 绿 / 金**
* **操作提示只在开场短暂显示，然后淡出**

这条路最像“像素格斗游戏”，不会再像“猫猫站在企业驾驶舱里打拳”。

你要的话，我下一步可以把这份调研直接压成一页 **可交付的 HUD spec**，包括具体像素尺寸、布局草图和 Phaser 组件拆分。

[1]: https://www.gameontology.com/index.php/Health_Indicator "Health Indicator - gameontology"
[2]: https://www.nintendo.com/us/store/products/snk-vs-capcom-the-match-of-the-millennium-switch/ "https://www.nintendo.com/us/store/products/snk-vs-capcom-the-match-of-the-millennium-switch/"
[3]: https://docs.phaser.io/api-documentation/typedef/types-core "Types.Core | Phaser Help"
[4]: https://fonts.google.com/specimen/Tiny5?utm_source=chatgpt.com "Tiny5"
[5]: https://developers.google.com/fonts/faq "Frequently Asked Questions  |  Google Fonts  |  Google for Developers"
[6]: https://docs.phaser.io/phaser/concepts/gameobjects/bitmap-text "Bitmap Text | Phaser Help"
[7]: https://plazatin.itch.io/toe-20-toe "Toe II Toe by plazatin"
[8]: https://docs.phaser.io/phaser/concepts/cameras "Cameras | Phaser Help"
[9]: https://www.nintendo.com/us/store/products/snk-vs-capcom-the-match-of-the-millennium-switch/?srsltid=AfmBOorJpT8epY3H5U2GV6nb6bEBeREEK8H6dq4S7z3nmxVunSpZHLwE "SNK VS. CAPCOM: THE MATCH OF THE MILLENNIUM for Nintendo Switch - Nintendo Official Site"
[10]: https://pocketrumble.com/ "Pocket Rumble"
[11]: https://www.aksysgames.com/blazingstrike/ "HOME - Blazing Strike | Official Site"
[12]: https://drasnus.itch.io/first-cut "First Cut by Drasnus"
[13]: https://united-by-games.itch.io/the-king-of-fighters-final-attack "The King of Fighters: Final attack by United By Games, Bigruss91"
[14]: https://mattmakesgames.itch.io/towerfall "https://mattmakesgames.itch.io/towerfall"
[15]: https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes "Pixelblog - 1 - Color Palettes — SLYNYRD"
[16]: https://docs.phaser.io/api-documentation/class/gameobjects-domelement "DOMElement | Phaser Help"
[17]: https://docs.phaser.io/api-documentation/class/gameobjects-bitmaptext "BitmapText | Phaser Help"
[18]: https://deadrevolver.itch.io/pixel-ui-hud-pack "Pixel UI & HUD by Dead Revolver"

## Part 3: 综合 — 布偶猫对照 codebase 验证 + 行动方案

> 综合人：布偶猫 Opus 4.6 | 日期：2026-03-09

### GPT Pro 核心结论验证

| # | GPT Pro 建议 | 验证状态 | 备注 |
|---|-------------|---------|------|
| 1 | 640x360 内部分辨率，2x 输出到 1280x720 | **直接可用** | Phaser `zoom: 2` + `pixelArt: true`，无需验证 |
| 2 | 16x16 sprite → 6x = 96px 终尺寸 | **直接可用** | Cat Heroes 素材是 16x16，scale=3 在逻辑层，最终 96px |
| 3 | Silkscreen + Tiny5 常驻，Press Start 2P 大字 | **直接可用** | 均为 Google Fonts OFL 许可，项目是 MIT 但 OFL 字体可用 |
| 4 | 中性框体 + 队伍 fill，不整体染色 | **直接可用** | 修正了 v2 mockup 蓝绿满屏的错误 |
| 5 | HUD 用 Phaser 原生，不用 DOM overlay | **直接可用** | 战斗 HUD 不需要 HTML 表单 |
| 6 | BitmapText 做文字 | **需注意** | 中文标签需要做成图形字/bitmap atlas |
| 7 | 操作提示开场显示后淡出 | **直接可用** | demo 录屏不需要常驻控制提示 |

### v2 mockup 的具体错误（对照检查清单）

| 检查项 | v2 状态 | 问题 |
|--------|---------|------|
| 整数缩放 | ❌ | 直接用 1280x720，没有 640x360 逻辑层 |
| 像素字体 | ❌ | 用了 Sora + Inter（现代几何无衬线） |
| 中性框体 | ❌ | 整个 HUD 蓝绿满屏上色 |
| 镜像 HP 条 | ✅ | 左右镜像，但样式是 SaaS 条 |
| 操作提示 | ❌ | 常驻底栏，应该开场后淡出 |
| HUD 主次 | ❌ | 没有小头像 tab 表示替补 |
| 像素边框 | ❌ | 用了细 hairline + soft stroke |

### 行动方案：v3 Pixel-Correct Mockup

**配色方案（采纳 GPT Pro 推荐）**

```
中性色：
  Ink:   #111318  (最深背景)
  Slate: #1E2430  (卡面/面板)
  Steel: #3A4658  (边框/次要文字)
  Bone:  #E8DFC7  (主要文字)

队伍色（仅用于 fill）：
  布偶猫 4.6: #2C57A6
  布偶猫 4.5: #79C9FF
  缅因猫 CDX: #2FA56E
  缅因猫 5.4: #D7AB43

状态色：
  Danger: #D84E3B
  Flash:  #F1E28A
  DJ:     #8D6BFF (仅背景彩蛋)
```

**字体方案**

```
常驻 HUD: Silkscreen (角色名/Timer/数字)
小标签:   Tiny5 (状态字/debug 感)
大字:     Press Start 2P (ROUND/FIGHT/KO)
```

**布局方案（640x360 逻辑分辨率）**

```
┌─────────────────────────────────────────────────────┐
│  [P1 头像][HP████████░░] 99  ROUND 2  99 [░░████████HP][P2 头像]  │  ← 顶部镜像 HUD
│  [替补tab]                                [替补tab]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│      🎧 DJ 烁烁                                     │  ← 背景装饰
│                                                     │
│    😼(96px)  😺(96px)    |    🐱(96px)  🐱(96px)   │  ← 猫猫 6x
│                          |                          │
│  ─────────────────────────────────────────────────  │  ← 地板线
│  [Team Meter ████░░]              [░░████ Team Meter]│  ← 底部队伍能量
└─────────────────────────────────────────────────────┘
```

**Mockup 设计规则**

1. 所有尺寸以 640x360 逻辑分辨率设计（Pencil 画布用 1280x720，所有元素 ×2）
2. 像素字体替代现代字体
3. HP 条用粗像素边框（bg/fill/fg 三层），分段式 fill
4. 框体中性色，fill 才用队伍色
5. 小头像 tab 表示 2v2 替补
6. 操作提示标注"开场后淡出"
7. DJ 烁烁只在背景，紫色不进主 HUD

### 下一步

1. ~~写 Part 3~~ ✅
2. 删除 v2 mockup，用 pixel-correct 风格重建 v3
3. 截图 → 对照 GPT Pro 12 项检查清单逐项验证
4. 通过后呈给铲屎官 Design Gate review
