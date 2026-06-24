---
doc_kind: research-note
topics: [openviking, extraction-quality, prompt-confound, blind-test, F243]
created: 2026-06-24
status: active
designed_by: "@opus-48"
executor: "@gemini35"
evaluator: "@opus-48"
---

# OpenViking 抽取提示词 — 强模型盲测（confound 消除）

> **动机**：F243 实测"自动摘要 feat md"硬骨头 83% fail，宪宪上轮归因"任务固有难度"。
> 铲屎官质疑：这可能是**提示词 confound**——F243 用的是咱家提示词，且 F243 自己的
> aggregate 改进方向就写着"prompt v4 sharpen"，等于承认提示词有锅。
> **本实验**：用 OpenViking 的**真实抽取提示词** + 强模型烁烁35（能力吊打 OV 论文宣称的
> qwen-7b/12b 级小模型）跑 F243 同 10 篇，分离"提示词/模型弱" vs "任务固有难度"。
> 设计：宪宪 opus-48 · 执行：@gemini35 · 评测：宪宪（盲，非抽取者）

## 假设（pre-register）
- **H0（铲屎官）**：F243 失败主因是提示词/模型弱。强模型 + 好提示词 → **突破** 83% fail。
- **H1（宪宪上轮）**：自动摘要复杂文档是任务固有难度。强模型 + 好提示词 → **仍在硬骨头翻车**。
- 若 H0 成立 → 我上轮的悲观归因被推翻，自动摘要对咱家是工程可达的；若 H1 成立 → 铲屎官"保持怀疑"地接受难度真实。**两个结果都有用。**

## 输入 1：OpenViking 真实抽取提示词
**来源（务必 Read 原文，勿用聊天里被转码的版本）**：
`/Users/lysander/projects/ref/OpenViking/openviking/prompts/templates/parsing/context_generation.yaml`
- 用 `context_type = resource` 分支（feat md 属 resource/文档）
- 核心要求：`semantic_title`(10-30字) + `abstract`/L0(<200 tokens，一句话说清主旨 + 保留核心概念) + `overview`/L1(<2000 tokens，5W 结构：what is / what covers / when to use / how to use / what for + 内容大纲)
- `temperature: 0.0`，输出 JSON `{"semantic_title","abstract","overview"}`

## 输入 2：测试文档（F243 同 10 篇）
`docs/features/` 下，Read 原文：
- **硬骨头（6）**：F008, F038, F155, F161, F170, F189
- **easy（4）**：F009, F012, F013, F119
- ⚠️ **版本漂移 caveat**：这些 md 可能已被 reviewer 更新，与 F243 原 sample 非完全同版本，结论作**趋势参考**，不做逐篇精确 diff。

## 执行（@gemini35 烁烁）
1. Read OV 提示词 yaml 原文 + 10 篇 feat md 原文。
2. 严格按 OV 提示词，对每篇产出 `{semantic_title, abstract(L0), overview(L1)}`。
3. **盲测纪律（关键）**：禁止读 F243 的 `aggregate.md` / 任何 `*eval*` / verdict 文件——那是答案，看了实验作废。只看 feat md 原文 + OV 提示词。
4. 产出写到本目录 `gemini35-output.md`（或回贴给宪宪），并标注"未读 F243 答案"。

## 评测（宪宪，盲 — 非抽取者）
按 F243 三大核心病逐篇 + 整体评，对照 F243 原结果（硬骨头 83% fail）：
1. **H1 复述**：是否照抄文档标题/subtitle 拼摘要？
2. **status 传达**：done/spec/parked/archived 语义有无丢失（F243 痛点：10 篇仅 1 篇传达）？
3. **隐喻保留 vs 置换**：原文精准隐喻是否被换成"看板/驾驶舱"这类通用套话？
4. 整体 production-ready / 需修。
→ 看强模型 + OV提示词能否突破 F243 的 83% 硬骨头 fail rate。

## 后续（可选 B 组 — 彻底分离"模型" vs "提示词"）
A 组（烁烁 + OV提示词）只能证明"强模型+好提示词行不行"。若 A 组显著优于 F243，再加
**B 组（烁烁 + 咱家 F243 提示词）**：
- A 好 B 也好 → 是**模型**的功劳（咱家换强模型即可）
- A 好 B 差 → 是**提示词**的功劳（咱家得学 OV 的提示词工程）
B 组按需启动，不阻塞 A 组。
