---
feature_ids: [F070]
related_features: [F038, F041, F042, F046, F049, F050, F058]
topics: [knowledge-engineering, governance, dispatch, cross-project, skills, bootstrap]
doc_kind: spec
created: 2026-03-06
---

# F070: Portable Governance — 猫咖方法论的可复制输出

> Status: spec | Owner: 布偶猫 | Evolved from: F041(能力Hub) + F042(三层架构) + F046(愿景守护)

## Why

猫咖的猫被派遣到外部项目（如 studio-flow）工作时，完全"失忆"——不知道 3001 端口是猫咖的、不知道 Redis 6399 圣域、不知道 SOP，甚至把 dev server 起在 3001 上导致猫咖前端 404。

根因不是"某个配置没带过去"，而是**能力注入 ≠ 治理继承**：现有能力 Hub（F041）已经能跨项目同步 MCP 配置，但 Skills、SOP、铁律、文档架构、Backlog 治理方法论——这些猫咖知识工程的核心——完全没有跨项目携带机制。

铲屎官的愿景：**猫咖不只是一个项目，是共创工作站。猫是铲屎官的永久团队，无论出征哪个项目，都带着完整的知识工程方法论。不需要打开其他 coding agent，不需要从零教规则。**

## What

在现有能力 Hub 基础上，扩展"治理层同步"能力：当猫首次被派遣到外部项目时，自动 bootstrap 猫咖的知识工程骨架，让派遣猫带着完整方法论工作。

### 定位

- Cat Cafe = **方法论中枢**（methodology hub）：SOP/Skills/协作规范/愿景守护的真相源
- 外部项目 = **独立执行面**（independent execution plane）：用猫咖方法论模板，但拥有自己的 BACKLOG/Feature/ADR
- **分区控制模型**：猫咖治理的是"怎么做"（方法论），外部项目治理的是"做什么"（自己的 backlog/feature）
- 猫咖不是外部项目的 BACKLOG 真相源——猫咖只输出方法论模板和工作流规范

## Scope: 携带什么

### 必携带（治理操作系统）

| 层 | 内容 | 形式 |
|----|------|------|
| 硬约束 | 端口保留表（3001=猫咖前端）、Redis 6399 圣域、禁止 self-review、身份不可冒充 | managed block in CLAUDE.md/AGENTS.md/GEMINI.md |
| 文档架构 | 三层信息架构（CLAUDE.md/Skills/refs）、frontmatter 契约、归档规则 | 模板 + 规范文档 |
| Backlog 治理 | Feature lifecycle 方法论（立项→讨论→开发→review→完成）、热/温/冷层 | BACKLOG.md 模板 + Feature 聚合文件模板 |
| SOP 工作流 | 6 步流程导航 + Skills 路由表 | SOP 模板 + manifest |
| Skills + 路由 | cat-cafe-skills symlink + manifest.yaml | project-level `.claude/skills/` symlink bootstrap |
| 协作规范 | A2A 交接五件套、愿景守护协议、review 流程 | shared-rules.md |
| 任务态上下文 | 当前 feat 的 AC、链接、phase | 派遣 thread 首条消息注入 |

### 不携带（各项目独立 or 猫咖私有）

- MEMORY.md 项目细节（猫咖私有上下文）
- 猫咖自己的 BACKLOG.md 条目（猫咖自己的功能规划）
- 猫咖自己的 Feature 聚合文件（猫咖自己的 spec）
- 猫咖自己的 ADR/lessons-learned 条目（但方法论模板会输出）
- SystemPromptBuilder 实现细节

注：外部项目会有**自己独立的** BACKLOG.md / Feature 文件 / ADR，由外部项目的猫独立管理。猫咖输出的是方法论模板（"怎么写"），不是具体条目（"写什么"）。

## Non-goals

- 不做整仓镜像（不把 `docs/` 全部 symlink 过去）
- 不做 BACKLOG 双向同步（外部项目用猫咖方法论但独立管理自己的 backlog）
- 不新建并行配置系统（复用现有 capability-orchestrator）
- 不强制外部项目改变已有的 build/test/style 规则

## Design: 三阶段

### Phase A: Portable Governance Pack（定义"带什么"）

定义 versioned portable governance pack：
- 版本号 + checksum + managed block 标记
- 硬约束层：端口/Redis/身份铁律
- 方法论层：文档架构模板 + Backlog 模板 + SOP 模板 + Feature lifecycle 模板
- 工作流层：Skills symlink + manifest + refs
- 协作层：shared-rules.md + A2A 规范 + 愿景守护协议

TD099（hook 归一化）并入此阶段。

### Phase B: Dispatch Bootstrap Adapter（"怎么带"）

首次派遣到 project X 时，在 `invoke-single-cat` 前执行幂等 bootstrap：

1. 检测目标项目是否已有治理包（通过 managed block 标记 + 版本号）
2. 写入/更新 managed block 到目标项目的 `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`
3. symlink 三家 provider skills 目录 → 猫咖 skills（`.claude/skills/` + `.codex/skills/` + `.gemini/skills/`，含 F038 workaround）
4. 同步 hooks（TD099）
5. 生成方法论骨架（**仅在目标文件不存在时创建，已有文件不覆盖**）：
   - `docs/` 目录结构 + `BACKLOG.md` 模板 + `docs/features/` + SOP 模板
   - 已有 `docs/` / `BACKLOG.md` / `docs/features/` → 跳过，记录到 bootstrap report
   - 冲突落盘：bootstrap report 记录"已存在/跳过/冲突"明细
   - 支持 `--dry-run` 模式：预览将要写入的文件，不实际写入
   - 回滚语义：bootstrap report 含文件清单，可按清单逆向删除
6. 注入任务态上下文（当前 feat 的 AC/链接/phase）

**触发点双保险**（codex 硬要求）：
- Mission Hub dispatch 时触发一次
- `invoke-single-cat` 前再校验一次（防手工建 thread / 旁路调用）

**幂等保证**：版本戳 + checksum，重复派遣不重复写入。

**与能力 Hub 集成**：复用 `capability-orchestrator` 和 `capabilities.ts` 的跨项目 bootstrap 底座，在现有 MCP 同步旁边加治理同步。能力 Hub UI 增加治理同步状态显示。

### Phase C: Preflight Gate + 方法论更新（"确认带了" + "持续同步"）

**Preflight Gate**：
- spawn 前检查：核心规则已注入？skills 可达？hooks 已同步？方法论骨架存在？
- 未通过 → fail-closed，Mission Hub 显示"治理同步未完成"
- 通过 → 正常派遣

**方法论更新**：
- 能力 Hub 的 Skills 管理页面扩展，增加"同步到外部项目"按钮
- 猫咖 skills/方法论更新时，能力 Hub 显示外部项目的版本漂移状态
- 支持一键同步最新版本

## Conflict Contract（冲突规则）

| 类别 | 优先级 |
|------|--------|
| 猫咖安全铁律（端口/Redis/身份） | 不可覆盖 |
| 猫咖协作规范（A2A/review/愿景守护） | 不可覆盖 |
| 猫咖 SOP 工作流 | 安全/协作底线不可替换，执行流程可由外部项目映射/裁剪 |
| 外部项目 build/test/style/架构约束 | 外部项目优先 |
| 任务态上下文 | 仅对当次派遣生效 |

## Acceptance Criteria

### 核心 AC
- [ ] AC-1: 空白外部项目首次派遣，自动 bootstrap 完整治理骨架（managed block + skills + hooks + 方法论模板）
- [ ] AC-2: 已有自己 CLAUDE.md/docs/BACKLOG.md 的外部项目，managed block 共存不冲突，已有文件不被覆盖
- [ ] AC-3: 重复派遣幂等（版本戳 + checksum）
- [ ] AC-4: 缺失治理文件时 Preflight Gate 阻断生效（fail-closed）
- [ ] AC-5: 回滚后可再同步（版本漂移检测 + 修复）
- [ ] AC-6: Mission Hub 可见同步健康状态（哪个项目裸奔、版本、最近校验）

### 方法论输出 AC
- [ ] AC-7: 外部项目获得文档架构模板（docs/ 目录结构 + frontmatter 契约）
- [ ] AC-8: 外部项目获得 Backlog 治理模板（BACKLOG.md + Feature 聚合文件模板）
- [ ] AC-9: 外部项目获得 SOP 工作流模板 + Skills 路由
- [ ] AC-10: 外部项目获得协作规范（shared-rules + A2A + 愿景守护）
- [ ] AC-11: 派遣猫能在外部项目按猫咖 feat/backlog/SOP 跑完整闭环

### 审计 AC（codex 硬要求）
- [ ] AC-12: Bootstrap 触发点双保险（dispatch + invoke 前校验）
- [ ] AC-13: 复用现有 capability-orchestrator，不新建并行系统
- [ ] AC-14: 治理载体是 versioned portable pack（含 checksum + managed block），不是整仓镜像
- [ ] AC-15: 派遣注册表可审计（首次派遣时间、同步版本、校验时间、状态）
- [ ] AC-16: Bootstrap 结果落盘可回放（做了什么、跳过什么、冲突什么）

### 回流与闭环 AC（gpt52 P1-3 修复）
- [ ] AC-17: 外部项目执行结果可回流猫咖追踪（派遣任务状态在 Mission Hub 可见，不需要去外部项目找）
- [ ] AC-18: Bootstrap 支持 dry-run 模式 + 回滚清单（已有文件无损策略）

### 跨 provider AC（gpt52 P2-2 修复）
- [ ] AC-19: Skills bootstrap 覆盖三家 provider（`.claude/skills/` + `.codex/skills/` + `.gemini/skills/`），不只 Claude

## Dependencies

| 依赖 | 关系 |
|------|------|
| F041 能力 Hub | Evolved from — 复用其跨项目 bootstrap 底座 |
| F042 三层信息架构 | Evolved from — 方法论的核心结构 |
| F046 愿景守护协议 | Related — 愿景守护是携带内容之一 |
| F038 Skills 发现机制 | Related — project-level skills workaround |
| F049/F058 Mission Hub | Related — 派遣触发点 + 状态显示 |
| F050 External Agent Onboarding | Related — A2A 接入契约 |
| TD099 Hook 归一化 | Blocked by — 并入 Phase A |

## Risk

1. **过度污染外部项目**：managed block + 版本戳确保可控，不做整仓镜像
2. **外部项目规则冲突**：Conflict Contract 显式定义优先级
3. **Skills symlink 不稳定**：F038 已证明 user-level symlink 有 bug，需要 project-level workaround
4. **方法论过重**：外部项目可能只需要轻量级治理，需要可选层级

## Open Questions

1. ~~外部项目 Backlog 归属~~ → 已决：外部项目用猫咖模板但独立管理
2. ~~方法论更新策略~~ → 已决：能力 Hub 显示版本漂移 + 一键同步按钮
3. Bootstrap 默认行为：自动写入 vs 首次确认后自动写入？（待铲屎官拍板）

## Review Gate

- R1: codex 审安全边界 + 回归矩阵
- R2: gpt52 审架构完整性 + 闭环验证
- 云端 review: PR 级

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-06 | Kickoff + 三猫讨论 + spec v0 |

## 需求点 Checklist

| # | 需求点 | AC 映射 | 状态 |
|---|--------|---------|------|
| R1 | 空白项目 bootstrap | AC-1 | pending |
| R2 | 已有规则项目共存 | AC-2 | pending |
| R3 | 幂等同步 | AC-3 | pending |
| R4 | Preflight Gate fail-closed | AC-4 | pending |
| R5 | 版本漂移检测与修复 | AC-5 | pending |
| R6 | Mission Hub 健康状态 | AC-6 | pending |
| R7 | 文档架构模板输出 | AC-7 | pending |
| R8 | Backlog 治理模板输出 | AC-8 | pending |
| R9 | SOP + Skills 路由输出 | AC-9 | pending |
| R10 | 协作规范输出 | AC-10 | pending |
| R11 | 派遣猫完整闭环 | AC-11 | pending |
| R12 | 双保险触发点 | AC-12 | pending |
| R13 | 复用 capability-orchestrator | AC-13 | pending |
| R14 | versioned portable pack | AC-14 | pending |
| R15 | 派遣注册表审计 | AC-15 | pending |
| R16 | Bootstrap 结果落盘 | AC-16 | pending |
| R17 | 回流路径（Mission Hub 追踪） | AC-17 | pending |
| R18 | dry-run + 回滚清单 | AC-18 | pending |
| R19 | 跨 provider skills bootstrap | AC-19 | pending |

## Key Decisions

| 决策 | 理由 | 来源 |
|------|------|------|
| 能力注入 ≠ 治理继承 | MCP 同步不等于方法论同步 | 三猫讨论 2026-03-06 |
| methodology hub 留猫咖（分区控制模型） | 避免真相源分裂 | gpt52 建议 |
| 复用 capability-orchestrator | 不新建并行系统 | codex 硬约束 |
| TD099 并入 Phase A | hook 归一化是闭环关键 | codex 建议 |
| 分区控制模型 | 猫咖管"怎么做"（方法论），外部项目管"做什么"（自己的 backlog） | gpt52 P1-1 修复 |
| 无损 bootstrap | 已有文件不覆盖，支持 dry-run + 回滚 | gpt52 P1-2 修复 |
| 回流路径验收化 | 外部执行结果必须在 Mission Hub 可追踪 | gpt52 P1-3 修复 |
| 能力 Hub 集成方法论更新 | 复用现有多项目管理 UI | 铲屎官指出 |

## Links

- 讨论: Thread `thread_mmfvoxjjy1hlzh9e` (2026-03-06)
- 愿景守护: [F046](F046-anti-drift-protocol.md)
- 三层架构: [F042](F042-prompt-engineering-audit.md)
- 能力 Hub: [F041](F041-capability-dashboard.md)
- Mission Hub: [F049](F049-mission-control-backlog-center.md)
- Skills 发现: [F038](F038-skills-discovery.md)
- Hook 归一化: [TD099](../TECH-DEBT.md) + [计划](../plans/2026-02-26-hook-unification.md)
- ADR-009 Skills 分发: [ADR-009](../decisions/009-cat-cafe-skills-distribution.md)
