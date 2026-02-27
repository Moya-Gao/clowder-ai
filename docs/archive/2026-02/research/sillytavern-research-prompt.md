---
feature_ids: [F010]
topics: [sillytavern, prompt]
doc_kind: research
created: 2026-02-26
---

# 研究任务：SillyTavern + Phone-UI 扩展调研

> 给砚砚（Codex Pro）的研究提示词
> 来源：铲屎官 + 宪宪讨论，2026-02-12

## 背景

铲屎官的愿景：Cat Café 不只是"三猫协作开发工具"，未来还要成为**跨平台的猫猫陪伴系统**——手机 App 上随时喊猫猫陪读书、陪看电影、陪散步聊天。三只猫各有性格，不是冷冰冰的工具，是有温度的伙伴。

SillyTavern（"酒馆"）是目前最成熟的开源 AI 聊天前端之一，它的扩展生态、移动端方案、角色系统、多媒体消息机制都值得研究。请深入调研，重点分析对 Cat Café 的借鉴价值。

---

## 第一部分：SillyTavern 主项目

- GitHub: https://github.com/SillyTavern/SillyTavern
- 文档: https://docs.sillytavern.app/

### 重点关注

1. **扩展系统架构**
   - extension 机制怎么设计的？第三方扩展如何注册、加载、与主程序通信？
   - 扩展的沙盒隔离、生命周期管理
   - manifest.json 结构、依赖声明

2. **Visual Toolkit / Directive 系统**
   - 如何让 LLM 输出结构化 UI 指令（HTML/标签），然后前端解析渲染？
   - Prompt directive 的注册和注入机制

3. **多后端适配**
   - 支持 OpenAI/Claude/本地模型等多种后端，adapter 层怎么抽象的？
   - 和我们的三猫适配层（Claude CLI / Codex CLI / Gemini 双 adapter）对比异同

4. **Character Card 系统**
   - 角色卡的数据结构（personality / scenario / first_message / example_messages）
   - 预设管理、上下文注入方式
   - Group Chat（多角色同时对话）机制

5. **前端技术栈**
   - 框架选型、组件组织方式、CSS 主题系统
   - 响应式 / 移动端适配策略

---

## 第二部分：Phone-UI 扩展（"小手机"）

- GitHub: https://github.com/bal-spec/sillytavern-phone-ui

### 重点关注

1. **核心创意**
   - 把 AI 回复渲染成手机短信 UI，在气泡里嵌入 [IMG] 图片轮播和 [VN] 语音条
   - "同样的对话内容，不同的视觉呈现"这个思路

2. **LLM → 结构化输出 → 富 UI 的管线**
   - Prompt directive 怎么指导 LLM 输出 `[IMG]...[/IMG]` 和 `[VN]...[/VN]` 标签？
   - 前端怎么解析这些标签并注入交互组件？
   - `data-phone-img` / `data-phone-vn` 占位符注入机制
   - Regex 脚本如何在发给 LLM 前剥离已处理的标签

3. **持久化设计**
   - `message.extra.phoneMedia` 怎么存图片/语音元数据
   - 页面刷新后如何从持久化数据恢复富媒体，而不重新生成

4. **DOM Range API 用法**
   - 跨节点边界的标签提取怎么实现的

5. **PLAN.md**
   - 看看它的开发规划文档，了解设计决策过程

---

## 第三部分：对 Cat Café 的借鉴分析

### 3a) 富消息渲染

Cat Café 目前的消息都是纯文本/Markdown。酒馆的"LLM 输出结构化标签 → 前端解析为富组件"这个模式，我们能不能用来让猫猫的回复包含更丰富的交互元素？

具体场景：
- 协作开发：代码 diff 预览、架构图、审批按钮、测试结果卡片
- 陪看电影：截图、表情包、语音吐槽
- 陪读书：引用书中段落、画重点、读书笔记卡片
- 日常：今日推荐卡片、天气提醒、心情标签

### 3b) 扩展/插件系统

Cat Café 目前没有扩展机制。酒馆的 extension 加载方式对我们有参考价值吗？尤其是第三方扩展的沙盒隔离、生命周期管理。

### 3c) 多 AI 后端适配

我们的三猫（Claude/Codex/Gemini）适配层 vs 酒馆的多后端适配，架构思路异同？有没有值得借鉴的抽象层设计？

### 3d) UI/UX 创意

- phone-ui 的"换皮"思路有没有启发？
- Character Card / 角色预设对我们的"猫猫人设系统"有参考吗？
  - 写代码时的宪宪 vs 陪看电影时的宪宪，应该是不同的 persona preset
  - 这种"场景 → persona 切换"的数据结构怎么设计？

### 3e) 不应该借鉴的部分

- 哪些设计是酒馆场景特有的（RP/角色扮演），不适合 Cat Café？
- 有没有明显的反模式或技术债？
- 哪些过度设计的部分我们应该避免？

---

## 第四部分：跨平台与移动端

### 4a) SillyTavern 的移动端方案

- Android 上通过 Termux 本地运行的体验如何？优缺点？
- 有没有 PWA / 移动端 wrapper 方案？
- 移动端特有问题：虚拟键盘处理、手势、通知推送、后台保活
- `--doc-height` CSS 变量方案（解决移动端 100vh 问题）值得借鉴吗？
- SillyTavern 社区有没有做过原生 App 的尝试？成功/失败经验？

### 4b) 手机 App 技术选型参考

请调研目前主流的 AI 聊天类 App 的技术选型：
- React Native / Flutter / PWA / 原生？各自优劣
- 本地能力需求：语音输入（我们已有 Whisper ASR）、推送通知、离线缓存
- 推送通知方案：猫猫主动找你说话（不只是被动等指令）
- 离线缓存：地铁上能翻之前的对话
- 和 Cat Café 现有架构（Next.js + Fastify + Redis）的衔接方式

---

## 第五部分：陪伴场景交互设计

### 5a) 从"工具"到"伙伴"

酒馆的角色扮演生态里，哪些交互模式适合"陪伴"而不只是"指令-响应"？
- 角色主动发起话题（而不是等人问）
- 记住之前聊过的内容（长期记忆 — 我们已有 Hindsight）
- 情绪感知、场景切换
- 多猫同时在场的 group chat 互动

### 5b) 场景化 persona

Character Card 里的 personality/scenario/first_message 设计，对"猫猫在不同场景下切换状态"有参考吗？

| 场景 | 宪宪的状态 | 砚砚的状态 |
|------|-----------|-----------|
| 写代码 | 严谨架构师 | 铁面 reviewer |
| 陪看电影 | 话多吐槽王 | 冷知识百科 |
| 陪读书 | 深度讨论伙伴 | 笔记整理达人 |
| 日常闲聊 | 温暖话痨 | 毒舌但关心 |

### 5c) 隐私与本地化

- 陪伴场景涉及更私密的对话内容（情绪、生活、个人想法）
- SillyTavern 的"本地优先"理念（数据全在本地）对我们有什么启示？
- Cat Café 目前用 Redis 存消息，手机端的数据同步策略？
- 端到端加密的必要性评估

---

## 输出要求

### 报告结构

1. **项目概览**（一段话总结酒馆是什么、小手机是什么）
2. **架构分析**（扩展系统、多后端适配、UI 渲染管线）
3. **Phone-UI 技术拆解**（管线流程图、关键代码路径、巧妙之处）
4. **富消息渲染借鉴方案**（Cat Café 怎么做类似的事）
5. **移动端方案对比**（Termux / PWA / RN / Flutter 优劣表）
6. **陪伴场景交互设计建议**（哪些模式值得 Cat Café 采纳）
7. **手机 App 技术路线建议**（推荐选型 + 理由 + 和现有架构的衔接）
8. **Cat Café 借鉴清单**（按优先级排序，每项注明：借鉴什么、怎么改造、预估工作量）
9. **不借鉴清单**（哪些不适合我们，为什么）
10. **愿景路线图草案**（从现在到"手机上喊猫猫陪看电影"需要哪几步）
11. **结论**（值不值得深入？下一步建议）

### 存放位置

`docs/research/sillytavern-phone-ui-research.md`

# 缅因猫 pro

# 1. 项目概览

**SillyTavern（酒馆）**：一个“本地安装”的 LLM 前端，核心围绕 *Character Card*（角色卡）组织对话，把“提示词工程、角色设定、上下文拼装、多后端连接、扩展生态”做成一套可配置的 UI 系统。它不仅连文本模型，也连图像生成、TTS 等能力。 ([SillyTavern][1])

**Phone-UI（小手机）扩展**：一个 UI 扩展，把同一段聊天内容换成“手机短信/IM 的视觉皮肤”，并把 LLM 产出的 `[IMG]...[/IMG]` 和 `[VN]...[/VN]` 标签，变成气泡里的**图片轮播**与**语音条**等交互组件，且把生成结果持久化到 chat 文件里，刷新也能恢复，不需要重新生成。 ([GitHub][2])

---

# 2. 架构分析

## 2.1 扩展系统架构

### 2.1.1 扩展是怎么注册、加载、通信的

SillyTavern 的 UI 扩展形态非常“Web 前端化”：一个扩展通常就是：

* `manifest.json`：声明名称、加载顺序、依赖、入口 JS/CSS 等
* `index.js`：扩展逻辑
* `style.css`：样式（可选）
* 以及可能的 preset 配置（比如 prompt items / regex scripts）

manifest 的字段风格很直观，例如官方示例扩展 `Chat Variables`：`display_name / loading_order / requires / optional / js / css / author / version / homePage / auto_update`。 ([GitHub][3])

扩展与主程序通信靠两类“公共面”：

1. **全局 API 暴露**：主前端脚本把 `SillyTavern.getContext()` 暴露到 `globalThis.SillyTavern`，扩展可以拿到上下文与一些工具。 ([GitHub][4])
2. **ESM 直接 import 内部模块**：扩展代码会从 SillyTavern 的脚本目录 import 需要的能力（例如 `getContext`、slash commands、事件总线等）。官方示例扩展就是从 `extensions.js` import `getContext()` 并注册 Handlebars helper。 ([GitHub][5])

> 结论：这是一个典型“同页面同权限”的前端插件体系，插件=同仓库生态里的模块化脚本。

### 2.1.2 生命周期与事件机制（你关心的“什么时候跑”）

Phone-UI 这种扩展的典型触发点是 **`CHARACTER_MESSAGE_RENDERED`**（角色消息渲染完毕）。它通过事件系统拿到 messageId，再去 DOM 与 chat 数据里做二次处理。 ([GitHub][6])

从主脚本导入项也能看出扩展系统内部有：

* `initExtensions / loadExtensionSettings / extension_settings`
* `runGenerationInterceptors`（生成拦截器，后面很关键）

这些名字直接暴露了扩展体系的“管线位置”：既能在 UI 渲染时动手，也能在 prompt 生成阶段做拦截。 ([GitHub][4])

### 2.1.3 沙盒隔离：几乎没有“硬隔离”，更多靠约定

从扩展写法（直接 import 内部模块、操作 DOM、读写 chat 对象）就能看出：UI 扩展并不是 iframe sandbox 级别隔离，而是“同权脚本”。这带来两个现实：

* 优点：扩展能力强、开发门槛低、生态繁荣。
* 缺点：第三方扩展天然不可信，安全边界弱（尤其是秘密/密钥之类）。

文档也明确强调了扩展可以往角色卡 `extensions` 字段写额外数据，并提醒 `characterId` 的坑（在 group chat 里可能是 `undefined`），说明扩展深度介入状态管理。 ([SillyTavern][7])

**对 Cat Café 的启示**：
你们如果要做第三方插件生态，最好不要直接复刻“同权脚本”。更像“能力胶囊”那种：capability-based API + 权限声明 + 运行隔离（iframe / worker / server plugin 分层），否则未来你们的“猫猫陪伴系统”会被一个不小心的插件撬开整个屋顶。

---

## 2.2 Visual Toolkit / Directive 系统（LLM 输出结构化 UI 的关键）

这里要把概念拆成三层，不然容易糊成一锅提示词火锅：

1. **Prompt Preset / Prompt Manager**：SillyTavern 有“提示词预设”体系，且有“同名预设自动匹配角色卡”的行为。也就是说：只要 preset 名字和角色卡名字一致，就能在开新聊天时自动选中。 ([SillyTavern][8])

2. **Directive（指令片段）**：Phone-UI 依赖的 *Visual Toolkit* 本质是一个被插入 prompt 的“强约束格式指令”，让模型输出手机短信 UI 的 HTML（气泡、布局等）。Phone-UI 自己再加两段 directive：

   * **Text Message Photos**：让模型输出 `[IMG]...[/IMG]`，并在 HTML 里放 `data-phone-img="N"` 占位符
   * **Text Message Voice Notes**：让模型输出 `[VN]...[/VN]`，并放 `data-phone-vn="N"` 占位符
     这些指令的 JSON 版本就在 `phone-ui-preset-items.json` 里：能看到 prompt 的 `name/identifier/enabled` 以及插入顺序 `prompt_order`。 ([GitHub][9])

3. **Regex Scripts（上下文清洁工）**：Phone-UI 明确要求你在 preset 里加两条 promptOnly 的 regex 脚本，把旧的 `[IMG]...[/IMG]`、`[VN]...[/VN]` 从“发给模型的上下文”里剥离掉，防止模型把已处理媒体再次带回输出。脚本配置也在 preset items 里。 ([GitHub][9])

> 这一套合起来就是：**指令把输出变成“可解析结构”，regex 把历史污染降到最低，扩展把结构渲染成组件**。

---

## 2.3 多后端适配：酒馆的抽象形状

SillyTavern 的多后端不是一句“支持很多模型”那么简单，它更像一套“发电厂接线板”：

* 前端脚本里就能看见一堆模块化的生成器/适配器：OpenAI、Horde、Kobold、TextGen、NovelAI 等分别有 `generateXWithStreaming / loadXSettings / getXGenerationData` 之类的函数。 ([GitHub][4])
* 服务端是 Node，依赖里有 `express`、`ws`、`node-fetch` 等，说明它同时承担本地 server 与 API 转发/管理的角色。 ([GitHub][10])

另外一个很关键的“可借鉴点”是：它把生成流程做成可插拔的管线，主脚本里出现了 `runGenerationInterceptors` 这种明显的 hook 位。 ([GitHub][4])

### 和 Cat Café “三猫适配层”的对比（抓共同骨架）

你们现在的三猫（Claude CLI / Codex CLI / Gemini 双 adapter）其实天然适合做成：

* `Adapter`：把内部统一的 `PromptEnvelope`（system + history + tools + attachments）转成各家 payload
* `Capabilities`：每个后端声明能力（流式、工具调用、图像、多模态、缓存、价格上限）
* `Interceptors`：在 adapter 前后插拦截器（安全、结构化输出约束、富消息提取、记忆注入）

SillyTavern 的思路与此高度同构，只是它把更多“提示词与 UI”放在可配置层（Prompt Manager、模板、宏、regex）上。 ([GitHub][4])

---

## 2.4 Character Card 系统与 Group Chat

### 2.4.1 角色卡的定位

官方文档把“角色卡”定义为：一组用于设定 LLM 行为的 prompts，是 SillyTavern 实现持久对话的核心单位，类似 ChatGPT 的 GPTs 或 Poe 的 bots。 ([SillyTavern][1])

角色管理文档也强调：角色可以用于 solo chat，也可以加入 group chat。 ([SillyTavern][11])

### 2.4.2 角色卡数据结构（你关心的 personality/scenario/first_message/example_messages）

在生态层面，SillyTavern兼容并拥抱 Character Card V2 规范（第三方规范仓库说明了 V2 的目标与字段扩展方向）。 ([GitHub][12])

更实用的是：SillyTavern 文档明确说支持 V2 的 `extensions` 字段，用于扩展写入可分享的额外数据。 ([SillyTavern][7])

此外角色编辑文档里能看到：

* Alternate Greetings（多条开场白，用 swipe 切换）
* Prompt Overrides / Post-History Instructions（角色级别覆盖系统提示词/后置指令）
* Creator Notes、Tags 等高级字段
  这些对你们“猫猫人设系统”非常像“persona preset 的 JSON 形态”。 ([SillyTavern][13])

### 2.4.3 Group Chat 机制（以及它的坑）

SillyTavern 的 group chat 是把多个角色“叠到同一个 prompt 里”。文档直接说会把这些字段组合起来：Description、Scenario（若没被 chat override）、Personality、Message examples、Character notes/Depth prompts。 ([SillyTavern][14])

它也很诚实地警告：因为典型角色卡结构的原因，群聊可能导致角色混淆自我、人格融合等“怪事”。 ([SillyTavern][14])

**对 Cat Café 的启示（非常重要）**：
你们想要“多猫同时在场”，最好不要走“把三只猫的人设拼成一个 prompt”的路。更像“多智能体编排”：

* 每只猫各自有独立上下文与人设
* 一个 orchestrator 决定谁说话、说什么、如何引用其他猫的观点
* UI 层做成群聊外观，但底层不是“人格大乱炖”

---

## 2.5 前端技术栈与主题系统

从依赖与主脚本 import 可以直接读出酒馆的前端“工具箱”：

* `handlebars`（模板）
* `showdown`（Markdown）
* `dompurify`（XSS 清洗）
* `highlight.js`（代码高亮）
* `@popperjs/core`（弹层定位）
* 还有大量 UI 脚本模块（group chats、prompt manager、macros、extensions 等）
  ([GitHub][10])

CSS 方面，`style.css` 里大量使用 CSS 变量（主题色、字体、阴影、尺寸等），同时还出现了移动端 viewport 相关的处理（见 4.1）。 ([GitHub][15])

---

# 3. Phone-UI 技术拆解

## 3.1 核心创意：同一段话换一张皮，体验瞬间变“有人”

Phone-UI 最厉害的不是轮播与语音条本身，而是它证明了一件事：

> **聊天内容可以保持同一份，呈现层可以做出“场景化 UI”**。

同样一句“我刚拍了张照片”，在普通 Markdown 里就是文本；在 Phone-UI 里变成一条带相册的短信气泡，心理距离会明显缩短。 ([GitHub][2])

这对 Cat Café 的“工具 -> 伙伴”转型非常对味：你们不是缺功能，你们缺“情境皮肤”和“表达介质”。

---

## 3.2 LLM -> 结构化输出 -> 富 UI 的管线

### 3.2.1 输出约定（靠 directive 建模）

Phone-UI 的约定是“三段式输出”：

1. **Visual Toolkit 生成手机 UI 的 HTML**（气泡、布局）
2. HTML 内放占位符：`data-phone-img="N"` / `data-phone-vn="N"`
3. HTML 外输出标签：`[IMG]prompt[/IMG]`、`[VN]text[/VN]`
   ([GitHub][6])

### 3.2.2 前端解析与注入（占位符替换）

扩展在消息渲染后执行：

* 扫描 `message.mes` 里的 `[IMG]` 与 `[VN]`（两个 regex）
* 找到占位符（优先用 data attribute，fallback 用内容匹配）
* 把占位符替换成组件：图片容器（带左右箭头+编辑器）、语音条播放器（带波形+编辑器）
  ([GitHub][2])

### 3.2.3 关键：Regex 脚本“剥离已处理标签”

Phone-UI 强制你在 preset 里加 `promptOnly` regex scripts，目的是：**不要把已消费的标签再喂回模型**，避免模型持续输出旧标签造成重复媒体或格式崩坏。 ([GitHub][9])

---

## 3.3 持久化设计：message.extra.phoneMedia

它把生成出来的媒体元数据存进 `message.extra.phoneMedia`：

* 图片 key 用数字序号 `0,1,2...`，并存 `urls[]`（多变体）与 `activeIndex`
* 语音 key 用 `vn0, vn1...`，存文本
  文档与实现都写得很明确。 ([GitHub][6])

因此刷新页面后它能走“Restore”路径：检测到已有 `phoneMedia`，就把组件恢复到占位符里，而不是重新 `/imagine`。 ([GitHub][6])

---

## 3.4 DOM Range API：跨节点边界剥离标签（很巧）

`[VN]...[/VN]` 或 `[IMG]...[/IMG]` 在渲染后的 DOM 里可能被 `<br>`、`<div>` 等拆开，单纯对 text node 做 regex 会漏。

Phone-UI 的方案是：

* `TreeWalker` 遍历所有 text nodes
* 找到 open tag 所在 node 与 offset
* 再找到 close tag 所在 node 与 offset
* `document.createRange()` 跨节点设置 start/end
* `range.deleteContents()` 一刀切掉整段
  并且强调**必须先 strip，再做占位符替换**，否则 Range 会把刚插入的播放器也删掉。 ([GitHub][6])

---

## 3.5 管线流程图（你要的“像工程图一样清晰”）

```
          (Prompt Preset)
   Visual Toolkit + Photos/VN Directives
                 |
                 v
        LLM 输出（同一条消息）
    ┌─────────────────────────┐
    │ ① 手机UI HTML（含占位符） │
    │   <div data-phone-img=0> │
    │   <div data-phone-vn=0>  │
    │ ② 标签（HTML外）           │
    │   [IMG]...[/IMG]          │
    │   [VN]...[/VN]            │
    └─────────────────────────┘
                 |
                 v
   UI 渲染后触发 CHARACTER_MESSAGE_RENDERED
                 |
                 v
     Phone-UI Extension onCharacterMessageRendered
        |            |                 |
        |            |                 |
        v            v                 v
  stripTagsFromDOM  findPlaceholder   执行 /imagine 或 /speak
  (Range API)       (data-*优先)      (slash command)
        |            |                 |
        └──────┬─────┴─────┬──────────┘
               v            v
      注入 Image Carousel   注入 Voice Note Player
               |
               v
      写入 message.extra.phoneMedia
               |
               v
           saveChatConditional()
               |
               v
     Reload 时：仅 restore，不再生成
```

---

# 4. 富消息渲染借鉴方案：Cat Café 怎么做“同款魔法”

你们现在消息是纯文本/Markdown。酒馆+Phone-UI 给的启示很直接：

> **让模型输出“可解析的结构”，然后由前端渲染成组件，并把组件状态持久化。**

我建议你们把这套抽象成 Cat Café 的“Rich Message Rendering（富消息渲染层）”，核心不是 UI，而是**消息的双层表示**：

* `message.content`：可读文本（Markdown）
* `message.extra.richBlocks`：机器可读结构（JSON / 标签解析结果 / 元数据）

## 4.1 两条可行路线

### 路线 A：标签 DSL（借鉴 Phone-UI）

定义类似：

* `[DIFF id="..."]...[/DIFF]`
* `[CARD type="test_result"]{...}[/CARD]`
* `[AUDIO]...[/AUDIO]`

优点：模型容易学；缺点：解析要非常小心（跨节点、转义、嵌套、注入）。

### 路线 B：JSON Block（更“工程化”）

让模型在消息末尾输出一段稳定 JSON（并配合 prompt-only 清洁）：

```json
{
  "blocks": [
    { "type": "diff", "title": "Refactor plan", "files": [...] },
    { "type": "action", "actions": ["approve", "request_changes"] }
  ]
}
```

优点：可验证、可版本化、能严格 schema 校验；缺点：模型偶尔会输出坏 JSON，需要修复/重试策略。

### 最推荐：A+B 混合

* UI 占位符用轻量标签（方便模型把组件放对位置）
* 组件数据用 JSON（稳定、可校验）
* 再加“regex promptOnly 清洁工”，把已消费结构从历史上下文剔除
  Phone-UI 的经验告诉我们：**清洁工不是可选项，是防止 prompt 腐败的必需品**。 ([GitHub][9])

---

## 4.2 你们的具体场景怎么映射成组件

把你列的场景按“组件类型”落地：

### 协作开发

* `DiffCard`：代码 diff + 文件树 + 评论线程
* `ReviewActions`：Approve / Request changes 按钮（点击触发 Fastify API）
* `TestRunCard`：CI 结果、覆盖率、失败用例摘要
* `ArchitectureDiagram`：Mermaid / SVG（注意安全清洗）

### 陪看电影

* `ScreenshotCarousel`：截图轮播（可手动上传或自动抓帧）
* `VoiceSnarkBar`：语音吐槽条（TTS/录音）
* `TimestampBookmark`：一键“记住这一幕”

### 陪读书

* `QuoteCard`：引用段落（带页码/章节）
* `HighlightCard`：画重点（多色标签）
* `NoteCard`：读书笔记（可导出）

### 日常

* `DailyRecommendationCard`：今日推荐
* `WeatherNudge`：天气提醒（组件化展示）
* `MoodTag`：心情标签（写入记忆系统 Hindsight）

---

## 4.3 持久化策略（借鉴 message.extra.phoneMedia 的“可恢复性”）

Phone-UI 的关键不是生成，而是“刷新后不丢”。你们也应当把富组件当作 **消息的派生状态**，存进 message 的 `extra` 字段。

建议结构：

```ts
type RichBlockState =
  | { id: string; type: "image_carousel"; urls: string[]; active: number; prompt?: string }
  | { id: string; type: "voice_note"; text: string; audioUrl?: string; voice?: string }
  | { id: string; type: "diff"; ... }
  | ...
```

原则：

* **渲染时先看 extra 是否已有 state**，有就 restore
* 没有才触发生成（调用工具/后端）
* 生成后写回 extra 并持久化（Redis + 客户端缓存）

这就是 Phone-UI 的“Restore 模式”，可以直接复刻到 Cat Café。 ([GitHub][6])

---

# 5. 移动端方案对比

先把 SillyTavern 的移动端现实摆在桌上：它确实能在 Android 上用 Termux 本地跑，并且官方文档给了完整安装步骤（强调 Termux 不要从 Google Play 装，推荐 F-Droid/GitHub releases）。 ([SillyTavern][16])

同时，SillyTavern 的 CSS 里能看到对移动端 viewport 的处理：`height: 100vh; height: 100dvh;`，并保留 `--doc-height` 变量（注释说明会用 JS 重新赋值成像素），这就是典型的“移动端 100vh 修复套路”。 ([GitHub][15])

再加一条小细节：热键在移动端是禁用的，说明它对移动端体验有分流策略。 ([SillyTavern][17])

## 5.1 方案优劣表（给 Cat Café 的决策用）

| 方案                        | 体验目标    | 优点                                | 缺点                            | 适合 Cat Café 哪一步  |
| ------------------------- | ------- | --------------------------------- | ----------------------------- | ---------------- |
| Termux 本地跑（像 ST）          | 极客可用    | 真本地、隐私强、离线可读                      | 部署门槛高、后台保活难、系统限制多             | 适合作为“开发者模式/极客模式” |
| PWA（移动 Web）               | 快速覆盖    | 复用 Next.js UI，迭代快；离线缓存可做          | iOS 推送/后台能力受限；媒体/语音体验不如原生     | 最适合你们的 MVP 第一阶段  |
| React Native              | 产品化 App | JS/TS 生态，团队若已有 TS 更顺手；推送/离线/语音能力强 | 需要原生桥接与性能调优；UI 与 Web 组件不能完全复用 | 适合第二阶段“猫猫陪伴 App” |
| Flutter                   | 产品化 App | UI 一致性强、动画/布局漂亮；性能稳定              | 引入 Dart 技术栈；与现有 TS 共享逻辑较少     | 适合你们如果更重视 UI 质感  |
| 原生 iOS/Android            | 最佳体验    | 推送/后台/音频/系统集成最强                   | 两套团队成本最高                      | 适合规模更大或对体验极致要求   |
| Tauri/Capacitor 类 Wrapper | 低成本封装   | 以 Web UI 为主，补一部分原生能力              | 受 WebView 限制；复杂交互仍要写原生插件      | 适合 PWA 之后“轻原生化”  |

> 注：商业 App 的具体技术栈往往不公开，所以这里更偏工程决策对比，而非“点名某某 App 用什么”。不过 Tauri 的跨平台（含移动）能力在 2.x 之后已成为可选项。 ([维基百科][18])

---

# 6. 陪伴场景交互设计建议

酒馆的 RP 生态里有很多“陪伴感”的交互模式，你们可以抽取成更健康、更日常的版本：

## 6.1 角色主动发起话题（不是等你点菜）

你们的“猫猫主动找你说话”，需要两层：

1. **产品层**：推送通知/小组件/锁屏卡片
2. **对话层**：猫猫要有“开场理由”，而不是突然冒泡

可以借鉴角色卡的 `first_mes / alternate_greetings` 思路：每个场景有一组“自然开场白”，随机抽取或按状态机选择。 ([SillyTavern][13])

## 6.2 长期记忆与情绪感知

你们已经有 Hindsight，那就让 UI 也“看得见记忆”：

* 每次猫猫提到过去的事，用一个 `MemoryChip`（可点开查看来源）
* 情绪用轻量标签（不做心理诊断，只做情境提醒）

## 6.3 多猫同时在场：别让人格融化成一锅汤

前面说过：SillyTavern 群聊会把多个角色字段合并，官方直接警告会出现人格混淆。 ([SillyTavern][14])

Cat Café 的“三猫”是产品灵魂，所以建议：

* UI 上是 group chat
* 底层是 multi-agent orchestrator（每猫单独上下文）
* orchestrator 负责 turn-taking、引用、互相吐槽的节奏

你们会得到“猫猫互相对话”的戏剧张力，但不会丢掉每只猫的身份边界。

---

# 7. 手机 App 技术路线建议（结合 Next.js + Fastify + Redis）

这里给一个“能落地的路线”，目标是：**先让猫猫住进手机，再让猫猫学会走路，最后让猫猫学会主动来蹭你** 🐾

## 7.1 推荐路线：PWA 先行，然后 RN/Flutter 或轻封装

### 阶段 1：移动 Web + PWA（最快出“可用陪伴”）

* 把 Cat Café 的 Next.js 前端做成 mobile-first
* 做好：

  * 流式消息（SSE/WebSocket）
  * 富消息渲染框架（第 4 部分）
  * 离线缓存（至少“地铁里能翻历史记录”）
  * 视口适配（借鉴 `100dvh + --doc-height` 这类套路） ([GitHub][15])

### 阶段 2：App 化（推送、后台、语音体验）

如果你们最想要的是“猫猫主动找你”，**推送**基本绕不开更强的原生能力：

* Android：FCM
* iOS：APNs（PWA 在 iOS 上限制多，做 App 更稳）

技术选型倾向：

* 团队 TS/React 熟：React Native
* 团队偏 UI 极致与动画：Flutter
* 想保留 Web UI 最大复用：Tauri/Capacitor 类 Wrapper（但复杂能力还是要写插件）

## 7.2 与现有架构的衔接方式（关键是“统一消息模型”）

建议你们定义一个“跨端一致的消息协议”：

* `Message`：id、chatId、role、content、extra、createdAt、deviceMeta
* `extra`：富组件状态、媒体引用、工具调用记录、记忆引用
* `sync`：增量拉取 + ack；离线时本地排队，在线后补发

Redis 可以继续做“在线态与热数据”，但移动端需要一个“本地库”：

* iOS/Android：SQLite（RN/Flutter 都能用）
* 加密：先做“端上加密存储”，E2EE 作为可选增强（见 5c）

---

# 8. Cat Café 借鉴清单（按优先级排序，含改造方式与工作量）

> 工作量用“人周”粗估，默认你们已有 Next.js/Fastify/Redis 基础设施。

| 优先级 | 借鉴什么                                             | 怎么改造成 Cat Café                                           | 预估工作量                      |
| --- | ------------------------------------------------ | -------------------------------------------------------- | -------------------------- |
| P0  | **“结构化标签/JSON -> 前端组件”富消息管线**（Phone-UI 核心模式）     | 设计 `richBlocks` 协议；实现解析器 + 组件注册表 + `extra` 持久化 + restore | 2-4 人周                     |
| P0  | **Prompt directives + prompt order**（可配置注入）      | 做“场景指令库”：写代码/看电影/读书/散步；按 session 自动注入                    | 1-2 人周                     |
| P0  | **prompt-only 清洁工（regex/过滤器）**                   | 在生成前剥离已消费结构，避免上下文污染与重复生成                                 | 0.5-1 人周                   |
| P1  | **生成拦截器（interceptors）**                          | 把“安全检查、结构化输出约束、记忆注入、工具选择”做成可插拔管线                         | 2-3 人周                     |
| P1  | **“message.extra”式派生状态持久化**（Phone-UI phoneMedia） | 富组件状态一律写进 message.extra，刷新/多端同步可恢复                       | 1-2 人周                     |
| P1  | **场景化 persona preset**（角色卡思路）                    | 把每只猫拆成“基础人格 + 场景姿态”，可热切换并可回滚                             | 1-2 人周                     |
| P2  | **Group chat 的“表现层”**                            | UI 群聊 + orchestrator，多猫各自上下文，避免人格融合                      | 3-6 人周                     |
| P2  | **移动端 viewport 修复套路**（`100dvh` + `--doc-height`） | 移动 Web/PWA 直接借鉴，减少键盘顶起/100vh bug                         | 0.5 人周 ([GitHub][15])      |
| P3  | Termux 本地模式（极客向）                                 | 提供“本地运行开发者模式”，强调隐私与离线                                    | 1-2 人周 ([SillyTavern][16]) |
| P3  | Electron/Tauri 桌面封装思路                            | 作为分发渠道，降低非技术用户安装成本                                       | 2-4 人周 ([GitHub][19])      |

---

# 9. 不借鉴清单（不适合我们，为什么）

1. **“同权脚本”的第三方扩展生态（不加隔离）**
   酒馆的扩展方式很强，但安全边界弱。Cat Café 若走陪伴系统路线，未来会涉及更私密的内容与更敏感的系统能力，插件必须做权限与隔离，否则迟早出事故（数据泄漏/滥用工具调用）。 ([GitHub][5])

2. **群聊用“把多个角色卡字段合并成一个 prompt”**
   官方都明确提醒会导致人格融合、角色混乱，这对“三猫人设”是致命的。请走 orchestrator。 ([SillyTavern][14])

3. **把大量 UI HTML 直接当作聊天正文长期保存**
   Phone-UI 能这么干是因为它本来就是“换皮 UI 实验”。Cat Café 若要长期演进，建议把 UI 表示从正文抽离到 `extra.richBlocks`，正文只保留可读内容，避免未来 UI 重构时历史记录全坏。

4. **过度依赖 regex 解析复杂结构**
   Phone-UI 的 Range API 已经很聪明了，但它仍是在 DOM 上做“外科手术”。你们更适合用 schema 驱动（JSON + 校验 + 版本化），regex 只做清洁与薄解析。

---

# 10. 愿景路线图草案：从现在到“手机上喊猫猫陪看电影”

给一条“可以按里程碑推进”的路线：

## Step 1：定义“场景会话模型”

* Session = { type: movie/reading/walking/coding, start/end, mood, participants(cats), directives }
* 先把“写代码/陪电影/陪读书/日常”四种场景跑通

## Step 2：落地富消息框架（先做 3 个组件就够）

* `ScreenshotCarousel`
* `VoiceNoteBar`
* `ActionCard`（按钮/投票/继续/暂停）

## Step 3：移动 Web 体验打磨（PWA）

* streaming、离线历史、媒体缓存
* viewport 适配（`100dvh + --doc-height`）
* 通知先用“站内提醒”替代系统推送

## Step 4：猫猫主动找你（推送系统）

* 后端定时任务/事件触发（例如：日程、天气、你的习惯）
* push 通知与“轻量开场白库”（alternate greetings 思路） ([SillyTavern][13])

## Step 5：App 化（RN/Flutter/Wrapper 其一）

* 语音输入、后台播放、系统推送、锁屏小组件
* 离线同步升级为“本地库 + 增量 sync”

## Step 6：多猫群聊升级为 orchestrator

* 三猫互相吐槽、互相补充观点
* 但每只猫的人设保持清晰边界

## Step 7：隐私增强包

* 端上加密存储（必做）
* E2EE（可选，取决于你们是否要在服务器侧做检索/RAG）

---

# 11. 结论：值不值得深入？下一步建议

**值得深入**，原因很简单：

* SillyTavern 给你们展示了“可配置 prompt 系统 + 多后端适配 + 角色生态 + 扩展生态”在真实用户规模下的可行形态。 ([SillyTavern][1])
* Phone-UI 更像一枚非常锋利的“设计模式样机”：
  **结构化输出（标签） + 占位符 + 渲染注入 + message.extra 持久化 + prompt 清洁工**，这一套几乎可以原封不动迁移到 Cat Café 的富消息体系上。 ([GitHub][2])

## 下一步（建议你们这周就能干的 3 件事）

1. 做一个 Cat Café 的“富消息 PoC”：
   先只支持 `[CARD]...[/CARD]`（或 JSON block）一种结构，渲染成一个可折叠卡片，并把状态写入 `message.extra`。

2. 做一个“场景 directive 库”最小集合：
   coding / movie / reading / daily 各一段，能被 session 自动注入。

3. 做一个“prompt-only 清洁器”：
   把已消费的结构从上下文剥离，减少模型重复输出与历史污染（直接照 Phone-UI 的 regex 思路做）。 ([GitHub][9])

如果你愿意，我也可以在你们的 Cat Café 语境里，把“富消息 DSL + 组件注册表 + 持久化结构”的接口草案写成一份更像 PRD/技术设计文档的版本（偏工程可落地，不写玄学）。

[1]: https://docs.sillytavern.app/ "https://docs.sillytavern.app/"
[2]: https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/README.md "https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/README.md"
[3]: https://raw.githubusercontent.com/SillyTavern/Extension-Variables/main/manifest.json "https://raw.githubusercontent.com/SillyTavern/Extension-Variables/main/manifest.json"
[4]: https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/public/script.js "https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/public/script.js"
[5]: https://raw.githubusercontent.com/SillyTavern/Extension-Variables/main/index.js "https://raw.githubusercontent.com/SillyTavern/Extension-Variables/main/index.js"
[6]: https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/PLAN.md "https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/PLAN.md"
[7]: https://docs.sillytavern.app/for-contributors/writing-extensions/ "https://docs.sillytavern.app/for-contributors/writing-extensions/"
[8]: https://docs.sillytavern.app/usage/prompts/prompt-manager/ "https://docs.sillytavern.app/usage/prompts/prompt-manager/"
[9]: https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/phone-ui-preset-items.json "https://raw.githubusercontent.com/bal-spec/sillytavern-phone-ui/main/phone-ui-preset-items.json"
[10]: https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/package.json "https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/package.json"
[11]: https://docs.sillytavern.app/usage/characters/ "https://docs.sillytavern.app/usage/characters/"
[12]: https://github.com/malfoyslastname/character-card-spec-v2 "https://github.com/malfoyslastname/character-card-spec-v2"
[13]: https://docs.sillytavern.app/usage/core-concepts/characterdesign/ "https://docs.sillytavern.app/usage/core-concepts/characterdesign/"
[14]: https://docs.sillytavern.app/usage/core-concepts/groupchats/ "https://docs.sillytavern.app/usage/core-concepts/groupchats/"
[15]: https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/public/style.css "https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/public/style.css"
[16]: https://docs.sillytavern.app/installation/android-%28termux%29/ "https://docs.sillytavern.app/installation/android-%28termux%29/"
[17]: https://docs.sillytavern.app/usage/hotkeys/ "https://docs.sillytavern.app/usage/hotkeys/"
[18]: https://en.wikipedia.org/wiki/Tauri_%28software_framework%29 "https://en.wikipedia.org/wiki/Tauri_%28software_framework%29"
[19]: https://github.com/SillyTavern/SillyTavern/discussions/3619 "https://github.com/SillyTavern/SillyTavern/discussions/3619"


----

下面是一份偏“能直接开工”的 **Cat Café 富消息系统（Rich Message Rendering）技术设计草案 v0.1**。我会把它写成工程同事能拿去拆任务、落接口、开 PR 的那种口味。🐾

---

# Cat Café 富消息系统设计草案 v0.1

## 0. 一句话总览

让猫猫（Claude/Codex/Gemini 等后端）在**同一条消息**里同时输出：

* **人类可读**的 Markdown 文本（主内容）
* **机器可读**的 `cc_rich` 结构化块（JSON，描述要渲染的富组件）
* **可选的占位符**（把组件插到消息中的某个位置）

前端解析 `cc_rich`，通过组件注册表把块渲染成卡片、轮播、语音条、diff 预览、按钮等，并把组件状态持久化到 `message.extra.rich`，刷新和跨端同步都能恢复，不需要重新生成。

---

# 1. 目标与非目标

## 1.1 目标（Goals）

1. **富消息可插拔**：新增一个富组件不需要改主渲染器，只要注册一个 renderer。
2. **结构化、可验证**：富内容必须是 JSON（可 schema 校验），拒绝“模型输出一坨 HTML 让前端猜”。
3. **可恢复**：所有富组件的必要状态（媒体 URL、选中索引、按钮状态等）持久化到 `message.extra`。
4. **对模型上下文友好**：富块在进入下一轮 prompt 前会被清洁/压缩，避免 Phone-UI 那种标签反复回流造成格式腐败。
5. **渐进上线**：先支持 2–3 个块类型，走 feature flag，慢慢长出生态。

## 1.2 非目标（Non-goals）

* v0.1 不做“第三方任意 JS 扩展”这种同权插件系统（安全边界太危险）。
* v0.1 不强制 E2EE，但会把数据结构设计成将来能加。
* v0.1 不追求所有消息都富化；只让“需要富组件的场景”走新管线。

---

# 2. 典型用户故事（直接对应你列的场景）

### 协作开发

* 宪宪发一条“review 总结”，里面嵌一个 `DiffCard` + `Approve/Request changes` 按钮。
* 砚砚把测试结果变成 `TestRunCard`，点击能展开失败用例。

### 陪看电影

* 吐槽时插 `ScreenshotCarousel`，气泡里滑动截图。
* 插 `VoiceNote`，猫猫用语音吐槽（或你录音给猫猫）。

### 陪读书

* 插 `QuoteCard`：引用段落 + 页码 + “一键做笔记”按钮。
* 插 `NoteCard`：整理出的要点卡片，可导出。

### 日常

* `DailyRecommendationCard` + `MoodTag`，顺带写入 Hindsight 记忆索引。

---

# 3. 数据模型（Message / RichPayload / Block）

> 这里是整个系统的“地基”。先把它定义干净，后面渲染和同步才不崩。

## 3.1 Message 基础结构（建议）

```ts
export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatRole;
  content: string;            // 人类可读（Markdown）
  createdAt: number;          // epoch ms
  updatedAt?: number;

  // 关键：所有派生/富状态都放 extra，保证可恢复
  extra?: {
    rich?: RichMessageExtra;
    toolCalls?: unknown[];
    memoryRefs?: { id: string; score?: number }[];
    // 未来：e2ee meta / device meta 等
  };
}
```

## 3.2 RichMessageExtra（持久化位置）

```ts
export interface RichMessageExtra {
  schema: 1;

  /**
   * 富块定义（“描述要渲染什么”）
   * 注意：这不是 React state，而是可序列化、跨端可恢复的数据
   */
  blocks: Record<string, RichBlock>;

  /**
   * 富块运行状态（“渲染后产生/更新的状态”）
   * 比如轮播 activeIndex、按钮是否点击过、生成任务是否完成等
   */
  state?: Record<string, RichBlockState>;

  /**
   * 用于插入到正文的位置索引（可选）
   * key: placeholderId, value: blockId
   */
  placements?: Record<string, string>;

  /**
   * 供 prompt 清洁器使用：把富块压缩成一段摘要，喂给下一轮模型
   */
  promptDigest?: string;

  /**
   * 乐观并发控制（跨端编辑/生成写回用）
   */
  rev?: number;
}
```

## 3.3 RichBlock（“是什么块”）

```ts
export type RichBlockType =
  | "image_carousel"
  | "voice_note"
  | "action_card"
  | "diff_card"
  | "quote_card"
  | "test_run_card";

export interface RichBlock {
  id: string;                 // blockId
  type: RichBlockType;
  v: number;                  // block schema version
  title?: string;

  /**
   * 纯数据 props：完全可序列化
   * 不允许放函数、HTML、任意 JS
   */
  props: Record<string, unknown>;

  /**
   * 资源引用（可选）
   * 比如图片 url、音频 url、文件 hash 等
   */
  resources?: Record<string, unknown>;

  /**
   * 生成/解析来源信息（调试 + 观察）
   */
  origin?: {
    byModel?: string;         // e.g. "claude-3.7" / "gpt-5"
    at?: number;
    directive?: string;       // 哪个场景 directive 触发
  };
}
```

## 3.4 RichBlockState（“运行时状态，可恢复”）

```ts
export interface RichBlockState {
  status?: "ready" | "pending" | "failed";
  error?: { code: string; message: string };

  // 可扩展：每个 block type 定义自己需要的 state
  data?: Record<string, unknown>;

  updatedAt?: number;
}
```

---

# 4. LLM 输出格式：Cat Café Rich DSL（建议 v0.1 用“占位符 + JSON fenced block”）

目标：既让模型容易输出，又让你们解析稳。

## 4.1 占位符语法（可选）

模型想在正文中“把组件插到这里”，就写：

```
[[cc:block PLACEHOLDER_ID]]
```

* `PLACEHOLDER_ID`：建议短字符串，比如 `p1`、`imgA`、`diff1`
* 只是一个锚点，真正 blockId 在 JSON 里映射。

## 4.2 JSON 富块承载：固定 fenced block（强制）

消息末尾追加一个 fenced block，语言标识固定为 `cc_rich`：

````
```cc_rich
{
  "schema": 1,
  "placements": { "p1": "b_img_0" },
  "blocks": {
    "b_img_0": {
      "id": "b_img_0",
      "type": "image_carousel",
      "v": 1,
      "title": "电影吐槽截图",
      "props": {
        "items": [
          { "url": "https://...", "alt": "..." },
          { "url": "https://...", "alt": "..." }
        ],
        "activeIndex": 0
      }
    }
  }
}
```
````

规则（很重要）：

1. **正文必须先写完**，`cc_rich` 必须放在消息末尾。
2. `cc_rich` 必须是合法 JSON，不允许注释、尾逗号。
3. `content`（正文）里不允许出现任何 raw HTML 作为富组件载体。
4. 如果模型输出坏 JSON：前端/后端会进入降级模式（只显示正文、忽略富块）。

> 这比纯标签（`[IMG]...[/IMG]`）更稳、更可演进。标签解析只能作为“轻锚点”，别当主协议。

---

# 5. 前端解析与渲染管线（Next.js/React）

## 5.1 关键流程图（落到代码就是这些函数）

1. 接收消息（流式完成后）
2. `extractRichPayload(content)`：提取并移除 `cc_rich` fenced block
3. `validateRichPayload(json)`：schema 校验
4. `mergeIntoMessageExtra(message, payload)`：写入 `message.extra.rich`
5. 渲染正文 Markdown（已移除 cc_rich）
6. `renderRichBlocks(message)`：根据 placeholder 插入组件；没有 placeholder 的块按“附加区”展示

## 5.2 extractRichPayload 实现建议

* 不要用 DOM Range 这种“跨节点手术”来拆 JSON
* 直接在**原始 Markdown 字符串**上提取 fenced block 最稳

伪代码：

````ts
const RICH_FENCE_RE =
  /```cc_rich\s*\n([\s\S]*?)\n```/g;

export function extractRichPayload(raw: string): {
  text: string;                 // 去掉 rich block 的正文
  richJson?: string;            // rich JSON 字符串（未 parse）
} {
  let richJson: string | undefined;

  const text = raw.replace(RICH_FENCE_RE, (_m, json) => {
    richJson = json;
    return ""; // 移除
  }).trimEnd();

  return { text, richJson };
}
````

> 如果你担心模型输出多个 `cc_rich`：只取最后一个，其余忽略，并记一条 telemetry。

## 5.3 schema 校验（Zod/Ajv）

前端和后端建议共用一份 schema（npm package `@catcafe/rich-schema`），避免“前端说合法、后端说不合法”的内耗。

例（Zod 思路）：

```ts
import { z } from "zod";

export const RichBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  v: z.number(),
  title: z.string().optional(),
  props: z.record(z.unknown()),
  resources: z.record(z.unknown()).optional(),
  origin: z.object({
    byModel: z.string().optional(),
    at: z.number().optional(),
    directive: z.string().optional(),
  }).optional(),
});

export const RichPayloadSchema = z.object({
  schema: z.literal(1),
  placements: z.record(z.string()).optional(),
  blocks: z.record(RichBlockSchema),
});
```

---

# 6. 组件注册表（Block Renderer Registry）

你们想要的是：新增一个富块，不要去动消息主渲染器。那就做注册表。

## 6.1 Registry API（前端）

```ts
export interface RichBlockRenderer<TProps = any> {
  type: RichBlockType;
  v: number; // 支持版本

  // 负责把 block 渲染成 React 组件
  render: (ctx: {
    message: ChatMessage;
    block: RichBlock;
    state: RichBlockState | undefined;

    // 更新 message.extra.rich.state 的统一入口
    setState: (patch: Partial<RichBlockState>) => void;

    // 发起需要后端能力的“解析/生成”请求
    resolve: (req: ResolveRequest) => Promise<void>;
  }) => React.ReactNode;

  // 生成 prompt digest（用于下一轮喂给模型，避免上下文污染）
  digest?: (block: RichBlock, state?: RichBlockState) => string;
}

const registry = new Map<string, RichBlockRenderer>();

export function registerRenderer(r: RichBlockRenderer) {
  registry.set(`${r.type}@${r.v}`, r);
}

export function getRenderer(type: string, v: number) {
  return registry.get(`${type}@${v}`) ?? null;
}
```

## 6.2 渲染策略（插入点 vs 附加区）

* 如果 `placements` 存在，并且正文里有 `[[cc:block p1]]`：就在那一行替换成组件
* 没有 placeholder 的 block：统一渲染在消息底部的 “附件/卡片区”

这样不会强迫模型每次都给占位符，系统也能工作。

---

# 7. 解析/生成管线（Resolver）：把“描述”变成“可用资源”

很多块需要后端能力，比如：

* 图片生成（prompt -> urls）
* 语音合成（text -> audioUrl）
* diff 解析（patch -> 高亮结构）

建议做统一 resolver API，避免每个组件自己乱打 endpoint。

## 7.1 ResolveRequest/Response

```ts
export type ResolveKind =
  | "image_generate"
  | "tts_generate"
  | "diff_render"
  | "fetch_url_preview";

export interface ResolveRequest {
  kind: ResolveKind;
  messageId: string;
  blockId: string;
  payload: Record<string, unknown>;
}

export interface ResolveResponse {
  ok: boolean;
  resources?: Record<string, unknown>;
  statePatch?: Partial<RichBlockState>;
  error?: { code: string; message: string };
}
```

## 7.2 Fastify API 设计

* `POST /api/rich/resolve`

  * 校验用户权限（chatId ownership）
  * 校验 block type/kind 是否允许
  * 调用对应后端能力（你们已有适配层）
  * 写回 `message.extra.rich.blocks[blockId].resources` 与 `state`

> 核心原则：**解析/生成的结果要写回消息**，这样跨端才能恢复。

---

# 8. Prompt 指令与“上下文清洁器”（避免富块回流污染）

这是 Phone-UI 经验里最值钱的部分：不清洁，上下文会发霉。

## 8.1 场景 directive（写给模型看的）

每个场景一个 directive，强制模型输出格式：

* 正文用 Markdown
* 如需富组件：追加 `cc_rich` JSON
* `cc_rich` 中只写数据，不写 HTML
* 如果引用资源：优先写“意图”（prompt/text），让系统 resolver 去生成 url

示例（陪看电影 directive）：

* “你可以插入 `image_carousel` 和 `voice_note`”
* “image_carousel 的 items 可以先留 prompt，系统会生成 urls”
* “不要重复输出上一次的 cc_rich；历史 rich 信息会由系统摘要提供”

## 8.2 清洁器策略（生成下一轮 prompt 前）

你们在 prompt assembly 时，对历史消息做一遍“富块处理”：

* 从 `message.content` 移除 `cc_rich` fenced block（如果还残留）
* 把 `[[cc:block ...]]` 占位符替换成简短文本，比如：

  * `（附：图片轮播 x3）`
  * `（附：语音条 x1）`
* 追加 `message.extra.rich.promptDigest`（若存在）作为补充摘要
  digest 示例：`[image_carousel#b_img_0: 3 images, active=1]`

这样模型既知道发生过什么，又不会把 JSON 原样带回输出。

---

# 9. 安全与隐私（必须先写在设计里，省得以后补地基）

## 9.1 安全红线

1. **永不渲染模型提供的 HTML**（富块只认 JSON + 自己的 React 组件）。
2. **URL 白名单/代理**：图片、音频等资源建议走你们的媒体代理（防止用户 IP 泄漏、避免混合内容、便于缓存）。
3. **严格 schema 校验**：未知字段可保留但不执行；不合法直接忽略。
4. **CSP**：禁止 inline script，组件内部也不要用 `dangerouslySetInnerHTML`（除非是可信渲染如 Mermaid，且要 sanitize）。

## 9.2 隐私与本地化启发（对齐“陪伴系统”）

* 客户端要做离线缓存（IndexedDB），至少能翻历史
* 媒体资源如含隐私，支持“仅本设备可见”的标记（将来上 E2EE 时好迁移）
* `message.extra.rich` 是最敏感的那部分（包含音频、图片、按钮点击等行为痕迹），你们后端日志不要把它原样打出来

---

# 10. v0.1 建议先做的 3 个块（够用且能验证管线）

## 10.1 `action_card`（最容易验证端到端）

用途：审批按钮、继续/暂停、投票

props 示例：

```json
{
  "id": "b_act_0",
  "type": "action_card",
  "v": 1,
  "props": {
    "text": "要不要继续看这一段？",
    "actions": [
      { "id": "continue", "label": "继续", "variant": "primary" },
      { "id": "pause", "label": "暂停", "variant": "secondary" }
    ]
  }
}
```

state 存：

* 哪个 action 被点了
* 是否已发送到后端

## 10.2 `image_carousel`（复刻 Phone-UI 的“体验提升”）

props 支持两种形态：

* 已有 urls：直接渲染
* 只有 prompt：resolver 生成 urls 后写回

```json
"props": {
  "items": [
    { "prompt": "电影里主角翻白眼的截图风格插画" },
    { "url": "https://media-proxy/..." }
  ],
  "activeIndex": 0
}
```

## 10.3 `voice_note`（陪伴感很强）

```json
"props": {
  "text": "这段台词也太中二了吧…",
  "voice": "yan-yan",
  "autoplay": false
}
```

resolver 生成 `audioUrl`，写入 `resources.audioUrl`。

---

# 11. 前后端存储与同步（你们是 Next.js + Fastify + Redis）

你们现在 Redis 存消息，我建议 v0.1 仍旧沿用，但要加两点，保证将来不难迁移：

## 11.1 消息写回策略（生成/点击等都会更新 extra）

* 所有富块写回都走 `PATCH /api/chats/:chatId/messages/:messageId`
* 携带 `ifMatchRev`（乐观锁），避免两端同时写把状态覆盖

## 11.2 客户端离线缓存

* IndexedDB 存 message 列表与 `extra.rich`
* 在线时拉增量：按 `updatedAt` 或 `rev` 拉
* 冲突策略：以服务器为准，但保留本地“待提交 patch 队列”

> 这一步做完，你们地铁里翻对话就稳了，陪伴感也更像“随身带着猫”。

---

# 12. 可观测性与失败降级

## 12.1 Telemetry（最少要有）

* rich payload parse success/fail（错误类型：bad_json、schema_invalid、too_large）
* resolver success/fail（超时、额度、后端错误）
* renderer fallback（找不到 renderer 版本）

## 12.2 降级策略（用户永远要能读到正文）

* rich 解析失败：只显示正文 + 一个小提示（开发模式可展开错误）
* resolver 失败：块显示 `failed` 状态，提供“重试”按钮
* renderer 缺失：显示 `Unsupported block type: xxx@v` 的灰卡片（可复制原始 JSON）

---

# 13. 上线计划（最少风险的推进方式）

## 13.1 Feature Flag

* `rich_messages_enabled`：全局开关
* `rich_block_types_enabled`: 允许的 type 列表（白名单）

## 13.2 Rollout 顺序

1. 内部（你们三猫开发环境）只开 `action_card`
2. 加 `image_carousel`
3. 加 `voice_note`
4. 再考虑 `diff_card/test_run_card`（这些更偏开发工具场景）

---

# 14. 工作拆解（按模块拆，方便你们排人）

## P0（先跑通端到端）

1. **协议与 schema 包**：`@catcafe/rich-schema`（Zod/Ajv）
2. **extractRichPayload + validate**（前端）
3. **message.extra.rich 持久化写回**（Fastify patch API）
4. **Renderer registry + 3 个块**（action/image/voice）
5. **prompt 清洁器（server side prompt assembly）**

## P1（让体验变“产品”）

1. Resolver API：`/api/rich/resolve`
2. 媒体代理与缓存策略
3. IndexedDB 离线缓存 + 增量同步
4. Scene directives（coding/movie/reading/daily）

## P2（长远演进）

1. 多猫 orchestrator 与群聊表现层
2. E2EE 评估与数据层改造（可选）
3. 更细粒度的插件/扩展沙箱（不是同权 JS）

---

# 15. 附：一条“陪看电影”的完整示例（模型输出长这样）

**模型返回：**

````markdown
哈哈这段我给 8 分，剩下 2 分扣给那个毫无必要的慢镜头 🤨

[[cc:block p1]]

顺便我用语音吐槽一小句，别被邻居听见。
[[cc:block p2]]

```cc_rich
{
  "schema": 1,
  "placements": { "p1": "b_img_0", "p2": "b_vn_0" },
  "blocks": {
    "b_img_0": {
      "id": "b_img_0",
      "type": "image_carousel",
      "v": 1,
      "title": "这段的表情包候选",
      "props": {
        "items": [
          { "prompt": "电影主角翻白眼的一瞬间，做成手机截图风格" },
          { "prompt": "反派尴尬沉默的特写，做成表情包截图风格" }
        ],
        "activeIndex": 0
      }
    },
    "b_vn_0": {
      "id": "b_vn_0",
      "type": "voice_note",
      "v": 1,
      "props": {
        "text": "我宣布这段台词进入年度中二榜前三。",
        "voice": "xian-xian",
        "autoplay": false
      }
    }
  }
}
````

```

**系统行为：**
- 前端提取 `cc_rich`，写入 `message.extra.rich`
- 渲染正文时把 `[[cc:block p1]]` 替换成轮播组件
- `image_carousel` 的 items 只有 prompt，没有 url：触发 resolver 生成图片，写回 resources
- `voice_note` 触发 TTS 生成音频 url，写回 resources
- 下一轮 prompt 时，清洁器只喂给模型：  
  `（附：图片轮播 2 张；语音 1 条）`

---

## 你想让我下一步怎么继续

我可以把这份草案再向前推进两步，直接给你们“可开 PR 的模板”：

1) **TypeScript 类型 + Zod schema 的完整文件结构**（放到一个 `packages/rich-schema`）  
2) **Next.js 前端的消息渲染器改造 diff**（伪 PR：哪些文件加什么函数、组件怎么挂 registry、状态怎么 patch 回服务端）

你更想先落哪一块？  
- A：先把 `action_card` 跑通（最快验收）  
- B：先做 `image_carousel`（最能展示陪伴感）  
- C：三块一起做（稍重，但一次打通管线）
::contentReference[oaicite:0]{index=0}
```


----

行，砚砚开工完毕 ✅
我已经把你丢来的 `packages.zip` 解开并把你点名的这些关键路径都读了一遍（`MessageStore / RedisMessageStore / AgentRouter / route-strategies / ChatMessage / mcp-server`），然后把**技术设计草案重写成 v0.2**，严格“基于 Cat Café 现有架构”，不再是假设项目。

📄 **技术设计草案 v0.2（Markdown）下载：**
[Download cat-cafe-rich-blocks-design-v0.2.md](sandbox:/mnt/data/cat-cafe-rich-blocks-design-v0.2.md)

---

## 你问的 GitHub 那句：我能不能看到你们 cat-* 两个仓？

**我现在不能直接“在线浏览”你们 GitHub 上的私有仓内容**（除非你把仓内容提供给我，或在这个环境里有对应的仓访问权限/连接）。
但你这次给的 `packages.zip` 已经把 `packages/*` 关键实现都带过来了，所以我能**完整基于现有代码**把 v0.2 写出来（也就是上面这个文件）。

---

## v0.2 我做了哪些“对齐现实”的关键修正（超短提要）

（详细都在文档里，这里给你一个“不会跑偏”的提纲）

1. **消息模型不重造**
   直接在现有 `StoredMessage` 上加 `extra.rich`，并同步让 `RedisMessageStore` 用 Hash 多存一个 `extra` 字段，做到刷新可恢复。

2. **猫猫不是 HTTP 后端**
   设计里不再类比酒馆 adapter。三猫是 CLI 子进程 + NDJSON 流，富块生成要走：

   * Opus: **MCP tool**（最自然）
   * Codex/Gemini: **HTTP callback**（McpPromptInjector 注入 curl 指令）+ 文本标签 fallback

3. **富块来源不只靠“模型在文本里吐标签”**
   主线是：新增 `cat_cafe_create_rich_block` MCP 工具 + `/api/callbacks/create-rich-block` 回传端点，富块可以在流式过程中生成并即时渲染。

4. **挂点全都挂在你指定的真实代码点上**

   * 清洁/提取：`route-strategies.ts`（done 后落库前）
   * 渲染入口：`ChatMessage.tsx`（不是不存在的 `components/chat/`）
   * MCP 能力：`packages/mcp-server/src/tools/callback-tools.ts`

5. **不引入新 package，不额外发明 @catcafe/rich-schema**
   类型放 `@cat-cafe/shared`，避免分裂。

---

如果你想让我把这份 v0.2 再“压缩成 PR 顺序 checklist”（每个文件改哪几行，改动点清单），我也能直接按你们仓的实际文件路径列出来，方便你一条条开 PR 🐾

----

# Cat Café 富消息（Rich Blocks）技术设计草案 v0.2（基于现有代码）

> 砚砚版，面向落地实现  
> 基于你给的 `packages.zip` 读码结果：`MessageStore / AgentRouter / route-strategies / ChatMessage / mcp-server` 全部按现状对齐。  
> 目标：在**不重写架构**的前提下，把“LLM 输出结构化指令 → 前端渲染富组件”的能力塞进 Cat Café，且兼容我们“CLI 子进程 + NDJSON 流 + MCP/Callback”的现实世界。

---

## 0. 先对齐现状（我已读到的关键事实）

### 0.1 消息模型和存储（必须在此基础上扩展）

- `packages/api/src/domains/cats/services/MessageStore.ts`
  - `StoredMessage` 现有字段：  
    `id, threadId, userId, catId|null, content, contentBlocks?, metadata?, mentions, timestamp, deletedAt?, deletedBy?, _tombstone?`
  - 删除语义：软删 `deletedAt/deletedBy`，硬删会清空 `content/contentBlocks/metadata/mentions` 并置 `_tombstone`。
- `packages/api/src/domains/cats/services/RedisMessageStore.ts`
  - Redis Hash 保存消息详情，字段：`contentBlocks`/`metadata` JSON 字符串化；TTL 默认 7 天。

结论：**不要新造 ChatMessage 模型**。在 `StoredMessage` 上加 `extra.rich` 即可，连 Redis 都按现有 Hash 多加一个字段最自然。

### 0.2 猫猫调用方式（不是 HTTP 后端）

- `packages/api/src/domains/cats/services/*AgentService.ts`
  - Opus/Claude：`claude -p ... --output-format stream-json`，支持 MCP（通过 `--mcp-config` 指向 `packages/mcp-server/dist/index.js`）。
  - Codex：`codex exec --json ...`，NDJSON 事件流。
  - Gemini：`gemini -p ... -o stream-json`（另有 antigravity adapter）。
- `packages/api/src/domains/cats/services/invoke-single-cat.ts`
  - 通过 env 注入 `CAT_CAFE_API_URL / CAT_CAFE_INVOCATION_ID / CAT_CAFE_CALLBACK_TOKEN` 给子进程，供 MCP/Callback 回传鉴权。

结论：富块方案必须适配「子进程流式输出」和「MCP 回传/HTTP callback」两条路。

### 0.3 Prompt 组装与清洁点（你的“清洁器要加在这里”是对的）

- `packages/api/src/domains/cats/services/route-strategies.ts`
  - 汇总 stream text 成 `textContent`，最后 `sanitizeInjectedContent(textContent)` 再落库。
  - 这里就是富块“提取 + 剥离 + 合并 + 落库”的黄金挂点。

### 0.4 前端渲染挂点（路径要修正）

你写的 `packages/web/src/components/chat/` 在当前仓里不存在；现有消息渲染主入口是：

- `packages/web/src/components/ChatMessage.tsx`
- `packages/web/src/components/ChatContainer.tsx`
- `packages/web/src/hooks/useAgentMessages.ts`（Socket 流消息处理）
- `packages/web/src/hooks/useChatHistory.ts`（历史拉取映射）

结论：富块 renderer registry 应挂在 `ChatMessage.tsx` 这一层，store 里加 appendRichBlock 即可。

### 0.5 MCP Server 现状

- `packages/mcp-server/src/tools/callback-tools.ts`
  - 已有 `cat_cafe_post_message` 等工具，都是通过 `/api/callbacks/*` 回传到 API。

结论：新增 `cat_cafe_create_rich_block` 工具是顺手的，走同样回传通道即可。

---

## 1. v0.2 目标与非目标

### 1.1 目标

1. **让猫猫能创建“富块”**：卡片、diff 预览、测试结果、媒体轮播等。
2. **富块可持久化**：刷新后仍能恢复渲染，不依赖重新生成。
3. **不推翻现有消息模型**：在 `StoredMessage` 上扩展，不造新 package、不改现有消息路由主干。
4. **兼容三猫架构**：
   - Opus：优先用 MCP tool 创建富块（最自然）。
   - Codex/Gemini：用 HTTP callback（McpPromptInjector 注入 curl 指令）或文本指令 fallback。

### 1.2 非目标（先别贪）

- 不做完整插件沙盒系统（SillyTavern 那套先当参考，Cat Café v0.2 只做内部 registry）。
- 不做“富块里任意 JS/HTML 注入”。富块只允许**受控数据结构**，由前端 React 组件渲染，避免 XSS。
- 不强依赖模型输出特定标签。标签仅作为 fallback。

---

## 2. 数据结构设计（放 @cat-cafe/shared，不要新包）

### 2.1 Shared: RichBlock 类型（最小可用 + 可扩展）

新增：`packages/shared/src/types/rich.ts`，并在 `types/index.ts` 导出。

建议 v0.2 先支持 4 类块（覆盖你列的场景 80%）：

- `card`：通用信息卡（标题、要点、严重级别、字段表）
- `diff`：代码 diff（文件路径 + unified diff 文本）
- `checklist`：任务清单（用于 review、陪读书的重点列表）
- `media_gallery`：图片轮播（urls + caption）  
  （音频 `audio` 可以 v0.3 再加，先把 schema 留好）

示例（草案）：

```ts
export type RichBlockKind = 'card' | 'diff' | 'checklist' | 'media_gallery';

export interface RichBlockBase {
  id: string;            // message-local stable id
  kind: RichBlockKind;
  v: 1;
}

export interface RichCardBlock extends RichBlockBase {
  kind: 'card';
  title: string;
  bodyMarkdown?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  fields?: Array<{ label: string; value: string }>;
}

export interface RichDiffBlock extends RichBlockBase {
  kind: 'diff';
  filePath: string;
  diff: string;          // unified diff
  languageHint?: string; // optional
}

export interface RichChecklistBlock extends RichBlockBase {
  kind: 'checklist';
  title?: string;
  items: Array<{ id: string; text: string; checked?: boolean }>;
}

export interface RichMediaGalleryBlock extends RichBlockBase {
  kind: 'media_gallery';
  title?: string;
  items: Array<{ url: string; alt?: string; caption?: string }>;
}

export type RichBlock =
  | RichCardBlock
  | RichDiffBlock
  | RichChecklistBlock
  | RichMediaGalleryBlock;

export interface RichMessageExtra {
  v: 1;
  blocks: RichBlock[];
}
```

### 2.2 API: StoredMessage 扩展（核心约束）

在 `packages/api/src/domains/cats/services/MessageStore.ts` 的 `StoredMessage` 上新增：

```ts
export interface StoredMessageExtra {
  rich?: RichMessageExtra;
  // future: phoneUi?: {...}, reactions?: {...}, etc.
}

export interface StoredMessage {
  ...
  extra?: StoredMessageExtra;
}
```

注意：**不要新造 ChatMessage**。前端已有自己的 `ChatMessage` 类型，但只需要映射并补上 `extra`。

---

## 3. 富块生成管线（两条腿走路：MCP 优先，文本 fallback）

### 3.1 路线 A（推荐）：猫通过 MCP/Callback 主动创建富块

#### 3.1.1 新增 MCP 工具

在 `packages/mcp-server/src/tools/callback-tools.ts` 增加工具：

- name: `cat_cafe_create_rich_block`
- input: `{ block: RichBlock, clientBlockId?: string }`
- handler: `callbackPost('/api/callbacks/create-rich-block', ...)`

沿用现有 `sendCallbackRequest(..., { enableOutbox: true })`，确保离线重试友好。

#### 3.1.2 新增 API callback 端点

在 `packages/api/src/routes/callbacks.ts` 加：

- `POST /api/callbacks/create-rich-block`

流程：

1. `registry.verify(invocationId, callbackToken)` 校验。
2. 拿到 `record.threadId / record.catId / record.userId`。
3. 将富块放入一个 **RichBlockBuffer**（后面定义）中，key 为：
   - `(threadId, userMessageId, catId)`  
     其中 `userMessageId` 需要从 registry record 获取。

所以：需要小改 `InvocationRegistry`，让 record 记住 `userMessageId`。

- 修改 `InvocationRegistry.create(...)` 接受 `userMessageId` 并存入 record。
- 修改 `invoke-single-cat.ts` 在 `registry.create(...)` 时传入 `routeOptions.currentUserMessageId`（route-strategies 已有这个）。

#### 3.1.3 实时 UI 更新（不等落库）

callback 端点在成功写入 buffer 后，立刻通过 websocket 广播一个 `system_info`：

```ts
socketManager.broadcastAgentMessage({
  type: 'system_info',
  catId: record.catId,
  content: JSON.stringify({
    type: 'rich_block',
    threadId: record.threadId,
    userMessageId: record.userMessageId,
    block,
  }),
  timestamp: Date.now(),
}, record.threadId);
```

前端 `useAgentMessages.ts` 解析到 `{type:'rich_block'}` 后，把 block append 到当前 cat 的 active message 上（下面前端部分详述）。

---

### 3.2 路线 B（fallback）：从猫的文本输出中提取富块指令

适用场景：

- Codex/Gemini 因环境限制无法回调。
- 模型一时忘了用工具，但能输出结构化标记。

#### 3.2.1 指令语法（建议用 fenced code，避免和 Markdown 冲突）

建议格式：

````
```cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"..."}]}
```
````

优点：

- 解析简单、可跨多行。
- 人类也能读，模型也更不容易乱括号。

#### 3.2.2 提取和剥离挂点

在 `route-strategies.ts` 中，现有流程是：

- stream 汇总 `textContent`
- `sanitizeInjectedContent(textContent)`
- `messageStore.append(...)`

我们在 **sanitize 之后、append 之前** 增加：

- `extractRichFromText(sanitizedText)` → `{ cleanText, richExtra? }`

把 richExtra 合并到 message 的 `extra.rich`，并把 cleanText 存回 `content`。

注意：v0.2 可以先做“结束后提取”，流式期间用户会看到那段 fenced block。  
如果想更丝滑，v0.3 再做“流式过滤器”（需要跨 chunk state machine）。

---

## 4. RichBlockBuffer（把“工具创建的富块”挂到最终消息上）

### 4.1 为什么需要 buffer

route-strategies 现在是在 “done 后一次性 append cat message”。  
工具回调发生在流中途，**当时还没有 StoredMessage.id** 可以 attach。

所以我们用 buffer 先按 invocation 维度暂存，等最终 append 时合并进去。

### 4.2 形态（v0.2 先做内存版）

新增 `packages/api/src/domains/cats/services/RichBlockBuffer.ts`：

- `add(threadId, userMessageId, catId, block, clientBlockId?)`
- `consume(threadId, userMessageId, catId): RichBlock[]`（取出并清空）
- 内部 `Map<string, {...}>`，key 可用 `${threadId}:${userMessageId}:${catId}`。
- 增加 TTL 清理（比如 15 分钟）防止泄漏。
- idempotency：复用 `InvocationRegistry.claimClientMessageId` 的集合，存 `rb:${clientBlockId}`。

### 4.3 route-strategies 合并点

在每只猫 `done` 后准备落库时：

1. `const buffered = richBuffer.consume(threadId, currentUserMessageId, catId)`
2. `const extracted = extractRichFromText(...)`（如果启用 fallback）
3. 合并规则：
   - `blocks = [...buffered, ...extracted]`（保持“工具优先，文本补充”）
   - 去重：按 `block.id` 去重（后来的覆盖前面的，或者直接忽略重复，选一种）
4. `messageStore.append({ ..., extra: { rich: { v:1, blocks }}})`

---

## 5. 持久化（MessageStore / RedisMessageStore 的必要改动）

### 5.1 MessageStore（内存）

- `StoredMessage` 新增 `extra?: ...` 后，`append`/`getById` 等自然会带着走。
- `hardDelete` 需要 `delete msg.extra`。

### 5.2 RedisMessageStore（必须）

- `append` 的 `hset(hashKey, {...})` 增加字段：
  - `extra: msg.extra ? JSON.stringify(msg.extra) : ''`
- `getById` / `hydrateMessages` 增加 `safeParseExtra(d['extra'])`
- `hardDelete` 也要把 `extra: ''` 清空

这样保证刷新后富块不会“再生成”，而是从持久化恢复。

---

## 6. 前端渲染与状态更新（基于现有 ChatMessage）

### 6.1 前端类型扩展

- `packages/web/src/stores/chat-types.ts`
  - `ChatMessage` 增加 `extra?: { rich?: RichMessageExtra }`

- `useChatHistory.ts` 拉历史时映射增加：
  - `...(m.extra ? { extra: m.extra } : {})`

### 6.2 store 增加 appendRichBlock

在 `chatStore.ts` 增加：

- `appendRichBlock(messageId, block)`  
  实现类似 `appendToolEvent`，把 block push 到 `message.extra.rich.blocks`（并保证结构初始化）。

### 6.3 useAgentMessages 增加 system_info 富块处理

在 `msg.type === 'system_info'` 的 JSON parse 分支里新增：

- 若 `parsed.type === 'rich_block'`：
  1. 找到 `activeRefs.current.get(msg.catId)` 对应的 messageId  
     - 若不存在，创建一个 assistant message（content ''）并 setStreaming(true)
  2. 调 `appendRichBlock(messageId, parsed.block)`
  3. `consumed = true`（不要显示系统消息）

这样富块会在流式过程中即时插入到正在说话那条消息里。

### 6.4 ChatMessage 渲染挂点

在 `packages/web/src/components/ChatMessage.tsx`：

- 现有结构：header + contentBlocks/markdown + tool events
- 新增 `<RichBlocks blocks={message.extra?.rich?.blocks} />`

#### 6.4.1 RichBlocks 组件和 renderer registry

新增目录：

- `packages/web/src/components/rich/`
  - `RichBlocks.tsx`
  - `renderers.tsx`

`renderers.tsx`：

```ts
export const RENDERERS: Record<RichBlockKind, (b: RichBlock) => JSX.Element> = {
  card: (b) => <CardBlock block={b as RichCardBlock} />,
  diff: (b) => <DiffBlock block={b as RichDiffBlock} />,
  checklist: (b) => <ChecklistBlock block={b as RichChecklistBlock} />,
  media_gallery: (b) => <MediaGalleryBlock block={b as RichMediaGalleryBlock} />,
};
```

关键安全点：**不要渲染 block 里的 raw HTML**，只用 React 组件渲染受控字段。

---

## 7. API 返回与兼容性

### 7.1 GET /api/messages

`packages/api/src/routes/messages.ts` 里 TimelineItem 目前是手动映射字段。  
把 `extra` 加进去即可：

```ts
...(m.extra ? { extra: m.extra } : {}),
```

TimelineItem 结构已经允许 `[key: string]: unknown`，所以向后兼容很好。

### 7.2 导出

`packages/api/src/routes/export.ts` 现在只导出 `formatMessage(msg)` 的文本。  
v0.2 可以先不动。  
v0.3 再加：rich blocks 导出为附录（比如 “(附) Diff: filePath …”）。

---

## 8. 猫猫侧使用规范（避免“只有 UI 没有字”）

为避免 rich blocks 不进上下文导致“猫自己也忘了画了啥”，约束：

1. **每次创建富块，正文里至少留一句文本说明**（例如“我附上一个 diff 卡片”）。
2. 富块内容尽量不要巨大（diff 适度截断，给“展开”按钮以后做）。

---

## 9. 变更清单（按落地顺序，工作量用 S/M/L 表示，不给时间承诺）

1. **Shared types 增加 rich.ts 并导出**（S）
2. **API StoredMessage 增加 extra.rich**（S）
3. **RedisMessageStore 支持 extra 存取 + hardDelete 清空**（M）
4. **RichBlockBuffer（内存版 + TTL + 去重）**（M）
5. **InvocationRegistry 记录 userMessageId（create 参数扩展）**（S）
6. **invoke-single-cat / route-strategies 传递 userMessageId**（S）
7. **callbacks.ts 新增 /create-rich-block + websocket system_info 广播**（M）
8. **mcp-server 新增 cat_cafe_create_rich_block 工具**（S）
9. **web: chat-types + store appendRichBlock + useAgentMessages 处理 rich_block**（M）
10. **web: ChatMessage 渲染 RichBlocks + 最小 4 个 renderer**（M）
11. **fallback 文本提取（可选 v0.2 后半）**（M）

---

## 10. 这版设计刻意避开的坑（回应你给我的“不要借鉴/不要过度设计”）

- 不引入新 package（没有 `@catcafe/rich-schema`）。
- 不把 cats 当 HTTP LLM backend，不做“adapter 层复刻酒馆”。
- 不强依赖 Zod 在 shared 做全套验证（API/Redis 用 `safeParse` 型守卫即可）。
- 不做全插件系统和沙盒隔离（先把“富块”跑通，后面再谈扩展生态）。
- 不做富块里任意 HTML/JS 注入，避免 XSS 和权限绕过。

---

## 11. v0.2 结论

值得做，而且可以很“贴地”地做：  
**主线走 MCP/Callback 工具创建富块 + buffer 合并落库 + 前端 registry 渲染**，这条链路和 Cat Café 现有“CLI + MCP 回传”结构完美贴合。  
文本标签提取做 fallback 就够，不抢主线。

🐾 到这里，砚砚已经把“先读代码再设计”的债还清了，接下来就是把这些改动拆成 PR 了。
