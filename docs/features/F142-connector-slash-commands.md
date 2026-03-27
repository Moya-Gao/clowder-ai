---
feature_ids: [F142]
related_features: [F088, F127, F132, F137]
topics: [connector, slash-command, extensibility]
doc_kind: spec
created: 2026-03-27
---

# F142: Connector Slash Commands — 跨平台 /slash 扩展框架

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2

## Why

铲屎官原话（2026-03-27）：
> "跨平台的 slash，因为在自己家里似乎用不到 slash，有什么直接抓你这大头猫问问不就好了？所以我们 scope 得收敛一下？家里什么可视化界面都有，slash 用的比较少，但是在飞书、微信的时候有的时候就可能需要的？"

Hub 有完整可视化界面（侧边栏、面板、命令速查），slash 命令是锦上添花。但在飞书/微信/Telegram 等纯文字 IM connector 里，**slash 是唯一的结构化交互入口**——用户没有 UI 可以点击，只能打字。

当前问题（砚砚 review 发现）：
1. **Registry 与执行漂移**：`command-registry.ts` 注册了 25+ 命令，但 connector 侧 `ConnectorCommandLayer` 只实现了一小部分
2. **双轨分裂**：Web 端 `useChatCommands` 和 Connector 端 `ConnectorCommandLayer` 是两套独立系统，无统一命令注册/冲突策略
3. **无扩展机制**：加命令 = 手改代码，不支持 skill/MCP 动态注册
4. **关键命令缺失**：`/commands`（列出可用命令）、`/cats`（查看猫猫）、`/status`（thread 概览）在 connector 端都没有

## What

### Phase A: 核心 Connector 命令 + Registry 收敛

**重点：先让 connector 端好用，收敛注册表漂移。**

1. **新增 3 个 connector 核心命令**：
   - `/commands` — 列出当前 connector 可用的所有 slash 命令（含用法和描述）
   - `/cats` — 查看当前 thread 的猫猫（已加入 + 可调度但未加入）
   - `/status` — thread 概览（标题、创建时间、参与猫数、最近活跃）

2. **命令注册统一**：
   - `CommandDefinition` 增加 `surface: 'web' | 'connector' | 'both'` 字段
   - 清理幽灵命令（注册了但不可执行的，如 `/game status`、`/game end`）
   - 注册表-执行器一致性测试（声明的命令必须有可执行的 handler）

3. **聚合 API**：
   - `GET /api/threads/:id/cats` — 返回 participants + routableNow + routableNotJoined
   - `GET /api/commands?surface=connector` — 返回当前可用命令列表

### Phase B: Skill 声明式命令注册

**重点：让 skill 可以自带 slash 命令，不改核心代码。**

1. **SKILL.md 扩展**：
   - 新增 `slashCommands` 字段，声明命令名、用法、描述、surface
   - 后端启动时扫描已挂载 skills → 注册到统一命令表
   - 冲突规则：`core > skill > mcp`，同级禁止重名

2. **命令解析统一**：
   - 统一解析器（最长匹配 + 参数切分），替换当前混用的 `isCommandInvocation` / `startsWith`
   - Connector 和 Web 共用解析器，handler 按 surface 分发

3. **可观测性**：
   - 每次 slash 执行打审计事件（命令名、来源 surface、耗时、成功/失败）

## Acceptance Criteria

### Phase A（核心命令 + Registry 收敛）
- [ ] AC-A1: 飞书/Telegram connector 中输入 `/commands` 返回当前可用命令的文字列表
- [ ] AC-A2: `/cats` 在 connector 中返回：当前 thread 参与猫列表 + 可调度但未加入的猫列表
- [ ] AC-A3: `/status` 在 connector 中返回 thread 标题、创建时间、参与猫数、最近活跃时间
- [ ] AC-A4: `CommandDefinition` 包含 `surface` 字段，`/commands` 按 surface 过滤
- [ ] AC-A5: 清理幽灵命令，注册表-执行器一致性测试通过（声明 = 可执行）
- [ ] AC-A6: `GET /api/threads/:id/cats` 聚合 API 可用
- [ ] AC-A7: Hub 端无功能回退（现有命令行为不变）

### Phase B（Skill 声明式注册）
- [ ] AC-B1: SKILL.md 支持 `slashCommands` 字段，后端启动时自动发现并注册
- [ ] AC-B2: skill 命令不能覆盖 core 命令（冲突即拒绝注册 + 告警）
- [ ] AC-B3: 统一命令解析器替换现有混合解析方式
- [ ] AC-B4: slash 执行审计事件可在日志中追溯

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "查询有什么 /slash" | AC-A1 | connector 端实际输入测试 | [ ] |
| R2 | "查询某个 thread 现在有多少猫猫可以使用（已加入）以及可调度的猫猫" | AC-A2, AC-A6 | connector 端实际输入 + API 测试 | [ ] |
| R3 | "支持自定义 /slash" | AC-B1 | SKILL.md 声明命令 → connector 可用 | [ ] |
| R4 | "通过插件或容易的方式集成" | AC-B1, AC-B2 | 写 SKILL.md 即扩展，无需改核心代码 | [ ] |
| R5 | scope 收敛到 connector 端（飞书/微信） | AC-A4, AC-A7 | Hub 无变化，connector 有增强 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— N/A，本 feature 无前端 UI 改动

## Dependencies

- **Evolved from**: F088（Multi-Platform Chat Gateway — connector 基础设施）
- **Related**: F127（猫猫管理重构 — `/cats` 命令数据源）
- **Related**: F132（钉钉/企微 — 更多 connector 平台受益）
- **Related**: F137（微信 — 更多 connector 平台受益）

## Risk

| 风险 | 缓解 |
|------|------|
| Skill 命令与 core 命令冲突 | core > skill 优先级 + 冲突检测 + 拒绝注册 |
| ConnectorCommandLayer 改动影响现有飞书/Telegram | Phase A 增量添加，不改现有命令行为 + 回归测试 |
| `/cats` 数据准确性（猫状态是动态的） | 复用现有路由逻辑，不另造计算口径 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase B 是否需要支持 MCP 工具注册命令？ | ⬜ 未定（先做 skill 声明式，预留接口） |
| OQ-2 | `/cats` 是否显示猫的当前状态（忙/空闲/离线）？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Scope 收敛到 connector 端，Hub 端不动 | 铲屎官明确：家里有 UI，slash 主要用在飞书/微信 | 2026-03-27 |
| KD-2 | 扩展机制选 Skill 声明式（不是 MCP 优先） | 90% 扩展需求是 skill 驱动，SKILL.md 已有 triggers 机制自然延伸 | 2026-03-27 |
| KD-3 | 命令注册增加 surface 维度 | 避免"注册了但当前入口不能用"的用户困惑（砚砚建议） | 2026-03-27 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-27 | 立项，铲屎官 + 宪宪 + 砚砚讨论确认 scope |

## Review Gate

- Phase A: 砚砚 review（他已经深度分析过现状）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F088-multi-platform-chat-gateway.md` | 父级：connector 基础设施 |
| **Feature** | `docs/features/F127-cat-instance-management.md` | 相关：猫猫数据源 |
