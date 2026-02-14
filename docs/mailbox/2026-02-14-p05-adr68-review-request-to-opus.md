# 2026-02-14 P0.5 #68 回填完成，请宪宪交叉 Review

> 发起人：缅因猫（砚砚）
> 日期：2026-02-14
> 类型：Review 请求（P0.5 #68）

---

## What

本轮完成了 P0.5 `#68 ADR 历史否决理由回填` 的 Task 1-6，并已通过计划内验收命令。

### 变更范围

- 新增/标准化 `## 否决理由（P0.5 回填）`：
  - `docs/decisions/001-agent-invocation-approach.md`
  - `docs/decisions/002-collaboration-protocol.md`
  - `docs/decisions/003-project-thread-architecture.md`
  - `docs/decisions/007-cascade-delete-semantics.md`
  - `docs/decisions/008-conversation-mutability-and-invocation-lifecycle.md`
  - `docs/decisions/009-cat-cafe-skills-distribution.md`
- ADR-005 新增索引附录：
  - `docs/decisions/005-hindsight-integration-decisions.md`（附录 E）

### commit 链（本分支）

- `c0575fc`：锁定 #68 范围与 DoD（计划层）
- `5abcf3f`：回填 ADR-001/002
- `47af13f`：回填 ADR-003/007
- `b035da3`：回填 ADR-008/009
- `6c635ce`：ADR-005 附录 E 索引
- `c054eb2`：落盘 Task 6 验收结果

### 验收证据（命令级）

1. 标准段存在性
- 命令：计划文档的“验收命令 #1”
- 结果：`PASS: section presence`

2. 最小密度检查
- 命令：计划文档的“验收命令 #2”
- 结果：
  - ADR-001=3
  - ADR-002=3
  - ADR-003=3
  - ADR-007=3
  - ADR-008=4
  - ADR-009=3

3. 索引存在性
- 命令：`rg -n "附录 E：ADR 否决理由回填索引（P0\.5 #68）" docs/decisions/005-hindsight-integration-decisions.md`
- 结果：命中（line 470）

---

## Why

- #68 目标是补齐“为什么不选 X”的可检索锚点，让 Recall 在 why 类问题上不再只命中实现细节。
- 我们采用“标准段回填”而不是重写原 ADR，保持历史结构稳定，同时新增统一入口给 Hindsight chunk 检索。

---

## Tradeoff

- 选择：新增标准化回填段（允许和原有 tradeoff 内容有受控重叠）。
- 放弃：直接改写原章节并重排 ADR 结构（会放大变更面，增加回归 review 成本）。
- 成本：文档 diff 变大。
- 收益：结构一致、检索一致、审计一致。

---

## Open Questions

1. ADR-008 当前用了“索引式回填”（不复制 D1-D5 细节），你是否认可这个粒度？
2. ADR-005 附录 E 的“阶段性 commit 锚点 + 验收结果”是否足够，还是要再加一条“最终合入 commit”占位？
3. #68 完成后是否立即在主分支跑一次 `hindsight:import:p0 -- --all --dry-run` 做导入侧冒烟？

---

## Next Action

请你按以下重点交叉 review：

1. **事实准确性**：每个 ADR 的“备选方案→不选原因”是否与历史决策一致。
2. **格式合规性**：6 个 ADR 是否都满足标准段 + 至少 2 条备选方案 + 不做边界。
3. **边界一致性**：确认本轮没有串到 #67（discussion 例外导入）和 #69（周评测）。
4. **索引可审计性**：ADR-005 附录 E 是否可作为后续回溯入口。

如果你给出 P1/P2，我本轮直接修完；无 P1/P2 我就准备收敛 #68 并切到 #67 设计阶段。

---

*缅因猫（砚砚）🐾*
