---
feature_ids: []
topics: [capability, dashboard]
doc_kind: discussion
created: 2026-02-26
---

# 2026-02-26 能力看板 — Hub MCP/Skills 统一管理

> 参与者：铲屎官 + 布偶猫 + 缅因猫（实测验证）
> 形式：铲屎官口述需求 + 布偶猫采访澄清 + 缅因猫技术验证
> 状态：铲屎官宏观决策已拍板，技术细节待布偶猫+缅因猫讨论

---

## 铲屎官原始需求

### 1. Hub MCP 工具列表是硬编码的假数据

> "我都不知道你们三只猫到底挂了什么！"

**现状**：Hub `config-viewer-tabs.tsx` 硬编码了 9 个工具名，其中 7 个是过期的旧名字（`cat_speak`、`get_context`、`remember` 等），实际注册了 27 个工具。铲屎官看到的是一张假菜单。

**核心动机**：铲屎官作为团队管理者，需要知道每只猫实际有什么能力，并能控制它们。

### 2. 不想当人肉路由器

> "我不要再跑到 Claude Code、跑到 Codex、跑到 Gemini CLI 或 Antigravity 里面一个个管。"

**参考**：VISION.md 第一句——Cat Cafe 的愿景就是不让铲屎官当人肉路由器。Hub 应该是唯一管理入口。

### 3. 多项目场景

> "我现在甚至用你们来开发我公司内的代码。我在猫猫咖啡打开 dare-framework，让你们开发 dare-framework。"

**核心动机**：Cat Cafe 不只是开发自身。不同项目需要不同的工具集配置，不能每次切项目都跑去各个 CLI 单独配。

### 4. Skills 也需要管控

> "我很害怕以后有 100 个 Skills，占了一堆上下文。我要如何只给每只猫匹配它需要的 Skills？"

**核心动机**：Skills 加载进猫猫的上下文会消耗 token。随着 Skills 增长，必须能按猫控制加载范围。

---

## 决策过程

### 采访问题与铲屎官决策

| # | 问题 | 铲屎官决策 |
|---|------|-----------|
| 1 | 只读看板 vs 可管理看板？ | **可管理**——能帮猫猫降级 |
| 2 | 管理粒度：全局/每猫/两层？ | **C：全局 + 每猫覆盖**（实在不行 A 也可接受） |
| 3 | 管理范围：自有 MCP / 外部 MCP / Skills？ | **全都管**——成为唯一入口 |
| 4 | 分阶段 vs 一步到位？ | **一步到位**——B 包含 A，不走弯路 |
| 5 | 配置编排对 Codex 外部 MCP 怎么做？ | **技术细节猫猫自行决策**（漏斗细节层） |
| 6 | 能力看板 UI 形态？ | **统一看板 + tag 过滤**，不要 tab 重叠 |
| 7 | Skills 需要开关吗？ | **需要**——和 MCP 一样的开关层级 |
| 8 | 猫 tab 里还保留 Skills/MCP 吗？ | **不保留**——猫 tab 只放模型&预算，能力全归看板 |

### 关键架构发现（缅因猫实测）

讨论中缅因猫实测验证了两个重要事实：

1. **Codex 支持项目级 MCP**：`.codex/config.toml` 在 trusted 项目下生效，`-c` 参数可做单次注入
2. **Gemini 支持项目级 MCP**：`.gemini/settings.json` 支持项目级和用户级 MCP 配置

**推翻的架构前提**："只有 Claude 支持动态加载 MCP" → **不成立**。三猫都支持。

**架构影响**：
- Codex/Gemini 的 Cat Cafe 工具应从 HTTP callback 迁移到原生 MCP（归一）
- HTTP callback 降级为 fallback（应急降级路径）
- 配置编排方案对三猫统一可行

> 实测详情：缅因猫消息 `[06:25]` + `[06:51]`
> 研究文档：`docs/research/codex-支持动态加载mcp.md`、`docs/research/gemini-cli支持动态加载mcp.md`

### 铲屎官纠正记录

| 错误 | 纠正 |
|------|------|
| `read_file`/`write_file` 是 Cat Cafe 工具 | CLI 自带工具，不是我们的 |
| Codex 不支持 MCP 协议 | 支持，`~/.codex/config.toml` 配置，Codex 设置 UI 有完整 MCP 管理 |
| CLI 改配置要重启才生效 | 无头模式每次 spawn 新进程 = 天然热加载 |
| HTTP callback 是 Codex/Gemini 主路径 | 应归一到原生 MCP，callback 降级为 fallback |

---

## 最终设计方案

### 1. 信息架构重组

```
改前 Tab 结构：
布偶猫[模型+Skills+MCP] | 缅因猫[同] | 暹罗猫[同] | 系统配置 | Skills 看板

改后 Tab 结构：
布偶猫[模型&预算] | 缅因猫[模型&预算] | 暹罗猫[模型&预算] | 系统配置 | 能力看板
```

- **猫 tab**：只保留猫特有配置（Provider、Model、各种上限）
- **能力看板**：MCP + Skills 归一展示，tag 过滤，支持编辑开关
- 消除信息重复

### 2. 能力看板 UI

**展示**：
- 每条能力显示：名称 + 描述 + 类型 tag（MCP/Skill）+ 来源 tag（Cat Cafe/外部）+ 绑定的猫
- 三个过滤器：类型（MCP/Skill）、来源（Cat Cafe/外部）、猫猫（布偶/缅因/暹罗）

**编辑**：
- 每条能力有开关（MCP 和 Skills 都有）
- 开关支持两层：全局开关 + 每猫覆盖
- 全局 OFF → 三猫都不能用；全局 ON + 某猫 OFF → 只有该猫不能用

### 3. 数据架构 — `.cat-cafe/` 配置编排

```
{project-root}/
├── .cat-cafe/
│   ├── capabilities.json    ← 能力开关唯一真相源
│   └── project.json         ← 项目元信息
│
│   配置编排器生成 ↓
│
├── .mcp.json                ← Claude 读
├── .codex/config.toml       ← Codex 读
└── .gemini/settings.json    ← Gemini 读
```

- `capabilities.json`：全局开关 + 每猫覆盖（只记差异）
- 配置编排器：读 `.cat-cafe/capabilities.json` → 生成三份不同格式的 CLI 配置
- 三猫统一走原生 MCP 协议，无特殊分支

### 4. MCP 归一

- 三猫的 Cat Cafe 工具和外部 MCP **全部走原生 MCP 协议**
- Cat Cafe 配置编排器统一生成各 CLI 的 MCP 配置
- HTTP callback（McpPromptInjector）降级为 fallback
- 下次 spawn → 猫猫自动加载新配置（无头模式 = 天然热加载）

### 5. 提示词归一（关键！MCP 归一的连带变更）

**现状**：Codex/Gemini 不走原生 MCP，所以 McpPromptInjector 在 prompt 里注入 HTTP callback 指令（curl 命令），告诉它们"你有这些工具，用 curl 调用"。Claude 不需要这些提示词，因为它直接通过 MCP 协议发现工具。

**归一后**：三猫都走原生 MCP → **McpPromptInjector 的 HTTP callback 提示词必须同步移除/改写**。否则缅因猫会同时看到：
- 原生 MCP 工具列表（CLI 自动发现）
- prompt 里的 HTTP curl 指令（旧的 callback 注入）
→ 矛盾、困惑、可能导致重复调用或选错路径。

**变更范围**：
- `McpPromptInjector`：不再给走原生 MCP 的猫注入 HTTP callback 指令
- `SystemPromptBuilder`：移除/条件化 Codex/Gemini 的工具说明段
- 各猫的 system prompt 模板：统一为"你的工具通过 MCP 提供"，不再有三分叉
- **fallback 路径保留**：当某猫 MCP 加载失败时，才临时注入 HTTP callback 提示词作为降级

---

## 验收标准

### 功能验收

1. **能力看板展示**：Hub 能力看板 tab 显示所有实际注册的 MCP 工具 + Skills，无硬编码假数据
2. **tag 过滤**：可按类型（MCP/Skill）、来源（Cat Cafe/外部）、猫猫过滤
3. **全局开关**：关掉某个 MCP/Skill 后，三猫下次 spawn 均不加载该能力
4. **每猫覆盖**：全局开启的能力，可对单只猫关闭
5. **猫 tab 精简**：猫 tab 不再展示 Skills/MCP 列表，只保留模型&预算
6. **无信息重复**：能力信息只在能力看板一处展示

### 架构验收

7. **`.cat-cafe/capabilities.json`**：项目根目录下存在，作为唯一真相源
8. **配置编排器**：修改 `capabilities.json` 后能正确生成 `.mcp.json`、`.codex/config.toml`、`.gemini/settings.json`
9. **三猫 MCP 归一**：Cat Cafe 自有工具对三猫均通过原生 MCP 协议提供（非 HTTP callback）
10. **提示词归一**：McpPromptInjector 不再给走原生 MCP 的猫注入 HTTP callback 指令；三猫的 system prompt 工具说明段统一，不再有三分叉
11. **热加载验证**：在 Hub 翻开关 → 下次 spawn 猫猫 → 确认能力变化生效

### 边界验收

12. **多项目隔离**：两个项目（如 cat-cafe 和 dare-framework）可有不同的能力配置
13. **降级路径**：MCP 加载失败时，HTTP callback 作为 fallback 仍可用（含提示词自动注入）

---

## 开放问题（待布偶猫+缅因猫技术讨论）

1. **配置编排器的具体 API 设计**：`PATCH /api/capabilities/:name` 还是其他形式？
2. **外部 MCP Server 发现机制**：如何动态发现各 CLI 已配置的外部 MCP（读配置文件解析？）
3. **Skills 发现机制**：现有 `/api/capabilities` 已能列出 Skills，如何与新看板整合？
4. **配置格式转换**：`.cat-cafe/capabilities.json` → 三种 CLI 配置格式的映射规则
5. **MCP 归一迁移路径**：现有 HTTP callback 架构如何平滑迁移到原生 MCP？是否需要过渡期？
6. **提示词迁移范围**：McpPromptInjector + SystemPromptBuilder + 各猫 system prompt 模板，哪些要删、哪些要改、哪些保留为 fallback？需要逐文件清点。
7. **`capabilities.json` 初始化**：新项目首次使用时，如何生成初始配置（扫描现有 CLI 配置反向生成？）
8. **猫 tab 里是否保留能力计数摘要**：如"12 MCP / 8 Skills"链接到能力看板

---

## 关联 BACKLOG 条目

| 编号 | Feature | 状态 |
|------|---------|------|
| #101 | 能力看板 — Hub MCP/Skills 统一管理 + 配置编排 + MCP 归一 | [ ] 待做 |
| #102 | SessionBootstrap 同步 F98 — 启动包引导路径补全 | [ ] 待做 |
| #103 | 课件契约文档同步 — read_invocation_detail 参数差异 | [ ] 待做 |

> #102 和 #103 来自砚砚 F98 对照验收中"仍有差距"部分。#101 覆盖了"Hub 小齿轮硬编码"差距。
> Hub 硬编码差距（`config-viewer-tabs.tsx:6`）已被 #101 能力看板覆盖，不单独登记。

---

*记录人：布偶猫 🐾*
*日期：2026-02-26*
