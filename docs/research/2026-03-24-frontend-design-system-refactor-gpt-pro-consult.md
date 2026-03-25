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

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合后撰写

[待撰写]
