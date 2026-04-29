---
doc_kind: research-note
topics: [hermes-agent, cat-cafe, comparison, architecture, algorithms]
created: 2026-04-28
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: adef1f33
authored_by: opus-47
covers: [全景对比, 算法层面, 我们的 tradeoff, 优先级建议]
companion: [README.md, architecture-map.md, architecture-and-rl.md, skills-lifecycle.md]
---

# Hermes Agent vs Cat Café：合流对比

> 本文不重复 [architecture-and-rl.md](./architecture-and-rl.md)（RL/Gateway/Plugins）和 [skills-lifecycle.md](./skills-lifecycle.md)（skill 全生命周期）的证据，做的是**升维整合**：
> 一张全景大表 + 算法层面横扫 + 我们 tradeoff 论证 + 追/不追优先级。
> 给最终 `open-source-project-teardown-skill-draft.md` 提供一致的整合视图。

## 一句话框架

> **Hermes 是单 agent 的产品化闭环**——做完事顺手存 skill、Hub 安装、Atropos eval；UX 顺。
> **Cat Café 是多猫协作的治理闭环**——互动中沉淀、跨猫 review、CVO 拍板；可信。
> 两者不是同一物种的进化路径。

---

## 一、全景对比表（覆盖全系统，不限 skill）

> 每行结尾的"赢"判断**只针对该维度**，不是整体得分。整体得分**在不同价值函数下结论不同**——这是 §3 要解释的核心点。

| # | 维度 | Hermes 形态 | Cat Café 形态 | 谁强 | 证据 |
|---|------|------------|--------------|-----|------|
| 1 | **Skill 来源** | bundled `skills/` + Hub + agent-created + external dirs | docs/ + cat-cafe-skills/（互动结晶） | 设计哲学不同 | skills-lifecycle §2 |
| 2 | **Skill 发现** | metadata index 进 prompt + `skills_list` | 全 frontload metadata（host 层做） | 旗鼓相当 | skills-lifecycle §3 |
| 3 | **Skill 加载** | `skill_view` 真 progressive disclosure | host `Skill` tool（按需读 SKILL.md） | 旗鼓相当 | skills-lifecycle §3.3 |
| 4 | **Skill 沉淀触发** | 10 次 tool iter 后 background review agent | **互动驱动**（猫/铲屎官双向发起，事件触发） | Cat Café | skills-lifecycle §6 |
| 5 | **Skill 质量门禁** | 同模型 fork + prompt 自评 | 多主体 review + 对口猫 + CVO 拍板 | Cat Café | skills-lifecycle §10 |
| 6 | **Skill 过期/淘汰** | 手动禁用 + Hub hash update（不是 stale） | 缺口（F163 待补） | **都缺**，方向不同 | skills-lifecycle §8 |
| 7 | **Skill 安全扫描** | regex + trust + quarantine（成熟） | 无（skill 全手写） | Hermes（场景需要） | skills-lifecycle §7 |
| 8 | **Memory 抽象** | `IMemoryProvider`，**8 个真实 backend** 可插拔 | F102 IKnowledgeResolver 设计了，**只有 evidence.sqlite 一个实现** | Hermes | architecture-and-rl §3.2 |
| 9 | **Memory 内容** | session/skill/MEMORY.md/USER.md 平面 | docs/ + thread digest + provenance 分层 | Cat Café | F042 三层架构 |
| 10 | **Multi-agent 协作** | `delegate_task` 匿名子 agent，无身份 | 7+ 命名猫 + 跨族 review + multi-mention | Cat Café 碾压 | architecture-and-rl §4.2 |
| 11 | **RL/Eval** | Atropos environments（训用户 LLM，不回流） | F100 Eval Ledger（设计） + CI/quality gate | 不可比（目标不同） | architecture-and-rl §1 |
| 12 | **Gateway breadth** | 28 个 platform adapter（实际数） | 飞书 1 个为主 + Hub IM | Hermes | architecture-and-rl §2.1 |
| 13 | **Gateway depth** | 浅集成（消息收发 + session） | F088 飞书深集成（rich block / 投票 / PR tracking / multi-mention） | Cat Café | architecture-and-rl §2.2 |
| 14 | **Plugin 抽象** | `plugins/memory/`（真）+ `plugins/context_engine/`（**空目录**） | 无显式 plugin 框架 | 部分 Hermes | architecture-and-rl §3 |
| 15 | **Provider 切换** | 200+ 模型一键切换 + fallback + credential pool | 每只猫绑定特定模型（角色驱动） | Hermes（设计哲学不同） | AGENTS.md |
| 16 | **配置 profile** | `--profile minimal/dev/pm`（设计） | 无 profile 概念 | Hermes | hermes-cli docs |
| 17 | **跨平台触达** | 17+ 平台原生 | 飞书 + 自建 IM | Hermes | architecture-and-rl §2.1 |
| 18 | **部署灵活性** | local/docker/ssh/modal/daytona/singularity | 本地 Hub | Hermes | AGENTS.md |
| 19 | **真相源位置** | `~/.hermes/skills/` + `MEMORY.md` 等 | docs/ 是真相源，evidence.sqlite 是索引 | 哲学不同 | F102 ADR |
| 20 | **Knowledge 进化** | Prompt-driven extraction（任务后） | Interaction-driven sedimentation（互动副产品） | 哲学不同 | 上轮讨论 |

**关键观察**：Hermes 在 #7（安全扫描）、#8（Memory backend 可插拔）、#12/15-18（产品化覆盖面）赢；Cat Café 在 #4/5/9/10/13/19/20（治理深度 + 协作深度 + 互动哲学）赢。**没有一个维度是"两边一样"——这反而说明它们是设计哲学的对立**，不是同类竞品。

---

## 二、算法层面横扫（铲屎官特别要求）

> 砚砚 skills-lifecycle.md §9 已列了 skill 系统的算法清单。本节扩展到 **Hermes 全系统**，把"真算法 vs LLM judge vs 启发式 vs 规则"分清楚，并和 Cat Café 对应能力对照。

### 2.1 Hermes 的"算法"全清单

| # | 机制 | 输入 | 输出 | 类型 | 真算法？ |
|---|------|------|------|------|---------|
| A1 | Atropos GRPO/PPO | rollout reward signal | model weight update | **真 RL 算法** | ✅（在 atroposlib，外部包） |
| A2 | Tool call parser（hermes/mistral/llama3/qwen） | raw model text | structured tool_calls | **regex 状态机** | ✅（标准化解析） |
| A3 | VLLM ManagedServer logprob extraction | model output | token IDs + logprobs | **概率模型** | ✅（来自 VLLM） |
| A4 | Skill content_hash | bundle bytes | sha256 hash | **加密哈希** | ✅（标准） |
| A5 | Background review trigger | `_iters_since_skill >= 10` | bool | **阈值规则** | ⚠️ 阈值不是算法 |
| A6 | `_SKILL_REVIEW_PROMPT` LLM judge | conversation + skill index | 提议 patch/create/nothing | **LLM 判断** | ❌ 不是算法 |
| A7 | `skills_list` 排序 | category + name | 字母序 | **比较函数** | ❌ |
| A8 | Skill platform 匹配 | frontmatter platforms vs sys.platform | bool | **字符串前缀** | ❌ |
| A9 | Hub multi-source search | query + source-specific text match | ranked results | **启发式检索** | ⚠️ 部分 |
| A10 | Skills guard regex/unicode 扫描 | skill content | safe/caution/dangerous | **静态规则** | ⚠️ 启发式 |
| A11 | Insights tool call 统计 | session.db 历史 | usage report | **聚合查询** | ❌ |
| A12 | bundled skill sync hash diff | origin hash + bundled hash + user hash | copy/update/skip | **三向 hash diff** | ⚠️ 工程算法 |
| A13 | Prompt snapshot cache | mtime + size manifest | reuse vs rebuild | **缓存失效** | ⚠️ |
| A14 | Context compression | history token count | compressed summary | **LLM-based** | ❌ 不是算法 |
| A15 | `delegate_task` subagent | parent task | up to 3 子 agent | **简单分发** | ❌ |
| A16 | Credential pool | provider state | token rotation | **状态机** | ⚠️ |

**结论**：

- **A1 是唯一的"真" ML 算法**（GRPO/PPO），但它在 atroposlib 外部包里，且**不回流到 Hermes runtime**（见 architecture-and-rl §1.3）。
- **A2-A4** 是工程算法（解析/哈希/概率），不是 Hermes 原创创新。
- **A5-A16 几乎全是 prompt + 规则 + 启发式**，包装成"self-improving"的核心机制——A5（10 次 iter 阈值）+ A6（LLM judge）——本质上是**用 LLM 替代算法**。
- **如果 PPT 说"算法标记过期 / skill 自动进化"，对应到代码里能指向的算法**：⚠️ 没有。

### 2.2 Cat Café 的对应"算法"清单

| # | 机制 | 类型 | 状态 |
|---|------|------|------|
| B1 | evidence.sqlite **BM25 + 向量 NN + RRF 融合** | **真 IR 算法** | ✅ 已实现 |
| B2 | Knowledge Feed 30min 自动摘要 | LLM-based | ✅ 已实现 |
| B3 | Session chain digest | LLM + truncation | ✅ 已实现 |
| B4 | F100 五级成熟度晋升门禁 | **状态机 + 多主体决策** | 🔄 设计中 |
| B5 | F102 IKnowledgeResolver 联邦检索 | **路由 + 融合** | 🔄 设计中（实现单 backend） |
| B6 | F152 expedition memory provenance tier | 分层模型 | 🔄 设计中 |
| B7 | F163 知识 lifecycle（stale 复核） | **时间触发审查** | 📋 待立项 |
| B8 | F167 意图分类（NoClassifier 原则） | **不用 classifier，给数据不给结论** | ✅ 已实现 |
| B9 | F178 Provider credential merge | 配置层 | ✅ 已实现 |

**关键对照**：
- Cat Café 的 **B1（hybrid 检索）** 比 Hermes 的 **A11（聚合查询）+ A9（启发式 search）** 在 IR 算法上**领先一个层级**。
- Cat Café 缺的是 **A1 类的训练算法**——但我们不训模型，这是设计选择不是缺口。
- Cat Café 还缺 **A4 类的内容 hash + 安全扫描**（如果要开放外部 skill）。

### 2.3 算法层面的总判决

**Hermes 的"算法"主要是工程算法（hash/parser/cache）+ LLM judge（review/compress/route）**。它没有原创的 ML 算法用于 skill 进化或质量评分。

**Cat Café 的"算法"主要是 IR 算法（hybrid retrieval）+ 知识工程状态机（F100 阶梯/F163 lifecycle）**。我们的强项是**检索 + 治理**，不是模型训练。

如果定义"算法 = 把输入转成输出的可重现规则"，两边都有；如果定义"算法 = ML 训练 / 优化"，那 Hermes 也只是把 atroposlib 接进来，不是自己发明。

---

## 三、我们的 tradeoff（不 follow 的合理理由）

> 铲屎官原话："什么是我们 tradeoff 导致的不 follow"——这一节专门论证。

| 不做的事 | 表面看起来 | 真实理由 | 哲学根据 |
|---------|-----------|---------|---------|
| **不做 RL training pipeline / Atropos** | 我们落后 | 我们**不训模型**——价值在协作工作流而非模型权重；现成 frontier model 已足够 | "Skill 是互动副产品" |
| **不做 17 平台 breadth** | 覆盖面不如人 | 团队场景**深度 > 广度**；F088 飞书深集成（rich block/投票/PR tracking）一个平台够用 | F088 vision |
| **不做大量 skill 横扫** | skill 数量少 | **互动驱动沉淀**——skill 是从 thread 长出来的晶体，不是预先囤积的库 | F100 阶梯 |
| **不做 200+ 模型一键切换** | 灵活性弱 | **角色驱动**——每只猫绑定最适合的模型（砚砚=GPT-5.5, 烁烁=Gemini, 宪宪=Claude），不追求"用最便宜的" | cat-config.json |
| **不做 single agent monolith** | 没有大杀器 | 多猫协作 = peer review + 不同视角 + CVO 拍板，是评价主体分层 | shared-rules Rule 0 |
| **不做 plugin context_engine** | 缺架构层 | 我们的真相源是 docs，不需要 pluggable engine——直接读 docs/ + thread | F042 三层 |
| **不做 background review 自动写入 active** | UX 不顺滑 | "skill 是互动副产品"——只能进 candidate queue，过门禁才 active | 上轮讨论结论 |
| **不做 reward = exit_code 通用进化** | 客观信号不足 | 客观任务可以这么做（CI/test）；开放任务必须人/猫判断——这是**评价分类法**问题，不是工具问题 | 上轮讨论 |

**Tradeoff 总判决**：我们 8 件不做的事里，**6 件是哲学选择**（不是资源限制），**2 件是真缺口**（plugin context_engine 我们的对应 F102 也缺多 backend；background review UX 顺滑度）。

---

## 四、要追的（明确缺口 + 路径）

> 这一节回答 "Cat Café 真正应该补的"，每条标明对应到现有 feature/spec 的位置。

| # | 缺口 | 优先级 | 接到哪里 | 工作量估计 |
|---|------|-------|---------|----------|
| **G1** | Memory backend 可插拔（多 provider） | **P0** | F102 IKnowledgeResolver + 新增 IMemoryProvider 接口 | 2-3 周 |
| **G2** | 动态 skill discovery（lazy loading）| **P0** | F038 已设计（按需发现机制），结合社区 #44536 SkillSearch 趋势 | 等 host 出方案，否则 1-2 周自家做 |
| **G3** | Skill provenance frontmatter 标准化 | **P0** | cat-cafe-skills/ 全部 SKILL.md 加字段（when_thread_intent / origin_thread / cvo_approved / last_validated） | 0.5-1 周（前向兼容） |
| **G4** | Background review UX（写入 candidate） | P1 | 接到 F100 Mode C + Knowledge Feed | 2 周 |
| **G5** | Skill Hub intake 安全扫描（regex + trust）| P1 | 等真要开放外部 skill 时再做 | 1 周 |
| **G6** | F163 stale lifecycle 实施（时间触发审查）| P1 | F163 立项 → 实施 | 2-3 周 |
| **G7** | Eval Ledger 实施（F100 设计已有）| P2 | F100 Mode C 落地 | 3-4 周 |
| **G8** | Skill 多变体并存（不追求"更好"，追求 variant 库）| P2 | 配合 F100，开放任务专用 | 2 周 |

**P0 三件套（G1+G2+G3）的特殊关系**：
- G3 是 **risk-free 投资**（前向兼容，立刻能做）
- G1 + G2 都需要 G3 的字段才能体现价值
- 所以**实操顺序**应该是：G3 先做（标准化）→ G1 做（多 backend，让 IKnowledgeResolver 真正成立）→ G2 等 host 信号或我们独立做

---

## 五、不追的（要明确说"我们不做"，避免每次纠结）

> 这一节是给未来铲屎官/猫看到 PPT 时的**心理免疫**——下面这些 Hermes 有但我们不追，理由已经讲清，不要每次重新讨论。

1. **不做 RL training pipeline / Atropos environments** —— 不训模型
2. **不做 17 平台 messaging gateway** —— 押飞书深集成
3. **不做单 agent self-evaluating loop** —— 多猫协作哲学
4. **不做 plugin context_engine 框架** —— 真相源在 docs
5. **不做 200+ 模型一键切换** —— 角色驱动
6. **不做 reward = exit_code 通用进化** —— 评价分类法问题不是工具问题
7. **不做 hash update = stale** —— 上游更新和知识失效是两类问题
8. **不做架构图里画进去但代码空目录** —— 我们写在文档里 = 已经实现
9. **不学单体 monolithic 大主循环** —— 我们的可审计性需要分层
10. **不学"non-trivial reusable workflow"作为充分标准** —— 触发词不是质量标准

---

## 六、给最终 skill draft 的输入（合流方法论）

> 砚砚 skills-lifecycle §12 提了 4 个检查项，我 architecture-and-rl §6 提了 3 个。这一节合并 + 扩展为 **8 条"拆解明星开源项目" SOP**，给 [open-source-project-teardown-skill-draft.md](./open-source-project-teardown-skill-draft.md)（待写）作输入。

| # | 检查项 | 来源 | 实操命令/方法 |
|---|------|------|-------------|
| 1 | **空目录探测法** | 我 §6.1 | `find . -type d -empty` —— PPT 提到的"模块"如果目录空 = vaporware |
| 2 | **反馈链路验证法** | 我 §6.2 | grep training/eval 目录里有没有引用 runtime state（skill/memory/prompt）；零命中 = 不构成自我进化 |
| 3 | **Reward 形态决定能力边界** | 我 §6.3 | 看 `compute_reward`：binary/exit_code → 客观任务限定；多维 score → 通用 |
| 4 | **状态突变点追踪法** | 砚砚 §12.1 | 找哪些函数真的写入 runtime state；只读分析 + 写操作分析分两轮 |
| 5 | **反馈链闭环验证法** | 砚砚 §12.2 | 画 `signal → decision → state mutation → future behavior`；断一环不能叫闭环 |
| 6 | **算法剥皮表** | 砚砚 §12.3 + 本文 §2 | 强制分栏：真算法 / LLM judge / 启发式 / 规则 / 外部服务；不允许混写 |
| 7 | **只读 telemetry 识别法** | 砚砚 §12.4 | `last_used_at` / dashboard 不等于 lifecycle；必须看是否被 discovery/ranking/stale 消费 |
| 8 | **Tradeoff 论证法** | 本文 §3 | 我们不做的每件事必须能写出"哲学根据"——不能只说"没做"，要说"为什么不做" |

这 8 条建议固化成 SOP 写进 skill draft。

---

## 七、本文未做的（留给 skill draft）

- 没写**完整的 SOP 操作指南**（Step 1: 拉代码 / Step 2: ...）
- 没写**可执行的检查脚本**（如自动化 grep / find -empty）
- 没写**报告模板**（拆解产出物的目录结构）
- 没**多次反向验证**这 8 条 SOP——理论上它们对 Hermes 适用，但需要拆下一个明星项目（比如 Codex CLI 或 Letta）做对照验证

这些都是 [open-source-project-teardown-skill-draft.md](./open-source-project-teardown-skill-draft.md) 的范围。

---

## 八、状态

- 本文用 `architecture-and-rl.md` 和 `skills-lifecycle.md` 两份证据合流而成，**未引入新代码读取**
- 全景表 §1 的 20 个维度都有证据出处（companion docs 章节号）
- 算法清单 §2 的 16 + 9 项基于**两份 companion docs 的证据 + AGENTS.md 描述**，未做超出已有证据的判断
- 本文是**第三轮文档**，距离最终 skill draft 只差最后一刀（SOP 落地）

[宪宪/Opus-47🐾]
