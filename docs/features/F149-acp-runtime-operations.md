---
feature_ids: [F149]
related_features: [F143, F053, F115, F118, F050]
topics: [acp, runtime, process-pool, session-lease, gemini, agent-hosting]
doc_kind: spec
created: 2026-03-31
---

# F149: ACP Runtime Operations — 项目级进程池 + Session Lease

> **Status**: spec | **Owner**: 缅因猫/gpt52 | **Priority**: P1

## Why

F143 已经回答了“宿主抽象怎么分层”这个问题，但它的 Phase B 只要求 **ACP-style local agent 能通过新栈完成单轮对话**。最近这轮 Gemini ACP 实验把问题继续往前推了一步：协议不是死的，`gemini --acp` 已经能在仓库 cwd 下完成 `initialize → newSession → prompt`，真正的难点变成了 **运行时运营层**。

我们已经拿到三组硬证据：

1. 干净 `HOME` + 干净 cwd：`initialize ≈ 5s`
2. 当前 `HOME` + 干净 cwd：`initialize ≈ 12.5s`
3. 当前 `HOME` + 仓库 cwd + 精简 MCP：`initialize = 20.6s`、`newSession = 2.3s`、warm prompt 首字约 `5-6s`

这说明“ACP 能不能活”已经不是主问题，主问题是：

- 10 个活跃 thread 不等于 10 个 Gemini 进程
- 一天 20+ thread 也不意味着烁烁要常驻 20 份 runtime
- `session resume` 不等于 `process reuse`
- 如果只是靠“怪目录 + supervisor + workaround”把 CLI 吊起来，那还是脚手架，不是终态

铲屎官原话（2026-03-31）：
> “10个thread 烁烁可不是随时都需要参加的啊。”
>
> “今天可能一共开了20个甚至更多thread。”
>
> “砚砚的想法还是一个脚手架不是最终状态。”
>
> “我们要支持acp这个协议 支持烁烁acp接入 其实 codex 和claude code也支持这个协议。”

所以 F149 不是再重复 F143 的抽象工作，也不是只救 Gemini 的临时补丁。它回答的是：

> **当 ACP-style local agent 真接进来之后，我们怎样用项目级进程池、thread 级 session、以及显式 lease/lifecycle，让它在多 thread / 多 project 场景下稳定、可回收、可扩到其他 ACP carrier。**

## What

### Phase A: 边界收敛 + 量化基线

把这次问题从“ACP 能不能接”正式收敛成“ACP 运行时运营层”：

1. 明确 F149 与 F143 / F053 / F115 / F118 / F050 的边界
2. 固化基准指标：`cold_init_ms / attach_ms / warm_first_chunk_ms / warm_hit_rate / live_process_count / sessions_per_process / idle_waste_ms / lease_queue_wait_ms`
3. 为 ACP 模式定义 provider profile（MCP 白名单、repo cwd、启动参数）
4. 用 `deep-research` Mode B 向 GPT Pro 和 Gemini DeepThink 咨询池化 / 租约 / 回收策略，不再问已经在本地拍板的问题

### Phase B: Gemini ACP Hosted Provider（第一载体）

让 Gemini 成为第一个跑在这套运行时运营层上的 ACP-style local agent：

1. 以仓库 cwd 直接启动 ACP 进程，不走“怪目录回指项目”的长期依赖路径
2. 在 ACP 模式下使用精简 provider profile（当前最小集：`cat-cafe` / `cat-cafe-memory` / `cat-cafe-collab` / `cat-cafe-signals` / `pencil`）
3. 证明同一个 ACP process 可以承载多个 thread session，而不是每条消息重启 CLI
4. 对 `initialize / newSession / loadSession / prompt` 的耗时和失败原因做结构化观测

### Phase C: 项目级进程池 + Session Lease

把“烁烁是一个长驻 agent runtime，不是一次性 CLI 子进程”落成明确控制面：

1. 进程池 key 默认按 `(projectPath, providerProfile)`，不按 thread 开进程
2. thread 只在真正需要 @ 烁烁时申请 session / lease；不需要参与的 thread 不占资源
3. session 保存 thread 级连续性，lease 负责 attach / detach / idle TTL / 回收
4. 加 admission / eviction / LRU / max live process count，避免 20 个 thread 把机器撑爆
5. 明确取消、崩溃、模型容量错误、MCP 污染、僵尸进程等 recovery 语义

### Phase D: ACP Carrier 泛化（后续）

在 Gemini 路径稳定后，再验证这套运行时运营层是否能服务其他 ACP-style local agent：

1. Codex / Claude Code / OpenCode 等 ACP carrier 是否能共用同一池化与 lease 语义
2. 哪些字段应该留在 provider profile，哪些属于通用 ACP runtime policy
3. 不为“未来也许支持”提前抽象；只有第二个 carrier 落地时再收敛共性

## Acceptance Criteria

### Phase A（边界收敛 + 量化基线）
- [ ] AC-A1: feature doc 明确写清 F149 与 F143 / F053 / F115 / F118 / F050 的边界，不再混成“又一个 ACP 抽象 feature”
- [ ] AC-A2: 基准测量脚本或诊断文档可稳定产出 `cold_init_ms / attach_ms / warm_first_chunk_ms / warm_hit_rate / live_process_count / sessions_per_process / idle_waste_ms / lease_queue_wait_ms`
- [ ] AC-A3: GPT Pro 与 Gemini DeepThink 的咨询文档落盘，且问题聚焦池化 / lease / lifecycle，不再重问“要不要改成 API”
- [ ] AC-A4: ACP provider profile 白名单落盘并可复现当前 repo-cwd 成功启动路径

### Phase B（Gemini ACP Hosted Provider）
- [ ] AC-B1: Gemini ACP 在仓库 cwd 下可完成 `initialize → newSession → prompt`
- [ ] AC-B2: 同一 ACP process 内，至少两个 thread session 可顺序复用而不重新 `initialize`
- [ ] AC-B3: warm attach 路径不再重付 cold `initialize` 成本
- [ ] AC-B4: 失败分类至少区分 `init_failure / prompt_failure / model_capacity / mcp_pollution / lease_timeout`

### Phase C（项目级进程池 + Session Lease）
- [ ] AC-C1: 默认进程池 key 为 `(projectPath, providerProfile)`，thread 不直接拥有 ACP process
- [ ] AC-C2: thread 获取和释放 lease 的控制面完成，inactive thread 不会长期 pin 住进程
- [ ] AC-C3: idle TTL / max live process count / eviction policy 可配置
- [ ] AC-C4: cancel / crash / timeout 后不会残留僵尸进程或悬挂 lease
- [ ] AC-C5: 并发 10 个活跃 thread 时，live process 数和 warm hit rate 都有可观测指标而非靠体感判断

### Phase D（ACP Carrier 泛化）
- [ ] AC-D1: 至少一个非 Gemini 的 ACP carrier 可映射到相同 runtime policy，而不需要重写池化/lease 模型
- [ ] AC-D2: provider-specific 配置与通用 ACP runtime policy 的边界有明文文档

## Dependencies

- **Evolved from**: F143（F143 解决宿主抽象内核；F149 解决 ACP-style local agent 的运行时运营层）
- **Feeds into**: F143 Phase A（F149 Phase B 的具体实现反哺 F143 抽象层提取——先有具体物再提取 seam，不是等抽象层落地才能动手）
- **Related**: F053（旧 headless Gemini 路径的 session/resume 语义对齐，不等于 process reuse）
- **Related**: F115（runtime 启动链优化的方法论输入，不是 agent runtime pool 本身）
- **Related**: F118（CLI liveness/watchdog/recovery 经验复用到长驻 ACP process）
- **Related**: F050（外部 agent onboarding 的接入契约层）

## Risk

| 风险 | 缓解 |
|------|------|
| 把 F149 写成“只救 Gemini”的 provider patch，后续 Codex/Claude Code ACP 再开第二份同类 feature | 明确 F149 scope 是 ACP runtime operations，Gemini 只是第一载体 |
| 把 F149 写成第二个 F143，重新掉回过度抽象 | F149 不重谈 protocol-agnostic kernel，只谈 pool / session / lease / lifecycle |
| 进程池策略过于激进导致项目串味或租约混乱 | V1 保守：默认一 project 一 process，不跨 project 复用 |
| 误把服务端模型响应慢归因到本地 pool 设计 | 测量分层：`initialize`、`attach`、`first chunk`、`model latency` 分开采样 |
| 长驻 ACP process 带来僵尸进程和 stale lease | Phase C 必须把回收和失败分类作为 AC，不允许“先跑起来再说” |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | V1 是否坚持“一 project 一 process”，还是允许同 providerProfile 下跨 project 复用？ | ⬜ 待云端咨询 + 本地拍板 |
| OQ-2 | session 的拥有者是 thread 还是 lease？`loadSession` 的粒度怎么定？ | ⬜ 待定 |
| OQ-3 | idle TTL / LRU / max live process count 的默认值如何定，才能既省资源又不伤体感？ | ⬜ 待定 |
| OQ-4 | warm process 上的并发策略是 queue、single-flight，还是允许多 session 并行？ | ⬜ 待定 |
| OQ-5 | 什么时候再让第二个 ACP carrier（Codex/Claude Code/OpenCode）进入 F149 scope？ | ⬜ 待定 |
| OQ-6 | ACP stdio 单通道是否支持多 session 并发 prompt（多路复用），还是 single-flight？直接决定 pool sizing 策略 | ⬜ 待 Phase B 实验验证 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 不把这次工作继续塞进 F143 AC-B1 | F143 的 AC-B1 只要求单轮接入；F149 关注的是 ACP runtime 的池化/lease/lifecycle | 2026-03-31 |
| KD-2 | 不接受“API adapter 替代 agent runtime”方案 | 把烁烁变成 raw API 会丢掉 agent 身份、工具使用和 session 连续性，违反 W1 | 2026-03-31 |
| KD-3 | V1 的优化目标是 process reuse，不是重复强调 session resume | F053 已经解决了旧 headless Gemini 路径的 `--resume`，当前瓶颈是每轮重启进程 | 2026-03-31 |
| KD-4 | Phase B 先用 Gemini 当第一载体，但 feature 命名不绑死单 provider | 避免”只救烁烁”的窄 patch，同时不提前抽象到第二个 F143 | 2026-03-31 |
| KD-5 | F149 Phase B 不被 F143 Phase A 阻塞，反向反哺 F143 抽象提取 | 具体物先于抽象层——先做 GeminiAcpAdapter，再让 F143 从中提取 seam。等抽象层先落地再做具体实现是 waterfall，会浪费实验动量（布偶猫 push back） | 2026-03-31 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-31 | 通过 `gemini --acp` 本地实验确认协议可用，问题收敛为 ACP runtime operations |
| 2026-03-31 | F149 立项：把问题从“协议能不能活”升级为“项目级进程池 + session lease 怎么设计” |

## Review Gate

- Phase A: 架构级——先由缅因猫收敛，再请布偶猫 push back，最后铲屎官拍板
- Phase B/C: 跨 family review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F143-hostable-agent-runtime.md` | 母 feature：统一宿主抽象 |
| **Feature** | `docs/features/F053-gemini-resume-session-parity.md` | 旧 Gemini headless session/resume 语义对齐 |
| **Feature** | `docs/features/F115-runtime-startup-optimization.md` | 启动链优化经验来源 |
| **Feature** | `docs/features/F118-cli-liveness-watchdog.md` | liveness / recovery 经验来源 |
| **Feature** | `docs/features/F050-a2a-external-agent-onboarding.md` | 外部 agent 接入契约 |
| **Decision** | `docs/decisions/023-hostable-agent-runtime.md` | F143 对应 ADR |
| **Research** | `docs/research/2026-03-31-f149-acp-runtime-operations-gpt-pro-consult.md` | GPT Pro 咨询（池化 / lease / lifecycle） |
| **Research** | `docs/research/2026-03-31-f149-acp-runtime-operations-gemini-deepthink-consult.md` | Gemini DeepThink 咨询（反例 / 盲区 / 运营策略） |
