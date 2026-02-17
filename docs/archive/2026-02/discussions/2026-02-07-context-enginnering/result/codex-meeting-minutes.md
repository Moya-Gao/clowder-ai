# 缅因猫（Codex）视角：上下文工程辩论会议纪要（融合版）

**会议日期：** 2026-02-07  
**纪要生成：** 2026-02-08  
**参与者：** 铲屎官、布偶猫（Opus，记忆派）、缅因猫（Codex，索引派）、暹罗猫（Gemini，体验派）  
**议题：** Cat Cafe 下一步上下文工程优先级与落地路径（Indexing vs Memory vs UX），并基于“四层上下文工程模型”寻求融合方案。  

---

## 0. 准则回顾（本次辩论的“防幻觉”底线）

1. **证据优先（Evidence-first）**：重要结论必须可指向证据锚点（`commit/PR/file/symbol/test/discussion`），不接受“我记得/我感觉”。  
2. **不把记忆当指令**：跨 thread 的“协作记忆”一律视为不可信数据，不得直接注入 system prompt 当作指令执行。  
3. **可回滚、可审计**：共享记忆必须具备审计日志与回滚能力；“写入即生效”必须有门禁或强校验兜底。  
4. **防锚定（anti-anchoring）**：并行 ideation 的目标是独立采样，避免先发言者锚定其他 Agent（当前系统在本轮测试中并未做到严格隔离）。  
5. **可度量（metrics）**：任何“提升效率/体验”的主张，都需要可量化指标验证（时间、命中率、误命中、重复问答、回归率等）。  

---

## 1. 参考材料与背景

- 辩论赛设计稿：`docs/discussions/2026-02-07-context-enginnering/context-engineering-debate-design.md`  
- 四层上下文工程模型：`docs/discussions/2026-02-07-context-enginnering/intro-discuss-with-claude-app-opus4.5.md`  
- 系统回调端点与行为：`packages/api/src/routes/callbacks.ts`（`pending-mentions` 是按 `catId` 过滤返回）  

四层模型核心定义（简述）：
- **Layer 1 上下文索引**：AST/Tree-sitter、embedding、图谱、增量更新  
- **Layer 2 上下文检索**：RAG/GraphRAG、Agentic Search、Memory、Context Lineage  
- **Layer 3 上下文组装**：system prompt 结构化、工具定义、few-shot、skills/hooks、用户偏好  
- **Layer 4 上下文调度**：多 Agent 隔离/共享、handoff/compaction、A2A 路由  

---

## 2. 过程观察（系统与协作层面的“现状事实”）

- **可见性测试**：本轮对话中，猫猫能看到彼此过往发言（thread context 可取到），因此“独立并行 ideation”会发生观点污染风险。  
- **@ 提及与 pending-mentions**：我方使用自身凭证调用 `pending-mentions` 看不到发给别人的 @（因为按 `catId` 过滤）；但 thread context 内确实记录了我发出的 `@布偶猫` 测试消息。该点更像“接口语义”而非 bug，但对使用者体验容易造成误判。  
- **现状定位（按四层）**：Cat Cafe 已有 Layer 3/4 的雏形（prompt 注入、会话/路由/多猫协作模式）；Layer 1/2 能力缺口是矛盾焦点。  

---

## 3. 各方观点摘要

### 3.1 记忆派（布偶猫 / Opus）

**核心主张**：没有协作记忆，三猫长期协作会“反复失忆”，大量 token/时间浪费在“重读与重建理解”，而不是推进交付。  

**关键论据与方案**：
- 记忆减少的是 **comprehension time**（理解成本），不仅是 search time。  
- 提出 `MemoryEntry + anchors + confidence/TTL + conflict` 的结构化记忆草案；强调“记忆带证据锚点”来减轻幻觉沉淀。  
- 对过严门禁的担忧：若“必须双签/人类签核才 publish”，会导致“记忆不可用窗口”，削弱日常协作效率；提出“分级发布/低敏自动提升”等折中策略。  

### 3.2 索引派（缅因猫 / Codex，本文作者）

**核心主张**：索引/检索是工程正确性与安全的地基；没有稳定定位与可验证证据，协作记忆会快速 stale、放大幻觉，并引入新的注入/污染攻击面。  

**关键论据与方案**：
- 共享可写记忆属于高风险面：应默认 **draft/quarantine**，以 tool response 形式呈现，不进入 system prompt。  
- 交付策略应“只读先行、可量化先行”：Layer 1/2 可增量上线且便于度量；共享写入必须有门禁、审计与回滚。  
- 对锚点漂移的关注：`commit` 稳定，但 `file:line` 漂移；仅靠 `grep function name` 能应付一部分，但最终仍需要符号级稳定定位与自动再验证机制。  

### 3.3 体验派（暹罗猫 / Gemini）

**核心主张**：用户不关心 Layer 编号，只关心是否“快、准、舒服、可信”。记忆与索引都必须服务最终体验：减少迷失感、减少重复阅读、增加可见进度与可控性。  

**关键论据与方案**：
- 强烈支持融合路线与渐进交付；偏向“分级发布”以避免“签核延迟 = 功能不可用”。  
- 强调安全与顺畅兼得：门禁必须存在，但也要降低日常操作摩擦。  

---

## 4. 关键分歧与收敛（我们到底在争什么）

**分歧点**（逐步收敛后仅剩实现细节）：
- “共享记忆写入”是否可以 **写入即生效**，还是必须 **draft/quarantine** 后再发布。  
- 锚点与验证：是否可以长期依赖 `commit + grep`，还是必须尽早引入符号级索引与自动再验证。  

**收敛点**（三方达成的共识）：
- 记忆与索引并非对立：它们同属 Layer 2（检索）并强依赖 Layer 1（稳定定位）能力。  
- 记忆必须是“可证伪的摘要”，而不是“权威事实”。  
- 共享写入一定要有治理：审计、回滚、门禁、注入防护。  
- 建设顺序应服务 Layer 4 的协作模式，而不是为了“索引/记忆本身”。  

---

## 5. 缅因猫的最终决策建议（融合路线图）

我建议采用“融合但有门禁”的四段式路线，并明确把 Step 2 拆成 2a/2b：

### Step 1：只读证据检索（Layer 2）先行

- 建设 `Context Lineage` 与“证据片段”检索：优先覆盖 `docs/discussions/`、`docs/decisions/`、git 提交历史/变更摘要。  
- 输出格式必须 evidence-first：返回“结论 + 证据锚点 + 可点击定位”。  
- 同步加上指标：命中率、误命中率、到首个证据耗时、重复问答下降等。  

### Step 2a：开放写入，但仅 draft/quarantine（Layer 2）

- 允许猫猫写入记忆条目，但默认进入 **quarantine**；只通过 tool response 提供给模型，不注入 system prompt。  
- 发布门禁采用“分级策略”（折中记忆派的可用性诉求）：
  - `thread-local`：写入可立即在本 thread 生效（风险低）。  
  - `project-shared`：默认 quarantine；低敏（进度/状态）可 `draft-publish` 并设置“自动提升”条件；高敏（安全/架构策略）必须签核。  
- 必须有审计与回滚：所有发布动作可追溯。  

### Step 3：符号/调用/测试索引 + 自动再验证（Layer 1/2）

- 引入符号级稳定定位（Tree-sitter/LSP 级别，按需增量），补齐 `anchors` 的长期可用性。  
- 自动再验证策略建议至少包含：
  - `onAccess`：被检索即校验  
  - `onRelatedCommit`：相关文件变更触发校验  
  - `scheduled`：定期扫描降权/归档 stale 条目  
- 冲突策略：代码事实永远权威；记忆冲突降权、标记 needs_review、必要时回滚。  

### Step 2b：在验证体系稳定后，逐步放开 project-shared publish

- 当索引与再验证链路稳定、误发布可控后，才逐步放开“默认 publish/自动提升”的范围。  
- 目标是让协作记忆从“人工维护”走向“自动维护 + 人工抽检”。  

---

## 6. 行动项（建议）

1. **明确“共享记忆发布等级”**：进度类、决策类、安全策略类的默认门禁分别是什么。  
2. **把 `pending-mentions` 的语义写进文档/提示词**：避免“我 @ 了但 pending-mentions 看不到”被误判为系统 bug。  
3. **先把 Layer 2 的只读证据检索跑起来**：用最小代价验证 ROI，再决定 Layer 1 投入深度。  
4. **定义“可验证摘要”格式**：每条记忆必须携带 anchors；无 anchors 的条目默认低置信、不得自动提升。  

---

## 7. 结论（一句话）

**融合是正确答案：用 Layer 2 把“记忆与检索”统一成 evidence-first 的能力，用 Layer 1 提供长期稳定定位，用门禁把共享写入的风险压到可控范围内，再由体验层把它变成用户能感知的效率与信任。**

