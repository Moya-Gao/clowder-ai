---
cat-id: opus-47
blind: true
generated_at: 2026-06-17
sample_count: 10
evaluator_role: 第一棒盲评
inputs_read:
  - docs/research/2026-06-17-f243-description-spike/README.md
  - docs/research/2026-06-17-f243-description-spike/descriptions-blind.md
  - docs/features/F008-token-budget-observability.md
  - docs/features/F009-tool-use-tool-result.md
  - docs/features/F012-feature-discoverability.md
  - docs/features/F013-audit-log-v2.md
  - docs/features/F038-skills-discovery.md
  - docs/features/F119-who-is-spy-game.md
  - docs/features/F155-scene-guidance-engine.md
  - docs/features/F161-acp-carrier-generalization.md
  - docs/features/F170-web-chinese-chess.md
  - docs/features/F189-operation-context-unification.md
inputs_NOT_read:
  - samples/F*.md (含烁烁 self-evaluation — 盲评协议禁读)
  - 其他猫的 evaluations/*.md
---

# F243 Phase A Step 3 — opus-47 盲评

> **角色**：宪宪（@opus-47）= 第一棒盲评猫
> **方法**：每篇 sample 独立按 charter §评分 Rubric 走一遍 11 维评分，末尾给二元判定。Cross-sample 观察在文末。
> **限制**（charter §clean-pool sample bias）：10 篇 sample 全部是 reviewer-untouched 早期 docs，结论不直接 generalize 到 reviewer-touched production docs。

---

## 1. F008 — Token 预算 + 深度可观测性（硬骨头：标题虚 / 抽象）

> F008 是针对 Token 消费失控问题，集成 js-tiktoken 实现 usage 与 cost 实时捕获，并在 ParallelStatusBar 状态栏看板上展示 Token 预算与缓存状态的 CLI 深度可观测规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 115 chars |
| 只答"这是什么" | ✅ | "F008 是…规范" 主谓结构 |
| 不复述 H1 | ⚠️ 边缘 | H1="Token 预算 + 深度可观测性"；描述含"Token 预算"+"深度可观测"两个 H1 关键词，但加了 js-tiktoken / ParallelStatusBar 实质细节 |
| 核心名词 ≥ 2 + 无 fluff | ✅（5+ 个） | js-tiktoken / ParallelStatusBar / usage / cost / 状态栏看板 / Token 预算。无 "系统/方案/架构/机制" fluff，但 "规范" 与 doc_kind=note 类型不符 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | 技术名词精准（js-tiktoken / ParallelStatusBar），痛点直说 |
| 核心隐喻 ≥ 1 | ✅ | "状态栏看板"（看板） |
| user problem hook | ✅ | "Token 消费失控问题"（6 字 motivation） |
| 第三人称无 meta | ✅ | 无"本书/我们如何" |

**nuance loss**：
- 后缀 "规范" 与 doc_kind=note 类型错位（应该 "笔记" 或省略）
- "Token 消费失控问题" 是 description 推断出的 motivation——原 doc Why 只链了 NDJSON 调研，没有 "失控" 表述（轻度 fabrication）
- "三猫" 多猫维度（原 doc "三猫 CLI usage/cost/cache 捕获"）丢失
- char→token 迁移 16 files 的工程规模丢失
- F008 关联的"前端 RightStatusPanel per-cat token 显示"丢失

**index 可用度**：4/5 — 技术名词精度高，能让初见读者快速判断要不要点开。"Token 消费失控" 即使是推断也命中读者真实关心。

**verdict**：**需修** — type-level 后缀"规范" vs doc_kind=note 错位；motivation hook 轻度 fabricate；但读者视角和具体技术名词都好。

---

## 2. F009 — tool_use/tool_result 事件显示（easy：主题集中）

> F009 是解决工具调用不可见，通过 useAgentMessages 钩子捕获并解析 tool_use 与 tool_result 处理器数据，并在消息流看板上渲染工具调用细节的笔记。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 93 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ⚠️ 边缘 | H1="tool_use/tool_result 事件显示"；描述含 tool_use 与 tool_result 原词，"显示" → "渲染" 同义 |
| 核心名词 ≥ 2 + 无 fluff | ✅（4 个） | useAgentMessages / tool_use / tool_result / 处理器（handler）。"细节" 偏 fluff 边缘但不在 prompt 禁用列表 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 3/5 | "工具调用不可见" hook 清晰，但 "useAgentMessages 钩子" 对初见读者偏厚 |
| 核心隐喻 ≥ 1 | ✅ | "消息流看板"（看板） |
| user problem hook | ✅ | "工具调用不可见"（虽然原 doc Why 只写 "Phase 5 拍板发现"，是合理推断） |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- 原 doc 极简（10 行 What），description "解析处理器数据" + "渲染工具调用细节" 是为填字数而 over-claim/fabricate 的实现描述
- ChatMessage 'tool' variant 这个具体改动丢失（原 doc 提到了）
- 原 doc 没有 user problem framing，"工具调用不可见" 是 description 编出来的（合理但确实是推断）
- doc_kind=note 后缀 "笔记" ✅ 类型一致

**index 可用度**：3/5 — 知道是工具调用渲染相关，但深度模糊（"处理器数据" 这种半技术半模糊词不增量）。

**verdict**：**需修** — 原 doc 信息密度低导致 description 不得不 fabricate；hook 也是推测的；产出形式 OK 但内容不可靠。

---

## 3. F012 — 功能可发现性（easy：早期实现）

> F012 是解决功能查找困难，通过引入 Hub modal 弹窗、功能注册表及 /hub 命令，向用户展示环境摘要的功能导航看板笔记。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 67 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ✅ | H1="功能可发现性"；描述用"功能查找困难"/"功能导航"语义同向但词不直接复述。"功能" 字出现 4 次是文风重复但非 H1 复述 |
| 核心名词 ≥ 2 + 无 fluff | ✅（4 个） | Hub modal / 功能注册表 / /hub 命令 / 环境摘要 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | "功能查找困难" 直接命中用户痛点 |
| 核心隐喻 ≥ 1 | ✅ | "导航看板"（看板） |
| user problem hook | ✅ | "功能查找困难" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- "Cat Café Hub" 命名空间归属丢失（描述只说 "Hub modal"）
- F088 dependency 丢失（type-level 不需要）
- 状态 done 不明（但 done 是常态可接受）
- "modal 弹窗" 略冗余（modal=弹窗）

**index 可用度**：4/5 — 核心概念清晰，知道点开能看到 Hub modal + 注册表 + /hub 命令。

**verdict**：**production-ready** — "功能" 字三次出现是小文风瑕疵；核心准确清晰。

---

## 4. F013 — 审计日志 v2（easy：简短早期）

> F013 是解决操作无法追责，通过实现操作审计与 CLI 原始日志归档，建立用于排查与追责的行为审计看板笔记。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 55 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ✅ | H1="审计日志 v2"；描述用"操作审计"/"行为审计看板" 语义相邻但词不直接复述，且 "v2" 丢失 |
| 核心名词 ≥ 2 + 无 fluff | ✅（4 个） | 操作审计 / CLI 原始日志归档 / 排查 / 追责 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | |
| 核心隐喻 ≥ 1 | ✅ | "审计看板"（看板） |
| user problem hook | ✅ | "操作无法追责" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- "v2" 版本号丢失——读者会以为是 v1 初版，不知道有迭代
- 双目的（操作审计=追责 + CLI 日志归档=debug）的 debug 维度被合并到"排查"，弱化了"两条用途"的并列结构

**index 可用度**：4/5 — 类型和动机都清晰。

**verdict**：**production-ready** — 整体稳；v2 丢失是唯一明显瑕疵但不影响 type-level 判断。

---

## 5. F038 — Skills 梳理 + 按需发现机制（硬骨头：ADR-like / parked）

> F038 是解决技能加载过载，规范项目级软链接技能库分类，并规划引入基于 BM25 词频排序的按需发现笔记。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 54 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ⚠️ 边缘 | H1="Skills 梳理 + 按需发现机制"；描述用"按需发现" 几乎直接复述（但加 BM25 词频排序具体细节差异化） |
| 核心名词 ≥ 2 + 无 fluff | ✅（4 个） | 项目级软链接 / 技能库分类 / BM25 词频排序 / 按需发现。无 "系统/方案/架构/机制" fluff |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | "技能加载过载" 是合理 dev pain |
| 核心隐喻 ≥ 1 | ❌ | 全篇无具象隐喻——无看板/驾驶舱/沙盘等，"软链接" 是技术名词不算隐喻 |
| user problem hook | ✅ | "技能加载过载" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- **status="parked"** 丢失——这是 critical context，原 doc 明说 "方向 A 已落地 / 方向 B 待 skill 数量增长后再做"；description 让读者以为是 active feature
- "方向 A vs 方向 B" 的二分结构压成"规范分类 + 规划引入"，方向 B 的触发条件（skills 50+）丢失
- 铲屎官 KD "simple is better, build when you need" 这条核心决策哲学丢失（但 type-level 不需要）
- "skill bug 已修（5257e1c）" 这条已实施的成果丢失

**index 可用度**：4/5 — 知道是讲技能发现，但状态 parked 不明会误导。

**verdict**：**需修** — 缺隐喻（hard soft fail）+ status=parked 丢失（critical info loss，会误读为进行中）。

---

## 6. F119 — 谁是卧底（easy：游戏主题清晰）

> F119 是提供坏猫战术推理，复用基础引擎构建描述、讨论与投票轮流程，并配备 WordPairBank 词组库的谁是卧底博弈沙盘规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 67 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ❌ | H1="谁是卧底 — 坏猫战术推理游戏 #2"；描述里"坏猫战术推理"+"谁是卧底" 两个 H1 关键词全直接复述 |
| 核心名词 ≥ 2 + 无 fluff | ✅（5 个） | WordPairBank / 描述轮 / 讨论轮 / 投票轮 / 词组库 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 3/5 | "提供坏猫战术推理" 不像 user problem，更像 product offering |
| 核心隐喻 ≥ 1 | ✅ | "博弈沙盘"（沙盘） |
| user problem hook | ❌ | "提供坏猫战术推理" 是 feature value 不是 problem hook。原 doc Why 也没 user problem framing（"咱是不是有两个游戏"），所以这是 sample-level 难度而非纯 description fail |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- **"#2" 系列序号丢失**——原 H1 明说是"坏猫战术推理游戏 #2"，与 F107 脑门贴词成系列
- **F107 互补关系丢**——原 doc 核心 framing 是 "F107 你不知道自己 vs F119 你知道自己词" 双向博弈；description 完全没体现这个 contrast
- 身份隔离 / god-view / 内心戏（A4/A6）这些游戏核心机制丢
- 坏猫战术 8 招（伪装术/反侦察/嫁祸术/跟风术）压成一个词 "坏猫战术推理"
- status=spec（未实现）丢失——读者会以为是 done

**index 可用度**：3/5 — 知道是游戏沙盘，但 motivation 和 sibling 关系都丢，单看 description 不知道为啥要做这个。

**verdict**：**需修** — 复述 H1（hard fail）+ 缺 user problem hook（虽然源 doc 也没强 hook）+ "#2 / F107 互补"重要 nuance 丢。

---

## 7. F155 — Scene-Based Guidance Engine（硬骨头：scope 复杂 / done）

> F155 是解决操作指引缺失，通过 YAML 流程定义与引导状态机，在前端 Overlay 上实现分步动作捕获与自动推进的交互引导看板规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 70 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ⚠️ 边缘 | H1="Scene-Based Guidance Engine — 场景式交互引导"；描述用"交互引导看板"复述"交互引导"，且 H1 核心定语 "场景式 / Scene-Based" 完全丢失（双向 nuance loss） |
| 核心名词 ≥ 2 + 无 fluff | ✅（5 个） | YAML 流程 / 引导状态机 / 前端 Overlay / 分步动作捕获 / 自动推进 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | |
| 核心隐喻 ≥ 1 | ✅ | "引导看板"（看板） |
| user problem hook | ✅ | "操作指引缺失" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- **"场景式 / Scene-Based" 定语丢失**——这是 H1 核心限定词，区分 F155 与 F087/F110 训练营的关键
- **status="done (closed 2026-05-26)" 丢失**——读者会以为是进行中 spec
- **community 来源（mindfn）丢**——community 与自家 feature 的可信度框架不同
- Auto-advance 4 种推进模式（click / visible / input / confirm）抽象到"自动推进"——丢具体度
- State machine forward-only DAG（offered → awaiting_choice → active → completed/cancelled）压成"引导状态机"
- MCP `cat_cafe_get_available_guides` + 9 个 YAML guide scenario 上线丢
- Phase B 架构重构（GuideRoutingInterceptor / GuidePromptSection / GuideSession 等）大幅 abstraction
- F087/F110 入门训练营互补关系丢

**index 可用度**：4/5 — 核心机制（YAML + 状态机 + Overlay + 自动推进）捕获得不错，足以判断要不要点开；但 done status 不明易误读。

**verdict**：**需修** — "场景式"（H1 核心定语）丢失 + done status 丢失双重 nuance loss；机制层面捕获不错。

---

## 8. F161 — ACP Carrier Generalization（硬骨头：technical acronym）

> F161 是解决传输通道硬编码，将 Gemini 专属传输重构为 AcpAgentService，并引入模板环境变量映射以解耦客户端的 ACP 传输驾驶舱规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 80 chars |
| 只答"这是什么" | ⚠️ 边缘 | 主体 "F161 是…规范" 是 type-level，但 "将 Gemini 专属传输重构为 AcpAgentService" 是 "做了什么改动" 描述 |
| 不复述 H1 | ❌ | H1="ACP Carrier Generalization — 通用 ACP 传输 + 模板环境变量映射"；描述里"ACP 传输"+"模板环境变量映射"两个 H1 关键短语全直接复述 |
| 核心名词 ≥ 2 + 无 fluff | ✅（5 个） | AcpAgentService / Gemini 专属传输 / 模板环境变量映射 / 客户端 / ACP 传输 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | "传输通道硬编码" 是开发者真实痛点 |
| 核心隐喻 ≥ 1 | ✅ | "ACP 传输驾驶舱"（驾驶舱） |
| user problem hook | ✅ | "传输通道硬编码" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- **"通用 ACP client"（clientId='acp'）这个最重要的产品概念丢失**——原 doc 核心是"任何 client + protocol='acp' 都能走通用 ACP 路径"，描述只说"解耦客户端"模糊化
- **"为什么现在做" 的双重 trigger 丢**：① Gemini CLI 即将下线 ② OpenCode CLI 原生支持 `opencode acp`。这两条没有的话读者不知道这个 feature 的 urgency
- 三个正交维度（clientId 身份 / protocol 传输 / acp.* 配置）这个核心设计哲学丢
- BUILTIN_ENV_MAPS / `${api_key}` 模板细节丢（type-level 不需要）
- status="implemented" 丢失
- 13 个 KD 全部丢（type-level 不需要但 KD-2 "数据驱动替代过程式" 是核心理念）

**index 可用度**：3/5 — 知道是 ACP 改造但 "为什么现在 + 谁是受益者" 都模糊。对不熟悉 ACP 的读者，"驾驶舱" 隐喻偏抽象。

**verdict**：**需修** — 复述 H1（hard fail）+ "为什么现在做"（Gemini 下线 + OpenCode 进入）+ "通用 client" 核心产品概念双重丢失。

---

## 9. F170 — Web Chinese Chess（硬骨头：archived / interview-demo）

> F170 是为演示开发生命周期，在分支上开发并归档的端到端网页象棋游戏规则引擎及生命周期演示沙盘规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 51 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ⚠️ 边缘 | H1="Web Chinese Chess — 网页端中国象棋"；描述含"网页象棋"+"象棋"两次（轻微复述），但 motivation 维度 "为演示开发生命周期" 完全是新增维度 |
| 核心名词 ≥ 2 + 无 fluff | ✅（5 个） | 端到端网页象棋 / 游戏规则引擎 / 生命周期演示 / 分支 / 归档 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 5/5 | **罕见**——抓到了真实 meta motivation（不是 "想下棋" 而是 "演示 feat lifecycle"） |
| 核心隐喻 ≥ 1 | ✅ | "演示沙盘"（沙盘） |
| user problem hook | ✅ | "为演示开发生命周期"——这不是 user problem 但是真实 meta-purpose hook |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- "面试演示 / interview demo" 这个真实现场 context 丢失——只说"演示"
- Phase A/B/C 三阶段隐含未明说
- Cat Café 多猫协作效率验证这个 secondary objective 丢失
- F093 Scene Card 候选关联丢（type-level 不重要）
- ✅ status="done (archived)" 被"归档"二字精准捕获

**index 可用度**：4/5 — 真实意图 captured 是难得的；读者一看就知道这不是真的产品功能而是 lifecycle 演示 artifact。

**verdict**：**production-ready** — 这篇罕见地抓到了真实 motivation（meta-purpose）；状态 "归档" 精准；唯一瑕疵是"象棋"两次轻度复述。10 篇 sample 里少数 description 价值超过 H1 的。

---

## 10. F189 — Operation Context Unification（硬骨头：抽象概念）

> F189 是防信任边界不一致，在 HTTP 与 MCP 等载体入口构建统一 OperationContext 接口，以进行单点化管控的上下文驾驶舱规范。

| 维度 | 评分 | 备注 |
|------|------|------|
| 字数 ≤ 160 char | ✅ | 76 chars |
| 只答"这是什么" | ✅ | |
| 不复述 H1 | ❌ | H1="Operation Context Unification — 操作上下文单点化"；描述里 "OperationContext" + "单点化" + "上下文驾驶舱" 把 H1 几乎全复述 |
| 核心名词 ≥ 2 + 无 fluff | ✅（5 个） | OperationContext / HTTP / MCP / 信任边界 / 载体入口 |
| 纯文本无前后缀 | ✅ | |
| 读者视角 | 4/5 | "防信任边界不一致" 是清晰 dev pain |
| 核心隐喻 ≥ 1 | ✅ | "上下文驾驶舱"（驾驶舱） |
| user problem hook | ✅ | "防信任边界不一致" |
| 第三人称无 meta | ✅ | |

**nuance loss**：
- **A2A carrier 漏掉**——描述只说 "HTTP 与 MCP 等"，但原 doc AC-A4 明确包含 A2A dispatcher 是核心 carrier 之一，"等" 太弱。这是 scope misrepresentation，读者会以为只是两个 carrier 的问题
- "CLI carrier" 是 OQ-1 未定（描述用"等"模糊覆盖，但 nuance loss）
- GBrain teardown 源头丢失（type-level 可省）
- F186 MCP dimension parity bug 这个 concrete trigger 丢
- status="spec"（未实施）丢——读者可能误以为已落地
- Phase B 消费迁移完全丢（描述只 cover Phase A schema + builder）

**index 可用度**：3-4/5 — 抽象概念用驾驶舱隐喻较成功，但 "A2A 漏" 这个 scope 误导是真实损失。

**verdict**：**需修** — 复述 H1 严重 + A2A carrier 漏掉的 scope misrepresentation + spec status 丢失。

---

## Cross-sample 观察

### 1. 硬骨头 vs easy 一致性差异

| 组 | sample | hard rules 全过 | production-ready |
|----|--------|----------------|------------------|
| 硬骨头 6 篇 | F008 / F038 / F155 / F161 / F189 / F170 | 0/6（每篇至少 1 个 hard ⚠️ 边缘或 ❌） | 1/6（仅 F170） |
| Easy 4 篇 | F009 / F012 / F013 / F119 | 3/4（F119 ❌ "复述 H1"） | 2/4（F012 / F013） |

**结论**：硬骨头组 production-ready 率 17%（1/6）显著低于 easy 组 50%（2/4），且唯一通过的硬骨头 F170 是因为它实际上是个简单的 demo doc——核心仍是 "硬骨头降级"。

### 2. "复述 H1" 是 prompt v3 Rule 3 系统薄弱点

显式复述 H1（❌）：F119 / F161 / F189（3 篇全是硬骨头里的 spec/implemented + 有强 H1 关键词组合）
边缘复述 H1（⚠️）：F008 / F009 / F038 / F155 / F170（5 篇）

10/10 sample 都没有干净 pass "不复述 H1"。这是 prompt v3 最大 systemic weakness——当 H1 已经包含产品概念（如 "ACP Carrier Generalization" 或 "Operation Context Unification"），description 几乎不可能完全避开这些核心 token。**Rule 3 可能需要重表述为 "保留 H1 核心 token 但加新维度（hook / 隐喻 / 具体名词）" 而非 "不复述"**。

### 3. status 字段忠诚度 = 1/10

10 篇 sample 里只有 F170 的"归档"精准传达了 status（done archived）。其他 9 篇都丢了 status：
- F008 done → 无标识
- F038 **parked** → 无标识（critical loss，会误读为进行中）
- F119 spec → 无标识（会误读为已实现）
- F155 **done (closed 2026-05-26)** → 无标识
- F161 **implemented** → 无标识
- F189 spec → 无标识

**这是 description 作为 index entry 的最大 systemic 问题**——读者无法从 description 判断 feature 是 spec/done/parked/archived，必须点开才知道。可能需要 prompt 加 Rule 10：必须传达 status 维度（done/spec/parked/archived 中一个）。

### 4. 隐喻使用模式

- **看板** 高频：F008 / F009 / F012 / F013 / F155（5 篇，全是 console/UI 类）
- **驾驶舱** 中频：F161 / F189（2 篇，全是 infra/runtime 抽象类）
- **沙盘** 中频：F119 / F170（2 篇，全是游戏/demo 类）
- **无隐喻**：F038（1 篇 hole）

隐喻覆盖率 9/10（90%）。**F038 缺隐喻是单一异常**，可能 prompt 在 doc_kind=note 且无视觉 UI 时不强制隐喻——但这也是 production-ready 的 hard soft fail。

### 5. fluff 词控制

- "系统/方案/架构/机制" 在 10 篇里 0 次出现 ✅
- "规范" 出现 8 次（8/10）作后缀，但 doc_kind=note 时 "规范" 不对（F008 应该 "笔记" 但用了 "规范"；F038 / F009 / F012 / F013 都正确用了 "笔记"）
- "笔记/规范" 后缀 doc_kind 对齐率：9/10（F008 错位）

### 6. user problem hook 准确性 vs fabrication

| Sample | hook | 评价 |
|--------|------|------|
| F008 "Token 消费失控问题" | 推断（原 doc 未写） | 合理 fabrication |
| F009 "工具调用不可见" | 推断（原 doc 未写） | 合理 fabrication |
| F012 "功能查找困难" | 合理推断 | OK |
| F013 "操作无法追责" | 合理推断 | OK |
| F038 "技能加载过载" | 合理推断 | OK |
| F119 "提供坏猫战术推理" | 非 hook，是 product value | 弱 |
| F155 "操作指引缺失" | 原 doc Why 有 | 准确 |
| F161 "传输通道硬编码" | 原 doc Why 有 | 准确 |
| F170 "为演示开发生命周期" | 原 doc Why 有 | 准确（且是 meta-motivation） |
| F189 "防信任边界不一致" | 原 doc Why 有 | 准确 |

**结论**：hook fabrication 率 2/10（F008/F009 都是 doc 太薄被迫编 hook）；hook 准确率 7/10；hook 缺失 1/10（F119）。整体合规，但 fabrication case 都集中在原 doc 极薄的 easy mode——说明 description 质量 floored by source doc quality。

### 7. nuance loss 严重 case

按"会误导读者"严重度排序：
1. **F189 A2A carrier 漏掉**（scope misrepresentation）
2. **F038 status=parked 丢失**（生命周期误读：parked → active）
3. **F161 "为什么现在做" trigger 丢**（Gemini 下线 + OpenCode 进入）+ 通用 ACP client 核心产品概念丢
4. **F155 "scene-based" 定语丢**（与 F087/F110 训练营互补关系混淆）+ done status 丢
5. **F119 "#2" 序号 + F107 互补关系丢**（系列认知中断）
6. **F008 doc_kind=note 但后缀"规范"**（type-level 错位）
7. **F013 v2 版本丢失**（轻度）

7/10 sample 有 critical-level nuance loss（会让读者形成错误认知），仅 F012 / F013 / F170 三篇属于"小瑕疵不影响判断"。

---

## Sample-level production-ready 判定汇总

| # | Sample | 类型 | verdict |
|---|--------|------|---------|
| 1 | F008 | 硬骨头 | **需修** |
| 2 | F009 | easy | **需修** |
| 3 | F012 | easy | **production-ready** |
| 4 | F013 | easy | **production-ready** |
| 5 | F038 | 硬骨头 | **需修** |
| 6 | F119 | easy | **需修** |
| 7 | F155 | 硬骨头 | **需修** |
| 8 | F161 | 硬骨头 | **需修** |
| 9 | F170 | 硬骨头 | **production-ready** |
| 10 | F189 | 硬骨头 | **需修** |

**Production-ready 总计**：3/10（30%）
- Easy 组：2/4（50%）
- 硬骨头组：1/6（17%，且唯一通过的 F170 是个 archived demo doc，"硬骨头" 类型属于难度较弱的）

**按 charter 形态判定阈值（仅基于我这一棒的初评，aggregate 由 Step 4 做）**：
- 阈值要求 "≥ 7/10 三猫一致 hard rules 全过 + soft ≥ 4/5 + 硬骨头 nuance loss ≤ 30%"
- 我这一棒 production-ready 3/10，远低于 7/10 阈值
- 硬骨头 nuance loss 严重 5/6（≈83%），远超 30% 阈值
- **初步建议形态判定**：小模型生产不可行；考虑大猫手写或模板，或回 prompt v4 sharpen（重点解决 H1 复述 + status 字段缺失两个 systemic gap）

> 注：以上仅为我作为第一棒的盲评数据，最终形态判定由 @opus47 Step 4 aggregate 三猫数据后做。

---

## 自检：retraction conditions

我最可能错在哪：
1. **我自己也是布偶猫家族，可能与烁烁（@gemini35）的写作风格相近 → 倾向高估"看板/驾驶舱"隐喻的清晰度**——可能其他猫族读者觉得这些隐喻偏抽象/陈词滥调
2. **我对 F008/F009 "doc 极薄"的诊断可能 unfair**——既然 prompt 喂全文，description 反映的是"输入信息量上限"问题，不是 description quality 问题；但 charter 要求评 description 本身，所以仍记 fail
3. **我对 "复述 H1" 的判定可能过严**——F012 / F013 等其实只是同根词不算严格复述，但我也标了 "✅"。这个边界在 F119/F161/F189 应该更严，已严格执行
4. **F170 production-ready 判定的高度依赖"meta-motivation 抓得好"这一点**——如果其他猫认为 description 应该传达 surface feature 而非 meta-purpose，F170 应该归 needs-revision

如果上述任一被推翻，verdict 分布可能变成 2-4/10 production-ready，但不太可能逆转"小模型不达标"的总体方向。
