---
feature_ids: [F065]
related_features: [F024]
topics: [session, chain, bootstrap, memory, continuity]
doc_kind: spec
created: 2026-03-05
---

# F065: Session Continuity — 封印重生，记忆不断

> 状态: spec
> 负责猫: 布偶猫（实现）+ 缅因猫（review）
> 日期: 2026-03-05
> Evolved from: F024 (Session Chain + Context Health)

---

## Why

猫猫的 session 被封印（context 达到阈值）后，新启动的 session 几乎"失忆"：

1. **猫猫崇崇（Task 列表）丢失** — 新猫不知道有哪些任务、做到哪了
2. **Extractive digest 只有机械信息** — 工具列表 + 文件列表，没有"在做什么、为什么、下一步"
3. **Bootstrap 没有引导猫使用已有的查询工具** — MCP 工具已补齐（TD098 已完成 view 模式 + invocation detail + search 指针），但 bootstrap 引导路径未更新
4. **没有线程级滚动记忆** — Session 5 对 Session 1 完全失明

铲屎官原话："Session chain 新启动的猫需要继承过去的猫的猫猫崇崇。现在是你之前的 chain 上下文超过了被封印了，然后启动后的新 session 的你，我估计是没自动继承这个 plan 的。"

铲屎官明确的恢复哲学：**搜文件树那样搜 session chain → invocation → 文件树**。不是让快没 context 的旧猫写总结——那时候他已经记不清了。

## What

补齐 F24 Phase D/E 的最后一公里，让封印重生的猫能快速恢复上下文。

### Phase A: Bootstrap 增强（最快见效）

1. **Task 快照注入** — `buildSessionBootstrap` 查询 `TaskStore.listByThread(threadId)`，格式化注入 bootstrap
2. **Thread metadata 注入** — 当前 feature ID、branch name 等关键上下文（如果 thread metadata 中有的话）
3. **Bootstrap 引导路径更新** — 推荐 `read_invocation_detail` 和 `view=handoff` 路径（原 TD102）

### Phase B: ThreadMemory（线程级滚动记忆）

解决"Session 5 对 Session 1 失明"问题：

1. **ThreadMemory** — 每次 seal 时追加/更新一段线程级摘要（有上限，如 3k-6k tokens）
2. Bootstrap 注入 ThreadMemory + last session digest
3. 生成方式：先用规则提取（从 extractive digest 聚合），后续可升级为 LLM 生成

### Phase C: Handoff Digest（可选增强）

1. `digest.handoff.md` — seal 后用便宜模型生成会议纪要
2. Session 2 bootstrap 优先用 handoff digest，没有则降级用 extractive

## Acceptance Criteria

| # | AC | Phase |
|---|-----|-------|
| AC-1 | 新 session bootstrap 包含当前 thread 的 Task 列表（猫猫崇崇）快照 | A |
| AC-2 | 新猫一醒来就知道"有 N 个任务，完成 M 个，当前在做哪个" | A |
| AC-3 | Bootstrap 引导路径包含 `read_invocation_detail` 和 `view=handoff` 推荐 | A |
| AC-4 | 封印重生的猫能通过已有 MCP 工具自主搜索旧 session 并恢复上下文 | A |
| AC-5 | Bootstrap 总 token cap 在 serial/parallel 两条路径都生效（含增量模式） | A |
| AC-6 | Task 快照内容按数据展示处理，包含注入防护与截断测试 | A |
| AC-7 | ThreadMemory 在每次 seal 时更新，新 session bootstrap 注入 | B |
| AC-8 | Session 5 的猫能通过 ThreadMemory 了解 Session 1 的关键信息 | B |

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "新启动的猫需要继承过去的猫的猫猫崇崇" | AC-1, AC-2 | test: bootstrap 输出包含 task 列表 | [ ] |
| R2 | "搜文件树那样搜 session chain → invocation → 文件树" | AC-3, AC-4 | test: bootstrap 引导路径 + 端到端查询 | [ ] |
| R3 | 恢复模式是"记忆模式"（知道之前做了什么，自行决定下一步） | AC-2 | manual: 新猫不被指令式驱动 | [ ] |
| R4 | 通用——所有猫封印后重启都继承上下文 | AC-1~AC-8 | test: 不同 catId 均生效 | [ ] |
| R5 | Bootstrap 不能超预算（砚砚 review 发现） | AC-5 | test: serial/parallel/incremental 三路径 token cap | [ ] |
| R6 | Task 内容不能变成注入攻击（砚砚 review 发现） | AC-6 | test: 恶意 title/why 截断+转义 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [ ] 前端需求已准备需求→证据映射表（若适用）— 本 feat 无前端 UI 改动

## Links

| 文档 | 路径 |
|------|------|
| F24 plan（前身，Phase A~E 全设计） | [docs/plans/2026-02-13-f24-session-chain.md](../plans/2026-02-13-f24-session-chain.md) |
| Session query tools upgrade plan（TD098 已完成，Gap 1-3 参考） | [docs/plans/2026-02-25-session-query-tools-upgrade.md](../plans/2026-02-25-session-query-tools-upgrade.md) |
| Session management lesson | [docs/lessons/08-session-management.md](../lessons/08-session-management.md) |
| Tech Debt TD102（Bootstrap 引导路径补全） | [docs/TECH-DEBT.md](../TECH-DEBT.md) TD102 |
| SessionBootstrap.ts（当前实现） | `packages/api/src/domains/cats/services/session/SessionBootstrap.ts` |
| TranscriptWriter.ts | `packages/api/src/domains/cats/services/session/TranscriptWriter.ts` |
| TranscriptReader.ts | `packages/api/src/domains/cats/services/session/TranscriptReader.ts` |
| MCP session tools | `packages/mcp-server/src/tools/session-chain-tools.ts` |
| F24 铲屎官讨论 | [docs/discussions/2026-02-13-f24-session-chain-handoff/](../discussions/2026-02-13-f24-session-chain-handoff/) |

## Key Decisions

| # | 决策 | 理由 |
|---|------|------|
| KD-1 | 恢复哲学是"搜"不是"灌"：新猫按需搜旧 session，不是一次性注入全部历史 | 铲屎官明确指示；F24 Q2 决策 |
| KD-2 | Task 快照直接注入 bootstrap（例外于 KD-1） | Task 列表小且关键，不适合让猫自己去搜才知道有任务 |
| KD-3 | MCP 查询工具已由 TD098 完成（view 模式 + invocation detail + search 指针），F065 只需更新 bootstrap 引导路径 | 避免重复劳动 |
| KD-4 | 面向所有猫，不限 Claude | 铲屎官确认 Q3 |
| KD-5 | ThreadMemory token 上限 `min(3000, floor(maxPromptTokens * 0.03))`，下限 1200 | 砚砚分析：预算未扣 bootstrap，Spark 64k prompt 下 3% ≈ 1920 |
| KD-6 | Task 快照格式：紧凑列表 + 焦点任务，doing>blocked>todo>done 排序，最多 8 open + 2 done | 砚砚建议，约 200-400 tokens |
| KD-7 | Task title/why 按数据块渲染，截断 80/120 字符，含注入防护 | 砚砚 P1 安全发现 |

## Dependencies

- `Evolved from` **F024** (Session Chain + Context Health) — F024 提供了完整的 session lifecycle + 存储 + 基础 MCP 工具
- `Related` **F046** (Anti-Drift Protocol) — ThreadMemory 有助于防偏航

## Risk

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| Task 列表注入增加 bootstrap prompt 长度 | 低 | Task 列表通常很短（<10 项），格式化后 <500 tokens |
| Bootstrap 超预算（增量路径无门禁） | 高 | Phase A 同时修 serial/parallel/incremental 三路径，加 bootstrap token 扣减 |
| Task 快照 prompt injection | 中 | 数据块标记 + 截断 + 转义 + 测试覆盖 |
| ThreadMemory 滚动摘要质量 | 中 | Phase B 先用规则提取，质量不够再升级 LLM |
| handoff digest 生成成本 | 低 | Phase C 可选，用便宜模型 |

## Open Questions

| # | 问题 | 待定方 | 结论 |
|---|------|--------|------|
| OQ-1 | ThreadMemory 的 token 上限 | ✅ 已决 | `min(3000, floor(maxPromptTokens * 0.03))`，下限 1200（KD-5） |
| OQ-2 | Phase C (handoff digest) 的优先级 | 铲屎官 | — |
| OQ-3 | Task 快照格式 | ✅ 已决 | 紧凑列表 + 焦点任务（KD-6） |

## Review Gate

- Phase A: 布偶猫实现 → 缅因猫 review
- Phase B/C: 待定

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-05 | Kickoff — 铲屎官提出需求，分析 gap，立项 |
| 2026-03-05 | 砚砚 review OQ-1/OQ-3 → 收敛：3k cap + 紧凑快照；发现 P1 预算门禁 + injection 风险 |
