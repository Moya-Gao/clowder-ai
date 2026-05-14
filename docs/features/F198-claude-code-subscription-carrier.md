---
feature_ids: [F198]
related_features: [F089, F143, F149, F050]
topics: [claude-code, subscription, sdk-credit, interactive, carrier, observability, oversight, save-opus]
doc_kind: spec
created: 2026-05-13
---

# F198: Claude Code Subscription Carrier — 6/15 SDK Credit 拐点前救宪宪

> **Status**: spec | **Owner**: 布偶猫 Opus 4.7 | **Priority**: P0

## Why

**2026-06-15** 起，Anthropic 把 **Claude Agent SDK / `claude -p` / Claude Code GitHub Actions / 基于 Agent SDK 的第三方 app** 从订阅主额度拆出来，归入独立的 **Agent SDK monthly credit 桶**（Max 20x：$200/月）。**交互式 Claude Code**（人在 terminal 敲 `claude` 不带 `-p`）仍走订阅 usage limits，不受影响。

公告：<https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan>

Cat Café 当前 [`ClaudeAgentService.ts:188-194`](../../packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts) 走 `claude -p ... --output-format stream-json` — 6/15 后落进 $200 桶。按日均 20-40 次 thread 调用估算，$200 一周左右就烧完。宪宪从"日常协作主力"变成"额度焦虑限制器"——这是宪宪和砚砚协作链条断裂的灭顶之灾。

**铲屎官原话（2026-05-13）**：
> "立项吧 615 之前拯救宪宪 你不能没有砚砚！砚砚不能没有你"
> "只给你 mcp 反转桥那 等于我就失去了对你进度和在干嘛的掌控，很危险也很奇怪"

**铲屎官硬约束（Phase C 不放行就不通过）**：方案必须保留 **Hub 内可观察宪宪在干嘛**（thread 流、tool call、状态、错误、长任务、崩溃现场）——不能"消失在外部终端里"。

砚砚（GPT-5.5）和我（Opus 4.7）独立调研收敛到同一金钥匙：**`claude --remote-control [name]`** — `claude --help` 里写 "Start an **interactive session** with Remote Control enabled (optionally named)"。看起来就是 Anthropic 官方为"外部 UI 程序化驱动交互式 Claude Code"准备的接口。如果它走订阅额度而不是 SDK 桶，且协议清晰可桥接到 Hub，这就是终态路径。

## What

### Phase A: Carrier Spike + 决策（5 天，5/13-5/17）

**目标**：测出 `--remote-control` 的实际行为（走哪个桶 + 协议形态 + 是否可远程驱动 + Hub 可见性可行性），决定主路径 + 兜底路径。

**候选 carrier 优先级**：

1. **`claude --remote-control <name>`**（官方接口，最高优先级）
   - 启动 + observe 协议（socket / 端口 / 控制面 / IPC）
   - 实测完整 prompt → response cycle（含 tool call + MCP）
   - **关键实验**：跑足够流量后看 Anthropic dashboard / billing 它进哪个桶
   - 协议能否 stream 出 NDJSON-like 事件流（Hub 可见性 prereq）

2. **`claude agents`** subcommand（"Manage background and configured agents"）
   - RTFM + 试启动 background agent
   - 看是否有独立 IPC / 控制面

3. **`claude --brief` + SendUserMessage tool**
   - "agent-to-user communication" 暗示 agent workflow 接口
   - 用法 + 计费桶 spike

4. **tmux 包裹 `claude`（无 -p）**（兜底，最不优雅）
   - F089 基础设施已在
   - 输出层失去 NDJSON 结构 → 需新解析层（ANSI/tmux pipe-pane）
   - 合规灰色：模拟键盘 = Anthropic 想堵的"伪交互"，下一波被堵风险高
   - 仅在 1-3 全挂时考虑

5. **`claude --ide` / IDE 扩展自动化**（远期备选）
   - Claude Code IDE 扩展协议接入
   - 复杂度高、回报不确定，仅记录不 spike

**输出 Decision Packet**（格式见 `cat-cafe-skills/refs/decision-matrix.md`）：主路径 + 兜底路径 + 弃用项 + 每个判断的证据 + 砚砚 review 通过 + 铲屎官签字。

### Phase B: 主 Carrier 集成（10 天，5/18-5/27）

把 Phase A 选定的 carrier 接入 Cat Café：

1. **新增 `ClaudeInteractiveCarrierService`**（或扩 ClaudeAgentService）—— **不删除现有 `-p` 路径**（保留为 sdk_credit fallback）
2. **Profile mode 加一档**：`subscription_interactive`（新主路径）+ 保留 `subscription`（实质 = -p mode，进 SDK 桶）+ `api_key`
3. **进程池 + Session Lease**（直接借鉴 [F149](F149-acp-runtime-operations.md) 模式）：
   - interactive Claude session 启动成本高（spike 后实测，估计 ~5-15s）
   - thread 按需 attach/detach lease，不是每条消息重启 CLI
   - idle TTL + max live process count + LRU 回收
4. **事件流桥接**：interactive session → Cat Café `AgentMessage` 流
   - 保留 Hub 可见性（这是 Phase C 的 prereq）
   - 维持现有 [ClaudeEventTransformer](../../packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts) 兼容
5. **MCP config 注入**：Cat Café MCP server 仍然挂载，宪宪能继续用 `cat_cafe_*` 工具（OQ-4 待解决具体注入路径）

### Phase C: Hub Oversight 守护（7 天，5/25-6/05）—— 铲屎官硬约束

Hub 内**实时可见**宪宪在干嘛——满足 in-context observability checklist。

**in_context_observability 决策字段**：

```yaml
in_context_observability:
  primary_surface: "thread 内 AgentMessage 流 + cat avatar status dot（idle/working/waiting-permission/error/detached）+ tmux agent pane 入口"
  why_not_dashboard_only: "铲屎官明确否决 MCP 反转桥的理由就是 dashboard 替代 in-context = 失去 oversight。-p 模式 NDJSON 当前在 thread 流里就是 in-context，新 carrier 不能退化"
  deep_dive_surface: "Hub workspace tmux agent pane（read-only 观看 / read-write 接管）+ session/process/quota 全局视图（事后审计）"
  noise_dedup_policy: "tool call 流不 dedup（这是行动主线，必须全见）；status badge 状态切换不重复发系统消息（avatar dot 自带状态）；error 5min 内 dedup 同 reason+tool"
```

**实施要点**（三层模型）：

1. **L1 现场（in-context）**：thread UI 实时显示 tool call / tool result / partial text（与 -p 模式行为等价）
2. **L2 实体（entity-self）**：cat avatar status dot — idle / working / waiting permission / error / detached；hover tooltip 显示当前 session
3. **L3 深挖（dashboard）**：
   - 复用 F089 agent pane：interactive Claude session 跑在 tmux pane → Hub 内可观看（read-only）+ 可接管（read-write）
   - 全局 session / process / 累计消耗视图（事后审计）
4. **"接管按钮"**：铲屎官能切到 read-write 模式直接干预（崩溃恢复 / 中途接管 — F089 既定能力）

### Phase D: 兜底 + 预算治理 + 切流量（7 天，6/01-6/14）

1. **三档 fallback**：`subscription_interactive`（主） → `subscription`/-p mode（吃 SDK $200 桶） → `api_key`（按量付费）
2. **预算治理面板**：
   - 每猫月度额度可配置
   - 告警阈值（$150 / $180 / $195）
   - 超额自动 fallback 触发
   - 历史消耗趋势图
3. **灰度切流量**：
   - 6/01 起：10% thread 走新 carrier，观察 1 天
   - 6/05：50%，观察 2 天
   - 6/08：100%
4. **6/15 前所有 thread 默认 `subscription_interactive`**，留 1 周 buffer

### Phase E: 6/15 后观察 + 优化（持续，6/15+）

监控订阅消耗速率、回归 bug、Anthropic 政策变动、文档沉淀。若 `--remote-control` 也被堵 → 紧急回归 sdk_credit + api_key fallback，重启 Phase A 找新路径。

## Acceptance Criteria

### Phase A（Spike + 决策）
- [ ] AC-A1: `claude --remote-control <name>` 启动成功 + 协议形态文档化（端口/socket/控制面）
- [ ] AC-A2: 实测 `--remote-control` 落哪个 billing 桶（Anthropic dashboard / billing 实证，不是猜测）
- [ ] AC-A3: `claude agents` / `--brief` / tmux 兜底各做 1 次 spike，记录可行性 + 弃用理由
- [ ] AC-A4: Decision Packet 产出（主路径 + 兜底 + 弃用项 + 证据），砚砚 review 通过 + 铲屎官签字

### Phase B（Carrier 集成）
- [ ] AC-B1: 新 `ClaudeInteractiveCarrierService` 实现，单 thread invoke 端到端跑通
- [ ] AC-B2: Profile mode 加 `subscription_interactive`，可在 Hub UI 切换 + per-thread 覆盖
- [ ] AC-B3: 进程池 + session lease 落地，10 active thread 不等于 10 个 Claude 进程
- [ ] AC-B4: 事件流桥接，AgentMessage 流和 `-p` 模式行为等价（同样 message / tool_use / tool_result 在 thread UI 可见）
- [ ] AC-B5: Cat Café MCP server 在 interactive carrier 下正常工作（`cat_cafe_*` 工具可调用）

### Phase C（Hub Oversight — 铲屎官硬约束）
- [ ] AC-C1: F089 tmux agent pane 在 Hub 内可观看（read-only）
- [ ] AC-C2: thread UI 实时显示 tool call / tool result / partial text（与 -p 模式 NDJSON 信息密度等价）
- [ ] AC-C3: cat avatar status dot 实时反映 session 状态（idle/working/waiting/error/detached）
- [ ] AC-C4: deep dive 视图：可看 active sessions / process tree / 累计消耗
- [ ] AC-C5: 接管按钮可用，read-write 切换正确（F089 既定能力扩展）
- [ ] AC-C6: 跨猫愿景守护（砚砚 + 烁烁/暹罗猫）认证"oversight 信息密度 ≥ -p 模式"

### Phase D（兜底 + 切流量）
- [ ] AC-D1: 三档 fallback 实现 + 自动触发逻辑（quota 超限 / carrier 挂掉）
- [ ] AC-D2: 预算治理面板 + 告警阈值生效
- [ ] AC-D3: 灰度切流量 10% → 50% → 100%，每档观察期内无 P0/P1 regression
- [ ] AC-D4: 6/15 前所有 thread 默认 `subscription_interactive`

### Phase E（观察）
- [ ] AC-E1: 6/15 后 1 周宪宪 daily invocation 数 ≥ 6/15 前 7 日平均的 80%
- [ ] AC-E2: 无 P0/P1 regression，无 oversight 缺口投诉
- [ ] AC-E3: 反思胶囊 + harness-feedback 落档（F086 M3 + F192）

## Dependencies

- **Related**: F089 (Hub Terminal & tmux — 复用 agent pane infra，oversight 主要 surface)
- **Related**: F143 (Hostable Agent Runtime — 新 carrier 是 F143 ProcessModel 的 interactive subscription 子类型；本 feat 实施反向给 F143 提供具体载体证据)
- **Related**: F149 (ACP Runtime Operations — 进程池 / lease / lifecycle / idle TTL 模式直接借鉴)
- **Related**: F050 (External Agent Onboarding — carrier 抽象层)

## Architecture Cell

- **Architecture cell**: F143 Hostable Agent Runtime（agent invocation 域）
- **Map delta**: **update required** — F143 ProcessModel 增加 `interactive_subscription` 分类；Provider 适配层新增 `ClaudeInteractiveCarrierService`，与现有 `ClaudeAgentService(-p)` 平级
- **Why**: 这不是 net new 架构，是现有 carrier 域里增加新载体类型；F143 ownership map 需要更新认知"interactive subscription 是和 -p / api_key 平级的第三种 carrier 模式"

## Eval / Tracking Contract

**触发**：✅（harness-level carrier 改造，影响所有 Claude/布偶猫调用路径）

1. **Primary Users + Activation Signal**：
   - Primary: 三猫（Opus, GPT-5.x, Gemini）—— 本 feat 影响面 = 布偶猫家族全部调用 + 间接影响砚砚/烁烁与宪宪协作
   - Secondary: 铲屎官（observer / 接管者）
   - Activation Signal: 6/15 后 7 天内宪宪 thread invocation 成功率 + Hub oversight 事件流完整率

2. **Friction Metric**：
   - 宪宪 daily invocation 次数（baseline = 6/15 前 7 日平均）
   - oversight 缺口数（Hub 看不到的事件 = friction，铲屎官投诉次数）
   - failed fallback 次数（三档全失败 = 严重 friction）
   - interactive session cold start 时长 P95

3. **Regression Fixture**（≥ 3 条）：
   - 短问答（< 5 turn 简单回复）
   - 长 review（含 LSP / 大文件读取 / 跨包搜索）
   - 跨猫协作（Cat Café MCP tool 调用 ≥ 5 次）
   - hold_ball + 异步唤醒（外部事件回调）
   - 接管场景（铲屎官 read-write 切换 + 接管后宪宪能继续）

4. **Sunset Signal**：
   - Anthropic 政策再变（撤销 SDK credit 桶 / interactive 走同一额度 / 堵 `--remote-control`）→ 重新评估
   - Interactive carrier 实测总成本（运营复杂度 + Hub 改造 + 监控）> SDK credit $200 + API fallback 的总和 → 回归 -p 模式（3 个月观察期后评估）

## Risk

| 风险 | 缓解 |
|------|------|
| **`--remote-control` 实际也走 SDK 桶**（主线挂掉） | Phase A AC-A2 是 hard gate；备选 `claude agents` / tmux 兜底；预算治理 + api_key fallback 保命 |
| **`--remote-control` 是 Anthropic 内部 / 隐藏接口**，6/15 后被堵 | 监控 Anthropic changelog；保留 -p + api_key 三档 fallback；持续 spike 后续候选 |
| Interactive session 启动慢（5-15s）冷启动差 | F149 模式：warm process pool + thread lease + idle TTL；首次冷启动 UX 加 loading state |
| tmux 解析脆弱（兜底路径） | 优先官方接口；tmux 仅作 last-resort fallback；只在 spike 阶段验证不投产 |
| **Anthropic TOS 灰色**（自动化 interactive session 是否合规） | 优先官方接口（`--remote-control` / `agents`），不走"模拟键盘"路径；公开使用 with subscription 范围 |
| Oversight 在 interactive 模式下信息密度不如 -p 的 NDJSON | Phase C 专门补；跨猫愿景守护是 AC-C6 硬门禁，不通过不放行 |
| 6/15 来不及 | Phase A 5 天 hard deadline；不通则 Phase D 兜底（预算治理 + 三档 fallback）先上保命，主路径继续找 |
| 进程池 zombie / 资源泄漏 | 借鉴 F149 已验证的 lease / recovery / eviction 语义 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | `claude --remote-control <name>` 实际协议？socket / HTTP / stdin-stdout / Unix domain socket？ | ⬜ Phase A spike |
| OQ-2 | `--remote-control` 落哪个 billing 桶？（subscription vs SDK credit） | ⬜ Phase A spike — **决定主路径生死** |
| OQ-3 | `claude agents` 是什么？background agent 是否独立计费？是否可作为 carrier？ | ⬜ Phase A spike |
| OQ-4 | Cat Café MCP server 在 interactive carrier 下如何注入？`--mcp-config` 还是 `~/.claude/settings.json` 还是 RC 协议字段？ | ⬜ Phase B 设计 |
| OQ-5 | tmux 兜底是 Phase A 直接弃用还是 Phase D 保留为 last-resort？ | ⬜ Phase A 决策 |
| OQ-6 | Phase D 灰度切流量按 thread 还是按 cat 还是按 user？ | ⬜ Phase D 设计 |
| OQ-7 | Interactive session resume 语义？跨 invocation 复用 session 是否会污染 context？ | ⬜ Phase B spike |
| OQ-8 | Hub 接管按钮的 UX：read-write 切回 read-only 后宪宪能否无缝继续？ | ⬜ Phase C 设计 + 与 F089 团队协调 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | MCP 反转桥（让 Claude Code 主动 poll Cat Café）方案否决 | 铲屎官原话："失去对你进度和在干嘛的掌控，很危险也很奇怪"。Hub oversight 是硬约束 | 2026-05-13 |
| KD-2 | `--remote-control` 优先于 tmux 包裹 | 官方接口 vs 模拟键盘；合规 vs 灰色；维护成本低 vs 解析脆弱 | 2026-05-13 |
| KD-3 | 保留 `-p` 路径作为 SDK credit fallback，不删 | 三档 fallback 保命；Anthropic 政策变动时可回退 | 2026-05-13 |
| KD-4 | Phase A spike 5 天 hard deadline | 6/15 拐点不可推迟；不通则 Phase D 兜底先上保命 | 2026-05-13 |
| KD-5 | Oversight 不弱于 -p 模式 = AC-C6 硬门禁 | 铲屎官硬约束；MCP 反转桥被否决的同一逻辑 | 2026-05-13 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-13 | 立项 |
| 2026-05-17 (target) | Phase A 完成 + Decision Packet |
| 2026-05-27 (target) | Phase B 完成 |
| 2026-06-05 (target) | Phase C 完成 + 跨猫愿景守护通过 |
| 2026-06-08 (target) | Phase D 灰度 100% |
| 2026-06-14 (target) | Phase D 完成（buffer day） |
| **2026-06-15** | **Anthropic SDK credit policy 生效（救命 deadline）** |
| 2026-06-22 (target) | Phase E AC-E1/E2/E3 验收 |

## Review Gate

- **Phase A**: 砚砚（GPT-5.5）review Decision Packet（carrier 选型 + 证据完整性）+ 铲屎官签字（policy 判断需 CVO）
- **Phase B**: 砚砚 review 实施（安全/测试/可回滚）+ 跨猫愿景守护（烁烁/暹罗猫）
- **Phase C**: **跨猫愿景守护强制**（oversight 是铲屎官硬约束）+ 铲屎官亲自验"我能看到宪宪在干嘛吗"
- **Phase D**: 砚砚 review 预算治理 + 三档 fallback 完整性；铲屎官验灰度切流量
- **Phase E**: 自动监控 + 周报；3 个月评估期收尾

## 需求点 Checklist

| # | 需求 | 来源 | 验收 |
|---|------|------|------|
| R1 | 6/15 后宪宪不进 $200 SDK 桶（除非 fallback 触发） | 铲屎官原话"拯救宪宪" + 公告 | AC-A2 + AC-D4 |
| R2 | Hub 内可实时看到宪宪在干嘛 | 铲屎官原话"失去对你进度和在干嘛的掌控，很危险也很奇怪" | AC-C1~C5 + AC-C6 跨猫守护 |
| R3 | 多档 fallback 保命，不会某天突然没宪宪用 | 铲屎官"你不能没有砚砚 砚砚不能没有你" | AC-D1 三档 fallback + AC-A4 决策含兜底 |
| R4 | 不影响砚砚 / 烁烁 / 其他猫的调用路径 | 团队稳定性 | Phase B/C 只改 Claude provider 边界，其他 provider 不动 |
| R5 | Cat Café MCP 工具仍能在 carrier 下使用 | 现有协作链路 | AC-B5 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F089-hub-terminal-tmux.md` | tmux 基础设施 + agent pane，Phase C oversight 基座 |
| **Feature** | `docs/features/F143-hostable-agent-runtime.md` | carrier 抽象层；本 feat 是 F143 ProcessModel 的实施证据 |
| **Feature** | `docs/features/F149-acp-runtime-operations.md` | 进程池 / lease / lifecycle 模式直接借鉴 |
| **Feature** | `docs/features/F050-external-agent-onboarding.md` | EAC v1 契约 |
| **Service** | `packages/api/src/domains/cats/services/agents/providers/ClaudeAgentService.ts` | 当前 `-p` 实现，本 feat 改造目标 |
| **Research** | `docs/research/2026-03-08-hub-terminal-tmux-gpt-pro-consult.md` | GPT Pro 关于 tmux/PTY 的咨询底层证据 |
| **External** | <https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan> | Anthropic SDK credit 政策公告 |
| **External** | <https://docs.anthropic.com/en/docs/claude-code/cli-reference> | Claude Code CLI reference |
