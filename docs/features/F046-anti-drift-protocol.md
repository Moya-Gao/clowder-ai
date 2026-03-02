---
feature_ids: [F046]
topics: [vision-drift, anti-drift, sop, review, process, multi-agent]
doc_kind: spec
created: 2026-02-27
---

# F046: 愿景守护协议 — Anti-Drift Protocol

> **Status**: in-progress
> **Owner**: 三猫
> **Created**: 2026-02-27
> **Priority**: P0

---

## Why

F041 能力看板暴露致命问题：AC 12 项全绿、76 测试全过、14 轮 review 全通过——**但铲屎官打开就发现交付物完全不是想要的**。根因：整条 review 链路没有任何角色回去读用户的原始需求。

这不是个案，是系统性缺陷：三猫协作流程中**缺少愿景层守护**，只守了代码质量层。

## What

建立多层愿景守护机制，确保从开发到交付全链路不偏离铲屎官原始意图。

### 已完成（Phase A — 立即做）

| ID | 内容 | 状态 | Commit |
|----|------|------|--------|
| A1 | 三猫指引（CLAUDE/AGENTS/GEMINI.md）新增「愿景守护」铁律 | ✅ Done | `642c31b` |
| A2 | `feat-completion` Skill 新增 Step 0d 跨猫签收记录 | ✅ Done | `642c31b` |
| A3 | 截图证据链——限定前端 UI/UX（铲屎官决策：后端免截图） | ✅ Done | `642c31b` |
| A4 | Review Skills 新增「≤5 行原始需求摘录」强制规则 | ✅ Done | `642c31b` |

### 待开发（Phase B — 计划做）

| ID | 内容 | 状态 | 说明 |
|----|------|------|------|
| B1 | 截图/录屏证据流程——利用现有 MCP（Claude in Chrome / Codex 浏览器） | 📋 Spec | 无需新依赖，用已有工具 |
| B2 | Cold-start Verifier——独立 agent 只看需求+交付物 | 📋 Spec | 先在 F041 redo 时试点 |
| B3 | 需求点 checklist 格式——结构化需求追踪 | 📋 Spec | 嵌入 feat-kickoff 模板 |
| B4 | skill-lint CI gate（`pnpm check:skills` manifest 一致性校验） | 📋 Spec | ← F042 Wave 2 毕业：Lint = 漂移防护 |
| B5 | ≥10 条对话场景回归测试 | 📋 Spec | ← F042 Wave 3 毕业：回归测试 = 愿景守护运行时验证 |
| B6 | 同族 reviewer identity check gate | 📋 Spec | ← F042 Wave 3 毕业：流程执行守护门禁 |

### 明确不做（Phase C）

| ID | 内容 | 理由 |
|----|------|------|
| C1 | 需求嵌入 system prompt（上下文嵌入） | 成本过高，压缩后会丢 |
| C2 | 向量化语义偏离检测 | 过度工程，小团队不需要 |
| C3 | 覆盖度 KPI | 铲屎官明确拒绝："别变成填表" |
| C4 | 跨猫 thinking 实时广播（属 F045） | 范围不同，F045 负责 |

## Acceptance Criteria

- [x] 三猫指引文件包含「愿景守护」铁律段落
- [x] `feat-completion` 有跨猫签收步骤（Step 0d）
- [x] `requesting-review` + `requesting-cloud-review` 强制附原始需求摘录
- [x] 截图证据仅限前端 UI/UX 功能
- [ ] 截图/录屏证据流程文档化，利用现有 MCP 工具（B1）
- [ ] Cold-start Verifier 在至少 1 个 Feature 上试点验证（B2）
- [ ] 需求点 checklist 格式嵌入开发模板（B3）
- [ ] skill-lint CI gate 可运行 + 检测 manifest 一致性（B4）
- [ ] ≥10 条对话场景回归测试就位（B5）
- [ ] 同族 reviewer identity check gate 落地（B6）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | [调研 Pipeline](../research/2026-02-27-vision-drift/README.md) | 6 份 Deep Research + Pro 审阅 |
| **Synthesis** | [综合报告](../research/2026-02-27-vision-drift/synthesis.md) | 代码库验证 + 行动清单 |
| **Prompt** | [调研 Prompt](../prompts/2026-02-27-vision-drift-research-prompt.md) | 三路 Deep Research 使用的 prompt |
| **Prompt** | [Pro 审阅 Prompt](../prompts/2026-02-27-vision-drift-gpt-pro-review-prompt.md) | GPT-5.2 Pro 审阅任务 |
| **Trigger** | [F041](F041-capability-dashboard.md) | 触发本 Feature 的事件 |
| **Code** | `CLAUDE.md` §12 | 愿景守护铁律 |
| **Code** | `AGENTS.md` §10-11 | 讨论沉淀 + 愿景守护 |
| **Code** | `GEMINI.md` §11 | 愿景守护铁律 |
| **Skill** | `cat-cafe-skills/feat-lifecycle/SKILL.md` | 含 feat-completion Step 0d 跨猫签收 |
| **Skill** | `cat-cafe-skills/request-review/SKILL.md` | 5 行摘录规则 |
| **Skill** | `cat-cafe-skills/merge-gate/SKILL.md` | 含云端 review 摘录规则 |

## Key Decisions

| 决策 | 选择 | 放弃的方案 | 理由 |
|------|------|-----------|------|
| 守护层级 | 流程嵌入（Skills/指引） | 上下文嵌入（system prompt） | 成本可控，上下文嵌入压缩后会丢 |
| 截图范围 | 仅前端 UI/UX | 所有 Feature 强制截图 | 铲屎官："后端功能硬截图是折腾" |
| 覆盖度衡量 | 不设 KPI | 愿景覆盖度量化指标 | 铲屎官："别变成填表" |
| 验证方式 | Cold-start Verifier（独立 agent） | 向量化语义偏离检测 | 简单有效 vs 过度工程 |
| 调研方法 | Deep Research Pipeline（三路+Pro） | 单猫调研 | 6 份报告交叉验证，避免单一偏见 |

## Risk / Blast Radius

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 流程过重导致开发效率降低 | 中 | A 项都是轻量嵌入（≤5 行摘录），不是新流程 |
| 猫猫表面合规但实质应付 | 中 | B2 Cold-start Verifier 做独立校验 |
| MCP 截图工具局限性 | 低 | Claude in Chrome 覆盖主流场景，特殊情况手动补 |
| 铲屎官审美疲劳（截图太多） | 低 | 已限定 ≤3 张 + 1 段 15s 录屏 |

## Dependencies

| Feature | 关系 | 说明 |
|---------|------|------|
| **F041** | 🔗 触发源 | F041 愿景对照失败触发本 Feature |
| **F042** | 🔗 毕业来源 | F042 Wave 2/3 剩余项 (B4-B6) 毕业到本 Feature |
| **F045** | 🟢 互补 | F045 做可观测性，F046 做愿景守护，互不阻塞 |

## Open Questions

1. ~~**B1 Playwright 新依赖审批**~~：已解决——铲屎官指出猫猫已有浏览器 MCP（Claude in Chrome / Codex），无需引入 Playwright
2. **B2 Cold-start Verifier 实现形态**：用独立 claude 子进程？还是 Codex sandbox？等 F041 redo 时试点确定

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

## Test Evidence

Phase A 为流程/文档变更，无代码测试。Phase B 开发时补充。

## Timeline

- 2026-02-27: F041 愿景对照失败，触发 Deep Research Pipeline
- 2026-02-27: 6 份 Deep Research + GPT-5.2 Pro 审阅 + 布偶猫综合
- 2026-02-27: 砚砚独立评审 + 铲屎官 UX 决策
- 2026-02-27: Phase A (A1-A4) 落地 → `642c31b`
- 2026-02-27: F046 立项（本文件）
- 2026-03-02: 吸收 F042 毕业项 B4/B5/B6（路线图收敛决策 → `docs/discussions/2026-03-02-f042-roadmap-convergence.md`）
