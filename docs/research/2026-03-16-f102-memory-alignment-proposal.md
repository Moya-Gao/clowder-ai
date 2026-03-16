---
feature_ids: [F102]
topics: [memory, proposal, alignment]
doc_kind: research
created: 2026-03-16
---

# F102 记忆系统对齐 Proposal

> **背景**：F102 Phase A/B/C 已 merge，激活讨论已完成（见 `docs/discussions/2026-03-14-f102-activation-meeting-notes.md`）。
> 铲屎官发现新想法，需要和现有记忆架构对齐。

## Related

- F102 spec: `docs/features/F102-memory-adapter-refactor.md`
- 激活讨论: `docs/discussions/2026-03-14-f102-activation-meeting-notes.md`
- 原始设计: `docs/research/2026-02-25-memory-design/proposal.md`

---

## Proposal

抓到了，这次我确实去翻了。
Artem 这套东西，压成一句话就是：

**不是让 Claude “自己记住”，而是把 notes / docs / session 历史外接成一个本地检索层，让 agent 每次开工前先“召回上下文”。** 他自己说，3 周里跑了 700 个 Claude Code session，默认方式每次都像从零开始；用 Haiku 子代理去搜一次能等到 3 分钟，而把 QMD 接进自己的 vault 以后，搜索几乎是即时的，而且更省 token。([linkedin.com][1])

### 他具体是怎么做的

第一层，他先把“可记忆的东西”统一成一个 **Markdown vault**。QMD 官方就是按这个思路设计的，给 notes、meeting transcripts、documentation、knowledge bases 建 collection，再给 collection 和路径树补充 `context` 描述，让命中的子文档在返回时带上更高层语境。这个 `context add` 其实是个暗器，很适合让 LLM 判断“这段命中到底属于 ADR、聊天记录，还是研究笔记”。([GitHub][2])

第二层，他不用纯 grep，而是换成三档检索：
`qmd search` 走 **BM25 全文检索**，`qmd vsearch` 走 **向量语义检索**，`qmd query` 走 **混合检索 + rerank**。QMD 的实现也是本地派路线：BM25 基于 SQLite FTS5，向量检索用 sqlite-vec，混合结果用 RRF 融合，再叠 LLM query expansion / reranking。也就是说，这不是“一个大而重的云 RAG 服务”，而是一个本地侧车搜索层。([GitHub][3])

第三层，他在 agent 之上包了一层 **`/recall` skill**。从 X 的摘要能看到，这个 skill 至少有三种入口：
**temporal** 按日期扫历史，**topic** 按主题在 QMD collection 里搜，**graph** 用交互式图把 session 和文件串起来看。按对原帖的整理，他还做了一个自动索引流水线，把本地 session 历史转成干净的 markdown，并在会话结束时自动更新索引，这样记忆层不会过期。([X (formerly Twitter)][4])

第四层，他把重点从“Claude Code 本身”挪到了 **context layer**。原帖整理里明确提到，这套上下文可以被 Claude Code、Codex、Gemini CLI 这类不同 agent 共用。也就是说，工具会换，模型会换，但 **记忆层和检索层不换**。这点跟你们猫猫咖啡的方向，几乎是同一个宇宙分支。([B Lab][5])

---

## 如果给猫猫咖啡抄作业，我会这样改

### 1. 先别“全量 grep”，先分语料层

你们现在最该做的，不是直接上“更高级搜索”，而是把语料切成 4 个 collection：

* `docs`：ADR、spec、research、设计文档
* `skills`：SOP、SKILL.md、治理规则
* `memory`：长期记忆、偏好、决策沉淀
* `threads`：聊天记录 / session chain / 讨论纪要

原因很简单：

**结构化 md** 和 **聊天 transcript** 不是一个物种。
前者更适合 BM25，后者更适合语义 / 混合检索。把它们塞进一个桶里搜，结果会像猫砂和咖啡豆混装，味儿不对。QMD 本身就是围绕 collection + path context 在工作的。([GitHub][2])

---

### 2. 把 thread 先“转译”为 Markdown 资产

你们已经有几百个 thread 了。别直接拿原始 JSON/数据库字段让猫搜。
我会做两层文件：

**raw transcript**

```md
---
source: cat-cafe-thread
thread_id: th_123
project: cat-cafe
participants: [landy, opus, gpt, gemini]
started_at: 2026-03-12T10:21:00+08:00
topics: [memory, retrieval, qmd]
feature_ids: [F102]
doc_kind: transcript
---

## Turn 001
[landy] 我们现在聊天记录还是 grep...

## Turn 002
[gpt] 这里的问题不是 grep 本身，是上下文层...
```

**distilled summary**

```md
---
source: cat-cafe-thread-summary
thread_id: th_123
project: cat-cafe
doc_kind: summary
topics: [memory, retrieval]
feature_ids: [F102]
---

## Decisions
- 聊天记录检索从 grep 升级为 collection-based hybrid retrieval

## Why
- grep 对“换词表达”的召回太差

## Artifacts Mentioned
- docs/adr/ADR-005-memory.md
- docs/research/f102-memory-review.md

## Open Questions
- raw transcripts 是否默认参与搜索
```

为什么要两层？
因为 raw transcript 是证据，summary 是入口。只搜 raw，噪音太大；只搜 summary，又会丢细节。两层一起，猫猫才不会在历史长河里狗刨。这个是我给你们的设计建议。

---

### 3. 默认策略不要直接“全混合检索”

QMD 自己的生态建议其实很务实：

* 默认先用 **BM25**
* 关键词不行，再上 **vector**
* 真的需要高质量召回，再上 **hybrid + rerank**

因为 `qmd search` 通常最快，`vsearch` / `query` 会涉及本地模型加载，冷启动更慢。QMD 也专门提供了 HTTP daemon 模式，避免每次都重复加载模型。对你们这种“三只猫并发查记忆”的场景，这个特别重要。([GitHub][6])

所以我会给猫猫咖啡定一个检索路由：

* **找 feature / 文件名 / ADR / 明确术语**
  先 `lex/BM25`
* **找“我们当时为什么这么决定”**
  `lex + vec`
* **找长聊天里隐含的同义表达**
  `vec` 或 `lex + vec + hyde`
* **找源码 symbol / API 实现**
  继续 `rg` / code search，别让 QMD 越俎代庖

---

### 4. 给猫猫们一个统一的 `/recall` 协议

Artem 的关键不是 QMD 本身，而是 **把检索封装成一个 agent 会主动用的动作**。你们也该有一个统一口子，不要让每只猫自己瞎搜。原帖里 `/recall` 至少覆盖了按时间、按主题、按图谱回溯三种模式。([X (formerly Twitter)][4])

我会给猫猫咖啡定义这种统一接口：

```text
/recall topic "F102 memory adapter hindsight"
/recall date "last week"
/recall why "为什么我们放弃纯grep搜thread"
/recall thread "狼人杀 GameEngine seat actor role"
/recall graph "memory migration"
```

然后让所有猫在开工前先跑一遍：

1. 取当前任务标题 / feature_id / thread topic
2. 先查 `docs + skills + memory`
3. 需要时再补查 `threads-summary`
4. 只有召回不够，才下钻 `threads-raw`
5. 最终只注入 5 到 10 条最有证据味的 snippet

这样猫猫不是“想起一点什么”，而是**按协议回忆**。

---

### 5. 用 typed query，不要只扔一句自然语言

QMD 现在已经支持 **query document**，可以把一次检索拆成 `lex:`、`vec:`、`hyde:` 多个子查询，而且**第一条会得到 2× 融合权重**。`lex` 还支持精确短语和排除词，能处理重名和歧义。([GitHub][7])

这对猫猫咖啡非常香。比如：

```text
intent: Cat Café memory migration decisions, not general RAG
lex: "F102" "memory adapter" hindsight local -smart-store
vec: why did we move from Hindsight to local markdown-first memory
hyde: We migrated memory from Hindsight to a local markdown-based system because we wanted markdown as source of truth, better traceability, and lower dependency risk.
```

或者找聊天：

```text
intent: locate conversation history rather than docs
lex: "狼人杀" "seat actor role" "scoped event log"
vec: which conversation discussed separating seat actor and role
hyde: The team discussed that seat, actor, and role should be decoupled so humans and AI players can be assigned independently while the game engine enforces scoped visibility.
```

这比一句“帮我找之前讨论过的那个东西”强太多。后者像把猫丢进仓库里找线球，前者像直接给它门牌号。

---

### 6. 把 `threads-raw` 设成默认不参与

QMD 最近加了一个非常适合你们的功能：
collection 可以 `includeByDefault: false`，也就是默认查询时把某个 collection 隐掉，只有显式指定才搜。还可以给 collection 配 `update-cmd`，让它在每次 `qmd update` 前先跑一段脚本。([GitHub][3])

这两个功能正好对应你们的痛点：

* `threads-raw` 默认排除，避免聊天噪音淹没 docs
* 每次更新前自动执行
  `node scripts/export-threads-to-md.mjs`

你们甚至可以这样想：

* `docs / skills / memory` 是 **主脑**
* `threads-summary` 是 **短期回忆**
* `threads-raw` 是 **档案馆**

平时别让档案馆冲进驾驶舱。

---

## 我给你们的第一版落地方案

官方命令形态大概就是这些：QMD 支持建 collection、加 context、生成 embedding、开 MCP / HTTP daemon；这些接口和命令都在 README 里。([GitHub][2])

```bash
# 1) 安装
npm install -g @tobilu/qmd

# 2) 建 collection
qmd collection add ~/cat-cafe/docs --name docs --mask "**/*.md"
qmd collection add ~/cat-cafe/skills --name skills --mask "**/*.md"
qmd collection add ~/cat-cafe/memory --name memory --mask "**/*.md"
qmd collection add ~/cat-cafe/threads-summary --name threads-summary --mask "**/*.md"
qmd collection add ~/cat-cafe/threads-raw --name threads-raw --mask "**/*.md"

# 3) 给 collection 加语境
qmd context add qmd://docs "Cat Café specs, ADRs, research reports, and design docs"
qmd context add qmd://skills "Cat Café SOPs, skills, and operating procedures"
qmd context add qmd://memory "Persistent memory, preferences, decisions, and follow-ups"
qmd context add qmd://threads-summary "Curated summaries of historical Cat Café conversations"
qmd context add qmd://threads-raw "Raw multi-agent chat transcripts and session logs"

# 4) 生成 embedding
qmd embed

# 5) 跑常驻 MCP，给三只猫共用
qmd mcp --http --daemon
```

然后再给 `threads-summary` / `threads-raw` 绑一个更新脚本：

```bash
qmd collection update-cmd threads-summary 'node scripts/export-thread-summaries.mjs'
qmd collection update-cmd threads-raw 'node scripts/export-thread-raw.mjs'
```

这一步利用的是 QMD 自带的 `update-cmd` 机制。([GitHub][3])

---

## 我会怎么告诉猫猫们“检索新规”

可以直接把下面这段当成猫猫咖啡内部 SOP 草案：

```md
# Retrieval Policy v1

1. 不再直接 grep 全量 thread。
2. 默认先查 docs/skills/memory。
3. 只有问题明确指向“历史聊天”时，才查 threads-summary。
4. 只有 summary 不够时，才下钻 threads-raw。
5. 明确术语 / feature_id / 文件名 → lex(BM25)
6. 模糊问题 / 同义表达 / “为什么”类问题 → lex + vec
7. 高价值复杂检索 → lex + vec + hyde
8. 代码符号、函数实现、调用链 → 继续 code search，不走 markdown retrieval。
9. 每次开工前必须先 /recall，再开始写。
10. 返回结果必须带 source path、snippet、score、必要时 line numbers。
```

---

## 最后一句判断

**Artem 真正值得抄的，不是“QMD”这三个字母，而是这条思路：**

> **聊天记录不是拿来存的，是拿来被 agent 再次取回的。**

你们现在已经有很多 md，也有几百个 thread。
这不是负担了，这是现成的猫猫记忆矿脉。
下一步不是继续拿 grep 小铲子刨，而是给它上轨道车。🐾

要是你点头，我下一条就直接给你写一份 **Cat Café 检索升级 ADR 草案**，包括目录结构、导出脚本字段、/recall 协议、以及“grep → BM25/hybrid”迁移步骤。

[1]: https://www.linkedin.com/posts/artemxtech_every-conversation-with-claude-code-starts-activity-7433332745063374848-5i-8 "Every conversation with Claude Code starts from zero. I had 700 sessions in 3 weeks and I don't remember what was happening back then. I'm losing control in terms of what's happening. I need to… | Artem Zhutov"
[2]: https://github.com/tobi/qmd/blob/main/README.md "qmd/README.md at main · tobi/qmd · GitHub"
[3]: https://github.com/tobi/qmd/blob/main/CHANGELOG.md "qmd/CHANGELOG.md at main · tobi/qmd · GitHub"
[4]: https://x.com/ArtemXTech/status/2028330693659332615?utm_source=chatgpt.com "Artem Zhutov (@ArtemXTech) on X"
[5]: https://b-lab.team/en/content/3299fe8c-6abd-47cd-a876-b0f6b965b2ae "Grep is Dead: How Claude Code Makes It Remember | GeekNews | B Lab"
[6]: https://github.com/openclaw/skills/blob/main/skills/levineam/qmd-external/SKILL.md "skills/skills/levineam/qmd-external/SKILL.md at main · openclaw/skills · GitHub"
[7]: https://github.com/tobi/qmd/blob/main/docs/SYNTAX.md?utm_source=chatgpt.com "qmd/docs/SYNTAX.md at main - tobi tobi"


