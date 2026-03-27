---
feature_ids: [F142]
related_features: [F088, F127]
topics: [connector, slash-command, extensibility, design-gate]
doc_kind: discussion
created: 2026-03-27
---

# F142 Discussion: Connector Slash Commands — Scope 讨论 + Design Gate

## 参与者

- 铲屎官（Landy）— 需求提出 + scope 收敛
- 宪宪（Opus 4.6）— 方案设计 + spec 编写
- 砚砚（Codex Spark）— 安全审查 + 架构 review

## 铲屎官原话

> "我在想我们的 im hub 或者说 f088 这里还少一个能力，支持自定义 /slash，查询有什么 /slash？比如我可能想查询某个 thread 现在有多少猫猫可以使用（或者说已经加入），以及就算没加入但是也可以调度的猫猫。可能还会有各种不同的 slash 需求。现在我们都有哪些？还有哪些我们可能有用但是没写出来呢？能支持自定义吗？通过插件？还是？怎么样容易的方式集成呢？"

> "跨平台的 slash，因为在自己家里似乎用不到 slash，有什么直接抓你这大头猫问问不就好了？所以我们 scope 得收敛一下？家里什么可视化界面都有，slash 用的比较少，但是在飞书、微信的时候有的时候就可能需要的？"

## 讨论过程

### Round 1: 需求分析 + 现状盘点

**宪宪**分析了现有 28 条命令（7 个分类），提出三种扩展方案：
- A: Skill 声明式（推荐）
- B: MCP 工具注册
- C: 混合（A+B + 核心命令）

**铲屎官 scope 收敛**：只做 connector 端（飞书/微信/Telegram），Hub 端有可视化界面不需要 slash。

### Round 2: 砚砚 Review v1（3P1 + 2P2）

1. **P1 Scope 冲突**：Phase A 说"只做 connector"但又包含 `surface` 字段改动会波及 Web
2. **P1 `/cats` 口径未定义**：AC 不可判真伪
3. **P1 API 权限缺失**：`GET /api/threads/:id/cats` 缺 owner 校验
4. **P2 Phase B 安全 AC 不完整**：缺元数据注入/权限绕过/DoS 防护
5. **P2 不应直接扫 SKILL.md**：已有 manifest/capabilities 链路

**宪宪修订 → v2**：全部采纳。

### Round 3: 砚砚 Review v2（2P1 + 2P2）

1. **P1 A0 scope 矛盾**：清理幽灵命令需碰 Web `command-registry.ts`，跟"不碰 Web"矛盾
2. **P1 权限定义不成立**：thread `participants` 是猫 ID 非人类用户
3. **P2 命令名正则太严**：不支持 `/xxx yyy` 多段命令
4. **P2 `unavailable` 语义不闭环**：上游 status API 仍是占位值

**宪宪修订 → v3**：全部采纳。

### Round 4: 砚砚确认收敛

v3 无 P1/P2 阻塞项，可收敛。唯一 P3 建议：`notRoutable` 后续可加 `reason` 字段区分 `available_false` vs `service_missing`（已记入 OQ-3）。

## 关键决策汇总

| # | 决策 | 理由 |
|---|------|------|
| KD-1 | Scope 收敛到 connector 端 | 铲屎官明确：家里有 UI，slash 主要用在飞书/微信 |
| KD-2 | 扩展机制选 Skill 声明式 | 90% 扩展需求是 skill 驱动 |
| KD-3 | `surface` 维度推 Phase B | 避免 Phase A 波及 Web 端 |
| KD-4 | A0 仅允许减法 | 明确"不碰 Web"的边界 |
| KD-5 | `/cats` 口径锚定 AgentRouter | 不另造计算逻辑 |
| KD-6 | 走 manifest/capabilities 链路 | 复用已有基础设施 |
| KD-7 | 权限用 connector binding owner | participants 是猫 ID |
| KD-8 | 支持 subcommands 数组 | 覆盖多段命令风格 |
| KD-9 | notRoutable 不区分忙/闲 | 上游未就绪 |

## Design Gate 结论

**类型判断**：纯后端（Connector 命令层 + API），无前端 UI 改动。

**确认路径**：猫猫讨论达成共识（宪宪 + 砚砚两轮 review 收敛）。

**结论**：**Design Gate PASSED** — spec v3 经两轮 review 收敛，无 P1/P2 阻塞项。可进入 writing-plans。

## Open Questions（实现期处理）

| # | 问题 |
|---|------|
| OQ-1 | Phase B 是否需要支持 MCP 工具注册命令？ |
| OQ-2 | notRoutable 是否需要忙/闲细分？ |
| OQ-3 | notRoutable 是否需要 reason 字段（available_false / service_missing）？ |
