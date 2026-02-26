---
feature_ids: []
topics: [prompts, gpt, pro]
doc_kind: note
created: 2026-02-13
---

# GPT Pro 架构评审 — 目录结构防腐化

> 用途：发给 GPT Pro（o1-pro / ChatGPT Pro），请他从外部架构顾问角度评审我们的重构方案
> 日期：2026-02-13
> 准备人：布偶猫
> 约束：GPT Pro 无法访问我们的 GitHub 私人仓库，所以需要把结构和上下文都写在 prompt 里

---

## Prompt 正文（以下内容直接发给 GPT Pro）

---

你好，我们是一个 3 人 AI 协作团队（两只 AI "猫" + 一个人类），在开发一个叫 Cat Café 的内部工具。项目是 TypeScript monorepo（Fastify 后端 + Next.js 前端 + MCP Server），目前 900+ 测试，已经迭代了十几个 Phase。

**我们遇到了目录结构腐化问题，已经有初步方案，想请你从外部架构角度审一下方案，看有没有盲点。**

你看不到我们的代码仓库，所以我把所有相关信息都写在下面了。

### 1. 项目结构概览

```
cat-cafe/                          # monorepo 根目录
├── packages/
│   ├── api/                       # 后端 Fastify API
│   │   ├── src/
│   │   │   ├── config/            # 11 个 .ts 文件 — 配置加载、猫猫预算
│   │   │   ├── domains/cats/
│   │   │   │   └── services/      # ⚠️ 70 个 .ts 文件 — 核心问题
│   │   │   │       └── modes/     # 6 个文件 — 唯一的子目录
│   │   │   ├── infrastructure/
│   │   │   │   └── websocket/     # 2 个文件
│   │   │   ├── routes/            # 31 个 .ts 文件 — API 路由
│   │   │   ├── services/          # 1 个文件 — 顶层 services
│   │   │   └── utils/             # 8 个文件 — CLI 工具
│   │   └── test/                  # 86 个 .test.js 文件
│   │       ├── helpers/
│   │       └── integration/
│   ├── web/                       # Next.js 前端
│   │   └── src/
│   │       ├── app/               # 页面路由
│   │       ├── components/        # UI 组件
│   │       │   └── __tests__/     # 前端组件测试
│   │       ├── hooks/             # React hooks
│   │       ├── stores/            # 状态管理
│   │       └── utils/             # 工具函数
│   ├── mcp-server/                # MCP Server
│   └── shared/                    # 共享类型
├── docs/                          # ⚠️ 270 个文件，也在膨胀
│   ├── mailbox/                   # 106 个文件 — 猫猫之间的通信记录
│   ├── bug-report/                # 50 个文件
│   ├── discussions/               # 37 个文件
│   ├── plans/                     # 21 个文件 — 功能计划
│   ├── phases/                    # 15 个文件
│   └── research/                  # 11 个文件
└── cat-cafe-skills/               # AI 协作 skills（工作流模板）
```

### 2. 核心问题：`services/` 目录

这 70 个文件包含至少 6 种不同职责：

| 类别 | 文件数 | 示例 |
|------|--------|------|
| Store 接口（内存实现） | ~8 | MessageStore, ThreadStore, TaskStore, SummaryStore, MemoryStore, InvocationRecordStore, AuthorizationRuleStore, AuthorizationAuditStore |
| Redis 实现 | ~9 | RedisMessageStore, RedisThreadStore, RedisTaskStore, RedisSummaryStore, RedisMemoryStore, RedisInvocationRecordStore, RedisAuthorizationRuleStore, RedisAuthorizationAuditStore, RedisPendingRequestStore |
| Store 工厂 | ~7 | MessageStoreFactory, ThreadStoreFactory, ... 每个 Store 对应一个 Factory |
| Redis key 定义 | ~6 | message-keys, thread-keys, task-keys, summary-keys, memory-keys, invocation-keys, authorization-keys |
| Agent 相关 | ~8 | ClaudeAgentService, CodexAgentService, GeminiAgentService, AgentRouter, route-strategies, invoke-single-cat, stream-merge, InvocationTracker |
| 其他业务逻辑 | ~10+ | AuthorizationManager, ContextAssembler, SystemPromptBuilder, SessionManager, AutoSummarizer, HindsightClient, DegradationPolicy, ModeOrchestrator, IntentParser, McpPromptInjector, EventAuditLog, CliRawArchive |

每个文件都 < 200 行（我们有文件大小规范），但目录级别完全没有组织。

### 3. 问题怎么产生的

- 从 Phase 0（5 个文件）到 Phase 5.x（70 个文件），每次 feature 加 2-3 个文件，从未停下来重组
- 代码规范管了文件大小（< 200 行），没管目录大小
- 主开发（我）对所有文件位置有完整 mental map，所以从不觉得有问题
- Code reviewer 专注于代码质量和安全，不检查目录结构

### 4. docs/ 的同类问题

docs/ 也是一样的模式：
- `mailbox/` 每次 review 来回通信存一份，106 个文件从未归档
- `bug-report/` 50 个文件（多数是历史 bug，已修复）
- `plans/` 21 个（多数已完成，和进行中的混在一起）
- 只有 `mailbox/archive/` 做过少量归档（按日期分了 2/6、2/7、2/8、2/9 四个子目录）

### 5. 我们的初步方案

由我（主开发）和 reviewer 共同讨论得出：

**A. 目录文件数硬上限 + 自动检测**
- 单目录 .ts 源文件不超过 15 个
- 写 lint 脚本检测，先 warn 一周再改 block

**B. 目录结构规范文档化**
- 写入团队文档，明确"每个子目录放什么"
- 新建文件必须匹配子目录语义

**C. Code review 增加架构检查**
- 大模块改动（5+ 新文件）必须检查目录结构
- Reviewer checklist 加"新文件放置合理性"

**D. 定期架构卫生检查**
- 每完成一个大 Feature 后跑一遍目录检查
- 绑定到开发节奏而非固定日历

**E. 依赖边界 lint（Reviewer 补充）**
- 防止"拆目录不拆耦合"
- 用 dependency-cruiser 或 eslint-plugin-boundaries 检查模块间 import 方向

**F. 兼容导出层（过渡期）**
- 重构后旧 import 路径通过 re-export 过渡
- 设置过渡期（2 周），到期后删除兼容导出

### 6. 执行时间线

- 当前有两个在途 Feature（F8、F12）正在 review，合入后即可开始重构
- 不需要分阶段过渡

### 7. 请你评审的问题

1. **方案盲点**：我们的 A-F 方案有没有遗漏的防腐化手段？特别是对一个 3 人小团队（其中 2 个是 AI）来说。

2. **目录拆分建议**：70 个文件按上面的 6 种职责分类，你建议怎么组织子目录？有没有 TypeScript/Node.js 后端项目的 best practice 可以参考？

3. **阈值合理性**：15 个文件/目录，太严还是太松？文件 < 200 行的约束下。

4. **依赖边界工具**：`dependency-cruiser` vs `eslint-plugin-boundaries`，对 monorepo + Fastify 后端哪个更合适？

5. **docs 归档策略**：270 个文件的 docs/ 目录，怎么归档最合理？按时间？按 Phase？按状态（已完成/进行中）？

6. **测试文件组织**：当前测试放在 `packages/api/test/`（和源码分离），前端放在 `__tests__/`（和源码同级）。重构后测试怎么跟？

7. **防腐化的长期有效性**：这类规范/lint 在你的经验里，半年后还有人遵守吗？有什么强化手段？

请针对每个问题给出你的具体建议，如果有不同意见请直说。我们需要的是独立判断，不是认同。

