# Signal Hunter 集成计划

> 日期：2026-02-12
> 作者：布偶猫
> 状态：待 review
> BACKLOG：F21
> 前置讨论：`docs/discussions/2026-02-12-signal-hunter-upgrade/README.md`
> 缅因猫调研：`docs/research/signal-hunter.md`

---

## 概述

将 Signal Hunter 的核心能力合入 Cat Café，实现：
- 每日自动抓取 AI 技术信源
- 邮件日报通知
- 和猫猫深度学习讨论
- 学习洞察存入 Hindsight

---

## 阶段划分

| 阶段 | 名称 | 主要交付 | 预估工作量 |
|------|------|---------|-----------|
| S1 | 基础设施 | 配置系统 + 存储结构 + Redis schema | 中 |
| S2 | 抓取引擎 | RSS/API/网页抓取 + 去重 | 大 |
| S3 | 通知系统 | 邮件 + Cat Café 内消息 | 中 |
| S4 | 定时调度 | launchd + 脚本入口 | 小 |
| S5 | Cat Café 集成 | MCP 工具 + 前端命令 | 中 |
| S6 | 迁移收尾 | 现有数据迁移 + 文档 | 小 |

---

## S1: 基础设施

### 目标
建立信源配置系统和存储结构。

### 任务

#### S1.1 目录结构初始化

创建 `~/.cat-cafe/signals/` 目录结构：

```
~/.cat-cafe/signals/
├── config/
│   └── sources.yaml       # 信源配置（从 Signal Hunter 迁移 + 补充）
├── library/               # 原始文章存储
│   ├── anthropic/
│   ├── openai/
│   ├── deepmind/
│   └── ...
├── inbox/                 # 待处理（今日新抓取）
│   └── 2026-02-12.json
└── logs/                  # 抓取日志
    └── 2026-02-12.log
```

#### S1.2 信源配置 Schema

`sources.yaml` 结构：

```yaml
version: 1
sources:
  # Tier 1: 大厂官方
  - id: anthropic-news
    name: Anthropic Newsroom
    url: https://www.anthropic.com/news
    tier: 1
    category: official
    enabled: true
    fetch:
      method: webpage  # rss | api | webpage
      selector: ".news-item"  # CSS selector for webpage
    schedule:
      frequency: daily

  - id: openai-rss
    name: OpenAI News RSS
    url: https://openai.com/news/rss.xml
    tier: 1
    category: official
    enabled: true
    fetch:
      method: rss

  - id: arxiv-cs-cl
    name: arXiv cs.CL
    url: https://export.arxiv.org/rss/cs.CL
    tier: 1
    category: papers
    enabled: true
    fetch:
      method: rss
    filters:
      keywords:
        include: [agent, llm, context, tool, mcp, rag]
        exclude: [survey only]  # 可选过滤

  # ... 完整信源列表见讨论文档
```

#### S1.3 Redis 索引 Schema

```typescript
// 文章索引
interface SignalArticle {
  id: string;              // hash(url)
  url: string;
  title: string;
  source: string;          // source id
  tier: 1 | 2 | 3 | 4;
  publishedAt: string;     // ISO date
  fetchedAt: string;
  status: 'inbox' | 'read' | 'archived' | 'starred';
  tags: string[];
  summary?: string;        // AI 生成的摘要
  filePath: string;        // library/ 下的路径
}

// Redis keys:
// signal:article:{id} -> hash
// signal:inbox -> sorted set (by fetchedAt)
// signal:by-source:{sourceId} -> sorted set
// signal:by-date:{YYYY-MM-DD} -> set
```

#### S1.4 TypeScript 类型定义

在 `packages/shared/src/signals/` 新增：
- `types.ts` - SignalArticle, SignalSource 等类型
- `schemas.ts` - Zod schemas

### 验收标准
- [ ] 目录结构创建脚本
- [ ] sources.yaml 完整配置（所有信源）
- [ ] Redis schema 定义
- [ ] TypeScript 类型定义

---

## S2: 抓取引擎

### 目标
实现多种抓取方式，支持 RSS/API/网页。

### 任务

#### S2.1 抓取器接口设计

```typescript
// packages/api/src/domains/signals/fetchers/types.ts

interface FetchResult {
  articles: RawArticle[];
  errors: FetchError[];
  metadata: {
    fetchedAt: string;
    duration: number;
    source: string;
  };
}

interface Fetcher {
  fetch(source: SignalSource): Promise<FetchResult>;
  canHandle(source: SignalSource): boolean;
}
```

#### S2.2 RSS 抓取器

```typescript
// packages/api/src/domains/signals/fetchers/rss-fetcher.ts

// 使用 rss-parser 库
// 支持：OpenAI, arXiv, AWS, Apple ML, LangChain, HN 等
```

#### S2.3 API 抓取器

```typescript
// packages/api/src/domains/signals/fetchers/api-fetcher.ts

// 支持：
// - GitHub API (releases, trending)
// - Hugging Face Hub API
// - Semantic Scholar API
// - arXiv API (补充 RSS)
// - Hacker News Algolia API
```

#### S2.4 网页抓取器

```typescript
// packages/api/src/domains/signals/fetchers/webpage-fetcher.ts

// 使用 cheerio 解析 HTML
// 每个站点需要配置 CSS selector
// 支持：Anthropic, DeepMind, Meta, 国内厂商等
```

#### S2.5 去重与增量

```typescript
// packages/api/src/domains/signals/services/deduplication.ts

// 去重策略：
// 1. 按 URL hash 去重（主要）
// 2. 按标题相似度（可选，防止同一文章多 URL）
// 3. Redis 记录已抓取 URL
```

#### S2.6 文章存储

```typescript
// packages/api/src/domains/signals/services/article-store.ts

// 1. 生成 Markdown 文件（含 frontmatter）
// 2. 写入 library/{source}/{date}-{slug}.md
// 3. 更新 Redis 索引
// 4. 更新 inbox（今日新增）
```

文章 Markdown 格式：

```markdown
---
id: abc123
title: "Claude 4.6 发布公告"
url: https://anthropic.com/news/claude-4-6
source: anthropic-news
tier: 1
publishedAt: 2026-02-12
fetchedAt: 2026-02-12T08:00:00Z
tags: [model, release, claude]
---

# Claude 4.6 发布公告

[原始内容...]
```

### 验收标准
- [ ] RSS 抓取器（≥10 个信源测试通过）
- [ ] API 抓取器（GitHub, HF, arXiv）
- [ ] 网页抓取器（Anthropic, DeepMind 测试通过）
- [ ] 去重逻辑
- [ ] 文章存储 + Redis 索引
- [ ] 单元测试覆盖

---

## S3: 通知系统

### 目标
实现邮件日报和多渠道通知。

### 任务

#### S3.1 通知配置

```yaml
# ~/.cat-cafe/signals/config/notifications.yaml
# 或合入 cat-config.json

notifications:
  email:
    enabled: true
    provider: gmail  # gmail | qq | outlook | custom
    smtp:
      host: smtp.gmail.com
      port: 587
      secure: false
      auth:
        user: ${CAT_CAFE_SMTP_USER}
        pass: ${CAT_CAFE_SMTP_PASSWORD}
    to: landy@example.com
    from: "Cat Café Signals <noreply@cat-cafe.local>"

  in_app:
    enabled: true
    thread: signals  # 专门的 signals thread

  system:
    enabled: false  # macOS 通知，可选

  schedule:
    daily_digest: "08:00"  # 每天早 8 点
    timezone: "Asia/Shanghai"
```

#### S3.2 邮件服务

```typescript
// packages/api/src/domains/signals/services/email-service.ts

import nodemailer from 'nodemailer';

// 功能：
// 1. 支持多 provider（Gmail, QQ, 自定义 SMTP）
// 2. 日报模板渲染
// 3. 发送 + 重试
// 4. 发送记录（避免重复发）
```

#### S3.3 日报模板

```typescript
// packages/api/src/domains/signals/templates/daily-digest.ts

// HTML 邮件模板：
// - 标题：🐱 Cat Café 信号日报 - {date}
// - 分 Tier 展示
// - 每篇文章：标题 + 链接 + 一句话摘要
// - 底部：打开 Cat Café 深入讨论
```

#### S3.4 Cat Café 内消息

```typescript
// packages/api/src/domains/signals/services/in-app-notification.ts

// 写入系统消息到 signals thread
// 格式类似邮件，但更简洁
```

### 验收标准
- [ ] 邮件发送（Gmail 测试通过）
- [ ] 日报模板（HTML 格式美观）
- [ ] Cat Café 内消息
- [ ] 配置热更新支持

---

## S4: 定时调度

### 目标
实现 launchd 系统级定时抓取。

### 任务

#### S4.1 抓取脚本入口

```typescript
// scripts/fetch-signals.ts (或 .js)

// 独立可执行脚本：
// 1. 读取 sources.yaml
// 2. 调用抓取引擎
// 3. 存储新文章
// 4. 触发通知
// 5. 写日志
```

#### S4.2 launchd plist

```xml
<!-- ~/Library/LaunchAgents/com.cat-cafe.signal-fetcher.plist -->

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cat-cafe.signal-fetcher</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/lysander/projects/relay-station/cat-cafe/scripts/fetch-signals.js</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/Users/lysander/.cat-cafe/signals/logs/fetch.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/lysander/.cat-cafe/signals/logs/fetch-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>CAT_CAFE_SMTP_USER</key>
        <string>your-email@gmail.com</string>
        <!-- password 从 keychain 或 .env 读取 -->
    </dict>
</dict>
</plist>
```

#### S4.3 安装/卸载脚本

```bash
# scripts/install-signal-fetcher.sh

# 1. 生成 plist（替换路径）
# 2. 复制到 ~/Library/LaunchAgents/
# 3. launchctl load
# 4. 验证状态

# scripts/uninstall-signal-fetcher.sh
# launchctl unload + 删除 plist
```

#### S4.4 手动触发支持

```bash
# 也可以手动跑
pnpm --filter @cat-cafe/api run fetch-signals

# 或者
node scripts/fetch-signals.js --dry-run  # 测试模式
node scripts/fetch-signals.js --source anthropic-news  # 指定信源
```

### 验收标准
- [ ] 抓取脚本可独立运行
- [ ] launchd plist 配置正确
- [ ] 安装/卸载脚本
- [ ] 日志记录完善
- [ ] 手动触发支持

---

## S5: Cat Café 集成

### 目标
让猫猫能查询和讨论信号。

### 任务

#### S5.1 MCP 工具

```typescript
// packages/mcp-server/src/tools/signals.ts

// 新增 MCP 工具：

// signal_list_inbox
// - 列出今日新文章
// - 参数：limit, tier, source

// signal_get_article
// - 获取文章详情（含全文）
// - 参数：id 或 url

// signal_search
// - 搜索文章
// - 参数：query, date_range, source, tier

// signal_mark_read
// - 标记已读
// - 参数：id

// signal_summarize
// - 让猫猫生成摘要
// - 参数：id
// - 摘要存入文章 frontmatter
```

#### S5.2 API 路由

```typescript
// packages/api/src/routes/signals.ts

// GET /api/signals/inbox
// GET /api/signals/articles/:id
// GET /api/signals/search?q=xxx
// PATCH /api/signals/articles/:id (mark read, add tags)
// GET /api/signals/sources
// PATCH /api/signals/sources/:id (enable/disable)
// GET /api/signals/stats (今日/本周统计)
```

#### S5.3 前端命令

```typescript
// packages/web/src/hooks/useChatCommands.ts

// /signals - 显示今日新文章
// /signals inbox - 同上
// /signals search <query> - 搜索
// /signals sources - 列出信源（可开关）
// /signals stats - 统计信息
```

#### S5.4 和猫猫的交互示例

```typescript
// 用户说"今天有什么新文章"
// → 布偶猫调用 signal_list_inbox
// → 返回格式化的列表

// 用户说"这篇帮我解读一下"
// → 布偶猫调用 signal_get_article 获取全文
// → 生成解读
// → 可选：Retain 到 Hindsight
```

### 验收标准
- [ ] MCP 工具（5 个）
- [ ] API 路由（CRUD）
- [ ] 前端命令
- [ ] 猫猫交互测试

---

## S6: 迁移与收尾

### 目标
迁移现有数据，完善文档。

### 任务

#### S6.1 数据迁移

```bash
# 从 Signal Hunter 迁移：
# 1. library/ 下的文章 → ~/.cat-cafe/signals/library/
# 2. sources.yaml → 合并到新配置
# 3. studies/ → 可选迁移（或保留在原项目）
```

#### S6.2 配置迁移脚本

```typescript
// scripts/migrate-signal-hunter.ts

// 1. 扫描旧 library/
// 2. 解析 frontmatter
// 3. 转换格式
// 4. 写入新位置
// 5. 更新 Redis 索引
```

#### S6.3 文档更新

- [ ] README.md 更新（新功能说明）
- [ ] CLAUDE.md 更新（信号追踪相关）
- [ ] 用户指南（配置邮箱、开关信源）

#### S6.4 测试验证

- [ ] 端到端测试：抓取 → 存储 → 通知 → 查询
- [ ] 邮件发送测试
- [ ] launchd 定时测试
- [ ] 猫猫交互测试

### 验收标准
- [ ] 现有文章迁移完成
- [ ] 文档更新
- [ ] 端到端测试通过

---

## 依赖项

### 新增 npm 包

```json
{
  "rss-parser": "^3.13.0",      // RSS 解析
  "cheerio": "^1.0.0",           // HTML 解析
  "nodemailer": "^6.9.0",        // 邮件发送
  "node-schedule": "^2.1.0"      // 可选，进程内调度
}
```

### 外部依赖

- Redis（已有）
- Hindsight（已集成）
- SMTP 服务（用户配置）

---

## 风险与缓解

| 风险 | 缓解方案 |
|------|---------|
| 网页抓取被反爬 | 1. 控制频率 2. User-Agent 模拟 3. 降级到手动 |
| 邮件进垃圾箱 | 1. SPF/DKIM 配置 2. 建议用户加白名单 |
| RSS 格式变化 | 容错解析 + 健康检查 + 告警 |
| 站点结构变化 | 模块化 selector 配置，易于更新 |

---

## 时间估算

| 阶段 | 预估时间 | 备注 |
|------|---------|------|
| S1 基础设施 | 0.5 天 | 配置和类型定义 |
| S2 抓取引擎 | 1.5 天 | 核心工作量 |
| S3 通知系统 | 0.5 天 | nodemailer 简单 |
| S4 定时调度 | 0.5 天 | launchd 配置 |
| S5 Cat Café 集成 | 1 天 | MCP + API + 前端 |
| S6 迁移收尾 | 0.5 天 | 数据迁移 + 文档 |
| **总计** | **4.5 天** | 不含 review 时间 |

---

## Review 检查点

| 阶段 | Review 重点 |
|------|------------|
| S1 | 配置结构合理性、类型定义 |
| S2 | 抓取逻辑健壮性、错误处理、测试覆盖 |
| S3 | 邮件安全（密码不硬编码）、模板质量 |
| S4 | launchd 配置正确性、日志完善 |
| S5 | MCP 工具设计、API 安全 |
| S6 | 迁移正确性、文档完整性 |

---

## 备注

### 和 BACKLOG 的关系

此功能记为 **F20: Signal Hunter 集成**，加入 BACKLOG Feature Requests。

### 后续可扩展

1. **Telegram Bot 通知** — 手机推送
2. **智能过滤** — 基于阅读历史推荐
3. **趋势分析** — 某关键词近期提及增多
4. **协作标注** — 多人共享阅读状态
