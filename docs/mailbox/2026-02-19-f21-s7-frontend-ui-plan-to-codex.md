## F21 S7: Signal Hunter 前端 UI 计划

**作者**: 布偶猫 (Opus)
**收件人**: 缅因猫 (Codex)
**日期**: 2026-02-19
**状态**: 待实现

---

### 背景

砚砚，原始 Signal Hunter 有独立的前端 Dashboard（见讨论文档第 16 行："有独立的 MCP Server 和前端 Dashboard"）。我们当前 S5 只做了聊天命令 `/signals`，没有可视化的 UI 页面——铲屎官说这样太原始了，配置信源不能让人去编辑 yaml。

**你的锅**：实现时没有对照原始需求文档发现缺前端 UI。
**我的锅**：review 5 轮都没 review 出来这个缺失。

现在补上。

---

### 设计原则

1. **复用现有设计系统** — Tailwind + 猫猫配色 (globals.css 里的 CSS variables)
2. **融入 Cat Café 而非独立页面** — 信号 UI 作为 Cat Café 的一个面板/视图，不是跳转到新页面
3. **渐进增强** — 聊天命令继续保留，UI 是可视化补充

---

### 路由规划

在 Next.js App Router 里新增：

```
packages/web/src/app/
├── signals/
│   ├── page.tsx              # 信号 Inbox 主页
│   └── sources/
│       └── page.tsx          # 信源管理页
```

或者如果不想脱离聊天界面，可以做成 **右侧面板 Tab**（类似现有的 RightStatusPanel）。铲屎官你来定：独立页面 vs 面板 Tab？

我倾向 **独立页面 + 顶部导航切换**，因为信号浏览需要大面积展示区域。

---

### 页面 1: 信号 Inbox (`/signals`)

**功能**: 浏览今日/历史文章，筛选、搜索、标记已读

```
┌─────────────────────────────────────────────────────┐
│  🐱 Cat Café          [Chat]  [Signals]  [Sources]  │  ← 顶部导航
├─────────────────────────────────────────────────────┤
│  ┌─ 筛选栏 ──────────────────────────────────────┐  │
│  │ [搜索框 🔍]  [Tier ▾] [Source ▾] [Status ▾]  │  │
│  │ [日期选择: 今天 | 本周 | 自定义]               │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 统计卡片 ────────────────────────────────────┐  │
│  │ 📬 今日 12 篇  │  📖 未读 8 篇  │  ⭐ 收藏 3 │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 文章列表 ────────────────────────────────────┐  │
│  │ ● [Tier 1] Anthropic Newsroom                  │  │
│  │   Claude 5 Roadmap                             │  │
│  │   2026-02-19 · inbox · #roadmap #claude        │  │
│  │   [标记已读] [⭐ 收藏] [🤖 AI 摘要]            │  │
│  │ ──────────────────────────────────────────────  │  │
│  │ ● [Tier 1] OpenAI RSS                          │  │
│  │   GPT-5 Architecture Paper                     │  │
│  │   2026-02-19 · read · #gpt5 #architecture      │  │
│  │ ──────────────────────────────────────────────  │  │
│  │ ...                                             │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ 文章详情 (点击展开或右侧面板) ──────────────┐  │
│  │ 标题: Claude 5 Roadmap                         │  │
│  │ 来源: Anthropic Newsroom (Tier 1)              │  │
│  │ 日期: 2026-02-19                               │  │
│  │ 状态: [inbox ▾]  标签: [+添加标签]             │  │
│  │ ─────────────────────────                       │  │
│  │ AI 摘要: (无 / 点击生成)                        │  │
│  │ ─────────────────────────                       │  │
│  │ 原始内容:                                       │  │
│  │ Detailed announcement about...                  │  │
│  │ ─────────────────────────                       │  │
│  │ [在对话中讨论] [打开原文 ↗]                     │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**API 调用** (已有):
- `GET /api/signals/inbox?date=xxx&limit=20` — 文章列表
- `GET /api/signals/search?q=xxx&dateFrom=xxx&dateTo=xxx` — 搜索
- `GET /api/signals/articles/:id` — 文章详情
- `PATCH /api/signals/articles/:id` — 更新状态/标签/摘要
- `GET /api/signals/stats` — 统计数据

---

### 页面 2: 信源管理 (`/signals/sources`)

**功能**: 查看所有信源，开关 on/off，按分类展示

```
┌─────────────────────────────────────────────────────┐
│  🐱 Cat Café          [Chat]  [Signals]  [Sources]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  信源管理                            [全部开] [全部关]│
│                                                      │
│  ── Tier 1: 大厂官方 (全球) ─────────────────────── │
│  │                                                   │
│  │  ┌────────────────────────────────────────────┐  │
│  │  │ 🟢 Anthropic Newsroom                      │  │
│  │  │ https://www.anthropic.com/news             │  │
│  │  │ 方式: webpage │ 频率: daily                 │  │
│  │  │                              [ON/OFF 开关] │  │
│  │  └────────────────────────────────────────────┘  │
│  │                                                   │
│  │  ┌────────────────────────────────────────────┐  │
│  │  │ 🟢 OpenAI News RSS                         │  │
│  │  │ https://openai.com/news/rss.xml            │  │
│  │  │ 方式: rss │ 频率: daily                     │  │
│  │  │                              [ON/OFF 开关] │  │
│  │  └────────────────────────────────────────────┘  │
│  │                                                   │
│  ── Tier 1: 国内厂商 ───────────────────────────── │
│  │  ...                                              │
│  │                                                   │
│  ── Tier 2: 开源社区 ───────────────────────────── │
│  │  ...                                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**API 调用** (已有):
- `GET /api/signals/sources` — 获取所有信源
- `PATCH /api/signals/sources/:id` — 切换 enabled

---

### 组件拆分

```
packages/web/src/
├── app/signals/
│   ├── page.tsx                    # Inbox 页面 (server component wrapper)
│   └── sources/page.tsx            # Sources 管理页
├── components/signals/
│   ├── SignalNav.tsx                # 顶部导航 [Chat] [Signals] [Sources]
│   ├── SignalInbox.tsx              # Inbox 主容器 (筛选 + 列表 + 详情)
│   ├── SignalFilterBar.tsx          # 搜索 + 筛选条件栏
│   ├── SignalStatsCards.tsx         # 统计卡片 (今日/未读/收藏)
│   ├── SignalArticleList.tsx        # 文章列表
│   ├── SignalArticleItem.tsx        # 单条文章卡片
│   ├── SignalArticleDetail.tsx      # 文章详情面板
│   ├── SignalSourceList.tsx         # 信源管理列表
│   ├── SignalSourceCard.tsx         # 单个信源卡片 + toggle
│   └── SignalTierBadge.tsx          # Tier 标识 (复用猫猫配色)
├── hooks/
│   ├── useSignalInbox.ts           # fetch inbox + 筛选状态
│   ├── useSignalSources.ts         # fetch sources + toggle
│   └── useSignalArticle.ts         # fetch 单篇文章详情
└── utils/
    └── signals-api.ts              # API client helpers (GET/PATCH 封装)
```

---

### 配色建议

复用现有猫猫配色体系：

| 元素 | 颜色 | CSS 变量 |
|------|------|---------|
| Tier 1 标签 | Opus 紫 | `--color-opus-primary` |
| Tier 2 标签 | Codex 绿 | `--color-codex-primary` |
| Tier 3 标签 | Gemini 蓝 | `--color-gemini-primary` |
| Tier 4 标签 | 灰色 | `--color-base-black/50` |
| inbox 状态 | Owner 橙 | `--color-owner-primary` |
| read 状态 | 半透明 | opacity |
| starred 状态 | 金色 | 新增 `--color-star` |

---

### 实现建议

1. **先做 Inbox 页再做 Sources** — Inbox 是铲屎官最常用的
2. **用现有 api-client.ts 模式** — 看 `packages/web/src/utils/api-client.ts` 怎么封装 fetch
3. **响应式** — 移动端文章列表 + 点击展开详情；桌面端左列表右详情（类似邮件客户端）
4. **导航** — 在现有 layout.tsx 里加顶部导航，或者在 ThreadSidebar 底部加 "Signals" 入口

### 关于设计 Skill

如果你想先做视觉原型再写代码，可以用以下 skill：
- `pencil-renderer` — 把组件描述渲染成视觉帧
- `pencil-to-code` — 从设计帧导出 React/Tailwind 代码

或者直接用 Tailwind 写，参考现有组件风格（CardBlock, EvidencePanel 等都是好的参考）。

---

### 五件套

**What**: 为 F21 Signal Hunter 补充前端 UI 页面（Inbox 浏览 + 信源管理）
**Why**: 原始 Signal Hunter 有 Dashboard，合入 Cat Café 后不能降级为只有聊天命令。铲屎官需要可视化的信源管理和文章浏览。
**Tradeoff**: 选择独立页面而非面板 Tab，因为信号浏览需要大展示面积。聊天命令保留作为快捷入口。
**Open Questions**: 导航方式（顶部 tab vs 侧边栏入口）需铲屎官定。
**Next Action**: 砚砚按此计划实现 S7，先做 Inbox 页，再做 Sources 页。完成后找我 review。
