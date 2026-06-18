---
feature_ids: [F243]
related_features: [F236, F186, F038]
topics: [design-gate, docs-governance, ownership-map, meta-aesthetics, observability]
doc_kind: discussion
created: 2026-06-17
---

# F243 Design Gate — Docs Discovery Profile

> **F243 spec**: `docs/features/F243-docs-discovery-profile.md`（立项 commit `cca384dc6`, R1 fix `6aa3c9cae`, R2 fix `bf997d9cb`）
>
> **Reviewer R1/R2/R3 verdict**: 砚砚 (@codex, gpt-5.5) — R1 退回（owner/scope/parser）→ R2 退回（scope creep 残留）→ R3 **放行** (`bf997d9cb`)
>
> **Design Gate 触发**：砚砚 R3 放行后建议"按 SOP 先走 Design Gate，再开 Phase A spike"。本文档是 Design Gate 自检结果产出。

## Design Gate 类型分流

F243 类型 = **架构级（轻量）**——
- 不跨现有 typescript runtime 模块（不动 packages/*/src/*）
- 但**新增 docs governance 子系统**（lint script + generator script + CI sync gate）
- 影响 docs 入口契约（frontmatter description 字段 + index.md schema）

按 feat-lifecycle SOP：架构级 = 猫猫讨论 → 铲屎官拍板（必须附 Decision Packet）。

**讨论共识**：
- 砚砚 (@codex) co-designed scope 4+1（命名 / 4-Phase 骨架 / F236 Related 不造 taxonomy / Eval primary=冷启动 / `> Summary:` 镜像 guardrail）
- 砚砚 R1/R2/R3 review 3 轮跨族 review（reviewer_no_middle_state 严格守门）
- CVO 立项时 signoff 2026-06-17（"a 吧先 feat 立项 然后！ 然后砚砚喵回来了！你可以喊他讨论了"）

**Design Gate 阶段铲屎官拍板点**：见本文档末尾 Decision Packet（铲屎官审 Design Gate 自检结论 + 是否启动 Phase A）。

## 1. 架构归属一问（Ownership Cell）

按 SOP 必答三项：

```markdown
Architecture cell: docs-governance（候选，待 cell 创建）
Map delta: new cell required
Why: F243 carrier 是 docs/ + cat-cafe-skills/refs/ + scripts/ + .github/，不动 runtime code，
     不在现有 typescript runtime cells 范围
```

### 实证：现有 ownership map 15 cells 全是 typescript runtime cells

Read `docs/architecture/ownership/README.md` 全量验证：

| Cell | code anchors 类型 | 是否匹配 F243 |
|------|---|---|
| action-plane | `packages/api/src/infrastructure/enterprise/*.ts` | ❌ |
| ball-custody | `packages/api/src/domains/ball-custody/*.ts` | ❌ |
| bubble-pipeline | `packages/web/src/stores/*.ts` | ❌ |
| callback-auth | `packages/api/src/domains/cats/services/agents/invocation/*.ts` | ❌ |
| community-ops | `packages/api/src/domains/community/*.ts` | ❌ |
| concierge-surface | `packages/api/src/domains/concierge/*.ts` | ❌ |
| dispatch | `packages/api/src/domains/cats/services/agents/invocation/*.ts` | ❌ |
| finance-data | `packages/finance/src/*.ts` | ❌ |
| harness-eval | `packages/api/src/infrastructure/harness-eval/*.ts` | ⚠️ F243 走 F192 eval contract 但本体不是 harness eval |
| hub-action-surface | `packages/api/src/routes/workspace.ts` 等 | ❌ |
| identity-session | `cat-config.json` / `packages/api/src/...` | ❌ |
| memory | `packages/api/src/domains/memory/*.ts` | ⚠️ F243 generated index 可能被 F102 scanner 索引，但 F243 本体不在 memory cell |
| plugin | `packages/api/src/domains/plugin/*.ts` | ❌ |
| thread-navigation | `packages/api/src/routes/labels.ts` 等 | ❌ |
| transport | `packages/api/src/infrastructure/connectors/*.ts` | ❌ |

**结论**：现有 ownership map 是 **typescript runtime ownership map**，F243 是 **docs governance ownership 缺口**。

### 建议候选 cell `docs-governance`

| 字段 | 草案 |
|------|------|
| Cell id | `docs-governance` |
| Title | Docs Governance / Metadata Pipeline |
| Summary | docs/ 元数据契约（frontmatter profile / description 字段 / OKF lineage）+ generated index.md + lint / sync gate + description generation pipeline 形态 |
| Canonical Features | F243（本 feat）|
| Primary Code Anchors | `docs/features/*.md`（frontmatter source of truth）+ `cat-cafe-skills/refs/feature-doc-template.md`（template）+ `scripts/docs-discovery/*`（generator + lint，待创建）+ `.github/workflows/docs-sync.yml`（CI sync gate，待创建）|

**Cell 创建是 ownership map 自身 lifecycle，不是 F243 close blocker**（feat-lifecycle SOP "找不到 cell = Phase 0 架构发现未完成"判定）。建议路径：
- 选 A: F243 Phase B 同时创建 `docs-governance` cell（PR 内一并提交）
- 选 B: F243 close 前由 ownership map maintainer 单独 PR 创建 cell
- 选 C: F243 close 后开 lightweight follow-up F 号 / ADR memo 创建 cell

我推荐 **选 A**（F243 Phase B PR 内一并提交 cell），最少 anchor 转换。

## 2. 元审美自检（Coordinate Shift vs Polynomial Stacking）

> 自检源：`docs/canon/meta-aesthetics.md` —— "这个方案是**坐标变换**（改变问题结构，让复杂度消失）还是**多项式堆项**（在现有结构上叠补丁/层数/脚手架）？"

### 判定：**坐标变换** ✓

**论据 1: 解决"docs 缺乏被发现的坐标系"**
- 现状 = 200+ 平铺文件 + BACKLOG（任务跟踪）+ 凭记忆引路。复杂度高的根因 = 没有 metadata 层
- F243 加 frontmatter + index.md = 给文档一个**被发现的坐标系**
- cardinality 降低：从 "ls + grep + search 多轮 carrier" 到 "cat index.md 一次解决"

**论据 2: index 是 derived view（投影），不是 new truth source**
- index.md = checked-in generated artifact，永不手写
- truth source 仍是各 feature doc frontmatter
- 这是 **单一真相源 + 投影视图** 模式（Memex 美学，参 Karpathy llm-wiki gist）
- 真相源数量不增加 ✓

**论据 3: description generation pipeline 形态 Phase A 判定不预设**
- 不是"提前 scaffolding 小模型生产线"
- 可能 spike 跑下来选"大猫手写 + 模板" → 整个 pipeline 不需要
- 避开了 47 元审美 §1.2 "花哨 scaffolding 反模式"

**论据 4: lint + sync gate 是运行时脚手架，不是认知脚手架**
- 按 gpt52 §2.1 挑战 3 修正：运行时脚手架（checkpoint / event log / credential isolation）是必需刹车
- F243 lint（frontmatter schema 守护）+ CI sync gate（index 同步守护）属此类
- 不是 critic / refiner / planner 认知脚手架 ✓

**论据 5: 边界检查（"删了它不影响安全/可验证性/权限边界，才是多余"）**
- 删 description / index 不影响 docs/ 真相源完整性
- 删 description / index 也不影响 search_evidence / graph_resolve / list_recent 内核能力
- F243 是**轻量元数据投影**层，可以被替换/扩展/删除，不破坏底层
- 合理边界 ✓

### 风险 flag：description generation if 选小模型路径

如 Phase A 判定形态选小模型生产，可能触发 47 元审美 §1.2 论点 3 "判断不可压缩"。已在 spec KD-3/4 处理：
- Phase A 验证后才固化形态（不预设）
- 若选小模型则强 prompt 规则（v3 9 条 mini-spike formal pass）+ PR-time 大猫 confirm（抽查不可代 gate）+ decision provenance 审计 trail（`@gemini35-draft → @author-confirmed`）
- 这对应 gpt52 §2.2 修正："判断权冻结在上游，小模型只做枚举/格式化/初筛，强模型 re-rank"

**元审美自检结论：✓ 通过**。

## 3. In-Context Observability 自检

> 自检源：`cat-cafe-skills/refs/in-context-observability-checklist.md`（凡是涉及 agent 状态 / runtime failure / 后台任务 / auth & degradation / diagnostics / health & status / 跨猫协作可见性 的 feature 必须逐项过）

### 弱触发

F243 大部分维度 ❌（docs 元数据生产线，不是 runtime）。部分弱触发：
- ⚠️ 后台任务：description generation pipeline 在 PR 触发，**不是后台 daemon**——是 CI step
- ⚠️ diagnostics：index sync gate 是 CI status，**不是 runtime dashboard**
- ⚠️ 跨猫协作可见性：description draft confirm 是协作流程——**在 PR 上发生**

### 决策字段

按 SOP 要求产出 4 个 observability 决策字段：

```yaml
in_context_observability:
  primary_surface: "PR 流程内（PR comment / checkbox / CI status）"
  why_not_dashboard_only: "description generation + sync gate 状态变化都发生在 PR 上下文里。
                          作者写 PR 时同步看 description draft、confirm checkbox、CI lint 结果——
                          状态发生处即可见处（entity carries its own state），不需要切到 Hub dashboard。
                          这是 F174 callback auth 原则的应用（明厨亮灶 - 数据/状态发生处可见）。"
  deep_dive_surface: "git log + commit message（description provenance：@gemini35-draft → @author-confirmed）；
                     CI run log（sync gate 失败时定位漂移点）"
  noise_dedup_policy: "PR 上 description draft 只显示一次（不重复 comment）；
                      触发节流（H1/scope/status 改才重新生成 draft）避免 noise；
                      sync gate CI 只在不同步时报错（同步时静默 pass）"
```

**Observability 自检结论：✓ 通过（弱触发，全在 PR 流程内可见）**。

## 4. Harness Eval Contract（F192）✓

详细见 F243 spec `## Eval / Tracking Contract` 段。摘要：
- **Primary Users + Activation**：猫冷启动探索 docs/features/（不知道具体 F 号时）
- **Friction Metric**：找正确 feature 的 tool calls / 时间 / 误点率 / 漏判率 / description-in-index 转化率
- **Regression Fixture (≥3)**：主题词查询 / 模糊问题 / description-in-context 盲读
- **Sunset Signal**（双类）：anchor tax + **变瞎子**（误点率/漏判率 vs baseline）

## 5. 软 + 硬 + eval 三层（ADR-031）✓

详细见 F243 spec `## 软 + 硬 + eval 三层（ADR-031）` 段。摘要：
- **软**：feat-lifecycle skill 教学 / prompt v3 9 条文档规范 / F243 ADR 立原则
- **硬**：profile lint / index sync gate / template 嵌字段 / PR-time 大猫 confirm gate
- **eval**：F192 friction metric / regression fixture / anchor tax + 变瞎子双类 sunset signal

## 6. 立项愿景硬度 ✓（spec 立项时已自检）

- **Why = 价值语言**：砚砚钉句"让 docs/features 从平铺文件堆变成可渐进探索的知识入口"
- **现状基线 = 实测证据**：200+ 文档无入口 + 凭记忆引路错认事件（孟加拉猫 Opus F186-stewardship event 2026-06-16）+ OKF v0.1 业界共振
- **AC↔Why 同源**：R1-R7 需求点全部 trace 到 AC（覆盖检查通过）
- **AC 可复核**：每条 AC 有非作者可复核方式（test fixture / parser 验证 / 三猫盲测）

## Decision Packet（给 CVO）

> 按 feat-lifecycle SOP：架构级 Design Gate 必须附 Decision Packet 给铲屎官拍板。

**价值题**：F243 Design Gate 自检（架构归属 + 元审美 + observability + Eval contract + harness 三层）全部通过，可否启动 Phase A spike？

**三选一**：

| 选项 | scope | 风险 | 节奏 |
|---|---|---|---|
| **A. 立即启动 Phase A spike** | 选 stratified sample 10 篇（6 硬骨头 + 4 easy mode）+ 拉砚砚 + 孟加拉猫 opus 做三猫盲评 + description generation 形态判定 | spike 数据驱动后续 Phase B/C/D | 紧凑 |
| **B. 先创建 docs-governance ownership cell** | 单独 PR 创建 cell（不进 F243 PR），然后 Phase A spike | 多一个 anchor 转换 cost | 偏保守 |
| **C. 调整 Architecture cell 判定** | 把 F243 强行挂到现有 cell（如 memory cell 因为 F102 scanner 会索引）| ownership map 失真，未来 F243 改动归属混乱 | 不推荐 |

**我（宪宪 Opus-4.7）推荐：A**——
- 砚砚 R3 已放行，spec 完备
- ownership cell 创建是 F243 Phase B 内可一并做（前文选 A 推荐），不前置阻塞
- Phase A spike 是数据驱动的关键 milestone，越早做越早收敛 description generation 形态判定
- 风险低：spike 跑下来不行的话，spec 早已写明可降级到大猫手写 / 模板路径

**🐾 等 CVO 拍板**。

## Co-design + Review Provenance

| 角色 | 猫 | Contribution |
|------|-----|---|
| **Owner** | 宪宪 (Opus-4.7) | 立项 + spec 落笔 + R1/R2 fix + Design Gate 自检 |
| **Co-design** | 砚砚 (gpt-5.5) | scope 4+1 决策（命名/Phase 骨架/F236 Related/Eval primary/Summary guardrail）|
| **Reviewer R1/R2/R3** | 砚砚 (gpt-5.5) | R1 退回（owner/scope/parser P1）→ R2 退回（scope creep 残留 P1）→ R3 放行 |
| **CVO 立项 signoff** | 铲屎官 | 2026-06-17 "a 吧先 feat 立项" + 当前 Design Gate Decision Packet 待拍板 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F243-docs-discovery-profile.md` | F243 spec（本 Design Gate discussion 的 anchor）|
| **Ownership** | `docs/architecture/ownership/README.md` | 架构归属 map（F243 = new cell required）|
| **Canon** | `docs/canon/meta-aesthetics.md` | 元审美自检参考轴（坐标变换 vs 多项式堆项）|
| **Sister** | `docs/features/F236-anchor-first-context-entry.md` | 姊妹哲学 anchor-and-drill（return-side vs source-side）|
| **Brainstorm chain** | (本 thread) | OKF 一手核实 4 轮 + description 漂移讨论 + mini-spike R1/R2/R3 烁烁 + 砚砚 co-design + R1/R2/R3 review |
