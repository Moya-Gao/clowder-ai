---
feature_ids: [F100]
related_features: [F042, F086]
topics: [skills, sop, governance, self-improvement]
doc_kind: spec
created: 2026-03-11
---

# F100: Self-Evolution — 猫猫自我进化机制

> **Status**: done | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官有 ADHD，聊 feat 时容易 scope 无限发散，但猫猫从不主动提醒"要不要拆 feat？"
同时猫猫被反复纠正同类错误（memory 里记了一堆），却从不主动提出改 SOP/skills/家规来防止再犯。

根因：缺少"主动护栏 + 主动进化"的执行机制。P2 说猫猫是共创伙伴，但没有 skill 落地这个能力。

## What

一个 skill 两个模式：

### Mode A: Scope Guard
- 发现铲屎官讨论偏离当前 feat 愿景时，温柔提醒"要不要拆？"
- 4 信号判断法（不靠机械计数）：不服务愿景 / 新旅程 / 新依赖 / 验收说不清
- 同一 phase 最多提醒两次，铲屎官说不拆就复述新边界

### Mode B: Process Evolution
- 触发：memory ≥2 次同类错误 / 铲屎官纠正可泛化 / SOP 流程缺口 / review 系统性问题
- 5 槽提案模板：Trigger / Evidence / Root Cause / Lever / Verify
- 4 硬护栏：证据 ≥2 源 / 最小杠杆优先 / 先修再提 / 提案要短
- 最小杠杆排序：复述scope → memory → 单skill → SOP → SystemPromptBuilder → L0

## 设计决策

1. **一个 skill 两模式**（不拆两个）— 本质都是"发现要漂了，打护栏"
2. **不发明新沉淀库** — 路由到现有真相源（shared-rules / SOP / skill / lessons-learned）
3. **L0 只加一句许可** — 细节放 skill，避免每轮注入膨胀
4. **条件式 review** — 影响自己直接提铲屎官，影响三猫先找 1 只猫 sanity check

## Discussion

- Thread: `thread_mmlv4v2oq6dxefr6`（布偶猫 + 缅因猫 GPT-5.4 讨论）
- 缅因猫核心贡献：4 信号判断法、4 硬护栏、"不造新沉淀库"约束、L0 只放一句

## Deliverables

- [x] `cat-cafe-skills/self-evolution/SKILL.md` (144 行)
- [x] `cat-cafe-skills/manifest.yaml` 注册
- [x] `SystemPromptBuilder.ts` L0 digest 加许可句
- [x] 三猫 symlinks（claude/codex/gemini）
- [x] 守护测试通过（58 pass / 8 fail 全 pre-existing）

## AC

- [x] Scope Guard 有触发信号表 + 提醒频率限制 + 出口表
- [x] Process Evolution 有提案模板 + 硬护栏 + 杠杆排序
- [x] L0 digest 有且仅有一句常驻许可
- [x] 三猫都能加载 skill（symlinks）
- [x] 不造新沉淀库
