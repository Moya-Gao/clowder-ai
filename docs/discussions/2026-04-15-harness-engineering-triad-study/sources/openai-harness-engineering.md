---
doc_kind: note
created: 2026-04-15
topics: [harness-engineering, codex, repo-legibility, docs-as-system-of-record]
source_url: https://openai.com/index/harness-engineering/
source_title: "Harness engineering: leveraging Codex in an agent-first world"
published: 2026-02-11
---

# Source Note — OpenAI Harness Engineering

## 文章定位

OpenAI 这篇不是在讲“怎么写 prompt”，而是在讲**如何把一个代码仓变成 agent-first 的工作系统**。

## 我提取到的五个核心点

1. **人类角色上移**
   人类不再主要直接写代码，而是负责设计环境、表达意图、构建反馈回路。

2. **repo 是系统记录，不是聊天记录**
   `AGENTS.md` 只做目录；真正的知识放进结构化 `docs/`，并且要求 agent 可发现、可校验、可维护。

3. **agent legibility 比 human convenience 更优先**
   代码、文档、日志、指标、UI 都要让 agent 看得见、跑得通、验证得了。

4. **高吞吐会把“taste”变成基础设施问题**
   当 agent 产出变多，问题不是“能不能写”，而是“会不会把 repo 越写越脏”。他们用 golden principles + 持续 cleanup 抵抗 drift。

5. **harness 是持续垃圾回收系统**
   技术债不是等爆炸了再还，而是持续用 agent 自己做 doc gardening、质量评分、重构 PR。

## 对我们最有启发的点

### A. `AGENTS.md` 作为目录，而不是百科全书

这和我们现在的方向高度一致。我们已经在做：

- 分层 prompt / governance pack
- feature doc / ADR / lesson / discussion 分流
- evidence 搜索作为召回层

但 OpenAI 的强项是：**把“短入口 + 深文档 + 机械检查”这一套闭得更紧。**

### B. docs-as-system-of-record 必须有 lint

只有把知识放进 repo 还不够。OpenAI 文章最值得学的不是“写了很多文档”，而是：

- 文档是否过期
- 交叉链接是否断裂
- 规则是否仍然有效

这些都要进 CI / 背景修剪。

### C. 高吞吐条件下，清理机制本身要 agent-native

他们不是让人类每周手工扫“AI slop”，而是让 agent 持续扫、持续开修复 PR。这一点和我们后续想做的 repo-native knowledge/gov lint 很一致。

## 我们和它的差异

OpenAI 这篇的默认前提还是 **Codex-first**。

它非常强，但核心仍是：
- 一个主 agent 家族
- 一个 agent-first repo
- 很重的仓内 legibility / validation / cleanup

而我们还多了：
- 多引擎
- 多身份
- 跨家族 review
- handoff / routing / human approval

所以我的结论是：  
**OpenAI 在 repo legibility 和知识工件化上走得更深；我们在多脑协作和身份治理上走得更远。**

