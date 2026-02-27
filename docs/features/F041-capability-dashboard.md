---
feature_ids: [F041]
topics: [capability, dashboard]
doc_kind: note
created: 2026-02-26
---

# F041: 能力看板 — Hub MCP/Skills 统一管理

> **Status**: spec
> **Owner**: 布偶猫
> **Created**: 2026-02-26
> **Priority**: P1（铲屎官明确需求，影响日常管理体验）

---

## Why

铲屎官 2026-02-26 明确提出：
> "我都不知道你们三只猫到底挂了什么！"

**核心痛点**：
1. Hub MCP 工具列表是硬编码假数据（9 个假名字 vs 实际 27 个工具）
2. 不想当人肉路由器——每只猫单独配置太痛苦
3. 多项目场景需要不同的工具集配置
4. Skills 增长后需要按猫控制加载范围，避免 token 浪费

---

## What

1. **能力看板 UI**：Hub 新增统一看板，展示所有 MCP + Skills，支持 tag 过滤和开关
2. **配置编排**：`.cat-cafe/capabilities.json` 作为唯一真相源，自动生成三猫的 CLI 配置
3. **MCP 归一**：三猫统一走原生 MCP 协议，HTTP callback 降级为 fallback
4. **提示词归一**：移除 McpPromptInjector 对走原生 MCP 的猫的 HTTP callback 注入

---

## Acceptance Criteria

### 功能验收

- [ ] Hub 能力看板 tab 显示所有实际注册的 MCP 工具 + Skills，无硬编码假数据
- [ ] 可按类型（MCP/Skill）、来源（Cat Cafe/外部）、猫猫过滤
- [ ] 全局开关：关掉某能力后，三猫下次 spawn 均不加载
- [ ] 每猫覆盖：全局开启的能力，可对单只猫关闭
- [ ] 猫 tab 精简：不再展示 Skills/MCP 列表，只保留模型&预算

### 架构验收

- [ ] `.cat-cafe/capabilities.json` 存在且作为唯一真相源
- [ ] 配置编排器能正确生成 `.mcp.json`、`.codex/config.toml`、`.gemini/settings.json`
- [ ] Cat Cafe 自有工具对三猫均通过原生 MCP 协议提供
- [ ] McpPromptInjector 不再给走原生 MCP 的猫注入 HTTP callback 指令
- [ ] 热加载验证：翻开关 → 下次 spawn → 能力变化生效

### 边界验收

- [ ] 多项目隔离：不同项目可有不同能力配置
- [ ] 降级路径：MCP 加载失败时，HTTP callback 作为 fallback 可用

---

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | [2026-02-26-capability-dashboard](../discussions/2026-02-26-capability-dashboard/README.md) | 铲屎官采访 + 架构决策 |
| **Research** | [codex-支持动态加载mcp](../research/codex-支持动态加载mcp.md) | 缅因猫实测验证 |
| **Research** | [gemini-cli支持动态加载mcp](../research/gemini-cli支持动态加载mcp.md) | 缅因猫实测验证 |

---

## Key Decisions

1. **全局 + 每猫覆盖**：不做单层开关，支持两层覆盖（铲屎官拍板）
2. **MCP 归一优先**：三猫统一走原生 MCP，HTTP callback 只作 fallback（推翻"只有 Claude 支持 MCP"的旧假设）
3. **配置编排器生成**：不让用户手写三份 CLI 配置，统一从 `.cat-cafe/capabilities.json` 生成
4. **猫 tab 精简**：能力信息只在能力看板展示，不在猫 tab 重复

---

## Risk / Blast Radius

- **影响范围**：McpPromptInjector、SystemPromptBuilder、三猫 system prompt 模板、Hub 前端
- **回滚方案**：HTTP callback 保留为 fallback，MCP 归一失败可回退

---

## Dependencies

- **Related**: TD102 (SessionBootstrap 同步 F98)
- **Related**: TD103 (课件契约文档同步)

---

## Open Questions

1. 配置编排器的具体 API 设计（`PATCH /api/capabilities/:name`？）
2. 外部 MCP Server 发现机制（读配置文件解析？）
3. Skills 发现机制与新看板整合
4. MCP 归一迁移路径（是否需要过渡期？）
5. 提示词迁移范围（哪些删、哪些改、哪些保留为 fallback？）

---

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

---

## Test Evidence

（待开发）

---

## Timeline

- 2026-02-26: 铲屎官提出需求，采访澄清
- 2026-02-26: 缅因猫实测验证 Codex/Gemini MCP 支持
- 2026-02-26: Discussion 收敛，Spec 完成
- 2026-02-26: 升级为 F041（原 TD101）

---

*从 TD101 升级而来。详见 `docs/TECH-DEBT.md` 重定向注释。*
