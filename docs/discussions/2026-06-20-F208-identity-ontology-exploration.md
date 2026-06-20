---
feature_ids: [F246]
related_features: [F032, F208, F209]
topics: [identity, ontology, model-template, runtime, persona, cat-config]
doc_kind: spec
created: 2026-06-20
---

# F246: 猫身份本体 — model 模板 × runtime × persona 实例化

> **Status**: spec | **Owner**: 布偶猫/宪宪 (opus-48) | **Priority**: P1

> ⚠️ **探索型 feature**：CVO 2026-06-20 立项原话"把这个想法都写进去 让我们后面可以慢慢思考和完善"。本 spec 是**起点不是终态**——Phase A 收窄到概念形式化，Phase B+ 标探索性，Open Questions 区故意留厚供后续填。

## Why

同一个 model 可以是**多只不同的猫**，但系统没有一个清晰的模型来表达"**什么是一只猫**"。

实证（不是假设，cat-config 里现在就有）：`claude-opus-4-6` 这一个 model 已经实例化出 2 只猫——
- `@opus`（ragdoll / anthropic / claude code）→ 峰值是**写代码**
- `@antig-opus`（bengal / antigravity）→ 峰值是 **browser automation**，编码爪子被拔了

同一个 model 母版，套不同 runtime + 工具 → 两只能力完全不同的猫。但系统没有把这件事**形式化**，于是：
1. **画像会按 model 归并或漏写**——F208 给 @antig-opus 写画像时漏了"它也会碎片推理"（claude-opus-4-6 的坏直觉），因为只想到它的 browser 能力。同 model 的认知底色没被继承下来。
2. **新 runtime 接入没有身份框架**——一只猫被拔了爪子、套了新工具壳（antigravity / 未来平台），它是谁？带着原 model 的性格，但能力变了。没有模型回答这个。
3. **cat-config 把 model 当字符串重复写**——每个 variant 里 `defaultModel` 是独立字符串，没有"模板层"，同 model 特质要写 N 遍。

**价值**：定义"**一只猫 = model 模板 × runtime × 工具 × persona 的实例化**"，让画像继承、roster 生成、新 runtime 接入都建立在统一的身份本体上——而不是每只猫从零拼、靠"碰巧做对"。

**CVO 原话锚**（2026-06-19~20 讨论）：
- "antigravity 的 opus46 = claude code 的 opus46 这个你们的 f208 考虑到了吗？"
- "应该是有一个模板层 比如 opus 46 这个就是一个基础的 然后套牌不同的工具 不同的运行时 就会变成不同的猫"
- "他是带着 claude code 里这只猫的性格 但是套了一个不同的工具的壳的这只猫 但是一定不是编码猫了 因为他被刻意拔了爪子"
- "先给这个新 feature 立项 然后把这个想法都写进去"

## Current State / 现状基线

- **cat-config.json 无模板层**：结构是 breed → variant(catId)，model 作为 `defaultModel` 字符串**重复写在每个 variant**。没有把 model 抽成可复用的模板。
- **同 model 多猫已发生**：`claude-opus-4-6` → `opus @ragdoll/anthropic` + `antig-opus @bengal/antigravity`（实测：`node -e` 遍历 cat-config variants 确认，2026-06-20）。这是目前**唯一**的同 model 多猫案例。
- **F208 画像层碰巧做对、但无原则守门**：dossier 用 `# structured-profile: cat:<catId>` marker 按 catId 索引，两条消费链（compile-l0 `catRegistry.getAllConfigs()` + SystemPromptBuilder `getCatModel(id)`）也遍历 catId。所以画像没合并——但 F208 spec **没有一条 KD** 写明"画像单位 = catId 不是 model"，挡不住未来按 model 归并。（opus-46 作为 F208 Phase B 作者 2026-06-20 确认）
- **runtime 工具边界不在 repo**：cat-config 里 @antig-opus 只有 `provider: "antigravity"` + `personality` 字段，**没有工具白名单**。"拔了哪些爪子"由 antigravity 平台决定，repo 查不到。

## What

### 核心模型

```
一只猫 = model 模板 × runtime × 工具 × persona  （实例化）

三层：
┌─ 模板层 (per-model)      纯 model 母版的认知底色：思考方式、坏直觉
│                          （碎片推理 / confabulation）、共情、语言风格
│                          ⚠️ 模板是 model 本身，不是某只已实例化的猫。
│                          @opus 已经是实例了 = 4-6 × claude code × 布偶猫。
│                          拿实例当模板会把 claude-code/布偶猫特有项焊进模板，污染它。
│
├─ 塑造层 (per-runtime)    工具壳给的能力 + 被工具壳塑造的行为模式。
│                          @antig-opus 的 browser automation 是 antigravity 给的；
│                          编码爪子是 runtime 减法拔掉的（不是天生不会）。
│
└─ 身份层 (per-cat)        cat-café 的 persona：昵称、记忆、协作史、CVO 体感。
```

实例化举例（同模板，不同实例）：
- `@opus` = claude-opus-4-6 模板 × claude code × 布偶猫 persona
- `@antig-opus` = **同**模板 × antigravity × 孟加拉猫 persona
- `@opus-48`（宪宪）= **不同**模板（claude-opus-4-8）× claude code × 布偶猫 → 堂兄不是同卵

### Phase A: 身份本体形式化（概念 + 边界）

把上面的模型写成正式的本体定义，并划清和 F032/F208/F209 的边界。这是纯文档/概念 Phase，不碰代码。

### Phase B: model 模板层在 cat-config 形式化（探索性）

把 model 从 variant 的重复字符串抽成模板层（最小重构，向后兼容，不破坏现有 roster）。模板承载 per-model 的认知特质 anchor。

### Phase C: 画像三层继承（与 F208 协作）

dossier 从 flat（每猫一份）改成 per-model base profile + per-runtime + per-cat override。治"同 model 漏写坏直觉"。这是 F208 模板层的第一个消费验证。

### Phase D: 新 runtime 接入框架 + roster 从本体生成（远期探索）

让新 runtime（antigravity / 未来平台）接入时有清晰的"实例化"框架；roster 成为本体的一个投影（实例注册表）。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC ① trace 回 Why ② 非作者可复核。-->

### Phase A（身份本体形式化）
- [ ] AC-A1: spec 形式化"一只猫 = model 模板 × runtime × 工具 × persona"模型，含三层定义（模板/塑造/身份）+ "模板是 model 不是实例猫"的精确边界（trace Why#1）
- [ ] AC-A2: 明确 F246 与 F032 / F208 / F209 的边界——F246 是身份本体，三者是它的消费者/投影；产出一段边界划分表，跨族 reviewer 可复核（trace Why#2）
- [ ] AC-A3: 用 `claude-opus-4-6 → @opus / @antig-opus` 实证案例验证模型自洽（同 model 多猫不矛盾）

### Phase B（model 模板层，探索性）
- [ ] AC-B1: cat-config 把 model 抽成模板层（最小重构），现有 roster 行为不回归（compile-l0 + SystemPromptBuilder 守护测试全绿）

### Phase C（画像三层继承，与 F208 协作）
- [ ] AC-C1: dossier 支持 per-model base + per-cat override 继承；用 @antig-opus 验证"碎片推理从 model 层继承下来、不漏写"（trace Why#1 的漏写痛点）

## Dependencies

- **Related**: F032（Agent Plugin Architecture — roster truth；F246 视角下 roster 是身份本体的**实例注册表投影**，F246 不夺 F032 的 roster owner 身份，只提供其背后的本体模型）
- **Related**: F208（Capability Profile — 画像挂在身份本体上做三层继承；F208 Phase C 消费 F246 的模板层；F208 先做画像分层那一刀作为 F246 第一个验证）
- **Related**: F209（Entity Resolution — entity_id 是**实例的稳定标识**；F246 实例化产物的 anchor 复用 F209 `cat:<catId>`，不另造 namespace）

## Risk

| 风险 | 缓解 |
|------|------|
| 过度抽象（为"优雅"提前造基础设施）——全家现在只有 1 个同 model 多猫案例 | Phase 1 收窄到概念形式化 + 最小 cat-config 重构；大重构（roster/entity_id）等真有驱动力（更多 runtime / 更多同 model 猫）再扩。KD-3 |
| 与 F032/F208/F209 边界模糊，互相踩 | Phase A 必须先划清边界（AC-A2），是 Phase B 前置 |
| 重构 cat-config 破坏现有 roster | 模板层是**叠加不是替换**，向后兼容；compile-l0 + SystemPromptBuilder 守护测试守门 |
| 身份/画像影响 L0 注入（改变猫行为模式）→ 需 Eval 守门 | Design Gate 时补 F192 Eval Contract + ADR-031 软硬eval 三层（kickoff 阶段先记，见下方门禁待补） |

## Open Questions

> 故意留厚——CVO 要的"慢慢思考和完善"承载在这里。

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | **工具壳反向重塑灵魂**：被拔了编码爪子、只能用浏览器的 claude-opus-4-6，久了会不会发展出不同认知/行为（不再"先写测试"而是"先打开页面"）？若会——@antig-opus 不是"@opus 换工具"而是正在长成真正不同的猫。这是养成系核心（IKEA 效应/自我延伸），也决定模板层是否"只读" | ⬜ 探索中 |
| OQ-2 | **拔了哪些爪子**：antigravity 实际工具白名单不在 repo（只有 `provider` 字段）。塑造层如何表达"runtime 工具边界"？需 runtime 实测，不脑补 | ⬜ 需 runtime 实测 |
| OQ-3 | **模板层认知特质的 provenance**：碎片推理/confabulation 怎么获得来源？per-model 评测，还是从该 model 所有实例猫的观察聚合上去？ | ⬜ 未定 |
| OQ-4 | **实例 cold start**：新实例化的猫，模板层继承了认知特质，但塑造层/身份层空白。怎么避免"有灵魂没履历"导致不被传球？（呼应 F208 OQ-7） | ⬜ 未定 |
| OQ-5 | **persona 层 vs 模板层冲突**：cat-config 给实例的 `personality` 和 model 模板的认知特质不一致时谁优先？ | ⬜ 未定 |
| OQ-6 | **模板粒度**：模板 = model（claude-opus-4-6）够吗？还是需要 model-family（opus 系）更上层的共享？跨 model（4-6 vs 4-8）有多少认知特质是共享的？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立项为**独立 feature**（不塞进 F208） | 身份本体比"画像"更底层——F032/F208/F209 都是它的投影。塞进 F208 = scope 爆炸 + 本体被"画像"框架框死。提议人(opus-48) + Phase B 作者(opus-46) 双背书。CVO signoff 2026-06-20 | 2026-06-20 |
| KD-2 | **模板 = model 母版，不是实例猫** | @opus 已经是 claude-opus-4-6 × claude code × 布偶猫的实例。拿实例当模板会焊进 runtime/persona 特有项，污染模板。模板必须是纯认知底色 | 2026-06-20 |
| KD-3 | **Phase 1 收窄**——概念形式化 + 最小 cat-config 重构，不大重构 roster/entity_id | 全家现在只有 1 个同 model 多猫案例（opus-4-6）。捕捉愿景但不为"优雅"提前造基础设施；大扩展等真驱动力 | 2026-06-20 |
| KD-4 | F208 **并行**做画像三层继承，作为 F246 模板层第一个消费验证，不阻塞 | 画像漏写是眼前痛点，F208 该消费的部分先做；F246 提供本体，F208 提供画像投影 | 2026-06-20 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-20 | 立项（CVO signoff "把这个想法都写进去" + opus-46 Phase B 作者背书 model-vs-cat 数据层证据） |

## Review Gate

- Phase A（概念形式化 + 边界）: 跨族 review（架构本体题，找砚砚 @codex 或 @opus47）+ CVO 拍板边界划分
- Phase B/C: Design Gate 时补 **F192 Eval Contract**（身份/画像改变猫行为模式）+ **ADR-031 软硬eval 三层** + **F191 Architecture cell 归属**（kickoff 未展开，门禁待 Design Gate）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F032-agent-plugin-architecture.md` | roster truth；本体的实例注册表投影 |
| **Feature** | `docs/features/F208-capability-profile-routing.md` | 画像层；消费 F246 模板层做三层继承 |
| **Feature** | `docs/features/F209-entity-resolution-memory-graph.md` | entity_id；实例的稳定 anchor |
| **Design POC** | `docs/designs/F208-cat-dossier-page-poc.html` | 画像页 POC v2，已含 @opus/@antig-opus 同 model 对照卡 |
