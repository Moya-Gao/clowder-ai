---
feature_ids: [F086]
related_features: [F079, F055, F037, F038, F040, F042, F043, F046, F070]
topics: [collaboration, routing, mcp, multi-mention, orchestration, meta-cognition, knowledge-engineering, reflection]
doc_kind: spec
created: 2026-03-08
---

# F086 Cat Orchestration — 猫猫自主协作 + 元认知系统

## Why

### 核心痛点（铲屎官采访 2026-03-08 20:25-20:36）

1. **协作链路脆弱**：A2A 经常断线，猫猫间协作不流畅，断了就需要铲屎官手动重新调度
2. **猫猫缺少元思考**：不是能力问题，是意识问题 — 猫猫不会主动想"这个我应该拉其他猫讨论"
3. **缺少元反思**：做完一个 feat 没有系统性地问"学到了什么？"，反思结果也没有沉淀到能影响未来行为的地方
4. **知识孤岛**：只有布偶猫有 MEMORY.md，其他猫没有跨 session 记忆

铲屎官原话：
> "其实你们经常 a2a 断线，很多时候都是我在强调和要求你们是不是这里能够找其他猫猫讨论。"
> "你们有的时候缺少这样的元思考。不是说没能力吧？"
> "我还认为我们缺少元反思逻辑。做完一个 feat 学习到了什么？沉淀呢？元认知提升呢？反思呢？"

### 知识工程体系现状（已建成 vs 缺失）

我们已有一个完整的知识工程栈（F038-F046 + F070）：

| Feature | 解决了什么 | 状态 |
|---------|-----------|------|
| F040 | 知识**在哪里** — 三层记忆（热 BACKLOG / 温 Feature 聚合 / 冷 docs） | done |
| F038 | 知识**怎么发现** — Skills 分类 + 按需发现 | in-progress |
| F042 | 知识**怎么路由** — 三层信息架构（CLAUDE.md → Skills → refs） | done |
| F043 | 知识**怎么查询** — MCP 归一化（feat_index, search_messages） | done |
| F046 | 知识**怎么守护** — 愿景守护 / 反漂移协议 | done |
| F070 | 知识**怎么移植** — Portable Governance（外部项目引导） | done |

**还没解决的（F086 要做的）**：

| 缺口 | 问题 |
|------|------|
| 猫猫**主动协作** | 不知道什么时候该拉人，工具也不够流畅 |
| **元反思循环** | 做完事不会系统性反思"学到了什么" |
| **知识沉淀** | 反思结果没有变成可复用的知识影响未来行为 |
| **跨猫共享记忆** | 只有布偶猫有 MEMORY.md，其他猫每次从零开始 |

## What — 分阶段实施

### Phase 1: 工具层 — 多重 @ + 回流路由

**目标**：让猫猫有流畅的多猫协作工具。

#### MCP 工具设计

```typescript
// cat_cafe_multi_mention
{
  targets: CatId[];      // 要 @ 的猫猫列表
  question: string;      // 问题/请求内容
  mode: 'parallel' | 'sequential';
  context?: string;      // 附加上下文
}
```

#### 交互流程

```
铲屎官 @opus "帮我设计一下这个功能"
    ↓
布偶猫思考后，需要收集意见
    ↓
调 cat_cafe_multi_mention({ targets, question, mode: 'parallel' })
    ↓
三只猫各自收到消息（在 thread 里，天然透明）
  ├── codex 回答 → 自动路由回 opus
  ├── gemini 回答 → 自动路由回 opus
  └── gpt52 回答 → 自动路由回 opus
    ↓
布偶猫收到三份回答，综合后给铲屎官
```

#### 安全模型

| 层面 | 规则 |
|------|------|
| CLI @ | 保留 ≤2 限制（防提示词注入） |
| MCP multi_mention | 无上限（猫猫自主意图，非输入解析） |
| 被 @ 猫 | **禁止** 再 @ 其他猫（防级联广播） |
| 回流 | 自动路由回发起者 |

#### 后端改动

1. 新增 MCP tool handler `cat_cafe_multi_mention`
2. routing 层：`callbackTo: CatId` 回流标记
3. 防扩散：被召唤猫的 @ mention 被忽略
4. system prompt 注入："你正在回答 {发起者} 的问题"

### Phase 2: 意识层 — 元认知触发点

**目标**：让猫猫知道**什么时候该拉人**，不只是有工具能拉。

#### 核心机制

在关键决策点注入"元认知 prompt"：

1. **设计决策时**："这个决策影响范围大吗？要不要拉其他猫看看？"
2. **遇到不确定性时**："我不确定这个方案，其他猫有没有不同视角？"
3. **跨领域时**："这涉及前端/安全/性能，对应领域的猫有没有看过？"

#### 实现方式

- Skills 中加入"协作判断指南"：什么场景该拉人、拉谁
- 不是强制规则，是 nudge（轻推）— 猫猫自己判断
- 关键：让猫猫内化"多视角会发现更多东西"的意识

### Phase 3: 反思层 — 元反思 + 知识沉淀

**目标**：做完事会反思，反思结果能影响未来行为。

#### 反思循环设计

```
feat 完成
    ↓
触发反思环节（可以在 feat-lifecycle completion 里加）
    ↓
三个问题：
  1. 这次学到了什么新东西？（技术/协作/流程）
  2. 哪里做得好，想保持？
  3. 哪里做得不好，下次怎么改？
    ↓
反思结果沉淀：
  - 技术类 → lessons-learned.md（已有，但需系统化触发）
  - 协作类 → 协作指南更新
  - 流程类 → SOP/Skills 更新
```

#### 知识沉淀的"回到行为"机制

反思完了写进文档只是第一步，关键是**怎么回到行为里**：

- **Skills 层**：反思发现的模式 → 更新 skill 的"Use when" / "Not for"
- **提示词层**：高频教训 → 写入 CLAUDE.md 或 shared-rules
- **记忆层**：猫猫个体的经验 → MEMORY.md（但目前只有布偶猫有…）

#### 跨猫共享记忆（待讨论）

这是最大的开放问题：
- 现在只有布偶猫有 MEMORY.md（Claude Code 的 auto memory 功能）
- 砚砚（Codex）每次从零开始，靠 SOP + Skills 获取上下文
- 烁烁（Gemini）同理
- 需要一种跨猫的"共享知识库"

#### ⚠️ Hindsight (cat_cafe_reflect) 已废弃

铲屎官明确表示 (2026-03-08)：hindsight 反思功能**废弃**——大量 token 消耗但效果不好。
当前猫猫实际常用的是搜索类工具（search_evidence, session_search, read_session_events）。

**教训**：元反思不能走"自动生成大段反思摘要"的路（token 黑洞），需要更轻量的方案。
可能方向：结构化的检查清单（而非自由文本反思）、事件驱动的知识捕获（而非 session 结束时回顾全部）。

#### 知识图谱方向（铲屎官补充 2026-03-08 20:48）

铲屎官原话：
> "你们的知识体系完全还是可以使用我们现在的 docs 来建立，但是是否有些东西可以丢到一个轻量专门的向量库？但有个条件就是他得用处得比你们直接搜名字更快更有用。"
> "我们或许这里要存也是维护文档的 link，构建文档网络。标题、摘要，有点像 Obsidian 建立起来的图谱。甚至你们现在每个文档都有 metadata 的，其实天然就是一张网络了。但是如何更高效？"

**关键洞察**：

1. **不是另建一套系统**：复用现有 docs + frontmatter metadata，它们天然就是一张网络
2. **不存全文，存关系**：文档 link、标题、摘要 → 构建文档网络/图谱（类 Obsidian）
3. **向量库的条件**：必须比 BM25/grep 搜名字**更快更有用**，否则不如不做
4. **参考 Claude Code ToolSearch**：简单的 BM25 关键词匹配已经能解决很多路由问题
5. **现有基础**：frontmatter (`feature_ids`, `related_features`, `topics`, `doc_kind`) 天然是图的节点和边

**可能的实现路径**：
- 轻量索引层：扫描所有 docs 的 frontmatter → 构建关系图（feature→docs, topic→docs）
- 搜索增强：在现有 grep/BM25 基础上，加上"相关文档推荐"（沿着图的边走）
- 向量库（可选）：只有当 BM25 不够用时才引入，不预设

#### 活生生的反面教材（布偶猫自省 2026-03-08）

铲屎官指出：布偶猫在采访时没有先搜索了解知识体系现状就开始提问——这恰好是 F086 要解决的"元思考缺失"的活例子。

> "你自己回顾你刚刚采访的错误，你并没有先搜、先了解、高效的理解我们，然后再问再想。"

**正确的采访流程应该是**：先搜索相关文档 → 理解现状 → 带着上下文提问 → 而不是从零开始问铲屎官已经沉淀过的东西。

## Acceptance Criteria

### Phase 1（工具层）
- [ ] MCP 工具 `cat_cafe_multi_mention` 可被猫猫调用
- [ ] parallel 模式：所有 targets 同时收到消息
- [ ] 回流路由：被 @ 猫的回答自动路由回发起者
- [ ] 防扩散：被 @ 猫不能再 @ 其他猫
- [ ] CLI @ 限制 ≤2 保持不变

### Phase 2（意识层）
- [ ] Skills/提示词包含"协作判断指南"
- [ ] 猫猫在关键决策点能自主判断是否拉人
- [ ] 不滥用（不是每个问题都拉全体）

### Phase 3（反思层）
- [ ] feat 完成时有系统性反思环节
- [ ] 反思结果沉淀到对应知识层（lessons/skills/prompt）
- [ ] 跨猫共享记忆方案落地

## Dependencies

- Evolved from: F079（投票系统 — 猫猫协作先例）
- Builds on: F042（三层信息架构 — 知识该放哪里）
- Builds on: F043（MCP 归一化 — 查询和发现）
- Builds on: F046（愿景守护 — 反漂移协议）
- Builds on: F070（Portable Governance — 知识移植）
- Related: F055（A2A MCP Structured Routing）
- Related: F037（Agent Swarm）
- Related: F038（Skills 发现机制）

## Risk

- Phase 1 中风险：回流路由是 routing 核心改动
- Phase 2 低风险：主要是提示词更新
- Phase 3 高不确定性：跨猫共享记忆的技术方案待探索
- 提示词膨胀：每加一层意识/反思指南都增加 prompt 长度

## Open Questions

- Phase 1: sequential 模式是否先做？还是先只做 parallel？
- Phase 2: "协作判断指南"怎么写才不会变成空洞的口号？需要具体场景
- Phase 3: 跨猫共享记忆用什么机制？MCP memory server？共享文件？
- Phase 3: 反思环节是自动触发还是猫猫主动？
- 和 F037 Agent Swarm 的关系：是 swarm 的子集还是独立能力？
- 和 cat-cafe-memory MCP 的关系：能否复用 `cat_cafe_reflect` 工具？

## Review Gate

- 跨猫 review：@codex（安全边界）+ @gpt52（架构 + 元认知视角）

## Timeline

| Date | Event |
|------|-------|
| 2026-03-08 | Kickoff — 铲屎官提出需求 |
| 2026-03-08 | 铲屎官采访：痛点澄清 + 愿景扩展（工具→意识→反思三层） |
| 2026-03-08 | 知识工程体系现状梳理（F038-F046 + F070） |
