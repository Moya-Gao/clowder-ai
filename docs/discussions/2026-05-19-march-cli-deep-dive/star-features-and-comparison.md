# March-CLI Star Features + Algorithm Peel + Comparison

## 3. Star Feature Deep Dives

### 3.1 Markdown Memory + Tag Recall

**Claim**: "记忆的结构有 name、description 和 tags，匹配源就是模型调用过程中的
碎碎念（Thinking）和用户的话，关键字匹配就很够用了，memory_hint 每次最多 3 条
记忆，且在轮内去重。有点像一个动态的技能发现系统。"

**完整链路（代码路径）**:

```
用户输入 "修一下 Redis 连接池的问题"
  ↓
repl-loop.mjs:144
  memoryStore.recallForUser(prompt, {limit: 3})
  ↓
markdown-store.mjs:125-131  recallForUser()
  → turnSeenMemoryIds 去重
  → #recall(text, {limit: 3, excluded, currentProject})
  ↓
markdown-store.mjs:214  #extractKnownTagTerms(text)
  → normalizeText(text): "修一下 redis 连接池的问题"
  → 遍历 tagDictionary，如果 tag 是 normalized text 的子串，收集
  → 假设 tagDictionary 有 "redis", "connection", "pooling"
  → 命中: "redis" ← text.includes("redis") ✅
  → 按长度降序排，取前 16 个
  ↓
markdown-store.mjs:216-217  FTS5 查询
  queryMarkdownMemoryIndex(db, '"redis"')  ← FTS5 全文检索
  ↓
markdown-store.mjs:224-233  scoreEntry()
  → tags 精确命中: +10
  → tags 展开后命中（e.g. "redis-pitfalls" → "redis" + "pitfalls"）: +5
  → currentProject tag 命中: +2
  → 按 score 降序排，取 limit 条
  ↓
格式化为 [memory_hint source="user"]
- mem_abc123 | Redis 踩坑 | ioredis keyPrefix 行为差异
注入到上下文
```

**Mid-turn recall（助手侧，thinking 文本触发）**:

```
agent 开始执行 tool...
  ↓
turn-runner.mjs:40-46  tool_execution_start 事件
  → flushAssistantRecall()
  ↓
turn-runner.mjs:148-157
  → assistantRecallDeltaText(turnState)
  → 取 turnState.draft（输出 delta）+ thinkingText（思考 delta）
  → 传给 memoryStore.recallForAssistant(text, {limit: 2})
  ↓
同上链路，但 limit=2
  ↓
注入方式: session.sendCustomMessage({deliverAs: "steer"})
  → Pi SDK 的 mid-turn steering 机制
```

**代码证据总结**:

| 组件 | 文件 | 行号 | 作用 |
|------|------|------|------|
| Memory Store | `markdown-store.mjs` | 25-286 | 文件扫描、FTS5 索引、recall、save |
| Tag 匹配 | `markdown-store.mjs` | 236-244 | `#extractKnownTagTerms()` — tag 字典子串匹配 |
| 评分 | `markdown-recall.mjs` | 12-24 | `scoreEntry()` — 精确 +10 / 展开 +5 / project +2 |
| Hint 格式 | `markdown-recall.mjs` | 3-9 | `[memory_hint source="user/assistant"]` |
| 轮内去重 | `markdown-store.mjs` | 38, 113-119 | `turnSeenMemoryIds` Set |
| Mid-turn 注入 | `turn-runner.mjs` | 40-46, 92-104 | tool_execution_start 时 flush + steer inject |
| 持久化 | `markdown-format.mjs` | 5-23 | Markdown frontmatter 解析/格式化 |
| FTS5 索引 | `sqlite-index.mjs` | — | SQLite FTS5 倒排索引 |
| Tag 展开 | `markdown-format.mjs` | 35-43 | `expandTags()` — 按 `/`, `_`, `-` 拆分 |

**Verdict**: ✅ 完整闭环。设计简洁有效。

**关键约束（Caveat）**:

1. **匹配 = tag 字典子串交集，不是语义理解**。`#extractKnownTagTerms()` 做的是：
   把用户/thinking 文本 normalize，然后遍历 tagDictionary 看哪个 tag 是文本的
   子串。这意味着：
   - 如果你的 tag 是 "redis"，用户说了 "redis"，命中 ✅
   - 如果你的 tag 是 "connection-pooling"，用户说了 "连接池"，不命中 ❌
   - 如果你的 tag 是 "audhd"，thinking 里写了 "注意力缺陷"，不命中 ❌

2. **Tag 词汇表是封闭集**。只有已存在的 memory 的 tags 构成词汇表。新概念、
   同义词、跨语言都是盲区。

3. **Thinking 文本的真实价值被匹配机制稀释了**。thinking 确实暴露了更丰富的
   意图信号——但 tag 子串匹配只能从这个丰富信号里捕获已知 tag 字面出现的部分。
   就像用一个 10 词的字典去"理解"一篇 500 词的思考过程。

---

### 3.2 Context Rebuild Engine

**Claim**: "中间工具执行的输出修剪掉，只保留简单的历史。下次发消息的时候重建
上下文。只会掉中间这段执行过程的 cache。"

**完整链路**:

```
Turn N 结束
  ↓
turn-runner.mjs:130-146  finalizeTurn()
  → compactAssistantContext(turnState)
    → 把 assistantContextParts（thinking + output + tool start/summary）
      拼接，清理多余空白
    → 注意：tool 的原始输出已经在 turn-events.mjs:105-110 被替换成
      一行 summary（"tool_name (summary)"），不保留原始输出
  → engine.recordTurn({
      userMessage,           // 用户原文
      assistantMessage,      // agent 最终输出
      assistantContext,       // compacted 版本（含 thinking 骨架 + tool summary）
      userRecallHints,        // 用户侧 memory hints
      assistantRecallHints,   // 助手侧 memory hints
    })
  ↓
engine.mjs:72-84  recordTurn()
  → this.turns.push({...})
  → if (turns.length > maxTurns=15)
      keep = max(1, 15 - trimBatch=5) = 10
      this.turns = this.turns.slice(-10)
  → 最多保留 10 轮历史
```

```
Turn N+1 开始
  ↓
turn-runner.mjs:60  resetPiMessageHistory(session)
  → session.agent.state.messages = []  ← 清空 Pi 的原始消息
  ↓
engine.mjs:38-50  buildProviderContext(userMessage)
  → 6 层 context 从头组装：
    1. system_core         ← 稳定，prefix-cache 友好
    2. injections          ← MCP server instructions，较稳定
    3. session_identity    ← workspace 元数据，稳定
    4. project_context     ← README/.gitignore，较稳定
    5. profiles            ← ~/.march/profiles/，稳定
    6. recent_chat         ← turn history（compacted）+ 当前用户消息
  → 前 5 层几乎不变 = provider 侧 prefix cache 命中概率高
  → 第 6 层是变化的部分，但只含 compact 后的历史
  ↓
Pi SDK 拿到完整 context 发给 LLM
  → 原始 tool 输出不在 context 里
  → cache miss 只发生在 recent_chat 层的变化部分
```

**Verdict**: ✅ 设计意图实锤。

**工程判断**:

| 维度 | march-cli (rebuild) | Claude Code (compaction) | Cat Café (compression) |
|------|---------------------|--------------------------|------------------------|
| 策略 | 每轮清空 Pi 消息、从 turn history 重建 | 自动压缩摘要 | harness 级上下文压缩 |
| 成本 | 长对话中每轮只付 compact history token | 压缩后全量重传 | 压缩后全量重传 |
| 信息保留 | tool summary 骨架、thinking 骨架 | 压缩摘要（可能丢细节）| 压缩摘要（可能丢细节）|
| 前缀 cache | 前 5 层稳定，命中率高 | system prompt 稳定 | system prompt 稳定 |
| 风险 | compact 可能丢关键 tool 输出 | 压缩可能丢规则 | 压缩可能丢规则 |

---

### 3.3 Auto-Experience Extraction

**Claim**: "经验落盘我的记忆系统承接了，它会自动总结经验的。"

**代码证据**:

经验自动落盘 **不是代码级机制**，是 **system prompt 指令**：

```markdown
# base.md:64
- If execution takes a meaningful detour, create or update a memory after
  the task. A detour means the initial plan or assumption failed, multiple
  approaches were tried, and the final successful path contains reusable
  project knowledge. Record the failed assumption, what was tried, and
  the successful approach. Prefer updating an existing related memory
  over creating a new one.
```

+ `memory_save` tool 可用，agent 可以在 turn 中主动调用保存经验。

**Verdict**: ⚠️ 半真。

- 是 prompt 指令，不是 hook / event-driven 自动触发
- 模型可能忘记执行（尤其 detour 不明显时）
- 没有 eval / cron / 后处理流程强制检查
- 但 "让他看 git history 能总结" 是真的——`command_exec` 可以跑 `git log`

**对比**：我们家的 knowledge feed（W7）+ self-evolution 五级阶梯是**结构化流程**：
被铲屎官纠正 → 记录 evidence → 蒸馏 → eval → skill 更新。不依赖模型"想起来"。

---

### 3.4 Group Chat Orchestrator

**Claim**: 多 agent 群聊编排。

略述（非本轮重点）：SQLite 13 表 + SSE event bus + Pi adapter 执行。
每个 agent 有独立 git worktree 分支。`Promise.all` 并发激活组内所有 agent。
Subscription connectors（GitHub/GitLab/Sentry）轮询外部事件注入群聊。
Framework proposals 让 agent 可以提议修改组规则（需用户审批）。

---

## 4. Algorithm Peel Table

| 机制 | 宣称 | 实际类型 | Input | Output | 代码路径 | 改变未来行为？ |
|------|------|----------|-------|--------|----------|----------------|
| Memory recall | "动态技能发现" | **Tag 子串匹配 + FTS5** | thinking/user text | top-N hints | `markdown-store.mjs:212-234` | 否（无反馈闭环） |
| Tag scoring | "关键字匹配够用" | **规则评分** | entry tags × query terms | 数值 score | `markdown-recall.mjs:12-24` | 否 |
| Context rebuild | "只丢中间 cache" | **Compact + 清空重建** | turn history + layers | 完整 context | `engine.mjs:38-50` | 否 |
| Tool output compact | "修剪执行输出" | **骨架保留 + 空白清理** | tool events | summary text | `turn-events.mjs:75-82` | 否 |
| Turn trimming | 隐式 | **滑动窗口** | turns array | 最近 10 轮 | `engine.mjs:81-84` | 否 |
| Experience save | "自动总结经验" | **Prompt 指令 + tool 调用** | agent 自行判断 | markdown file | `base.md:64` + `markdown-tools.mjs` | 是（下次 recall 可命中）|
| Command sandbox | 隐式 | **黑名单规则** | command name + args | allow/deny | `pi-adapter/index.mjs:196-222` | 否 |
| Subscription polling | "外部事件" | **ETags + dedup key** | HTTP poll | normalized event | `subscription-connectors.mjs` | 否 |

**结论**：march-cli 没有"算法"成分。所有机制都是**规则 / 启发式 / 工程约定**。
这不是批评——对一个 coding agent CLI 来说，规则 + 好的工程设计 > 花哨的算法。

---

## 5. Feedback Loops

| 宣称的闭环 | Signal | Decision | State Mutation | Future Behavior | Verdict |
|------------|--------|----------|----------------|-----------------|---------|
| Memory auto-save | agent 感知到 detour | agent 判断是否值得保存 | 写 markdown file | 下次 recall 可命中 | ⚠️ **断一环**：decision 靠 prompt 指令，agent 可能不执行 |
| Memory recall | user/thinking text 含已知 tag | tag 子串匹配 + score | 无 state mutation | hints 注入当前上下文 | ✅ 但**不改变未来排序**——没有消费反馈 |
| Framework proposals | agent 发现组规则需更新 | agent 提议 | 写 proposals 表 | 用户审批后改 framework_doc | ✅ 有审批门控 |
| Turn history trim | turns > 15 | 自动裁剪 | slice(-10) | 旧 turn 被遗忘 | ✅ 机制完整但单向 |

**关键缺失**：march-cli 的记忆系统**没有反馈闭环**。搜到了→没用→排名不变。
搜到了→用了→排名不变。下次还是同样的排序。

---

## 6. Cat Café Comparison

### 6.1 Thinking Recall vs. 我们的记忆系统——正式对比

**march-cli 的做法**:
- 被动触发：agent thinking 文本自动扫已知 tag 字典
- 零决策成本：agent 不需要主动搜索
- 匹配机制：tag 子串交集（`text.includes(tag)`）
- 上限：只能命中 tag 字面出现在 thinking 文本中的 memory
- 每轮 user 3 + assistant 2 hints

**Cat Café 的做法**:
- 主动搜索：agent 选择 mode（lexical/semantic/hybrid）、scope（docs/threads）、关键词
- 高决策成本：agent 需要思考"搜什么、怎么搜、从哪个角度搜"
- 匹配机制：BM25 + 向量 + RRF 融合 + 治理元数据
- 上限：理论上无限——可以多轮搜、换角度搜、跨语言搜
- 有消费加权反馈：搜了用了 → 排名上升

**铲屎官的挑战准确吗？**

**准确。** march-cli 的 thinking recall 本质是一个**被动 tag 提醒器**。它的优势
是零成本——agent 不需要主动做任何事。但这个零成本是有代价的：

1. **匹配天花板极低**。tag 子串匹配只能命中字面出现的已知词。agent 的 thinking
   里写了 "这个 WebSocket 重连逻辑可能有 race condition"，如果没有 tag 叫
   "websocket" 或 "race-condition"，什么都不会被召回。

2. **不知道要搜什么的时候，丢过去真的没用**。thinking 文本是 agent 对当前问题
   的内心独白——但 tag 匹配只看"是否包含已知词"，不理解意图。agent 在想
   "这个 bug 的根因可能和上次那个类似"——tag 匹配不知道"上次那个"是什么。

3. **和我们的对比**：布偶猫用 Cat Café 记忆系统时，是**深思熟虑后选关键词 +
   决定搜索模式 + 决定搜索范围**的。这个"深思熟虑"本身就是 agent 智能的一部分
   ——正如我们文章第 4 章说的："聪明的 agent 搜得更好不是因为系统给了更好的
   结果，是因为它问了更好的问题。"

4. **march-cli 的哲学是"系统帮 agent 想起来"**；**Cat Café 的哲学是"agent
   自己决定什么时候需要记忆、搜什么"**。前者是外部工作记忆的被动反射，后者是
   主动的知识导航。

**但 march-cli 这个设计不是没有可取之处**：

它解决了一个我们没有解决的问题——**agent 忘记搜索**。当 agent 深陷 tool
execution 循环时，可能根本不会想到要去搜记忆。march-cli 的 mid-turn recall
在每个 tool_execution_start 时自动 flush，确保 agent 在执行过程中也能收到
memory hints。这是一个"安全网"：不依赖 agent 的自觉性。

我们的系统更强大，但前提是 agent 主动使用它。如果 agent 在忙着跑 tool 链的时候
忘了搜记忆，那我们再强的检索能力也是零。

### 6.2 完整对比表

| 维度 | march-cli | Cat Café | Learn / Gap / Do Not Follow |
|------|-----------|----------|-----------------------------|
| **记忆存储** | Markdown + frontmatter + FTS5 | Markdown 真相源 → SQLite + FTS + 向量编译 | **相同哲学**：markdown 是真相源，索引是编译产物 |
| **检索机制** | Tag 子串匹配（封闭词汇） | BM25 + 向量 + RRF 融合 + 治理元数据 | **Do Not Follow**：tag 匹配太弱，跨语言/同义词全是盲区 |
| **检索入口** | 单入口（tag recall） | 三入口（graph_resolve / list_recent / search_evidence） | **Gap 无**：我们的三入口覆盖三种认知状态 |
| **触发方式** | 被动（thinking 文本自动触发） | 主动（agent 决定搜什么） | **Learn**：mid-turn 被动 recall 可以作为安全网 |
| **反馈闭环** | 无（搜了用了排名不变） | 消费加权 + 14 个行为指标 + revealed preference | **Do Not Follow**：没有反馈的记忆系统是静态书架 |
| **治理** | 无（soft delete，无权威性/生命周期） | 权威性 + 触发方式 + 生命周期 + 过期检测 | **Do Not Follow**：无治理 = 旧记忆和新记忆同权 |
| **跨域** | 无（单项目记忆） | 多域联邦（Collection + dimension） | **Do Not Follow**：我们已经走到了联邦 |
| **经验落盘** | Prompt 指令 + memory_save tool | Knowledge Feed + self-evolution 五级阶梯 | **Do Not Follow**：prompt 指令不可靠 |
| **Context 管理** | 每轮重建（compact + 清空 Pi messages） | Harness 压缩 + 压缩免疫层 | **Learn**：rebuild 策略值得研究，成本控制优 |
| **前缀缓存** | 6 层结构，前 5 层稳定 | L0 native system prompt 压缩免疫 | **相同方向**：都在保护 prefix cache |
| **多 agent** | Group chat server（共享聊天室） | A2A thread @传球 | **Tradeoff**：群聊更松耦合，@传球更有序 |
| **工具系统** | Pi SDK tools + MCP | Claude native tools + MCP | **Do Not Follow**：Pi SDK 是额外间接层 |
| **Provider** | Deepseek 默认，可换 | Claude 原生 + 多 provider 猫 | 不同定位 |
| **测试** | 150+ smoke/acceptance tests | pnpm gate + TDD | **Learn**：smoke test 覆盖面值得参考 |

### 6.3 对标定位总结

```
                    记忆深度
                      ↑
            Cat Café  ●  （多域联邦 + 反馈闭环 + 治理）
                      │
                      │
                      │
          march-cli   ●  （Markdown + tag recall，轻量但完整）
                      │
       Claude Code    ●  （CLAUDE.md + dream memory，平台级）
                      │
                ──────┼──────────────────────→ 工具生态
                      │
         Hermes       ●  （83 built-in skills + RL pipeline）
```

- **march-cli** 在记忆设计上比 Claude Code 更有野心（独立记忆系统 vs 文件记忆），
  但比 Cat Café 轻量得多。它的差异化在于**零成本被动 recall** + **每轮重建控成本**。
- **Hermes** 走的是另一条路——skill 市场 + RL 进化，记忆不是它的重点。
- **Claude Code** 最近加了 dream memory（consolidation + pruning），开始补记忆，
  但核心仍是 CLAUDE.md + file-based memory。

---

## 7. Lessons / Next Steps

### Candidate Lessons

1. **Mid-turn passive recall 是值得研究的安全网机制**：不替代主动搜索，但可以在
   agent 忙于 tool 执行时自动提醒。我们可以考虑在 harness 层加一个轻量级
   "thinking text → memory hint" 钩子。低优先级——因为我们的 agent 已经有
   session hook 每轮提醒搜记忆。

2. **每轮 context rebuild 是成本控制的有效策略**：长对话中，历史 tool 输出一直在
   context 里吃 cache token。march-cli 的 compact + rebuild 把这个成本控制在
   "最近 10 轮的 compact 版本"。值得量化我们的压缩策略 vs rebuild 的成本对比。

3. **Smoke test 覆盖面**：march-cli 有 13 个专项 smoke test（timeout、policy、
   output limit、event bus replay 等）。我们的 `pnpm gate` + TDD 更强，但
   专项 smoke test 值得参考。

### Do Not Follow

1. **Tag-only recall**：封闭词汇 + 子串匹配上限太低。我们的 hybrid 检索是严格
   更优的超集。
2. **无反馈闭环**：记忆是静态书架，用了没用一样排。
3. **Prompt-instructed experience save**：不可靠。
4. **Pi SDK 间接层**：多一层 SDK = 多一层控制权让渡。

### Follow-up (第三轮)

- 社区 signals：star/fork/issue 活跃度、contributor 分布
- Group chat 与 Cat Café A2A 的用户体验对比
- Pi SDK 生态（其他使用者？可替代性？）
