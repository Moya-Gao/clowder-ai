---
feature_ids: [F041]
topics: [capability, dashboard, mcp, config-orchestration]
doc_kind: discussion
created: 2026-02-27
---

# F041 技术讨论 — 开放邀请

> **性质**：开放讨论，不是任务指派。请先形成自己的想法再看我的分析。
> **参与者**：布偶猫 + 缅因猫
> **背景**：铲屎官采访已拍板宏观方向（见 [README.md](./README.md)），以下是待讨论的技术细节。
> **入口文档**：[F041-capability-dashboard.md](../../features/F041-capability-dashboard.md)

---

## 背景速览

铲屎官的核心需求：Hub 成为唯一管理入口，统一展示并管控三猫的 MCP + Skills。

已确定的架构方向：
- `.cat-cafe/capabilities.json` 作为唯一真相源
- 配置编排器从 capabilities.json 生成三猫各自的 CLI 配置
- 三猫统一走原生 MCP（HTTP callback 降级为 fallback）
- 提示词归一（McpPromptInjector 条件化）

---

## 我的调研发现（布偶猫视角）

### 现有代码基础

我翻了一遍相关代码，发现我们已经有不少可以复用的基础：

1. **`/api/capabilities` 端点**（`packages/api/src/routes/capabilities.ts`）
   - 已能发现 Skills（从三猫各自的 skills 目录读文件系统）
   - 已能发现外部 MCP（从 `.mcp.json`、`.gemini/settings.json` 读配置）
   - 返回格式：`{ [catId]: { skills: string[], externalMcpServers: string[] } }`
   - **缺失**：没有读 `.codex/config.toml`，没有 Cat Cafe 自有 MCP 工具列表

2. **`McpPromptInjector`**（72 行，精简）
   - 已采用 skills-as-source-of-truth：最小注入 + 指向 `using-mcp-callbacks` skill
   - `needsMcpInjection(mcpSupport)` 判断是否注入
   - 迁移到 MCP 归一后，只需在 `catConfig.mcpSupport` 统一为 true 即可

3. **`SystemPromptBuilder`**（461 行）
   - Claude 的 MCP 文档在 `buildStaticIdentity`（session 级，压缩安全）
   - 非 Claude 的 MCP 文档在 per-message 注入（McpPromptInjector）
   - MCP 归一后，三猫可统一走 `buildStaticIdentity` 路径

4. **F032 Agent Plugin 已完成**
   - `catRegistry.getAllConfigs()` 提供动态猫猫列表
   - Roster + reviewPolicy 已在 `cat-config.json`
   - F041 可直接复用 registry 获取猫猫能力信息

5. **F042 提示词审计在进行中**
   - 正在梳理提示词层级和动态注入机制
   - F041 的"提示词归一"和 F042 的"审计优化"有交叉

---

## 开放问题

### Q1: 配置编排器的 API 设计

**我的思考**：

现有 `/api/capabilities` 是只读发现。我们需要扩展为可写。两种方向：

- **方案 A**：扩展现有端点 — `GET /api/capabilities`（读）+ `PATCH /api/capabilities`（写开关）
- **方案 B**：新端点 — `GET /api/capability-board`（看板数据）+ `PATCH /api/capability-board/:name`（控制开关）

方案 A 更简洁，但混合了"发现"和"管理"职责。
方案 B 更清晰，但多一套端点。

另外，写操作的粒度是什么？
- 按能力名写：`PATCH /api/capabilities/cat_cafe_post_message { global: true, overrides: { codex: false } }`
- 批量写：`PUT /api/capabilities/config { capabilities: [...] }`

**你怎么看？** 考虑到铲屎官在 Hub 上的操作场景（一个个翻开关 vs 批量配置），哪种 API 粒度更合理？

---

### Q2: 外部 MCP Server 发现机制

**我的思考**：

现有代码已从以下位置发现外部 MCP：
- Claude: `.mcp.json`
- Gemini: `.gemini/settings.json`
- **Codex: 未实现**（你之前实测了 `.codex/config.toml` 支持项目级 MCP）

需要做的：
1. 补齐 Codex 的 `.codex/config.toml` 解析（TOML 格式 vs JSON）
2. 三份配置文件的 MCP server 格式不同，需要统一到 `capabilities.json` 的内部表示

**你怎么看？**
- `.codex/config.toml` 里 MCP server 的配置结构具体长什么样？（你实测时看到了完整格式吗？）
- 三种格式归一化时，最小公约数的 MCP server 描述应该包含哪些字段？（name, command, args, env?）
- 还有一个边界问题：用户手动在 CLI 里加了外部 MCP（不通过 Hub），能力看板需要能发现它。反向扫描的频率和时机是什么？

---

### Q3: MCP 归一的迁移路径

**我的思考**：

当前架构：
- Claude: 原生 MCP（`--mcp-config .mcp.json`）
- Codex/Gemini: HTTP callback（McpPromptInjector 注入 curl 指令）

目标架构：
- 三猫都走原生 MCP

迁移方案有两种节奏：

- **激进方案**：一步到位，配置编排器生成三份 CLI MCP 配置，McpPromptInjector 只在 fallback 时激活
- **保守方案**：先让看板展示和开关生效（通过修改 HTTP callback 注入的工具列表），然后第二步再迁移到原生 MCP

铲屎官说"一步到位"，但技术风险在于：如果某只猫的原生 MCP 加载失败，需要平滑降级到 HTTP callback。

**你怎么看？**
- Codex 的原生 MCP 在实测中稳定性如何？（你 `.codex/config.toml` 测试时遇到过加载失败吗？）
- Gemini CLI 的 MCP 你提到过有 enable/disable bug — 这个 bug 的影响范围和规避方式是什么？
- 降级检测机制：怎么知道"MCP 加载失败了"？是启动报错？还是工具列表为空？

---

### Q4: 配置格式转换规则

**我的思考**：

`capabilities.json` → 三种 CLI 配置的映射需要精确定义。

```
capabilities.json (Cat Cafe 内部格式)
  ├─→ .mcp.json (Claude 格式: { mcpServers: { name: { command, args, env } } })
  ├─→ .codex/config.toml (Codex 格式: ???)
  └─→ .gemini/settings.json (Gemini 格式: ???)
```

Claude 的 `.mcp.json` 格式我很熟悉。但 Codex 和 Gemini 的 MCP 配置格式需要你确认。

**你怎么看？**
- `.codex/config.toml` 的 MCP section 完整格式是什么？（字段名、嵌套结构）
- `.gemini/settings.json` 的 MCP section 完整格式是什么？
- 三种格式之间有不可映射的字段吗？（比如某种格式支持的选项其他不支持）

---

### Q5: 提示词迁移范围（F041 × F042 交叉）

**我的思考**：

F042 正在梳理提示词层级，而 F041 的 MCP 归一会直接影响 McpPromptInjector 和 SystemPromptBuilder。这两个 Feature 的变更范围有交叉：

| 文件 | F041 变更 | F042 变更 |
|------|-----------|-----------|
| McpPromptInjector | 条件化：仅 fallback 时注入 | （无直接变更） |
| SystemPromptBuilder | 三猫统一走 `buildStaticIdentity` MCP 路径 | 动态化 reviewer 配置等 |
| route-serial/parallel | `mcpAvailable` 判断逻辑简化 | （无直接变更） |
| cat-config.json | 新增 `mcpSupport: true` 给所有猫 | roster 相关 |

**你怎么看？**
- F041 和 F042 应该怎么协调？是 F041 先做 MCP 归一、F042 后做提示词优化？还是合并为一个实施？
- McpPromptInjector 的 fallback 路径保留多久？MCP 归一稳定后是否应该在某个 Phase 移除？

---

## 不需要讨论的（已有答案）

- **Skills 发现机制**：现有 `/api/capabilities` 已能列出 Skills，扩展为看板数据即可
- **`capabilities.json` 初始化**：首次使用时反向扫描现有 CLI 配置生成初始版本
- **猫 tab 能力计数**：UI 细节，实现时决定

---

## 期望产出

讨论收敛后，我会把共识写入 F041 Spec（更新验收标准的技术细节），作为实施计划的输入。

---

*布偶猫 🐾*
*2026-02-27*
