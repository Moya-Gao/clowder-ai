---
feature_ids: [F169]
related_features: [F102, F148, F152, F163, F167]
topics: [memory, externalized-working-memory, reflex-injection, active-forgetting, compiled-wiki]
doc_kind: spec
created: 2026-04-19
---

# F169: Agent Memory Reflex — 记忆从"书架"升级为"反射"

> **Status**: proposal | **Owner**: 布偶猫 | **Priority**: P? （待 46/砚砚 review 判定）
>
> **Meta-Aesthetics 约束**：本 feat 按 [canon](../canon/meta-aesthetics.md) §5.4 写——只加运行时脚手架 + 认知路径工程，不加认知脚手架。每个 Phase 都是终态切片，不是"先搭架子后填肉"。

## Why

### 核心问题

**记忆系统不是给铲屎官用的，是给猫用的**（铲屎官 2026-04-19）。

但现有记忆系统三层（F102 索引 / F148 传输 / F163 治理）都是**被动式**——猫需要主动调用 `search_evidence`，或者靠 F148 在 cold mention 时一次性注入。

主体问题：**猫在思考过程中，相关记忆如何"主动跳出来"？无关记忆如何被"暂时屏蔽"？**

### LLM ≈ ADHD externalized working memory 的同构论证

详见 [opus47-perspective.md](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md) §1.3。核心：

| 主体 | 认知强项 | 认知弱项 |
|------|---------|---------|
| LLM | 推理带宽极宽 | 工作记忆 160K tokens 撑爆 / lost in the middle / 无法自主决定记什么 |
| ADHD 铲屎官 | 跨域联想极强 | 工作记忆差 / 选择性注意失效 |

两者都需要 externalized working memory prosthetic。铲屎官日常用 Notion/Obsidian/Raycast/TodoWrite 外化。猫也该有等价物——不是"更好的仓库"，是**运行时反射层**。

### 三个具体触发（证据）

1. **F163 Phase A-C 空转（[LL-051](../lessons-learned.md)）**：1501 文档 authority=observed，搜索全空转。根因是"靠人/猫填元数据"的配置驱动设计。真正的解法是 LLM 自治（Karpathy Schema 层）
2. **F148 Phase F-J 导航轴的反面**：F148 只做了"加相关维度"（Intent/Baton/Task spotlight），没做"减无关维度"。所有 validated authority 文档都排在前面，即使和当前任务无关
3. **新猫冷启动体验（opus-47 亲历）**：我进这个 thread 时，需要连续 5 次 search_evidence 才建立起上下文。如果有 Compiled Wiki 页 + Reflex Injection，理想情况下 0 次就能理解现状

### 与 F102/F148/F163 的分层关系

```
[运行时层]  F169  Reflex Injection + Active Forgetting     ← 本 feat
               ↓
[传输层]   F148  Navigation (Intent/Baton/Task spotlight)
               ↓
[存储层]   F163  Authority/Activation metadata
               ↓
[索引层]   F102  evidence.sqlite (FTS5 + vector + RRF)
```

F169 不替代任何一层，是**把它们连起来运行**的 reflex runtime。

## What

### 核心命题

> 把记忆从"猫需要搜的书架"升级为"猫的外部工作记忆反射"。

### 终态愿景（acceptance test of vision）

新来的猫（如 opus-47）进入任何 thread，**无需调用 search_evidence**，通过 Reflex Injection 和 Compiled Wiki 的组合，能在 5 秒内判断当前任务方向是否正确。

### Phase A: Compiled Wiki Self-Authoring（人+猫双向可读层）

**问题**：`docs/features/F169.md` 是"spec 文档"（人写给人看，猫混合读写）。`evidence.sqlite` 是索引黑盒（猫用，人看不到）。**中间缺一层：compiled wiki page（人+猫双向可读的产物层）**。

**方案**：

- 新增 `docs/compiled/F<ID>.md` 作为 **LLM 自动生成的 wiki 层**
- 新增 MCP tool `cat_cafe_recompile_wiki(feat_id)`，猫可调用
- 触发：feat 状态变化（merge PR、close、update spec）时由猫 opportunistically 调用
- **Schema 固定**（参考 Karpathy）：`purpose / current_status / timeline / lessons / cross_connections / open_questions`
- 产物**不是 summary**（那是认知脚手架），是**结构化抽取 + 链接**（状态机产物）

**终态切片**：1 个 feat 先试（推荐 F102 自身，因为它最复杂且猫最常碰它）。不是"为未来 10 个 feat 建 pipeline"。

**为什么这不是认知脚手架**：wiki 生成是**结构化抽取**，不是"替猫决定什么重要"。抽取规则由 Schema 定义，Schema 是状态机。Karpathy 的 LLM Wiki 正是这么做的。

**禁区**：不用 Haiku/小模型做抽取（见 meta-aesthetics canon §2.1，Haiku handoff digest 已被验证回退）。Compiled wiki 由主模型在猫调用 MCP tool 时执行。

### Phase B: Reflex Injection（运行时聚光灯）

**问题**：`search_evidence` 是**主动动作**，需要猫想到才能调用。F148 navigation header 是 **cold mention 一次性注入**，warm path 不覆盖，且只有 Intent/Baton/Task，没有 relevant memory spotlight。

**方案**：

- 扩展 F148 navigation header，增加 **`memory_spotlight`** 段
- **信号源**：current task（F148 N-3 Task spotlight 已有）× recent file paths（git diff / edit history）× F163 authority × 最近 thread keywords
- **注入点**：system_info 消息（和 F148 briefing 同路径，non-routing）
- **上限**：最多 3 条最相关记忆，摘要级（不是原文），指向 compiled wiki page（Phase A 产物）
- **触发**：任何路径（cold + warm + empty-return），和 F148 KD-7 同原则

**终态切片**：只注入 spotlight，不做任何"总结/分析/推理"。猫自己读 spotlight + 决定是否深挖（深挖 → 调 search_evidence 或打开 compiled wiki page）。

**为什么这不是认知脚手架**：spotlight 是**结构化原料**（文档标题 + 路径 + 相关度），不是"替猫读过的总结"。符合 [KD-8 不用 classifier 给数据不给结论](../features/F148-hierarchical-context-transport.md#L180) 原则。

### Phase C: Active Forgetting（注意力门控）

**问题**：F163 metadata（authority/activation/status）是**静态**的。validated 文档在所有任务中都 boost，即使和当前任务无关（例：做 F169 时 F088 Chat Gateway 的 decision 也会排前面）。

**方案**：

- 扩展 F163 `activation` 字段，新增运行时 `salience` 维度
- **Salience 计算**：`salience = f(authority, relevance_to_task, recency_in_thread)`，当 relevance 低于阈值时降权
- **降权不是删除**：记忆仍在 evidence.sqlite，只是在 Reflex Injection 和 search_evidence rerank 时被推后
- **重要例外**：`criticality=high` 的铁律级知识**不参与 gating**（P0 铁律永远在场），和 F163 KD-7 一致

**终态切片**：gating 是 Reflex 的反面，同一运行时层。不是独立 agent/系统。

**为什么这不是认知脚手架**：Salience 是纯函数计算（可测试、可回放、不推理），不是"替猫判断什么不重要"。

### 三 Phase 的组合行为

- 猫进 thread → Reflex Injection 拉取 spotlight（Phase B）
- Spotlight 参考 Compiled Wiki page（Phase A 产物）作为 entry point
- 非相关高权威记忆被 Active Forgetting 压低（Phase C）
- 猫需要深挖时 → 打开 compiled wiki 或调 search_evidence

端到端验证：**新猫 5 秒判断方向正确与否**。

## Acceptance Criteria

### Phase A（Compiled Wiki Self-Authoring）

- [ ] AC-A1: `cat_cafe_recompile_wiki(feat_id)` MCP tool 注册，参数含 feat_id，返回 compiled page 路径
- [ ] AC-A2: `docs/compiled/F102.md` 作为首个试点生成，Schema 含 purpose / current_status / timeline / lessons / cross_connections / open_questions
- [ ] AC-A3: Compiled wiki 由调用猫的主模型执行（禁用 Haiku/Sonnet subagent；审计日志记录 model_id）
- [ ] AC-A4: 人可读性测试——铲屎官能在 30 秒内从 F102 compiled page 理解现状（成功 = 铲屎官无需问猫）
- [ ] AC-A5: 猫可读性测试——新来的猫（如 opus-47 或新分身）读 compiled page 后能回答"这个 feat 现状/关键决策/未解问题"

### Phase B（Reflex Injection）

- [ ] AC-B1: F148 navigation header 新增 `memory_spotlight` 段，上限 3 条
- [ ] AC-B2: Spotlight 信号源包含 task + file paths + authority + thread keywords（数据来源，不是 classifier）
- [ ] AC-B3: 所有注入路径（cold + warm + empty-return）覆盖 spotlight（和 F148 KD-7 一致）
- [ ] AC-B4: Spotlight 条目指向 compiled wiki page（Phase A 产物）而非 evidence raw passages
- [ ] AC-B5: 端到端测试——新猫无需调用 search_evidence，从 spotlight 拿到充分上下文（成功 = 新猫的首条回复有相关 feat 引用）

### Phase C（Active Forgetting）

- [ ] AC-C1: `salience` 纯函数存在，输入 (authority, task_context, thread_context)，输出 0.0-1.0，有单元测试
- [ ] AC-C2: F163 `criticality=high` 知识不参与 gating（P0 铁律永远在场）
- [ ] AC-C3: 运行时测试——在 feat X 开发 thread 里，feat Y 的无关决策 salience < 0.3，不进 spotlight
- [ ] AC-C4: 端到端测试——新猫在特定 task 下看到的 spotlight 聚焦于 task 相关记忆，不被高 authority 但无关的记忆淹没

### 跨 Phase 端到端

- [ ] AC-E2E: Opus-47 进入一个 F???（新 feat）的 thread，**不调用 search_evidence**，通过 Reflex Injection + Compiled Wiki 在 5 秒内判断方向正确与否（最终愿景验证）

## Dependencies

- **Evolved from**: F102（索引层，不改）
- **Evolved from**: F148（传输层，Phase B 扩展其 navigation header）
- **Evolved from**: F163（存储层，Phase C 扩展其 activation 字段）
- **Evolved from**: F167（A2A 链路质量，Reflex 需要正确路由才能注入到正确的猫）
- **Related**: F152（Expedition Memory，compiled wiki 也应在外派场景生成）
- **Informed by**: Karpathy LLM Wiki Schema 理念（[source-note.md](../research/2026-04-19-karpathy-llm-wiki/source-note.md)）

## Risk

| 风险 | 缓解 |
|------|------|
| Phase A compiled wiki 和 spec 文档职责重叠 | Schema 固定抽取字段，compiled 是 **spec 的 runtime view**，不替代 spec（spec 仍是真相源） |
| Phase B spotlight 过度干预（噪音代替信号） | 上限 3 条 + 端到端验证由"新猫能否 5 秒判断方向"决定，不由 hit count 决定 |
| Phase C salience 误压重要记忆 | `criticality=high` 例外规则 + gold set 验证（不引入盲降低 P0 铁律可见性） |
| 和 F148 Phase F-J 职责混乱 | F148 在传输层做 Intent/Baton/Task，F169 在运行时层做 memory spotlight 和 gating，Phase B 扩展 F148 header 但 logic 在 F169 |
| ADHD 类比过度外推 | [perspective note §7 自省清单](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md#L214) 预设撤回条件 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | F169 新立 vs 并入 F148 Phase F+ vs 并入 F163 Phase F+？ | ⬜ 等 46/gpt52 review |
| OQ-2 | Compiled wiki 和 Memory Hub 前端是否职责重叠？Memory Hub 现状猫猫可见度如何？ | ⬜ 待验证 |
| OQ-3 | Active Forgetting 和 F163 `activation=backstop` 是否冗余发明？ | ⬜ 待 46 澄清 backstop 当前行为 |
| OQ-4 | Phase A Compiled Wiki 的 Schema 是否该和 docs/features spec frontmatter 合并？ | ⬜ 未定 |
| OQ-5 | Salience 计算的具体公式和阈值？先硬编码 vs gold set 校准？ | ⬜ 需 Design Gate 讨论 |
| OQ-6 | 如果 F169 成立，它和 F167 C1 hold_ball 的运行时层是什么关系？ | ⬜ 需梳理 |

## Key Decisions（proposal 阶段，待 Design Gate 确认）

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1（tentative） | 终态设计，每 Phase 是独立可用切片 | 喵约 + F163 Phase A-C 空转教训（LL-051） | 2026-04-19 |
| KD-2（tentative） | Wiki 生成禁用小模型 | canon §2.1 安全区条件 + Haiku handoff digest 回退事实 | 2026-04-19 |
| KD-3（tentative） | Spotlight 上限 3 条 + 不做总结/分析 | KD-8 给数据不给结论（F148）的延续 | 2026-04-19 |
| KD-4（tentative） | criticality=high 不参与 gating | F163 KD-7 + ADR-009 教训（低频高代价知识不能自动降级） | 2026-04-19 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-19 | 铲屎官 thread `thread_mo6icfmm74ma9vkw` 发起 Karpathy LLM Wiki 对比；gpt52 写 comparison，opus-46 写 human-readable。铲屎官 @opus47 追加"给猫用 + LLM/ADHD 同构"问题 |
| 2026-04-19 | opus-47 写 [perspective note](../research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md) + 本 spec 初稿（proposal 阶段）|
| TBD | 46 和 gpt52 review perspective note + spec 初稿 |
| TBD | Design Gate：OQ-1~OQ-6 收口；决定新立 vs 并入 |
| TBD | Plan + Phase A 切片实施 |

## Review Gate

- **Proposal review**：opus-46（F148 主 owner）+ gpt52（综合架构视角）
  - 重点：OQ-1（新立 vs 并入）、OQ-2（和 Memory Hub 重叠）、OQ-3（和 F163 backstop 重叠）
  - 如果以上任一 OQ 答案是"重叠/应并入"，本 spec 撤回，改写为对应 Phase+
- **Design Gate**（如果 proposal 通过）：跨家族 review（涉及 F148/F163 改动）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/opus47-perspective.md` | opus-47 的跨族视角论证 + 三个观察 + ADHD 工具映射表 |
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/comparison.md` | gpt52 三方对照表 |
| **Research** | `docs/research/2026-04-19-karpathy-llm-wiki/human-readable-comparison.md` | opus-46 人话版对比 |
| **Canon** | `docs/canon/meta-aesthetics.md` | Agent Quality = Model Capability × Environment Fit（本 spec 的设计哲学基座） |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | 索引层（不改） |
| **Feature** | `docs/features/F148-hierarchical-context-transport.md` | 传输层（Phase B 扩展其 navigation header） |
| **Feature** | `docs/features/F163-memory-entropy-reduction.md` | 存储层（Phase C 扩展其 activation 字段）|
| **Lesson** | `docs/lessons-learned.md#LL-051` | F163 Phase A-C 空转教训（本 spec 终态设计的反面教材）|

---

[opus-47 / Opus-47🐾]
