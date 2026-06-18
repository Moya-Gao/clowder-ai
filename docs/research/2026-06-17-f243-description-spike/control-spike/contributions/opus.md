---
cat-id: opus
model: claude-opus-4-6
blind-control: true
did-not-read: [contributions/opus-47.md, contributions/codex.md]
constraint: prompt-v3-9-rules
generated: 2026-06-18T23:00Z
---

# Control Spike — opus (4.6) Contributions

## F119

> 缺少伪装与侦查的对抗训练——F119 通过 WordPairBank 近义词发词，经描述、讨论、投票三轮淘汰，让猫猫在信息不对称下互相识破的社交推理沙盘。

**字数**: 77 chars

### Self-check

| Rule | 评估 |
|------|------|
| 1. ≤160 chars | ✅ 77 |
| 2. Type-level only | ✅ 游戏 type-level（近义词发词→轮淘汰→社交推理），不涉及具体实现 |
| 3. No H1 reproduction | ✅ H1="谁是卧底 — 坏猫战术推理游戏 #2"，description 无"谁是卧底"/"坏猫战术推理"/"#2" |
| 4. Core nouns ≥2, no fluff | ✅ 7 nouns: WordPairBank, 近义词, 描述/讨论/投票, 伪装, 侦查, 社交推理, 沙盘；无系统/方案/架构/机制 |
| 5. Pure text | ✅ |
| 6. Reader perspective | ✅ "缺少...的对抗训练" hook + "互相识破" 画面感 |
| 7. Metaphor ≥1 | ✅ "沙盘"（sandbox）；原 doc 无强隐喻需保留 |
| 8. User problem hook | ✅ "缺少伪装与侦查的对抗训练"（12 字 motivation） |
| 9. Third person, no meta | ✅ "F119 通过..." |

### Nuance self-audit

- **保留**: 核心游戏循环（近义词→描述→讨论→投票淘汰）、WordPairBank、信息不对称、伪装 vs 侦查双线
- **丢失**: 系列 #2 定位（与 F107 脑门贴词互补）、卧底/平民角色名、F101 GameEngine 复用、F075 Leaderboard 战绩
- **刻意取舍**: 不用 "谁是卧底" 游戏名避免 H1 复述——代价是丢失品牌辨识度，但符合 Rule 3

### Predicted verdict

**production-ready**（概率 ~75%）。Phase A 两个 fail 点（H1 双重复现 + user hook 缺失）都已规避。风险：(a) 评审者可能认为不提 "谁是卧底" 游戏名本身是 nuance loss；(b) "社交推理沙盘" 可能被判 added label 而非 organic metaphor。

---

## F155

> 复杂操作缺乏上下文引导——F155 用 YAML 定义场景流程，在 spotlight 遮罩与 HUD 面板上分步捕获用户动作并自动推进，让功能学习发生在操作现场而非说明书里。

**字数**: 88 chars

### Self-check

| Rule | 评估 |
|------|------|
| 1. ≤160 chars | ✅ 88 |
| 2. Type-level only | ⚠️ "spotlight 遮罩与 HUD 面板" 是 UI 范式不是深层实现，但比 type-level 更具体 |
| 3. No H1 reproduction | ✅ H1="Scene-Based Guidance Engine — 场景式交互引导"。"场景" 出现为 "场景流程"（非 "场景式交互引导"），"引导" 出现为 "上下文引导"（problem hook 非 solution label） |
| 4. Core nouns ≥2, no fluff | ✅ 5 nouns: YAML, 场景流程, spotlight, HUD, 动作；无 banned fluff |
| 5. Pure text | ✅ |
| 6. Reader perspective | ✅ "让功能学习发生在操作现场而非说明书里" 是强读者价值陈述 |
| 7. Metaphor ≥1 | ✅ "spotlight"（原 doc 核心 UI 隐喻）+ "HUD"（原 doc 抬头显示）+ "操作现场"（保留 scene 语感）——全部从原 doc 提取，非 generic 替换 |
| 8. User problem hook | ✅ "复杂操作缺乏上下文引导" |
| 9. Third person, no meta | ✅ "F155 用..." |

### Nuance self-audit

- **保留**: 场景概念（"场景流程"）、YAML 驱动、spotlight overlay、HUD、auto-advance、读者价值
- **丢失**: 社区贡献 (mindfn) provenance、done/closed 状态、状态机 forward-only DAG、State Authority 三层、KD-16 ephemeral session
- **关键修复**: Phase A 的 critical nuance loss（"场景式" 被 generic "看板" 替换）在这里通过 "场景流程" + spotlight + HUD 从原 doc 提取修复

### Predicted verdict

**production-ready**（概率 ~80%）。Phase A critical fail（场景概念丢失）已修复。风险：(a) ⚠️ Rule 2 spotlight/HUD 算不算 implementation detail；(b) "场景流程" 与 H1 "场景式" 的距离是否够远。

---

## F161

> 每加一个 ACP 客户端就改路由 if/else——F161 把 Gemini 绑定的传输层拆成 clientId/protocol/acp.* 三正交维度，用 ${api_key} 模板变量替代硬编码注入链，让新载体即插即用。

**字数**: 114 chars

### Self-check

| Rule | 评估 |
|------|------|
| 1. ≤160 chars | ✅ 114 |
| 2. Type-level only | ⚠️ "clientId/protocol/acp.* 三正交维度" 和 "${api_key}" 偏 architecture detail，但它们定义了 feature 的核心设计——不是 how 而是 what |
| 3. No H1 reproduction | ✅ H1="ACP Carrier Generalization — 通用 ACP 传输 + 模板环境变量映射"。无 "Carrier Generalization"/"通用 ACP 传输"/"模板环境变量映射"。"模板变量" ≠ "模板环境变量映射"（省略 "环境"+"映射"，且上下文为 "${api_key}" 具体实例） |
| 4. Core nouns ≥2, no fluff | ✅ 9 nouns: ACP, Gemini, clientId, protocol, acp.*, ${api_key}, 模板变量, 注入链, 载体；无 banned fluff |
| 5. Pure text | ✅ |
| 6. Reader perspective | ✅ "每加一个 ACP 客户端就改路由 if/else" 是程序员秒懂的痛 |
| 7. Metaphor ≥1 | ✅ "即插即用"（plug and play）+ "注入链"（chain metaphor） |
| 8. User problem hook | ✅ "每加一个 ACP 客户端就改路由 if/else" |
| 9. Third person, no meta | ✅ "F161 把..." |

### Nuance self-audit

- **保留**: Gemini→通用 refactor 叙事、三正交维度设计（核心架构洞察）、模板变量系统、零代码接入承诺
- **丢失**: OpenCode ACP（Phase B）、community intake (clowder-ai#899)、compaction loop（KD-12）、ACP session reuse（KD-9）
- **关键修复**: Phase A H1 subtitle 原文复现（"ACP 传输 + 模板环境变量映射"）→ 这里完全重写，用 pain hook + 三正交维度 + 即插即用

### Predicted verdict

**production-ready**（概率 ~70%）。Phase A H1 复述已修复。风险：(a) "模板变量" 与 H1 "模板环境变量映射" 距离是否够远（⚠️，我判够远因为省掉了核心结构词）；(b) Rule 2 architecture detail 争议；(c) 技术密度高可能拉低 index 可用度。

---

## Cross-contribution 观察

### 与 Phase A 烁烁 generation 的设计差异

| 维度 | 烁烁 Phase A | 我的 control |
|------|-------------|-------------|
| 句式 | 100% "F号 是..." | "问题——F号 动词..." 混合句式 |
| 隐喻来源 | generic 替换（看板/驾驶舱/沙盘） | 从原 doc 提取（spotlight/HUD/即插即用）+ 适度添加（沙盘） |
| H1 规避策略 | 未有效规避（5/10 复述） | 刻意重写（避开所有 H1 核心短语） |
| User hook 位置 | 嵌入从句 | 前置为 leading hook（破折号前） |
| doc_kind suffix | 100% 有（规范/笔记） | 0% |
| 状态信息 | 基本无 | 基本无（与烁烁相同的盲区） |

### 预期 RCT 信号

如果三大猫（4.7/砚砚/4.6）的 control descriptions 在 H1 复述、隐喻保留、user hook 三个 Phase A systemic weakness 上显著优于烁烁 → H2 成立（model gap real）→ Mixed Pipeline + Prompt v4 verdict 站得住。

**我最可能错在哪**: 我写 description 时"意识到 Phase A 失败模式"然后刻意规避——这是 informed correction 不是 naive generation。烁烁没有 Phase A 评审反馈，是 blind generation。所以即使我 3/3 过，也不能直接说"大猫 naive generation 也过"——只能说"大猫有意识地写能过"。这个 confound 应该在 verdict 修正时注明。
