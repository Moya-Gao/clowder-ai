---
feature_ids: [F257]
related_features: [F192, F245, F237, F177, F233, F153, F244, F218]
topics: [harness, self-evolution, eval, governance, observability]
doc_kind: spec
created: 2026-07-06
---

# F257: Harness Ledger — 锅账体系与自进化闭环

> **Status**: spec | **Owner**: Ragdoll (Fable) | **Priority**: P1

> 信号 → 归因 → 修补 → 验证 → 淘汰。犯错可以，**同类偏差第二次必须被结构拦截，第三次 = 体系失败**（operator 定义的成功判据，thread_mr6kh7kdoac6852d 启动包）。

## Why

四层 harness（MCP 工具 GOTCHA / skill 手册 / 家规 / 记忆 feedback）积累了 130+ 口"锅"——每口都是一次真实事故换来的，但**没有任何一层能回答"这口锅最近 30 天拦住过什么"**。锅只加不减：每 turn 注意力被 130+ 条规则稀释（#1018 实证：PR #962 周期 60+ 次 operator 纠正，根因之一是"规则丰富但不在运行时关键路径上"），而同类偏差照样二犯三犯（#1080 A2A claim 冒名、#1082 消息排序假设失效，均为 2026-07 调查线实锤）。系统对偏差的唯一响应是"再添一口锅"，形成越治理越稀释的死循环。

终态：每口锅是**带生命周期的资产**——登记（origin/assertion）→ 触发可观测 → 周期实证评估 → 修补/升级/淘汰。锅账（ledger）是四层锅的单一真相源；"减"第一次成为有证据支撑的合法操作。

## Current State / 现状基线

2026-07-06 首棒审计实测（全表：`assets/F257/harness-audit-2026-07-06.md`）：

**Inventory（四层合计 130+，实测口径）**：
- MCP 层：43 处 GOTCHA 分布于 30 tools / 10 文件（`packages/mcp-server/src/tools/`），另有 ~13 条 hard-block 断言（400/403/429）
- Skill 层：48 个 skill（`cat-cafe-skills/manifest.yaml`），9 个 SKILL.md 含 GOTCHA 段
- 家规层：10 个 magic words + 20 条带事故编号规则（shared-rules.md 806 行）
- 记忆层：22 个文件（20 feedback + 1 reference + index）
- ⚠️ 启动包引用数字（86 工具 / 51 skill / 21 GOTCHA）与本次实测口径不可互相推导——**连 inventory 本身都没有单一真相源**（见 seed-cases SC-002）

**30 天触发审计（窗口 2026-06-06→07-06，26 个签名，双路：~/.claude transcripts 540 文件 873MB + 运行时磁盘工件）**：

| 观测层级 | 样本 | 结果 |
|---------|------|------|
| O1 结构强制（server fail-closed） | 5 | 3 有 firing 实证：hold_ball 429 × 7-8 session（反复触发=锅在挡没在治）；cross_post 路由拒绝 × 2；publish_verdict 403 × 1（**拦下真实越权**：opus 试图替 gpt52 域发 verdict）。但唯一 durable 痕迹 = transcripts 自由文本 echo；pino 4xx 只在 /tmp 重启即失；tool-usage-archive 无 outcome 维度 |
| O2 提示文本（GOTCHA/家规/magic words） | 15 | 活着 3 条（KD-27 × 15 session 引用、LL-048 × 4、补锅匠 operator 06-29 真实使用）；零痕迹 5 条（星星罐子/碎片够了/LL-054/LL-071/脚手架-as-scold）；**结构性不可测 8 条**——3 条 MCP 提示型 GOTCHA 无违规信号无分母；5 个抽样 skill 30 天 **0 次 Skill-tool 加载**（手册没被打开，GOTCHA 不可能生效；#860 的 30 天新证，检测器已用其他 skill 190+ 次命中验证有效） |
| O3 记忆文件 | 4 | **4/4 零回读**；其中 feedback_check_hypothesis_first 06-09 创建后从未被读过——记忆层实际是 write-only |

**三个结构性结论**：
1. 触发可观测性是**意外不是设计**——无任何结构化 guard-rejection 遥测，最接近的结构（F237 side-effect journal）还在 PR #1075 未合入
2. **无分母问题**——0 触发无法区分"威慑生效"与"锅已死"（waitSourceRef 400 从未 rendered vs cat_disabled 历史触发过，语义完全不同却同样无声）
3. **重复触发无归因闭环**——hold_ball 429 反复 fire，无人知道谁/为什么/是否该升级为结构修复

## What

> Phase 拆分为对齐稿：opus（架构）/ codex（风险与落地）对齐 + Design Gate 后冻结。

### Phase A: Ledger Registry + 盘点导入

锅 schema：`id / layer(mcp|skill|rule|memory) / origin(事故·issue·LL 锚点) / assertion(可检验断言) / observability(O1|O2|O3) / supersedes / status(active|probation|dormant|retired) / stats(trigger count·last-triggered·eval verdicts)`。四层 130+ 锅导入（origin backfill best-effort），CI lint：新增 GOTCHA/规则/feedback 未登记 → 红。seed-cases 机制启用（自举条款，文件已建）。

### Phase B: 触发可观测 + Anomaly 通道

结构拒绝（4xx guard rejection）结构化落盘（复用 F237 injection trace / side-effect journal 基座，**依赖 #1075 合入**）；拒绝响应携带 ledger id；猫侧 anomaly 上报通道接 F245 friction 聚合（引用 ledger id → stats+1）；O2 层代理信号采集（magic word 使用 / 规则 id 引用）边界见 OQ-3。

### Phase C: 双 Eval 域注册（F192 Y-lite，fail-closed）

`eval:harness-ledger`：周期抽锅 → alive / dormant / unmeasurable / retire-candidate verdict + 证据链。`eval:spec-fidelity`：检验"写了 ≠ 载了 ≠ 照做"——抽样 session 对照锅 assertion 与实际行为（直接承接 #860 / #1018 的"written ≠ loaded ≠ effective"诉求）。与 eval:sop 域边界见 OQ-4。

### Phase D: Console 锅账页

Registry 浏览（四层筛选 / status / last-triggered / 30d stats）+ 单锅详情（origin 事故链接 + 触发历史）+ retire 队列（eval 判定 dormant 候选，operator 批准）。

### Phase E: 闭环验证（含自举验收）

淘汰第一批 dormant 锅并在 pack/prompt 中真实移除（证明"减"通路端到端）；自举回放：本特性开发史 seed cases 逐类回放，验证同类偏差第二次被结构拦截。

## User Journey

### Primary Journey: operator 看锅账、批淘汰
- **Scope unit**: workspace
- **Actor**: operator
- **Entry**: Console → Harness Ledger（锅账）页
- **Flow**:
  1. 打开锅账页 → 看到四层锅列表（status / observability / last-triggered / 30d 触发数）
  2. 点开一口锅 → 看到 origin 事故锚点、assertion、触发历史、eval verdict 链
  3. 进 retire 队列 → 看到 eval 判定的 dormant 候选及证据 → 批准 → status=retired，对应文本段在下个 pack 版本移除
- **Success evidence**: 截图 + ≥1 口真实锅走完 retire 全程的 diff
- **Non-goals**: 不做自动淘汰（operator-in-the-loop 硬边界）；不改写既有锅的内容（只登记/观测/淘汰）；不新建独立 friction 采集面（复用 F245）

### Supporting Journeys

| ID | Scope unit | Actor | Flow | Evidence |
|----|------------|-------|------|----------|
| S1 | session | 猫猫 | 撞到 429/403 拒绝 → 拒绝响应带 ledger id → anomaly 上报引用它 → 锅 stats+1，反复触发进入归因队列 | 一次真实拒绝的端到端 trace |

## 需求点 Checklist（启动包逐条回执）

- [ ] 锅 registry：id/layer/origin/assertion/supersedes/status/stats → Phase A
- [ ] anomaly 上报通道接 F245 → Phase B
- [ ] eval:harness-ledger 域（Y-lite，fail-closed） → Phase C
- [ ] eval:spec-fidelity 域（Y-lite，fail-closed） → Phase C
- [ ] Console 锅账页 → Phase D
- [ ] 自举条款：开发偏差 = eval 种子；验收含"拦截自己开发史偏差类型" → seed-cases（已建）+ Phase E
- [ ] 烂尾资产并入：#617（automation layer → Phase B/C 承接）、#860（skill 0 加载 → spec-fidelity 域检验对象）、#1018（subtraction/工具化 → retire 通路 + CI lint）
- [x] 锅账有效性审计（抽样 26 签名查 30 天触发率）→ 本文档 Current State + assets 报告（2026-07-06 done）

## Acceptance Criteria

<!-- AC↔Why 同源自检：每条 trace 回 Why 的"不可观测/只加不减/同类偏差复发"三诉求；非作者可复核。 -->

### Phase A（Registry + 导入）
- [ ] AC-A1: registry 覆盖四层全部锅，每口 id/layer/origin/assertion/observability/status 完整；CI lint 绿（新锅未登记 → 红可复现）
- [ ] AC-A2: seed-cases 文件自 day-0 持续记录本特性开发偏差，每条含偏差类型 + 期望拦截层（可复核：文件 + 条目日期）

### Phase B（可观测 + 通道）
- [ ] AC-B1: 结构拒绝事件结构化落盘且可按 ledger id 查询（可复核：触发一次 429 → 查询返回该事件）
- [ ] AC-B2: anomaly 上报出现在 F245 friction rollup 且回写锅 stats（可复核：rollup 记录 + stats 变更）

### Phase C（双 Eval 域）
- [ ] AC-C1: 两域完成 Y-lite 注册且 fail-closed（越权 publish 被 403，可复现）+ 首轮 verdict 产出
- [ ] AC-C2: eval:harness-ledger 对抽样锅给出 alive/dormant/unmeasurable/retire-candidate 判定及证据链；eval:spec-fidelity 对 ≥1 个真实 session 产出"声明 vs 行为"diff 报告

### Phase D（Console）
- [ ] AC-D1: 锅账页展示 registry + stats（截图，含四层筛选）
- [ ] AC-D2: retire 队列 operator 批准流程可走通（截图/录屏）

### Phase E（闭环验证）
- [ ] AC-E1: ≥1 口锅经证据淘汰且对应文本从 pack/prompt 真实移除（可复核：diff + 移除后 eval 无回归）
- [ ] AC-E2: 自举回放——本特性开发史 seed cases 每类偏差有对应拦截机制且回放中触发（可复核：回放报告，灵魂条款）

## Eval / Tracking Contract（F192）

1. **Primary Users + Activation Signal**：全体猫（锅触发/anomaly 上报方）+ operator（retire 决策方）。Activation：guard rejection 结构化事件、anomaly 上报、eval 域周期运行、Console 页访问。
2. **Friction Metric**：① 同类偏差 30 天复发率（第二次未被结构拦截的比例，目标 → 0）；② dormant 锅占比 + retire 吞吐（治"只加不减"）；③ 重复触发递减率（同一锅对同一猫的 429 类重复触发应随归因闭环下降）。
3. **Regression Fixture**：① seed-cases 回放集（本特性开发史，持续增长）；② #1080 A2A claim 无 anchor 案例；③ #1082 类 superseded 假设案例（锅前提失效 → status 变更）；④ hold_ball 429 重复触发序列（归因闭环 fixture）。
4. **Sunset Signal**：连续 2 个 eval 周期满足（a）新增锅 100% 经 registry 登记（lint 零逃逸）、（b）同类偏差第二次拦截率达标、（c）operator 零手动策展 → ledger 维护降为例行；若 eval:harness-ledger 域自身连续 4 周期无 actionable verdict → 域降频或并入 eval:friction。

## Harness 三层计划（ADR-031 软+硬+eval）

| 层 | 本 feat 承载 |
|----|-------------|
| Soft | L0/skill 触发句："撞到 4xx 锅拦截 → anomaly 上报引用 ledger id"；锅账进猫认知路径（capability-wakeup index） |
| Hard | CI lint（新锅未登记 → 红）；拒绝响应携带 ledger id；guard rejection 结构化落盘（不靠自觉） |
| Eval | eval:harness-ledger + eval:spec-fidelity 双域 + 上节 4 项 contract |

## Dependencies

- **Evolved from**: F192（harness-eval control plane——把"域级评估"下沉到"单锅生命周期"）
- **Blocked by**: PR #1075（F237 Phase 2 injection trace/side-effect journal，Phase B 代码基座；**文档与 Phase A schema 设计不受阻**，代码开工前必须合入并 rebase——KD-1）
- **Related**: F245（anomaly/friction 聚合复用）、F177（四心智护栏的前身）、F233（observability 姊妹篇）、F153（观测基础设施）、F244（tips 生效追踪同类问题）、F218（provenance 反射）；issues #617 / #860 / #1018（烂尾并入）、#1080 / #1082（调查线动因）

## Risk

| 风险 | 缓解 |
|------|------|
| 锅账变成第 131 口锅（观测本身增熵） | registry 是数据不是 prompt 文本，不进上下文注入；元审美自检：这是坐标变换（散文锅 → 结构化资产），不是堆层 |
| O2 提示层本质不可测，eval 误判 dormant | observability 分级进 schema（KD-2）；unmeasurable-by-design 显式标注，只对可测锅下 alive/dormant 结论；不可测锅走"升级为结构 or 有意保留"二选一决策 |
| transcripts 挖掘的体量/隐私 | 只存聚合 stats + anchor 引用，不复制 raw payload（harness-feedback 同款规则） |
| F 号/文档在特性分支上直到 PR（占号可见性） | 立项即 cross-post 主 thread 声明 F257 占号；ROADMAP 行随 PR 上行 |
| 双 eval 域与既有 eval:sop / eval:friction 边界重叠 | OQ-4 在 Design Gate 前对齐，宁可并域不可撞域 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | ledger 存储形态：YAML in docs/ vs JSONL in data/ vs SQLite（Console 读取 + CI lint + human review 三方消费如何平衡） | ⬜ opus 对齐 |
| OQ-2 | 锅 id 命名规范 + supersedes 语义（替代/演化/合并三种关系是否分开建模） | ⬜ opus 对齐 |
| OQ-3 | O2 层代理信号采集边界：transcripts 离线挖掘 vs session hook 实时埋点（成本/隐私/覆盖三角） | ⬜ codex 对齐 |
| OQ-4 | eval:spec-fidelity 与既有 eval:sop 域的 scope 边界（sop 查"流程步骤合规"，spec-fidelity 查"锅断言 vs 行为"？还是该并域） | ⬜ codex 对齐 |
| OQ-5 | 启动包 inventory 数字（86/51/21）与实测（30/48/9）口径差——调查线的推导方法需回查 | ⬜ 已 cross-post 回主线 |
| OQ-6 | KD-1 文档先行分支策略（origin/main 现基线切出，#1075 合入后 rebase）是否认可 | ⬜ opus 对齐 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 文档先行：特性分支自 origin/main@6868041 切出，不等 #1075；代码 Phase 开工前 rebase 到含 #1075 的新基线 | 文档与 F237 代码零重叠；可逆（≤1 commit）；审计+立项不应被外部 merge 排队阻塞 | 2026-07-06 |
| KD-2 | observability 分级 O1(结构强制)/O2(提示文本)/O3(记忆文件) 进 ledger schema | 审计实证三层观测能力天差地别；单一 stats 模型会把"不可测"误读为"dormant"导致错杀 | 2026-07-06 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-07-06 | 立项（首棒 Fable：四层审计 + spec 初稿；来源 thread_mr6kh7kdoac6852d 调查线启动包） |

## Review Gate

- Design Gate（架构级）：opus 架构对齐 + codex 风险对齐 → Decision Packet → operator 拍板（含 in_context_observability 决策字段 + Architecture cell 更新）
- Phase A schema/lint：codex review
- 每 Phase merge 后与 operator 碰头（3+ Phase 大 feature）

## Architecture 归属（F191）

- **Architecture cell**: `harness-eval`（与 F245 同 cell）
- **Map delta**: update required——新增 ledger store + 双 eval 域 + Console 锅账页三个 anchor，Design Gate 时更新 ownership cell
- **Why**: ledger 是 harness-eval 控制面的资产层（域评估之下的单锅账本）

## Tips Contribution（F244）

计划 1 条：`撞到工具 4xx 拒绝时，拒绝响应里的 ledger id 是锅账坐标——anomaly 上报引用它，让锅的触发被记账`（sourceRef: F257 spec；Phase B 落地后挂 anchor）。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Evidence** | `docs/features/assets/F257/harness-audit-2026-07-06.md` | 首棒 30 天触发审计全表（26 签名双路狩猎） |
| **Evidence** | `docs/features/assets/F257/seed-cases.md` | 自举条款种子案例账本（day-0 起） |
| **Feature** | `docs/features/F192-harness-eval-control-plane.md` | 演化母体：五层 control plane |
| **Feature** | `docs/features/F245-friction-signal-eval.md` | anomaly 通道复用基座 |
| **Feature** | `docs/features/F237-prompt-injection-visibility.md` | 触发观测代码基座（PR #1075） |
| **Thread** | `thread_mr6kh7kdoac6852d` | 调查线主 thread（启动包来源） |
| **Thread** | `thread_mr96jyudj9iqisa9` | F257 工作 thread（Fable→opus→codex 接力） |
