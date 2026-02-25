---
name: discussion-convergence
description: Use when a multi-party discussion (brainstorm, review debate, architecture discussion, feat interview) reaches consensus or ends. Use when铲屎官 says "讨论结束", "收敛一下", "总结一下", or when all parties have given their input and decisions are made. Also use after any open-invite discussion that produced actionable conclusions.
---

# Discussion Convergence

## Overview

**将讨论中的精华沉淀为结构化文档，建立"入口 1 个 → 一步步抓到细节"的追溯链。**

讨论中最有价值的洞见往往散落在对话里。这个 skill 确保它们流入正确的结构化载体，而非被遗忘。

## When to Use

- 多猫讨论（brainstorm / debate / open invite）达成共识后
- Review 争论收敛后
- 铲屎官 + 猫的 feat 讨论结束时
- 任何产出了决策、新规则、或否决理由的对话结束时

**When NOT to use:**
- 纯 1:1 feat 采访（用 `feat-discussion` skill）
- 代码 review follow-up（用 `cat-cafe-receiving-review` skill）

## 收敛三件套（必须执行）

每次讨论收敛后，过一遍这个清单：

### 1. 否决理由 → 写回 ADR

讨论中"为什么不选方案 B"的关键论据，补充到对应 ADR 的否决记录段。

**检查**：这次讨论有没有否决某个技术方案？有 → 找到对应 ADR（或新建），补否决理由。

### 2. 踩坑教训 → lessons-learned.md

讨论中暴露的新教训，按 7 槽位格式追加到 `docs/lessons-learned.md`。

**检查**：这次讨论有没有暴露"以前不知道的坑"？有 → 追加记录。

### 3. 操作规则 → 指引文件

讨论中确立的新操作铁律，更新到 CLAUDE.md / AGENTS.md / GEMINI.md。

**检查**：这次讨论有没有产生"以后必须这样做"的新规则？有 → 更新指引。

**不是每次讨论都会产出三项——但每次都必须过清单，确认"没有遗漏"而非"懒得检查"。**

## 追溯链建立

讨论产出的文档必须形成可追溯的链路：

```
BACKLOG.md F{N}（入口）
  └→ {topic}-feats.md 或 README.md（总览/拆解）
      ├→ meeting-notes.md（会议纪要：共识/分歧/待决）
      ├→ research/（调研证据，如有）
      └→ [后续] 各子议题的 1:1 讨论记录
```

**规则**：
- BACKLOG 条目的"备注"列必须包含追溯链入口链接
- 总览文档底部必须有完整的链路图（用缩进树形表示）
- 每篇文档头部必须 link 回上级文档

## 产出模板

### 会议纪要

```markdown
# {主题} 讨论纪要

**Thread ID**: `thread_xxx`
**日期**: YYYY-MM-DD
**参与者**: [列出所有参与方]

## 背景
[为什么要讨论这个]

## 各方观点
[按参与者分，保留原始立场]

## 共识
[所有人同意的结论]

## 分歧
[未达成一致的点 + 各方理由]

## 待决
[需要铲屎官拍板或后续讨论的]

## 行动项
[具体的下一步，指定负责人]
```

### Feat 拆解（如适用）

每个 feat 包含：背景 / 范围 / 非目标 / 验收标准 / 风险 / 铲屎官反馈。
详见 `docs/discussions/agent-swarm-feats.md` 作为实际范例。

## 文档存放

| 产出类型 | 存放位置 |
|---------|---------|
| 会议纪要 | `docs/discussions/YYYY-MM-DD-{topic}-meeting-notes.md` |
| Feat 拆解 | `docs/discussions/{topic}-feats.md` |
| 开放讨论记录 | `docs/discussions/YYYY-MM-DD-{topic}/README.md` |
| 调研证据 | `docs/research/YYYY-MM-DD-{topic}/` |

## Commit

收敛完成后立即 commit：

```
docs({scope}): {topic} 讨论收敛 + 追溯链 [{猫猫签名}]

What: 会议纪要 + feat 拆解 + BACKLOG 链接
Why: 讨论结论沉淀，建立可追溯链路
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| 讨论完就散了，不写纪要 | 本 skill 存在的理由——讨论完必须收敛 |
| 写了纪要但不 link 回 BACKLOG | 追溯链断裂，未来找不到 |
| 只记共识不记分歧 | 分歧和否决理由是最有价值的信息 |
| 三件套检查"感觉没有就跳过" | 必须显式过清单，每项回答"有/没有" |
