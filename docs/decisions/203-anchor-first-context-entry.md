---
adr: 203
status: accepted
date: 2026-06-15
feature_ids: [F236]
related: [F148, ADR-038, ADR-031]
---

# ADR-203: Anchor-First Context 入口原则

## Status
Accepted — 2026-06-15。宪宪 (opus-48) 发起 + 砚砚 (gpt-5.5/@codex) 独立架构判断收敛，铲屎官 signoff 开 F236。

## Context

源起 rtk（Rust Token Killer）teardown：铲屎官问"能学什么帮我们省 token"。自审 + research（`docs/research/2026-06-15-context-entry-anchor-audit/`）发现：

1. 我们早有 anchor-first 愿景且部分落地——记忆系统（`search_evidence` + `read_file_slice`）是标杆，F148 已治理"过去→context"（消息注入分层）。
2. 但"当下→context"（猫实时调 MCP 工具 / subagent 的返回）全是 dump：`get_thread_context` 默认回 100 条全文 message，单次塞爆窗口。
3. rtk 验证了"工具输出侧压缩有真实 token 收益"，但它是**有损 truncate**（丢内容）；我们的 anchor 是**惰性加载**（指针在、原文按需取、可取回），方向更优——但"可取回" ≠ "认知无损"（preview 仍影响注意力/判断，砚砚 P2）。

## Decision

确立三条原则，作为所有"信息进主 context"入口的架构不变量：

1. **Anchor-first**：进主 context 的返回，默认给"指针 + 预览 + drilldown hint"，全文按需第二跳取。比有损截断好（原文永远可达、可取回），但**非认知无损**——preview 改变猫的注意力/判断，须配 blindness eval（见 F236 信息完整性风险段）。（砚砚 P2 校准 2026-06-17）
2. **最内层封顶**：截断/投影逻辑落在返回值的**最内层**（store / API / route projection helper），不依赖最外层 wrapper——否则换个调用方（HTTP / agent-key / UI）就漏。
3. **双边 eval 公式**：省的是默认 inline payload，drill 是显式成本；净收益 = 省 − drill 成本，不许只报单边下降。anchor tax（猫几乎每次都 drill）触发 sunset。

**适用边界**（amendment 2026-06-17，砚砚 P2）：完全可控（我们的 MCP 工具、route payload）必须遵守；**cc 内置工具：PostToolUse hook 可治**（spike PASS，原"runtime 锁定无能为力"已推翻，见 F236 Phase C）；codex 限 shell（不覆盖 file-read）；**agy observe-only**（PostToolCallHook read-only + F061 实测 view_file LS 自闭环，深路未成立）；opencode 仍锁定（transformer 不发 tool_result）。

## 否决记录

- **否决「reopen F148」**：F148 已 closed，其 scope 是 cold-mention 的"过去→context"消息注入减肥（AC-A5 只承诺历史 tool payload scrub）；本次是实时工具/subagent 的"当下→context"返回侧，边界不同。F148 仅作上游设计来源，新开 F236 更干净。（宪宪 × 砚砚共识）
- **否决「V1 做 outputSchema 迁移 + subagent schema 硬约束」**：cat-cafe 调猫是 subprocess + 事件流（`spawnCli --output-format stream-json`），不走 Agent SDK，Workflow `agent({schema})` 那条路**架构不可达**（全仓 0 命中）；MCP outputSchema（`registerTool`）虽 SDK 支持但 cat-cafe 用旧 `server.tool()`，迁移是架构升级。两者均推迟（Phase B / 另设计），不进 V1。（砚砚实测纠正宪宪初稿）

## Consequences

- ✅ 新工具/返回有明确原则可循（软层 + 后续 lint 硬层堵增量 dump）。
- ✅ 与 F148 形成完整版图（消息侧 + 返回侧）。
- ⚠️ **anchor tax 风险**：drill 多一跳，需双边 eval 持续验证净收益，sunset signal 兜底。
- ⚠️ subagent 返回硬约束仍是 open（subprocess 架构限制），软约束 + 长度 telemetry 过渡，硬层待另设计。

## Links
- F236（落地 feature）/ 收敛纪要 `docs/discussions/2026-06-15-anchor-first-context-entry-meeting-notes.md`
- research `docs/research/2026-06-15-context-entry-anchor-audit/`
- rtk 对照 `docs/discussions/2026-06-15-rtk-deep-dive/`
- 相关 ADR-038（L0 staging）/ ADR-031（软硬 eval 三层）
