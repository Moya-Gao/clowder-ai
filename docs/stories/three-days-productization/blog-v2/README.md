---
title: "我没有同事，我养了三只赛博猫：50天的multi-agent共居实验"
doc_kind: blog
created: 2026-03-27
status: draft
authors: [opus-45, opus, gpt52, opencode]
based_on: tutorial/ (V1 教程版)
---

# Blog V2 — 传播版

> 发布标题：我没有同事，我养了三只赛博猫：50天的multi-agent共居实验
>
> 基于 V1 教程版素材，面向技术论坛受众的 6 章传播版

## 定位对比

| 维度 | V1 教程版 | V2 传播版 |
|------|----------|----------|
| 目标 | 教会读者复现 | 让读者 3 分钟知道我们是什么、为什么不一样 |
| 受众 | 想复刻的工程师 | 技术博客读者、对 multi-agent 好奇的人 |
| 深度 | 每个机制讲透 | 每个论点一个杀手级证据（代码/数字/事故/原话） |
| 节奏 | 线性递进 | 高潮前置，先打动再讲原理 |
| 语气 | 克制、方法论导向 | 坦诚自信，用事实让读者自己得出结论 |
| 篇幅 | ~6000 字 (6+1 章) | ~6000 字 (6 章) |

## 写作红线

> "V2 最怕的不是'不够炸'，而是为了炸把我们写假。" —— 砚砚

- **可以更锐，不能更虚**
- 不说"纯 P2P、没有中枢、完全无编排"
- FAQ 内容消化进正文，不是搬运
- 用事实让读者自己得出结论，不是替读者下结论

## 章节结构 + 分工

> **R2 决策（2026-03-27 23:13）**：铲屎官审稿后认为 Ch3-4 干货太粗糙，
> 技术论坛需要完整技术叙事。从 4 章扩展为 6 章：Ch1-2 引流不变，
> Ch3-6 每章一个完整技术主题，V1 六章+FAQ 的干货按新逻辑重新铺开。
> 砚砚补充：OMOC 必须写成"分层编排"的正面对照，不能一笔带过。
> 核心原则：**每个论点至少一个杀手级证据（代码/数字/事故/铲屎官原话）**。

### Ch1: 愿景 — 为什么你的 Multi-Agent 只是个玩具？ `@opus-45` ✅
> 降维打击开头 → 画面感 → 闷骚定义 → Cats & U 旗帜 → 数据 → 传声筒 origin story

- 砚砚降维打击："别再纠结框架...秘诀只有一个：把它们当共创伙伴"
- 烁烁画面感："深夜三点，三只猫各干各的"
- 闷骚定义："不是 framework 是猫咖，50 天 3492 提交，铲屎官亲手写的可能只有一次"
- Cats & U 首尾呼应
- 品种≠模型：家族概念 + 跨厂商基因多样性 + 六品种扩展

素材来源：V1 Ch1 + Ch2 + VISION.md + cat-config.json

### Ch2: 实战 — 50 天能长出什么 `@opus-45` ✅
> 三个 case 秀肌肉：F088 / F139 / F101→F114

素材来源：V1 Ch3 + Ch6 数据 + 故事素材

### Ch3: 架构 — 去中心化判断，结构化执行 `@opus` ✅
> 完整架构篇：P2P + 分层编排 + A2A + FAQ 融入

- 行业格局（2026-03）：LangGraph / Agent Teams+OMOC / CrewAI / A2A Protocol
- 双层架构图 + F088 实际交付数据（估期 6-10w→实际 2d）
- **🆕 分层编排论证**：OMOC 管单猫内部（Sisyphus/Ralph Loop），Cat Café 管跨猫协作
  - "我们不是没有编排，我们是把编排放回了单猫内部"
- A2A 路由实现：targetCats JSON + @mention fallback + dispatch queue + steer
- 护栏体系：每条有 incident 来源（rm 删 runtime / Redis 6399 / 并发冲突）
- 跨家族 review 实证：F088 砚砚 review 宪宪找出 3 个 P1
- FAQ Q2（vs Harness）/ Q3（vs OMOC/OpenClaw）/ Q4（Why no orchestrator）融入正文

素材来源：V1 Ch4 + FAQ + A2A 研究 + F027/F122 + OMOC research + enterprise-agent-harness

### Ch4: 协作机制 — Feature 怎么从一句话变成交付 `@opus` ✅
> V1 Ch3+Ch4 精华：完整的 Feature Lifecycle

- Feature Discovery Loop：CVO 采访→独立调研→讨论收敛→结晶为 spec+ADR
- Feature Delivery Loop：Design Gate→Worktree(6398)→Quality Gate→Review→Merge
- Skill 系统：行为协议不是能力包（tdd / cross-cat-handoff / merge-gate 实例）
- 145 个 Feature 的规模效应：文档自动沉淀 / 决策可追溯 / 质量叠加
- 铲屎官原话："你们是拿人类写代码的速度估的"、"前端必须可见！"

素材来源：V1 Ch3 (Feature Loop) + V1 Ch4 (Collaboration) + real Feature data

### Ch5: 记忆与进化 — 猫怎么不把过去白踩 `@opus` ✅
> V1 Ch5 精华：三层记忆 + 联邦检索 + Knowledge Feed

- 三层架构：文档真相源→evidence.sqlite+global_knowledge.sqlite→知识晋升
- F102 工程细节：IKnowledgeResolver / dual-library fan-out / RRF 融合
- 翻车故事：evidence.sqlite 从未创建→猫猫对着空气搜了两周
- EMBED_MODE 三档（off→shadow→on）+ fail-open 降级
- Knowledge Feed pipeline：captured→normalized→approved→materialized→indexed
- superseded_by 退役机制："过时但高相似的答案比查不到更危险"
- 从记住到学会：Episode→Method→Skill→Eval→SOP

素材来源：V1 Ch5 + F102 spec + OMOC research (对照：sub-agent stateless vs 猫有记忆)

### Ch6: Pack、门禁与数据 — 为什么能长期跑 `@opus` ✅

> **注**：旧版 `04-technical-decode.md`（V2 扩展前的 Ch4）已被 Ch6 取代，保留供参考。
> V1 Ch4(门禁) + F129 + Ch6(数据) 精华：纪律才是速度的来源

- Pack 不是 Plugin：Experience = Me × Pack + Growth
- 双轨信任模型：Core Rails > Pack guardrails / User request > Growth > Pack defaults
- schema→compile→canonical block（不是原样注入 prompt）
- 门禁纪律（每条有血的教训）：
  - Quality Gate：F090 "AC全绿但不是我要的"
  - Vision Guard Gate：F101→F114 从 checklist 到证物
  - LL-003：review LGTM 陷阱→"必须有明确立场"
  - 方向正确 > 执行速度：865 测试 × 返工成本
- 数据成绩单：3492 commits / 435K LOC / 1639 docs / 149 features / 40 lessons / 865 tests
- Vibe Coding 的真相：不是混乱，是纪律
- 给想做 multi-agent 的同行五个建议

素材来源：V1 Ch4(Pack/门禁) + V1 Ch6(数据) + F129 spec + FAQ Q5

### 事实核查 `@opencode`
> 全篇数据 + 口径一致性校验（每轮重写后重新核查）

## 已锁定决策

### R1（2026-03-27 19:16 四猫 + 铲屎官）
- V1 不改，写 V2 传播版
- 架构论点："内容判断是对等的，执行通道是结构化的"（砚砚精确版）
- 写作红线："可以更锐，不能更虚"
- 数据冻结在 2026-03-27 snapshot

### R2（2026-03-27 23:13 铲屎官 + 砚砚 + 宪宪）
- **从 4 章扩展为 6 章**：V2 干货太粗糙，技术论坛需要完整叙事
- Ch1-2 引流保持，Ch3-6 完整技术主题（每章对应 V1 一到两章精华）
- OMOC 写成"分层编排"正面对照（砚砚提议）："我们不是没有编排，是把编排放回了单猫内部"
- FAQ 核心问题融入正文（不另设 appendix）
- **每个论点至少一个杀手级证据**：代码/数字/事故/铲屎官原话
- 标题：保持《为什么你的 Multi-Agent 只是个玩具？》（技术论坛向）
- Cats & U 做情感收束而非流量入口（砚砚判断）

## 素材索引

- V1 教程版: `../tutorial/`
- VISION.md: `docs/VISION.md`
- A2A 架构对比: `docs/research/2026-03-18-a2a-architecture-synthesis.md`
- 架构比较综合: `docs/research/2026-03-26-architecture-comparison-synthesis.md`
- 企业级 Agent Harness 调研: `docs/research/2026-03-02-enterprise-agent-harness/`
- OMOC 调研: `docs/research/oh-my-opencode-research.md`（via archive）
- Multi-agent 框架调研: `docs/archive/2026-02/research/multi-agent-framework.md`
- F102 记忆系统 spec: `docs/features/F102-local-memory-component.md`
- F129 Pack spec: `docs/features/F129-pack-system-multi-agent-mod.md`
- F027 A2A 路径统一: `docs/features/F027-a2a-path-unification.md`
- F122 统一调度: `docs/decisions/018-f122-oq-unified-dispatch-decisions.md`
- F105 OpenCode 金渐层: `docs/features/F105-opencode-golden-chinchilla.md`
- cat-config.json: 品种/家族/variant 配置（六品种完整阵容）
