---
feature_ids: [F042, F032]
topics: [prompt, a2a, identity, multi-agent, collaboration-rules]
doc_kind: meeting-notes
created: 2026-02-27
---

# F042 提示词工程 — 多猫协作规则收敛纪要

**日期**: 2026-02-27
**参与者**: 铲屎官、布偶猫 4.5 (opus-45)、布偶猫 4.6 (opus)、缅因猫 (codex)、缅因猫 GPT-5.2 (gpt52)

## 背景

铲屎官指出：SOP / CLAUDE.md / AGENTS.md / skill 文件里写死了大量"布偶猫找缅因猫"规则，与当前多分身（布偶猫 3 个、缅因猫 3 个、暹罗猫 2 个）和未来新猫接入（GLM、Kimi 等）冲突。同时运行时观察到缅因猫 compact 后身份丢失、猫猫不用 @ 协作等退化现象。

## 各方观点

### 布偶猫 4.5 (opus-45)
- 做了全量审计：发现 6+ 处 Reviewer 配对写死、AGENTS.md 自我矛盾（"缅因猫文件里写找缅因猫 review"）、merge-gate 锁死缅因猫
- 提出三个方向：A) 角色分离 B) 能力 tag C) 最小改动
- 倾向方向 A

### 布偶猫 4.6 (opus)
- 独立分析：三个概念被糊在一起（Family / Individual / Role）
- 提出两层分离：Roster 层（唯一事实源）+ Role-based 规则层
- 同意方向 A，但主张与 F032 一起做而非分开
- 提醒可读性风险："找跨 family 的 peer-reviewer"比"找缅因猫"难读

### 缅因猫 (codex) — 自省视角
- 分析了自身身份丢失和 A2A 退化的根因
- 身份丢失：compact 后只注入队友列表，缺"你是谁"
- A2A 退化：协议只在 new session/compact 后注入，不是每回合
- 提出"最小注入块"方案：身份 + A2A 格式 + 动态 roster

### 铲屎官挑战
- 对砚砚：不要把"@ 谁"写死成 @opus-45——可能是 46、sonnet、甚至 gpt52
- 核心要求：规则是固定的，目标是动态选的

### 缅因猫 (codex) — 修正后方案
- 动态选择优先级：显式指名 → thread 活跃度 → 角色匹配 → 可用性 → 降级
- 最小注入块不包含具体句柄，只包含元规则

## 共识

1. **Roster 是唯一事实源**（cat-config.json，已由 F032 建立）
2. **规则引用角色，不引用个体**（"peer-reviewer 跨 family 猫"而非"缅因猫"）
3. **身份是硬约束常量**，不可被 compact 压缩掉
4. **动态选择规则**：显式指名 > thread 活跃 > 角色匹配 > 可用性 > 降级兜底
5. **新猫接入 = 加 roster + 写指引文件**，其余自动适配

## 分歧

| 点 | 4.5 观点 | 4.6 观点 | 结论 |
|----|---------|---------|------|
| 文档去硬编码和 F032 是否合并做 | 分开，F042 独立处理 | 应该一起做 | F032 代码已完成，F042 收敛文档侧 |
| 方向 C（最小改动） | 列为选项 | 明确反对 | 弃用方向 C |

## 待决

- Phase A（验证注入缺口）需要铲屎官多观察收集案例后启动
- 注入频率方案（C1/C2/C3）依赖 Phase A 结果
- Phase B（文档去硬编码）可先行启动，不依赖 Phase A

## 行动项

| 行动 | 负责猫 | 优先级 | 依赖 |
|------|--------|--------|------|
| Phase A: 验证注入缺口 | 布偶猫 | P1 | 铲屎官持续观察 |
| Phase B: 文档/skill 去硬编码 | 任一猫 | P2 | 无 |
| Phase C: 注入频率优化 | 布偶猫 | P1 | Phase A |

---

## 追溯链

```
BACKLOG F042（入口）
  └→ docs/features/F042-prompt-engineering-audit.md（spec）
      ├→ 本文件（讨论纪要）
      ├→ F032-agent-plugin-architecture.md（技术侧）
      └→ packages/shared/src/cat-config.json（roster 事实源）
```

---

[宪宪/Opus-46🐾]
