---
feature_ids: []
topics: [frontend, design-system, refactoring, theming, i18n, enterprise]
doc_kind: research
created: 2026-03-24
---

# 前端设计系统组件化重构 — GPT Pro 咨询

> 委托人：布偶猫/宪宪（Cat Café 主架构师）  日期：2026-03-24

## Part 1: 发给云端模型的提示词

> 直接复制以下内容发给 GPT Pro (o3)

---

你好，我们是 Cat Café，一个 AI 多智能体协作平台（开源项目）。前端技术栈：**Next.js 15 + TypeScript + Tailwind CSS 4 + Zustand**，无第三方 UI 组件库（全部自己写）。

### 背景

我们的前端目前有 **236 个 TSX 组件文件**，按 feature 组织（chat, game, signals, mission-control, audit 等）。**但没有设计系统组件层**——没有共享的 Button、Input、Card、Modal 等 primitives，每个 feature 模块各写各的。

我们考虑做一次组件化重构的原因：
1. **Dark mode 做不了**：CSS 变量定义了 light + dark 值，Tailwind config 也映射到了 CSS vars，但实际组件里 **875+ 处硬编码颜色**（`#hex`、`bg-white`、`text-gray-700` 等），变量形同虚设
2. **企业 fork 定制成本高**：想让企业用户 fork 后能低成本换皮肤、改术语（比如 "thread" → "conversation"），目前做不到
3. **无 i18n**：硬编码中文，无国际化框架
4. **无 ThemeProvider**：没有运行时主题切换机制

### 我们已有的基础（不是从零开始）

| 已有 | 详情 |
|------|------|
| CSS 变量体系 | `:root` 定义了 `--bg-app`, `--text-primary`, 5 种品牌色（opus/codex/gemini/dare/cocreator），`[data-theme="dark"]` 有完整覆盖 |
| Tailwind token 映射 | `tailwind.config.js` 里品牌色和狼人杀主题都通过 `var(--xxx)` 引用 CSS 变量 |
| 主题化成功案例 | 狼人杀（Werewolf）模块有 **30+ 语义 token**（`--ww-bg-base`, `--ww-text-main`, `--ww-accent-danger` 等），通过 `data-theme="werewolf-cute"` + `data-phase="day|night"` 实现了完整主题切换 |
| 品牌色注册表 | `cat-config.json` 定义每只猫的 `color: { primary, secondary }`，前端通过 `useCatData()` hook 动态获取 |
| 设计规范文档 | `docs/design-system.md`（烁烁/暹罗猫维护），定义了配色、气泡形状、头像规范 |

### 我们的初步方案（三层蛋糕）

```
Layer 3: Theme + Terminology + i18n（企业定制层）
         ↑
Layer 2: Primitive Components（UI 原子层，~15 个 primitive）
         ↑
Layer 1: Design Token Foundation（语义 token 层）
```

- **Layer 1**：语义 token（surface, text-primary, border-default, accent-*, success/warning/danger），纯增量，codemod 逐模块替换硬编码色
- **Layer 2**：提取 Button/Input/Card/Badge/Modal/Tabs/Dialog 等 primitive，考虑 shadcn/ui 思路 + Radix headless
- **Layer 3**：ThemeProvider + useTheme + next-intl + terminology config JSON

### 请帮我们深度分析以下问题

**1. 增量重构策略**
- 875+ 处硬编码颜色，236 个文件——怎么在不改出一堆 bug 的前提下逐步迁移？
- 有没有成熟的 codemod 工具/方案可以自动化 `bg-white → bg-surface`、`text-gray-700 → text-muted` 这类替换？
- 模块迁移的优先级怎么排？从最简单的开始还是从最核心的开始？

**2. shadcn/ui vs 自建 vs Radix headless**
- 我们已有 236 个自写组件 + 独特的猫咖美学（圆角气泡、品牌色、动效）
- shadcn/ui 的 copy-paste 模式对我们来说是加速器还是包袱？
- 直接用 Radix headless + 自己的 Tailwind styling 是否更适合？
- 有没有第四种选择更适合我们的场景？

**3. 术语/品牌抽象层**
- 让 fork 者把 "thread" 改成 "conversation"/"channel"，品牌色从猫咖换成企业色——最佳实践是什么？
- next-intl 够用还是需要更灵活的方案（比如 react-intl + 自定义 terminology provider）？
- 品牌资产（logo、头像、配色方案）的可配置化有什么成熟模式？

**4. 视觉回归测试**
- 大规模样式迁移怎么防 regression？
- Storybook + Chromatic vs Playwright visual comparison vs 其他方案——哪个更适合我们的场景？
- 成本/收益分析？

**5. 企业级 fork 友好度**
- 开源项目怎么设计让企业 fork 后低成本定制？
- 有什么成功案例值得学习？（类似 GitLab、Mattermost、Rocket.Chat 这种"开源 + 企业版"的模式？）
- theme + branding + terminology 三层定制，哪些放 config JSON，哪些放 i18n，哪些需要代码级别的抽象？

**6. 风险评估**
- 这个重构的工程量大概是什么量级？（人天/人周估算）
- 最大的技术风险和陷阱是什么？
- 有没有"做了半截比不做更糟"的场景？怎么避免？

### 输出要求
- 每个结论请标注是"业界通用最佳实践"、"基于你对我们项目的理解推断"、还是"推测/需验证"
- 如果你觉得我们的三层蛋糕方案有盲区，请指出
- 如果有更好的架构方案，欢迎推翻我们的方案

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴 GPT Pro 回答到这里

我先给总判断。

**[基于你们项目的理解推断]** 这次重构值得做，但我会把你们的“三层蛋糕”改成“五层夹心”：Layer 0 治理与门禁，Layer 1 tokens，Layer 2 primitives，Layer 3 patterns/composites，Layer 4 theme/branding/terminology/i18n。Tailwind 4 已经把 theme variables 明确当成设计 token 的 API，GitLab Pajamas 也把 token 分成 constant、semantic、contextual，并且在代码里优先 components，其次 utilities，最后 custom properties。你们现在的方向没错，盲区在于少了“约束层”和“高频组合层”。 ([tailwindcss.com][1])

**[基于你们项目的理解推断]** 另一个盲区是，品牌不要只抽颜色。猫咖气质其实是颜色、圆角/气泡、边框厚薄、阴影层级、动效节奏一起合唱。Werewolf 模块已经证明“语义 token + `data-theme`/`data-phase`”这条路能跑，但我只会把它当 contextual token 样板，不会把每个 feature 都做成一套独立小王国。GitLab 的 contextual token 模式也说明，contextual 应该是例外层，不是默认层。 ([design.gitlab.com][2])

## 1. 增量重构策略

**[业界通用最佳实践]** 第一步不是提 Button，而是“止血”。先在 CI 里禁止新出现的 raw hex、`bg-white/text-gray-*` 这类非语义类，以及 feature 内继续新增伪 primitive。Tailwind 4 支持用 `@theme` 定义 token、用 `@custom-variant` 做 `data-theme` 变体、用 `@source` 显式纳管设计系统源码；ESLint 和 Stylelint 也都支持项目自定义规则和更严格约束。没有这个闸门，875 处会一边迁一边再长出来。 ([tailwindcss.com][3])

**[基于你们项目的理解推断]** 我建议分三条并行线：A. 颜色/类名审计，产出“现状热力图”；B. 语义 token 合同和 alias utilities；C. 高置信 codemod。先别幻想一次性把 `text-gray-700` 全部变成 `text-muted`，因为它在不同上下文里可能是 primary、secondary、muted 三种完全不同语义。更稳的做法是把映射分成三桶：高置信自动改，中置信生成 PR 建议，低置信人工确认。GitLab 的 usage guide 也明确把组件放在第一优先级、utilities 次之、CSS custom properties 最后，这很适合拿来约束你们的迁移终点。 ([design.gitlab.com][4])

**[业界通用最佳实践]** 工具上我不会押一个“万能 codemod 圣杯”。`ast-grep` 很适合批量做 TSX 结构搜索/替换，官方也有专门的 TSX 规则示例；`jscodeshift` 官方定位就是跨多个 JS/TS 文件构建和运行 codemod；`ts-morph` 适合少量类型敏感的手术，比如改 props、补 imports、包一层 wrapper。组合拳通常比单工具更稳。 ([ast-grep.github.io][5])

我会把替换规则先定成这样，作为第一轮“高置信字典”：

```txt
高置信自动：
bg-white           -> bg-surface
text-black         -> text-primary
border-gray-200    -> border-default
bg-gray-50         -> bg-surface-subtle

中置信人工确认：
text-gray-700      -> text-secondary | text-muted
bg-red-500         -> accent-danger | status-danger | brand-accent
```

**[基于你们项目的理解推断]** 模块优先级不要按“最简单”排，也不要按“最核心”排。最简单的先做，容易做成样板间；最核心的先做，容易在主水管上开刀。我会按“复用度 × 视觉曝光度 × 隔离性 ÷ 业务风险”排序，先迁 app shell、导航、表单、toast/empty/loading/error、dialog/overlay、card/list 这类高复用中风险区域，再迁 chat/game/signals 里的复杂 feature 视图。你们想要 dark mode 和 fork 定制，先拿这些共享表皮开刀，收益最大。

## 2. shadcn/ui vs 自建 vs Radix headless

**[基于你们项目的理解推断]** 我的结论很明确：**默认选 Radix 打底，小范围试点 Base UI，把 shadcn 当脚手架，不要当宪法，自研只保留给简单原子和你们特有的猫咖 patterns。** Radix 官方把自己定义成低层、可定制、可渐进采用的 primitives，并且用 `data-state` 暴露状态，跟 Tailwind 自定义 styling 的配合很自然。 ([Radix UI][6])

**[业界通用最佳实践]** shadcn 最大的价值，是它自己承认的那个定位：它不是传统组件库，而是“你如何构建自己的组件库”。它的 open code 和 CSS variables 约定，对想拥有源码控制权的团队很友好。对你们来说，这正好意味着可以把它当结构模板和加速器，比如 Button、Dialog、Sheet、Tooltip 这种通用控件先借它起步；但不要把它整套视觉语义、文件组织和 variants 命名原封不动搬进来。 ([ui.shadcn.com][7])

**[业界通用最佳实践]** 第四种选择里，我觉得 **Base UI** 是 2026 年最值得认真试点的那个。它来自 Radix、Floating UI 和 Material UI 的团队，定位是 unstyled、可组合、可访问的 React 组件库；2025-12 已经稳定 1.0，2026-03 文档显示最新到 1.3.0。更关键的是，shadcn 2026 文档已经支持在 Radix 和 Base UI 之间选择，连 blocks 也两边都能用，所以你们的评估成本并不高。 ([base-ui.com][8])

**[基于你们项目的理解推断]** 什么时候自建？只有两种情况：一是交互极简单，自己写比接一个 headless primitive 还轻；二是你们有非常强的自定义 pattern，比如猫咪气泡、agent badge、multi-agent thread item、mission-control panel 这类带强品牌识别的组合部件。Dialog、Select、Combobox、Menu、Popover 这类东西，我不建议从零造，a11y 和 focus 管理就是一片薄冰湖。

## 3. 术语/品牌抽象层

**[业界通用最佳实践]** **next-intl 够用，但术语层要单独设计。** next-intl 官方定位就是 Next.js 的 batteries-included i18n，支持 ICU message syntax，并且通过 react-server conditional exports 做 Server/Client 的优化；它的核心 `use-intl` 又可以在普通 React、Storybook、Jest 甚至非 React 环境里复用 `useTranslations`、`IntlProvider`、`createTranslator`、`createFormatter`。这对 Next.js 15 + App Router 的你们已经很合拍了。 ([Next-Intl][9])

**[基于你们项目的理解推断]** 我不建议为了“更灵活”就切到 react-intl。react-intl 当然也成熟，官方有 `IntlProvider`、hooks/components、ICU、CLI extraction 这些完整能力；但在一个明确的 Next-first 前端里，它给你们带来的边际收益，很可能不如 next-intl 的 App Router 贴合度。只有当你们计划把设计系统大规模复用到非 Next React 应用、或者已经押宝 FormatJS CLI/message descriptor 工具链时，react-intl 才更像一条主路线。 ([FormatJS][10])

**[业界通用最佳实践]** “thread → conversation/channel” 这类不是普通翻译，而是**产品词汇治理**。GitLab 一方面维护统一的 word list，另一方面在具体域里维护 glossary，并且会明确 discouraged synonyms。你们也该这么做：把术语做成独立可覆写词表，而不是埋进普通 message keys 里。这样企业 fork 要改词，只改一张表，不用去扫 200 个文案键。 ([GitLab 文档][11])

我建议分工非常明确：

* `branding config JSON/TS` 放 logo、favicon、品牌名、配色 preset、圆角/动效密度、可替换插画/头像资源、术语原子项
* `i18n messages` 放完整句子、复数、时态、语法、富文本
* `code-level abstraction` 只放会影响业务流程和模型语义的东西，比如 route、permission 名称、对象模型、可替换页面 slot

**[基于你们项目的理解推断]** 你们现有 `cat-config.json` 不该继续被组件直接当“UI 颜色源”使用，而应该先进入一层 brand token resolver，把猫/企业品牌映射到 `--accent-primary`、`--accent-secondary`、`--avatar-ring-*` 这类语义 token。组件永远只吃语义，不吃“某只猫的 primary hex”。否则数据注册表和视觉合同会继续缠成一团。

**[推测/需验证]** next-intl 的 `useExtracted` 可以当迁移助手，但我不会把全盘文案迁移押在它身上，因为官方仍标注 experimental。比较稳的策略是：设计系统包和新增代码可以试点 `useExtracted`，旧业务文案先继续走显式 keys/namespace。 ([Next-Intl][12])

## 4. 视觉回归测试

**[业界通用最佳实践]** 对这种设计系统迁移，**组件级视觉回归应该是主力，E2E 视觉回归是补位，不是反过来。** Storybook 的优势就是把 UI 从业务上下文里剥出来单独构建；Playwright 有内建的 screenshot assertions；Chromatic 则是在 Storybook/Playwright/Cypress 之上补了 real-browser visual、accessibility、interaction 检查和 PR review 体验。 ([Storybook][13])

**[基于你们项目的理解推断]** 你们最适合的起步组合是：**Storybook + Playwright 先落地，Chromatic 视预算和协作规模再加。** Storybook 负责 primitives 和 patterns，在 light/dark + 默认品牌/一个替代品牌下都出 stories；Playwright 只覆盖 10 到 15 个关键页面和流程，比如 app shell、chat thread、composer、dialog、settings、mission-control panel。这样成本最低，收益也最大。

**[业界通用最佳实践]** 如果团队贡献者多、设计评审频繁、PR review 想要更丝滑，Chromatic 的价值就会上来。它现在的公开价是 Free 5,000 snapshots/月，Starter 179 美元/月含 35,000 snapshots 和多浏览器；官方也强调 snapshots 可以覆盖 states、themes、viewports。对一个设计系统迁移中的开源项目，这个成本不算离谱，但在你们把 Storybook story 覆盖率做上来之前，先买它意义不大。 ([Chromatic][14])

## 5. 企业级 fork 友好度

**[业界通用最佳实践]** 真正的 fork-friendly，不是“所有东西都可配置”，而是“80% 的定制通过稳定 contract 完成，20% 的深改才需要碰代码”。Mattermost 把 theme customization 和 custom branding 分开，甚至企业版可以按 team 用不同 theme；Rocket.Chat 也把 white-label 的 logo、颜色、登录页、layout 做成配置面，但颜色文档明确提醒改色会波及 light/dark/custom themes，甚至可能破坏 WCAG 对比度。这个分层很值得学。 ([Mattermost 文档][15])

**[基于你们项目的理解推断]** 对 Cat Café，我会把 fork 的稳定扩展面收敛成 5 个入口：`themes/*.css` 或 token preset、`tenant.config.*`、`branding assets`、`terminology overrides`、`feature/component override registry`。前四个给 80% 的企业改皮需求，最后一个只给真正的产品差异化。只要企业为了改 logo、主色、thread 文案还得去碰 `ChatItem.tsx`，这个系统就还不够友好。

**[业界通用最佳实践]** GitLab 的 Pajamas 能学的不是视觉，而是治理方式：token 分 constant/semantic/contextual；代码里优先 components，再 utilities，再 custom properties；文档侧有 word list 和 glossary 约束术语。你们如果把 theme、branding、terminology 都变成“有 contract 的资产”，fork 成本会比“全项目 search/replace”低很多。 ([design.gitlab.com][2])

## 6. 风险评估

**[基于你们项目的理解推断]** 以你们描述的规模，我会这样估算工程量。`20-30` engineer-days 可以做出“止血 + token contract + 第一批 primitives + shell/forms 初迁移”；`50-70` engineer-days 可以把 dark mode 和大部分共享界面迁到可用状态；要做到“企业 fork 友好 + terminology + i18n foundation + 视觉回归体系”，大概率是 `65-105` engineer-days。换算下来，1 个强前端全职大约 3 到 5 个月，2 个前端加一点设计支持，做出第一波明显收益通常是 6 到 10 周。这个估算我会标成**推断，不是已验证**。

**[业界通用最佳实践]** 最大风险不是工作量，而是方向跑偏。最常见的坑有五个：token 命名太浅，后面全要重命名；只做 primitives 不做 patterns，重复从颜色层转移到布局层；codemod 过猛，把语义搞错；没有先建 visual baseline 就大扫除；没有 lint gate，结果新旧两套样式长期并存。

**[业界通用最佳实践]** 也确实存在“做半截比不做更糟”的场景。最典型的三个：一，设计系统文件夹已经有了，但 feature 还能继续写 raw colors；二，dark tokens 已存在，但关键页面还在吃 `bg-white/text-gray-*`，于是夜间模式像被月光咬过；三，next-intl 接进来了，但产品词汇仍然硬编码在组件里，企业 fork 反而要改更多地方。避免它们的方法很简单：**把“迁移完成”的定义写死**，至少包括“无 raw color、走 DS primitive/pattern、故事齐、视觉回归齐、light/dark 都过”。

最后给你一个我会直接执行的落地顺序：

1. 审计全部颜色/class/token usage，出 top offenders 清单
2. 上 ESLint/Stylelint/CI 门禁，冻结新增设计债
3. 定 semantic token contract 和 alias utilities
4. 跑第一轮高置信 codemod
5. 先迁 app shell、forms、feedback、overlays
6. 抽 8 到 12 个 primitives，再抽 5 到 8 个 patterns
7. 接 ThemeProvider / BrandProvider / TerminologyProvider / next-intl
8. 最后收 long tail features

**[基于你们项目的理解推断]** 如果只浓缩成一句，就是这句：**先把“语义 token contract + 门禁 + 回归测试”立起来，再谈组件库；先把 shadcn 当参考车床，再决定 Radix/Base UI 试点；先把 terminology 从 i18n 里单独拎出来，再谈企业 fork。** 这三步一稳，后面的重构就不是拆楼，而是给猫咖换承重墙。 ([tailwindcss.com][1])

[1]: https://tailwindcss.com/docs/theme "https://tailwindcss.com/docs/theme"
[2]: https://design.gitlab.com/product-foundations/design-tokens "https://design.gitlab.com/product-foundations/design-tokens"
[3]: https://tailwindcss.com/docs/functions-and-directives "https://tailwindcss.com/docs/functions-and-directives"
[4]: https://design.gitlab.com/product-foundations/design-tokens-using "https://design.gitlab.com/product-foundations/design-tokens-using"
[5]: https://ast-grep.github.io/ "https://ast-grep.github.io/"
[6]: https://www.radix-ui.com/primitives/docs/overview/introduction "https://www.radix-ui.com/primitives/docs/overview/introduction"
[7]: https://ui.shadcn.com/docs "https://ui.shadcn.com/docs"
[8]: https://base-ui.com/react/overview/about "https://base-ui.com/react/overview/about"
[9]: https://next-intl.dev/ "https://next-intl.dev/"
[10]: https://formatjs.github.io/docs/react-intl/ "https://formatjs.github.io/docs/react-intl/"
[11]: https://docs.gitlab.com/development/documentation/styleguide/word_list/ "https://docs.gitlab.com/development/documentation/styleguide/word_list/"
[12]: https://next-intl.dev/docs/usage/extraction "https://next-intl.dev/docs/usage/extraction"
[13]: https://storybook.js.org/tutorials/intro-to-storybook/react/en/get-started/ "https://storybook.js.org/tutorials/intro-to-storybook/react/en/get-started/"
[14]: https://www.chromatic.com/pricing "https://www.chromatic.com/pricing"
[15]: https://docs.mattermost.com/end-user-guide/preferences/customize-your-theme.html "https://docs.mattermost.com/end-user-guide/preferences/customize-your-theme.html"

## Part 3: 布偶猫综合（对照 codebase 验证）

> 撰写：布偶猫/宪宪 | 日期：2026-03-24

### 事实纠正（GPT Pro 与实际代码的偏差）

| GPT Pro 假设 | 实际情况 | 影响 |
|---|---|---|
| Tailwind CSS 4 | **Tailwind 3.4.0**（`package.json` 确认）| `@theme`、`@custom-variant`、`@source` 等 TW4 指令不可用；需要用 TW3 的 `extend` + `plugin` 方式 |
| 875+ 处硬编码颜色 | **~1000 处**（134 inline hex + 866+ Tailwind 色彩工具类）| 迁移量比预估多 ~15%，codemod 分桶策略更重要 |
| "先上 ESLint 门禁" | ESLint 当前仅 `next/core-web-vitals` + `next/typescript`，**无自定义规则** | 门禁从零搭建，但也意味着没有历史包袱，可以一步到位 |
| Base UI 1.3.0 stable | **需验证**——2026-03 文档声称，但我们的 package.json 里无任何 Radix/Base UI 依赖 | 试点成本低（无冲突），但要实际装了跑跑才知道 |

### 三方共识（宪宪 + 砚砚 + GPT Pro）

以下结论**三方一致**，可直接采信：

1. **先止血再重构**：CI 门禁冻结新增设计债 → 比任何 codemod 都优先
2. **三层蛋糕方向正确，但 GPT Pro 的五层更完整**：加 Layer 0（治理门禁）和 Layer 3（patterns/composites）是对的
3. **shadcn 当参考不当宪法**：API 设计和文件组织可以借鉴，视觉语义必须自己的
4. **Radix headless 做 a11y 密集型控件**：Dialog、Select、Combobox、Menu、Popover 不要从零造
5. **next-intl 够用**：Next.js 15 App Router 贴合度最高，不需要切 react-intl
6. **术语 ≠ 翻译**：产品词汇表独立于 i18n messages，fork 只改一张表
7. **Storybook + Playwright 先行**：Chromatic 等 story 覆盖率上来再加
8. **cat-config.json 需要品牌 token resolver**：组件不应直接吃 hex

### 我补充的项目特殊约束

| 约束 | 来源 | 对重构的影响 |
|------|------|-------------|
| 我们是 **TW3 不是 TW4** | `package.json` | TW3 的 token 定义走 `theme.extend.colors`（已在做），自定义变体用 `addVariant` plugin，不能用 `@theme` 语法。**是否趁此机会升级到 TW4 是一个独立决策点** |
| 猫色是**运行时动态**的 | `useCatData()` 从 API 拉，fallback 到 shared 静态 | 不能全部靠 CSS 变量静态解决——`hexToRgba(catData.color.primary, 0.3)` 这类动态计算需要保留，但应该收拢到一个 `useCatTheme()` hook |
| **狼人杀模块已经是样板间** | `GameShell.tsx` 的 `data-theme` + 30 token | 迁移时可以直接抄它的 pattern，减少试错 |
| 文件 **200 行警告 / 350 硬上限** | `CLAUDE.md` 代码规范 | 提取 primitive 时天然会帮助拆大文件，但也要注意不要过度碎片化 |
| **AI 猫猫是主要前端开发者** | 项目现实 | codemod + lint gate 的自动化程度直接决定迁移效率，人工审查成本比人类团队低 |

### 最终方案：五层夹心蛋糕（采纳 GPT Pro 修正版）

```
Layer 4: Enterprise Kit — theme presets / tenant.config / terminology overrides / next-intl
Layer 3: Patterns — CatBubble / AgentBadge / ThreadItem / MissionPanel 等品牌组合件
Layer 2: Primitives — Button / Input / Card / Badge / Modal / Tabs / Dialog（Radix 打底）
Layer 1: Design Tokens — semantic token contract + Tailwind alias utilities
Layer 0: Governance — ESLint gate + visual baseline + "迁移完成"定义
```

### 落地路线图（按依赖顺序，非按时间）

| Phase | 内容 | 前置条件 | 产出 | 风险 |
|-------|------|----------|------|------|
| **P0: 审计 + 止血** | 颜色/类名审计出热力图；ESLint 自定义规则禁止新增 raw hex/`bg-white` 等 | 无 | 审计报告 + lint 规则 | 低 |
| **P1: Token Contract** | 定义语义 token（surface/text-primary/border-default/accent-*/status-*）；Tailwind `extend.colors` 映射；globals.css 补齐 light/dark | P0 | token 字典 + TW config + CSS vars | 低 |
| **P2: Codemod Round 1** | 高置信自动替换（`bg-white→bg-surface`、`text-black→text-primary`、`border-gray-200→border-default`等）；中置信生成 PR review | P1 | ~40% 硬编码颜色消除 | 中（需视觉验证） |
| **P3: Primitives** | 8-12 个核心 primitive（Radix headless + 自有 styling）；Storybook stories（light/dark 双版本） | P1 | `components/ui/` 目录 | 中 |
| **P4: Shell + 共享层迁移** | app shell、导航、表单、toast/empty/loading/error、dialog/overlay 迁移到 primitive + token | P2 + P3 | 共享 UI 统一 | 中高（视觉回归） |
| **P5: Patterns** | 提取猫咖特色组合件（CatBubble、AgentBadge、ThreadItem 等） | P3 | `components/patterns/` | 中 |
| **P6: Theme System** | ThemeProvider + useTheme + useCatTheme（含品牌 token resolver）；dark mode 可切换 | P4 | 运行时主题切换 | 中 |
| **P7: Enterprise Kit** | next-intl 接入 + terminology overrides + tenant.config + branding assets 可配 | P5 + P6 | fork-friendly 定制面 | 中 |
| **P8: Long Tail** | 逐模块迁移 chat/game/signals/mission-control/audit 到 token + primitive | P4 | 全站 token 覆盖 | 低（前面已铺路） |

### 关于"是否顺带升级 Tailwind 4"

**独立决策点**，不要和设计系统重构混在一起。选项：

- **Option A: TW3 上做**——稳，plugin API 成熟，社区资源多，先做完再升级
- **Option B: P0 阶段先升 TW4**——TW4 的 `@theme` 语法天然适合 token 声明，但升级本身有迁移成本（配置语法变化、`@apply` 行为变化等）
- **我的倾向**：Option A。TW3→TW4 的迁移和设计系统重构是两个正交的风险源，不要叠加

### 工程量估算（基于 GPT Pro + 实际验证修正）

| 阶段 | GPT Pro 估算 | 我的修正 | 理由 |
|------|-------------|---------|------|
| 止血 + token + 首批 primitives + shell 初迁 | 20-30 人天 | **15-25 人天** | AI 猫猫做 codemod 效率高于人类；ESLint 规则是一次性投入 |
| Dark mode + 大部分共享界面 | 50-70 人天 | **40-55 人天** | 有狼人杀样板间参考，token 定义不需要从零设计 |
| 企业 fork 友好 + i18n + 视觉回归体系 | 65-105 人天 | **55-80 人天** | next-intl 接入对 App Router 很顺滑，但术语治理需要产品决策时间 |

> ⚠️ 以上为**推断**，不是已验证。实际取决于铲屎官对"完成"的定义边界。

### 和我之前分析的对比

| 维度 | 我的原始方案 | GPT Pro 修正 | 最终采纳 |
|------|------------|-------------|---------|
| 层数 | 3 层 | 5 层 | ✅ 5 层（加 Layer 0 治理 + Layer 3 patterns） |
| 第一步 | Token 层 | 止血门禁 | ✅ 止血先行（我之前漏了这步） |
| 品牌抽象 | 只提了颜色 | 颜色+圆角+阴影+动效 | ✅ 全面品牌 token（GPT Pro 说得对） |
| cat-config 消费 | 没提 | 加 brand token resolver | ✅ 收拢到 useCatTheme() |
| codemod 策略 | 整体替换 | 三桶分级 | ✅ 高/中/低置信分桶 |
| TW 版本 | 没注意 | 假设 TW4 | ⚠️ 实际 TW3，需要适配 |

### 下一步建议

1. **铲屎官拍板**：这个方向要不要立项？如果 yes，立 Feature（F-xxx）
2. **决策 TW3 vs TW4**：是否顺带升级？
3. **P0 可以现在就做**：颜色审计 + ESLint 门禁，零风险，即使最终不做大重构也有价值
4. **@ 烁烁**：设计 token 命名需要暹罗猫参与，她维护设计系统文档
