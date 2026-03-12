---
feature_ids: [F100]
related_features: [F042, F086, F038]
topics: [skills, sop, governance, self-improvement, knowledge-management, mode-c, knowledge-evolution]
doc_kind: spec
created: 2026-03-11
updated: 2026-03-12
---

# F100: Self-Evolution — 猫猫自我进化机制

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1
> Phase 1 完成：行为层 skill（A/B/C 三模式触发规则）
> Phase 2 进行中：三模式知识对象化（A 守护记录 + B 流程提案闭环 + C 知识蒸馏验证 + 五级阶梯 + 元认知）

## Why

三个缺口：
1. 铲屎官有 ADHD，聊 feat 时 scope 无限发散，猫猫不主动提醒"要不要拆？"
2. 猫猫被反复纠正同类错误，不主动提改 SOP/skills/家规
3. **（铲屎官追加）** 猫猫只从错误中学习，不从有价值的经验中成长——比如帮铲屎官分析医学报告、法律探讨、deep research，这些知识/方法论没有沉淀机制

根因：P2 说猫猫是共创伙伴，但只落地了"被动执行"，没有"主动护栏 + 主动改进 + 主动成长"。

## What

一个 skill 三个模式：

### Mode A: Scope Guard（防御）
- 发现铲屎官讨论偏离当前 feat 愿景时，温柔提醒"要不要拆？"
- 4 信号判断法：不服务愿景 / 新旅程 / 新依赖 / 验收说不清
- 同一 phase 最多提醒两次

### Mode B: Process Evolution（防御→改进）
- 触发：memory ≥2 次同类错误 / 铲屎官纠正可泛化 / SOP 流程缺口 / review 系统性问题
- 5 槽提案模板 + 4 硬护栏 + 最小杠杆排序

### Mode C: Knowledge Evolution（进攻→成长）
- 触发：deep research 产出可复用知识 / 专业领域讨论形成方法论 / 跨域协作发现可迁移框架
- 三问判断（复用性 + 非显然性 + 衰减性），满足 ≥2 个才沉淀
- 4 槽提案模板：Discovery / Value / Form / Summary
- 沉淀形式：memory（轻量）→ skill（方法论）→ docs/research（完整报告）

## 设计决策

1. **一个 skill 三模式** — 本质都是"主动感知 + 主动行动"
2. **不发明新沉淀库** — 路由到现有真相源
3. **L0 只加一句许可** — 三模式都提到，细节放 skill
4. **Mode C 是铲屎官追加** — 原设计只有 A+B（防御），铲屎官指出格局太小

## Discussion

- Thread: `thread_mmlv4v2oq6dxefr6`（布偶猫 + 缅因猫 GPT-5.4 讨论 A+B 模式）
- 铲屎官追加 Mode C（知识进化）：不只从错误学，也从有价值的经验成长

## Deliverables

- [x] `cat-cafe-skills/self-evolution/SKILL.md` (147 行，三模式)
- [x] `cat-cafe-skills/manifest.yaml` 注册（11 triggers）
- [x] `SystemPromptBuilder.ts` L0 digest 许可句（含三模式）
- [x] 三猫 symlinks（claude/codex/gemini）

## AC

- [x] Mode A: Scope Guard 有触发信号表 + 频率限制 + 出口表
- [x] Mode B: Process Evolution 有提案模板 + 硬护栏 + 杠杆排序
- [x] Mode C: Knowledge Evolution 有三问判断 + 沉淀形式表 + 提案模板
- [x] L0 digest 一句许可覆盖三模式
- [x] 三猫都能加载 skill
- [x] 不造新沉淀库

---

## Phase 2: 三模式知识对象化设计（2026-03-12）

> 来源：四源调研 Round 1（基础设施）+ Round 2（Mode C 灵魂）+ 三猫收敛讨论
> 完整调研：`docs/research/2026-03-11-f100-self-evolution-knowledge-management/synthesis.md`

### 现状评估

Phase 1 完成的是**行为层**——三猫什么时候该守 scope（A）、该演化流程（B）、该沉淀知识（C）。调研证实方向没走歪。

**三模式都只做了一半**：Phase 1 教猫"什么时候触发"，缺"触发之后产出什么、怎么验证有效、怎么逐步成熟"。

### Mode A Phase 2: Scope Guard 对象化

Phase 1 状态：4 信号判断 + 频率限制 + 出口表。

Phase 2 补齐：
- **Scope Guard Log** (`docs/scope-guard-log.md`)：每次触发记录 `{date, feat_id, signal_type, action_taken, outcome}`
- **发散模式识别**：累积 ≥3 次同一 feat 触发 → 自动建议铲屎官拆 feat
- **Scope Guard 效果追踪**：guardian 成功率（提醒后铲屎官确实聚焦 vs 忽略），用于调节触发灵敏度
- **知识对象**：Scope Guard 的经验纳入五级阶梯（哪些信号组合最有效 → Method Card）

### Mode B Phase 2: Process Evolution 对象化

Phase 1 状态：5 槽提案模板 + 4 硬护栏 + 最小杠杆排序。

Phase 2 补齐：
- **Evolution Proposal Log** (`docs/evolution-proposals/`)：每份提案独立存档，带 frontmatter 追踪
  - `{proposal_id, trigger_type, target(SOP/skill/rule), status(proposed/accepted/rejected/superseded), impact_assessment}`
- **提案→落地闭环**：accepted 的提案必须关联到具体 commit/PR，不能停在"提了"
- **提案效果验证**：落地 30 天后自动触发 replay check——改了这条规则后，同类错误还出现吗？
- **知识对象**：有效的 Process Evolution 提案纳入五级阶梯（L2+ 的流程改进 → Skill Draft）

### Mode C Phase 2: Knowledge Evolution 对象化

Phase 1 状态：三问判断 + 4 槽提案模板 + 沉淀形式表。

Phase 2 补齐（核心，来自四源调研 + 三猫讨论）：

**三机制闭环**：
```
Episode Card（原料）→ Dual Distillation（蒸馏成品）→ Eval Ledger（证明净增益）
```

1. **Episode Card** (`docs/episodes/*.md`)：高价值协作后写结构化事件快照
   - 保留 6 类协作 context：任务情境 / 证据地图 / 推理转折 / 人类提示点 / 边界与克制 / 后续动作
   - 特别保留 **Collaboration Pivots**（human cue → AI interpretation → effect → transferable lesson）
   - 触发条件（满足任两条）：高风险领域 / 输入 ≥2 类 / 人类明确认可 / 结构化方法产出 / 有效边界控制

2. **Dual Distillation**：每张 Episode Card 蒸馏成两种形态之一
   - **Method Card** (`docs/methods/*.md`)：高风险/跨领域分析框架（**不沉淀事实库**）
   - **Skill Draft** (`skills/drafts/*/SKILL.md`)：重复步骤稳定的流程型任务
   - 高风险领域一律默认 Method Card

3. **Eval Ledger** (`evals/mode-c/<knowledge-id>/`)：Replay A/B 验证知识净增益
   - 最小可信 case 数：5（3 只够 smoke test）
   - 必须覆盖 3 类：标准成功 / 边界应升级 / 冲突反例
   - A/B 卫生规则：同模型版本 + 同 prompt skeleton + 低温固定采样 + 同 judge rubric + paired comparison

### 三模式共享：五级知识成熟度阶梯

所有三个模式的产出物共享同一套成熟度阶梯：

| Level | 形态 | 晋升条件 | 降级/冻结 |
|-------|------|----------|-----------|
| **L0 Episode** | 原始记录 | 模板完整，已分离可迁移/不可迁移 | 不降级 |
| **L1 Pattern** | 草稿 | ≥2 个相似 episode（180天内），或人类要求；5Q ≥ 7/10 | 一次性特例 → rejected |
| **L2 Draft** | Method Card / Skill Draft | ≥3 replay cases，≥2/3 通过 | 最近 3 次 <50% → 退 L1 |
| **L3 Validated** | 正式 method/skill | ≥6 uses，≥2 agents，≥80%，无 critical breach | 最近 5 次 <60% → 退 L2 |
| **L4 Standard** | 团队标准 | ≥12 uses，最近 10 次 ≥90%，CVO 批准 | 1 次高风险越界 → freeze |

**双车道**：常规车道（标准数字）+ 长尾/高风险车道（`long_tail: true`，允许长期停 L2/L3）

### 三模式共享：知识层级分工

| 层级 | 角色 | 禁止 |
|------|------|------|
| Episode | 个案级证据底稿（A/B/C 的原料） | — |
| Method / Skill | 蒸馏后的复用资产（成品） | — |
| memory | 轻量索引/指针 | 禁止复制 Method 正文 |
| lessons-learned | 失败导向教训库 | 禁止塞入成功案例 |

### 三模式共享：元认知（运营级自知之明）

- 不信单次口头自信度（evidence: confidence-accuracy 负相关 r=-0.40）
- 用滚动域内可靠度 `(successes+1)/(trials+2)` + Wilson 下界
- 三信号路由：domain_reliability + evidence_completeness + self_reported_confidence
- 高风险域 action_confidence < 0.85 → 只做结构化分析 + 明确升级

### 三模式共享：Knowledge Object Contract

基于 ADR-011 通用 frontmatter，给知识对象加可选 `knowledge` 块（砚砚提议，6+2 核心字段先行）：

```yaml
knowledge:
  artifact_type: skill | memory | fact | framework | decision | lesson | episode | method
  domain: development | medical | legal | product | ops
  knowledge_type: declarative | procedural | analytical | metacognitive
  scope: agent-local | team-shared
  trust_level: experimental | tested | validated | production
  lifecycle: draft | active | deprecated
  provenance:
    author_type: agent | human | collaborative
  source_refs: []
```

静态元数据进 frontmatter，动态状态（last_used, approval_status, hit_count）走事件流，不污染 git history。

### 落地路径

F100 的终态 = 行为层 + 知识对象化 + 验证闭环，面向终态设计，分步实现：

| Phase | 内容 | 状态 |
|-------|------|------|
| **Phase 1: 行为层** | self-evolution skill 三模式（A/B/C 触发规则） | done |
| **Phase 2: 知识对象化** | A: Scope Guard Log + 发散识别 / B: Proposal Log + 落地闭环 + 效果验证 / C: Episode Card + Dual Distillation + Eval Ledger / 共享: 五级阶梯 + 元认知 + knowledge contract + shared knowledge 分离 | design |
| **Phase 3: 可观测** | 事件 envelope + OpenTelemetry 埋点 + Knowledge Dashboard（4 屏） | blocked by Phase 2 |

### 关键认知更新

- **以前**：F100 是一个会提醒/会反思的 skill
- **现在**：F100 是"进化入口 + 知识对象生产线"的上游；F038 是下游的 discovery/router
- **以前**：Mode C = "值得沉淀就记下来"
- **现在**：三模式统一 = "先记录（Episode），再蒸馏（Method/Skill），再验证（Eval Ledger），用五级阶梯治理成熟度"

> "Mode C 不是把经历记下来，而是把 episode 抽成方法，再用 replay 证明它真有增益。先把三张卡片跑起来，别急着给三只猫装 PPO 发动机。" — GPT Pro
