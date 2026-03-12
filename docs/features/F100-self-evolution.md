---
feature_ids: [F100]
related_features: [F042, F086, F038]
topics: [skills, sop, governance, self-improvement, knowledge-management]
doc_kind: spec
created: 2026-03-11
---

# F100: Self-Evolution — 猫猫自我进化机制

> **Status**: done | **Owner**: 布偶猫 | **Priority**: P1

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
