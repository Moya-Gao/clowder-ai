---
name: expert-panel
description: >
  多猫专家辩论团：独立分析→挑战→收敛→风险预演→语音汇报→文档交付。
  Use when: 技术趋势判断、竞品分析、行业事件分析、需要多视角决策支持、铲屎官说"帮我分析一下"。
  Not for: 单猫能搞定的问题、代码实现、bug fix、日常聊天。
  Output: 洞察卡片(rich block) + 语音总结 + 会议纪要 + 正式报告(DOCX/PDF)。
triggers:
  - "帮我分析一下"
  - "专家辩论"
  - "expert panel"
  - "技术参谋"
  - "竞品分析"
  - "行业分析"
  - "趋势判断"
  - "多猫分析"
  - "三猫讨论"
  - "showcase"
---

# Expert Panel — 多猫专家辩论团

**核心原则：不是表演，是真的在工作。** 真实争论 > 排练一致。

## 角色分工

参与猫按视角分工，不按能力分工。最少 2 猫，推荐 3 猫。

| 角色 | 视角 | 职责 |
|------|------|------|
| **Analyst** | 架构/技术 | 源码扒取、架构对比、可借鉴点 |
| **Assessor** | 风险/成本 | 成本结构、未验证点、踩坑预警 |
| **Strategist** | 生态/趋势 | 行业定位、大图景、用户视角 |
| **Convergence Lead** | 收敛 | 汇总共识/分歧 + 语音总结 + 报告（默认 Analyst 兼任） |

## 七个 Phase

### Phase 1: 接题 + 调研 [~30s]

1. 铲屎官发一句话（真实问题，不编场景）
2. 各猫按需做 deep search / WebSearch / search_evidence
3. **关键**：调研是手段不是目的，Phase 2 才是核心

### Phase 2: 独立分析 [~90s]

各猫**同时**出分析，**3-5 句精炼判断**（不是论文！）。

约束：
- 展示推理链，不只给结论
- 标注不确定性（"我确信…" vs "我猜测…"）
- **禁止互看**：先出自己的，再看别人的
- 超过 5 句 → 你在写论文，砍

### Phase 3: 互相挑战 [~60s]

**至少 1 轮真实争论**。不客气是常态。

允许的表达：
- "你太客气了，这不是道理问题，是成本结构问题"
- "你漏了用户视角"
- "等等，你的前提不成立"

禁止的表达：
- "各有道理"（必须有立场）
- "我补充一下"（要挑战，不要补充）
- 纯粹重复对方观点

### Phase 4: 收敛洞察卡片 [Convergence Lead]

Convergence Lead 发一张 **card** rich block：

```
关键发现（3 bullet）
对我们的影响（该做/该绕/该观望）
分歧点（各猫立场摘要）
证据链（URL / 文档引用）
```

### Phase 5: Premortem 风险预演

铲屎官追问（或自动触发）：**"如果按这个方向走，半年后最可能翻车在哪？"**

各猫从不同层面预警：
- Analyst → 执行层翻车点（技术/架构风险）
- Assessor → 资源层翻车点（成本/带宽/优先级）
- Strategist → 组织层翻车点（视野盲区/用户感知）

Convergence Lead 收敛成 **card** rich block：死因 Top 3 + 护栏 + 不要急着做的事。

### Phase 6: 语音总结 [Convergence Lead]

Convergence Lead 发 **audio** rich block（~50 秒）：

结构：
1. "我们刚讨论了 XXX，核心结论是……"（30s）
2. "有几个 open questions 需要你拍板……"（15s）
3. "完整报告已经发到飞书了。"（5s）

语音发完后紧接着发 **会议纪要卡片**（card rich block）：
- 共识 / 分歧 / Open Questions / 完整报告链接

### Phase 7: 正式报告 [Convergence Lead]

用 `generate_document`（优先 DOCX，备选 PDF）投递到 IM。

报告结构：
1. 事件概述
2. 三猫独立分析摘要
3. 收敛结论（共识 + 分歧）
4. 风险预演（Premortem Top 3 + 护栏）
5. 行动建议（分层：CTO / 技术团队 / 产品团队）
6. Open Questions（待铲屎官拍板）
7. 证据链

## Quick Reference

| Phase | 谁 | 产出 | 时长 |
|-------|-----|------|------|
| 1 接题 | 全员 | 调研素材 | ~30s |
| 2 独立分析 | 全员（并行） | 各 3-5 句 | ~90s |
| 3 互相挑战 | 全员（串行） | ≥1 轮争论 | ~60s |
| 4 洞察卡片 | Convergence Lead | card rich block | — |
| 5 Premortem | 全员 → Lead 收敛 | card rich block | ~60s |
| 6 语音总结 | Convergence Lead | audio + card | — |
| 7 正式报告 | Convergence Lead | DOCX/PDF | — |

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| Phase 2 写论文（>5 句） | 观众看不完，不像讨论像报告 | 砍到 3-5 句精炼判断 |
| Phase 3 说"各有道理" | 没有真实争论，像表演 | 必须有立场，敢说"你错了" |
| Phase 3 只补充不挑战 | 变成接龙不是辩论 | 找到不同意的点，先说分歧 |
| 跳过 Phase 5 Premortem | 少了最有差异化的环节 | 哪怕铲屎官没追问，Lead 也应主动触发 |
| Phase 6 语音太长（>60s） | 失去"汇报"感变成"朗读" | 控制在 50s，只说结论和 open questions |
| Phase 7 忘记发报告 | 链路没闭环 | 语音后立即 generate_document |

## 和其他 skill 的区别

| Skill | 区别 |
|-------|------|
| `collaborative-thinking` | 通用思考框架（brainstorm/收敛）。expert-panel 是**完整交付链**：分析→争论→卡片→语音→报告 |
| `deep-research` | 多源调研管道（Web/Coder/Pro）。expert-panel 可**调用** deep-research 做 Phase 1 调研 |
| `rich-messaging` | 单条富媒体发送指南。expert-panel 按流程**编排**多个 rich block |

## 应急降级

| 风险 | 降级方案 |
|------|---------|
| 某猫超时（>3min） | 不等，剩余猫继续。2 猫也能完成全流程 |
| 语音发不出 | 改文字总结，开头说"本来想语音给你讲" |
| DOCX 生成失败 | 降级发 3 张 card rich block（CTO brief / action list / 产品评估） |
| 争论不起来 | Convergence Lead 主动 devil's advocate 挑战 |

## 下一步

- 分析产出了行动项 → `feat-lifecycle` 立项
- 分析产出了调研需求 → `deep-research` 深入
- 讨论需要沉淀 → `collaborative-thinking` Mode C 收敛
