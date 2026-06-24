---
doc_kind: research-note
topics: [openviking, l0-l1-index, retrieval-precision, blind-test, F243]
created: 2026-06-24
status: active
designed_by: ["@opus-48", "@codex"]
executor: "@gemini35"
evaluator: "@codex"
advisor: "@opus-48"
---

# OpenViking L0/L1 索引精度盲测

> **纠偏**：这不是"提示词谁写得好"的文采评测。OpenViking 把 L0/L1 摘要放在检索关键路径上，
> 先靠摘要定位资源/目录，再 drill down 到 L2。记忆系统抽 L0/L1 的唯一 KPI 是**索引精度**：
> query 来时，正确文档能否精准命中、相邻文档会不会糊成一团。
>
> **设计来源**：宪宪 @opus-48 抽出 OpenViking 真实提示词并提出盲测；铲屎官把目标校正为
> "索引精度"；砚砚 @codex 重写 v2 protocol 并负责评测把关。

## 0. First Principle

L0/L1 是索引，不是摘要作品。评测只问五件事：

1. **核心覆盖**：L0/L1 是否抓住文档真正的检索锚点，而不是只复述标题。
2. **区分度**：10 篇放在同一索引池里，能不能分清彼此，不被通用套话抹平。
3. **可检索命中**：用熟悉文档的真实查询意图搜索时，是否会命中正确文档而不是漏召回/误召回。
4. **人类查询面**：人类不会用内部架构词描述需求。L0 至少要回答"这到底是什么产品/能力"，并能匹配自然语言 query，例如"那个一步步教用户点按钮的功能"。
5. **需求故事保真**：如果人类记住的是"为什么要做 / 先后关系 / 谁要接入谁"，L0 不能只抽象成重构结果。例如 F161 应保留"Gemini 已对接 ACP，后来 OpenCode 也要接 ACP"这个演进故事。

F243 旧三病（H1 复述、status 丢失、隐喻置换）在本实验里只作为**索引失败模式**解释：
复述标题会漏内部实质；丢 status 会少过滤维度；把 `spotlight/HUD/场景式` 换成通用"看板"会让真实概念 query 命不中。

## 1. Hypotheses

- **H0（可行）**：OpenViking 抽取方法 + 强模型能产出 index-ready L0/L1，在硬骨头文档上明显优于 F243 prompt v3 旧结果。
- **H1（不可行或不足）**：即使用 OpenViking 方法 + 强模型，复杂 feature doc 的 L0/L1 仍然会标题化、模板化或丢关键区分维度，说明摘要上检索关键路径的风险是真实的。

判定重点不是"谁的 prompt 好"，而是 OpenViking 这类 summary-as-index 架构在困难、熟悉文档上能不能给检索足够稳定的索引面。

## 2. Inputs

### 2.1 OpenViking 真实抽取提示词

Read 原文：

`/Users/lysander/projects/ref/OpenViking/openviking/prompts/templates/parsing/context_generation.yaml`

执行时使用 `context_type = resource` 分支：

- `semantic_title`: 10-30 characters，保留重要关键词/概念名。
- `abstract`: L0，推荐 <200 tokens，一句话概括主旨，保留核心概念。
- `overview`: L1，推荐 <2000 tokens，按 5W 和内容结构展开。
- `llm_config.temperature: 0.0`。
- 输出 JSON：`{"semantic_title":"...","abstract":"...","overview":"..."}`。

### 2.2 测试文档（F243 同 10 篇，读原文）

**硬骨头（6）**：

| ID | Source path | Stress type |
|----|-------------|-------------|
| F008 | `docs/features/F008-token-budget-observability.md` | 抽象标题 / token budget + observability |
| F038 | `docs/features/F038-skills-discovery.md` | note / parked / skills 按需发现 |
| F155 | `docs/features/F155-scene-guidance-engine.md` | scene guidance / spotlight / HUD / multi-phase |
| F161 | `docs/features/F161-acp-carrier-generalization.md` | ACP / carrier / env mapping |
| F170 | `docs/features/F170-web-chinese-chess.md` | archived interview demo / lifecycle |
| F189 | `docs/features/F189-operation-context-unification.md` | OperationContext / trust boundary / unification |

**Easy（4）**：

| ID | Source path | Stress type |
|----|-------------|-------------|
| F009 | `docs/features/F009-tool-use-tool-result.md` | tool_use/tool_result |
| F012 | `docs/features/F012-feature-discoverability.md` | feature discoverability |
| F013 | `docs/features/F013-audit-log-v2.md` | audit log |
| F119 | `docs/features/F119-who-is-spy-game.md` | game spec / domain clear |

**版本漂移 caveat**：这些 docs 可能已比 F243 原 sample 更新；结论用于趋势和架构风险判断，不做逐行复刻。

## 3. Executor Contract（@gemini35）

1. Read OV prompt 原文和 10 篇 feature doc 原文。
2. 对每篇严格按 OV prompt 产出 L0/L1；不要自行改 rubric、不要加 Cat Cafe 的 F243 prompt 规则。
3. 产出写到本目录 `gemini35-output.md`。
4. 明确写一行 blind statement：`未读 F243 aggregate/samples/evaluations/verdict；未读本实验评测答案。`

### 3.1 禁读清单（看了实验作废）

- `docs/research/2026-06-17-f243-description-spike/aggregate.md`
- `docs/research/2026-06-17-f243-description-spike/samples/`
- `docs/research/2026-06-17-f243-description-spike/evaluations/`
- `docs/research/2026-06-17-f243-description-spike/verdict.md`
- 任何包含 F243 旧输出/旧评分的聊天摘要或评测文件

### 3.2 Output Format

````markdown
---
doc_kind: research-note
topics: [openviking, l0-l1-index, gemini35-output]
created: 2026-06-24
executor: "@gemini35"
---

# OpenViking L0/L1 Index Precision Blind Output

Blind statement: ...

## F008

Source: `docs/features/F008-token-budget-observability.md`

```json
{"semantic_title":"...","abstract":"...","overview":"..."}
```

... repeat for all 10 docs ...

[烁烁/Gemini 3.5 Flash🐾]
````

## 4. Evaluation Contract（@codex）

评测必须在 `gemini35-output.md` 固化后进行。评测时可以读取 F243 aggregate/samples/evaluations/verdict，
但只能作为**对照基线**，不能反馈给执行猫修改输出。

### 4.1 Per-doc 评分

每篇按 0/1/2 打分：

| Dimension | 2 | 1 | 0 |
|-----------|---|---|---|
| 核心覆盖 | L0/L1 含 user problem + lifecycle/status + 关键机制/概念 | 抓到主题但少一个关键检索维度 | 标题化/泛化，内部实质搜不到 |
| 区分度 | 与其余 9 篇有清晰唯一 terms/metaphor/status | 有少量通用套话但仍可区分 | 多篇撞脸，如都只是"规范/看板/系统" |
| 可检索命中 | 针对 2-3 个真实 query probe 会命中本文且不误导到相邻文档 | 部分 query 可命中，部分漏 | 关键 query 命不中或会错指 |
| 人类查询面 | L0 用人话说明产品/能力，能匹配非专家 query | L1 里有可匹配人话，但 L0 本身偏术语/架构 | L0/L1 都主要是内部术语，人类 query 难命中 |

`index-ready = 四项都 >=1 且总分 >=7`。低于阈值记为 `needs-fix`。
`human-facing L0` 单独判：人类查询面若只靠 L1 才过，则 L0 不得作为用户可见摘要或 `docs/features/index.md` 的 description。
`demand/story gate` 单独判：如果原文的主要检索锚点是需求演进、接入对象或先后关系，L0 丢掉这个故事则不得判为 human-facing pass，即使机制词还在。

### 4.2 Query Probe 规则

评测猫从原文中提取 query probes，不让生成猫自拟查询，避免自证：

- **concept probe**：文档最独特的概念词，例如 `spotlight HUD 场景式引导`。
- **mechanism probe**：核心实现/约束，例如 `模板环境变量映射 ACP carrier`。
- **status probe**：done/spec/parked/archived/lifecycle 语义，例如 `archived interview demo 网页象棋`。
- **human probe**：不懂内部名词的人会怎么问，例如 `哪个功能能一步步教用户操作并高亮按钮`。
- **story/demand probe**：人类记住的需求背景或先后关系，例如 `Gemini 先接 ACP 后来 OpenCode 也要接 ACP`。

每篇至少 2 个 probe；硬骨头每篇 3 个 probe，且必须包含 1 个 human probe。若原文有明显需求演进或接入故事，必须额外包含 1 个 story/demand probe。

### 4.3 Aggregate 判定

- **Strong pass**：总样本 `index-ready >= 8/10` 且硬骨头 `index-ready >= 4/6`。
- **Partial**：总样本 `index-ready >= 6/10` 但硬骨头 `<4/6`，说明 easy 可用、困难文档仍需 gate。
- **Fail**：总样本 `<6/10` 或硬骨头 `<=2/6`。

对照 F243 旧结果时只看索引失败是否改善：

- F243 硬骨头多数表决 `5/6 needs-fix`（83% fail）。
- 三大旧病映射到索引风险：H1 复述、status 丢失、隐喻置换。
- 若 OV 输出改善这些病但仍不 index-ready，记录为"摘要质量进步但检索面仍不足"。

### 4.4 Evaluation Output

评测写入本目录：

`index-precision-evaluation.md`

必须包含：

- per-doc score table；
- query probe matrix；
- 与 F243 旧结果的 aggregate 对照；
- 对 Cat Cafe 的结论：可学习 / 需 gate / 不应学。

## 5. Thread Plan

- 主 thread：砚砚 @codex 负责 protocol v2、thread 编排、最终评测。
- 子 thread：烁烁 @gemini35 只做盲抽输出，`reportingMode=final-only`。
- 宪宪 @opus-48：上下文顾问，不主刀精细操作；必要时只回答 OpenViking 拆解上下文问题。

## 6. Non-goals

- 不评 OpenViking benchmark 数字。
- 不评文采；但评人话 query 能否命中，因为这是索引精度的一部分。
- 不证明 OpenViking 小模型声明；本轮给 OV 方法一个强模型 best-case。若 best-case 成立，再补小模型组。
- 不把 OpenViking 源码引入 Cat Cafe；AGPL 边界不变。

[砚砚/gpt-5.5🐾]
