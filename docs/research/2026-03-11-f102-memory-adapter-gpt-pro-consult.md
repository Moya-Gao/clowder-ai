---
feature_ids: [F102]
topics: [memory, adapter, evidence-store, architecture, consultation]
doc_kind: research
created: 2026-03-11
model: gpt-pro
---

# F102 记忆组件技术决策评审 — GPT Pro 咨询

## Part 1: 发给云端模型的提示词

> 直接复制发送

---

你好，我们是 Cat Café 团队——一个多 AI Agent 协作系统（3 只 AI 猫猫 + 1 位人类铲屎官）。我们正在重构记忆组件，从一个不好用的外部记忆服务（Hindsight）迁移到自建的本地方案。

### 背景

**项目现状**：
- Cat Café 是多 AI agent 协作开发平台，猫猫们（Claude/GPT/Gemini）协作写代码、做设计
- 当前文档规模：~150 篇（feat docs + decisions + plans），预计会增长到 1000+
- 猫猫未来会"出征"其他项目（如 Data Framework），需要跨项目记忆支持
- 技术栈：Node.js + TypeScript + Redis + Fastify

**原系统问题（Hindsight）**：
- 外部 HTTP 服务，localhost:18888，经常连不上
- retain（写入记忆）碎片化严重——猫猫随意写入自然语言，质量极低
- recall（检索）向量匹配效果差，"谁给我取名" → 返回各种包含"名字"的无关内容
- 整体评价：铲屎官觉得"实在难用"，已停用

### 我们的核心结论（三猫 + 铲屎官讨论后）

| # | 决策 | 理由 |
|---|------|------|
| KD-1 | 本地优先，不上外部服务/图数据库 | ~150 docs 不需要，1000+ 也能用 SQLite 撑住 |
| KD-2 | `reflect`（LLM 反思）从存储层拆出 | 反思是 LLM 编排能力，不是存储 primitive |
| KD-3 | retain 降级为 candidate/marker queue | 猫猫不能直写长期记忆，必须先进候选箱审核 |
| KD-4 | 自动索引 > 手动 retain | 与开发流程（feat lifecycle）集成，90% 记忆自动沉淀 |
| KD-5 | SQLite FTS5 为终态基座 | 不搞 JSONL 中间态——每步产物必须是终态基座 |
| KD-6 | 全局记忆跟猫走，项目记忆留在项目 | 全局=Skills/规则/猫猫记忆；项目=evidence.sqlite |
| KD-7 | 每项目一个 evidence.sqlite（物理隔离） | 猫出征新项目不带旧项目细节 |
| KD-8 | evidence.sqlite = gitignore + rebuild | 真相源是 .md 文件，SQLite 是编译产物 |
| KD-9 | markers 分层审批 | 项目内知识自动 accept；影响全局层 → 人工 review |
| KD-10 | Schema 拆分：evidence_docs + evidence_fts | 结构化元数据用常规表，FTS5 只管全文搜索 |
| KD-11 | 联邦检索 KnowledgeResolver | service 层合并全局真相源（只读）+ 项目 SQLite |

**终态架构**：

```
全局层（跟猫走）
  Skills + 共享规则 + MEMORY.md（已有基础设施，不改）
  └── 猫猫身份/偏好/跨项目方法论/教训

项目层（留在项目里）
  evidence.sqlite（每项目一个，物理隔离）
  ├── evidence_docs（常规表）— 结构化元数据
  ├── evidence_fts（FTS5 外部内容表）— 全文搜索 title+summary
  ├── edges — 文档间关系（evolved_from/blocked_by/related）
  └── markers — 候选记忆队列（pending→proposed→accepted/rejected/needs_review）
```

**四个接口**：
```
IEvidenceStore     — search/upsert/delete/get/health/initialize
IMarkerQueue       — submit/list/transition
IReflectionService — reflect（独立于存储层）
IKnowledgeResolver — resolve（联邦检索：全局层只读 + 项目层）
```

`SqliteProjectMemory` 同时实现 `IEvidenceStore` + `IMarkerQueue`（同一个 DB）。

**关键规则**：
- SQLite 是编译产物，不是真相源（gitignore + 启动时 rebuild）
- `accepted` marker 必须先 materialize 到 .md 文件，才算真正沉淀
- 全局记忆不写进项目库（联邦检索只读接入）

### 请求

**请帮我们做以下评审**：

1. **架构盲区**：我们的终态架构有没有明显的盲区或遗漏？特别是在 1000+ docs、多项目出征的场景下。

2. **SQLite 作为终态基座的风险**：FTS5 在 1000+ docs 场景下的性能特征？并发读写的限制？有没有我们低估的坑？

3. **Marker → Materialization 流程**：`pending → proposed → accepted → materialize to .md` 这个流程是否过度设计？还是说这种审核机制是必要的？业界有没有类似的 pattern？

4. **联邦检索（KnowledgeResolver）**：合并"文件系统全局真相源"和"SQLite 项目索引"的检索，有没有更成熟的 pattern 可以参考？

5. **接口设计**：四个接口（IEvidenceStore + IMarkerQueue + IReflectionService + IKnowledgeResolver）是否合理？有没有过度拆分或遗漏？

6. **我们可能没想到的**：基于你对 2026 年 agent memory 系统的了解，有没有我们完全没考虑到的重要维度？

**额外请求**：
- 如果你觉得我们某个决策有问题，请直说，不要委婉
- 如果有更好的方案，请给出具体替代方案和理由
- 如果某个决策你认为是对的，也请说明为什么对（帮我们确认信心）

---

## Part 2: 云端模型回答（待回填）

> 铲屎官粘贴回答到这里

[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫综合后撰写

[待撰写]
