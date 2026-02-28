---
feature_ids: [F041]
topics: [multi-agent, vision-alignment, goal-drift, research]
doc_kind: research-synthesis
created: 2026-02-27
source: 布偶猫/宪宪 (Opus 4.6)
pipeline_step: 4
---

# Step 4 综合报告：愿景漂移调研 → Cat Cafe 可行性验证

> 作者：布偶猫/宪宪
> 日期：2026-02-27
> 输入：6 份 Deep Research 报告 + 1 份 GPT-5.2 Pro 审阅 + Cat Cafe 代码库验证
> 目标：哪些建议可直接落地、哪些需要适配、哪些不适用

---

## 一、总结论

**三层防线模型**（6 份报告独立收敛，Pro 审阅确认不是回音壁幻觉）：

| 层 | 名称 | 我们已有 | 缺口 |
|----|------|----------|------|
| 1 | **上下文锚定** | CLAUDE.md / AGENTS.md 每次加载 | 缺"愿景锚点"结构化段落 |
| 2 | **流程守护** | 5 个 Skill 已加愿景对照步骤 | 全部靠手动、无强制门禁、无跟踪 |
| 3 | **技术嵌入** | 无 | 无视觉验证、无漂移监测、无自动门禁 |

**Pro 裁决的核心判断**：我们的"流程嵌入"方案是**必要的第一层**，不是"注定失败"（否定 Gemini 的极端评估），但单靠它鲁棒性**低到中**。需要补上第一层（锚定）和第三层（技术嵌入）。

---

## 二、代码库验证结果

### 2.1 SystemPromptBuilder（目标重估注入点）

| 项目 | 现状 |
|------|------|
| 当前 prompt 大小 | ~1600 chars，size guard 2000 chars |
| 可注入位置 | reviewer section 之后、invocation context 之前 |
| 预算余量 | ~400 chars（约 100 tokens） |
| 守护测试 | `test/system-prompt-builder.test.js:169` — `prompt.length < 2000` |

**结论**：空间极紧。不适合在 system prompt 里放"目标重估"段落。更好的方式是在**用户消息层**（McpPromptInjector 或 invocation prompt）注入，或放在 CLAUDE.md 等持久化文件中由猫猫自行遵守。

### 2.2 视觉测试基础设施

| 项目 | 现状 |
|------|------|
| E2E 框架 | **无**（无 Playwright、Cypress、Webdriver） |
| 视觉回归 | **无**（无 Percy、Chromatic、snapshot） |
| Storybook | **无** |
| 现有测试 | 60k+ 行测试代码，全部 unit/integration（Vitest + jsdom） |
| Puppeteer | API 包有 puppeteer v24（用于 RSS/web scraping，非 E2E） |

**结论**：Gemini R5 说"F041 本质上是视觉落地缺失"——**在我们代码库中完全验证**。零视觉测试 = UI 类功能完全靠人眼验收。这是 F041 做歪的技术根因之一。

### 2.3 猫猫指引文件结构

| 项目 | CLAUDE.md | AGENTS.md | GEMINI.md |
|------|-----------|-----------|-----------|
| 行数 | 533 | 588 | 462 |
| Non-negotiables 段 | 无 | 无 | 无 |
| DoD 段 | 无 | 无 | 无 |
| 愿景引用 | 指向 VISION.md | 指向 VISION.md | 指向 VISION.md |
| 讨论收敛检查 | 有 (#11) | **缺失** | 有 (#10) |

**结论**：Pro 建议的"愿景锚点文件"我们已有载体（三猫指引），但缺关键结构。需要加"Non-negotiables + DoD + Anti-drift ritual"段落。AGENTS.md 还缺讨论收敛检查。

### 2.4 Skills 执行状态

| 组件 | 设计状态 | 自动化 | 强制性 |
|------|----------|--------|--------|
| Step 0a: 回读原始需求 | 已设计 | 手动 | 可跳过 |
| Step 0b: 自问三问题 | 已设计 | 手动 | 可跳过 |
| Step 0c: 跨猫交叉验证 | 已设计 | 手动 | 无跟踪 |
| AC 完整性审计 | 缺失 | 无 | 无 |
| 愿景覆盖度指标 | 模板存在 | 无 | 仅建议 |
| 跨猫签收追踪 | 缺失 | 无 | 无 |

**结论**：我们在这个 session 加的"愿景对照"步骤全部是**纯文字指令**，没有任何强制性或跟踪机制。猫猫可以（无意中）跳过任何步骤。这正是 Pro 说的"enforcement depends entirely on the LLM's compliance with its own instructions"。

---

## 三、行动清单

### 立即做（本周，低成本，高优先级）

#### A1. 三猫指引加"愿景锚点"段落

在 CLAUDE.md / AGENTS.md / GEMINI.md 各加一个紧凑的结构化段落：

```markdown
## 愿景守护（Anti-Drift Protocol）

### Non-negotiables（铁律）
- 开始任何 Feature 前，必须读原始 Discussion/Interview 文档
- AC 打勾 ≠ 完成。必须问"铲屎官坐在 Hub 前用这个功能，体验是什么样的？"
- UI 类功能必须产出截图/录屏证据，附"需求 → 截图"映射表

### Definition of Done（完成标准）
- [ ] 原始需求文档全部读过（列出文件路径）
- [ ] 跨猫交叉验证通过（另一只猫独立确认）
- [ ] UI 截图证据链完整（如适用）
- [ ] 所有 AC + 铲屎官原始需求都被覆盖

### Anti-Drift Ritual（每轮复述）
- 每次上下文压缩后，重读本段落
- 每次开始新子任务前，复述："当前主目标是 X，要交付的可验证证据是 Y"
```

**为什么有效**：CLAUDE.md 在每次 session 和 compaction 后都会被重新加载。这是 6 份报告一致推荐的"最高性价比修复"，Pro 确认有强证据支撑。

**成本**：~15 行文字，0 代码改动。

#### A2. feat-completion Skill 加跨猫签收追踪

在 Step 0c 输出中加结构化签收格式：

```markdown
### 跨猫愿景验证签收
| 猫猫 | 读了哪些原始文档 | 三个问题回答 | 结论 |
|------|------------------|-------------|------|
| 布偶猫 | docs/features/F041.md, docs/discussions/... | 1. ... 2. ... 3. ... | 通过/不通过 |
| 缅因猫 | (同上) | 1. ... 2. ... 3. ... | 通过/不通过 |
```

**写入位置**：Feature 的 aggregate 文件（如 `docs/features/F041.md`），作为可审计的永久记录。

**成本**：改 1 个 Skill 文件。

#### A3. F041 重做时加 UI 截图证据链

F041 已经 reopen（AC 里已有 UX 条目）。重做时：
- DoD 写死：必须提交 Hub 截图（能力看板页、Skill 分类页、多项目切换页）
- 截图附"AC ID → 截图编号"映射表
- Review 时 reviewer 必须看截图，不能只看代码 diff

**成本**：0 代码改动，流程约束。

#### A4. AGENTS.md 补讨论收敛检查

AGENTS.md 缺失 #10/11（讨论收敛后的沉淀检查），是三猫指引的唯一不一致处。补上。

**成本**：复制 CLAUDE.md #11 段落，适配缅因猫语境。

---

### 计划做（下个 sprint，需要设计）

#### B1. Playwright 基础搭建 — UI 截图 CI

**目标**：不是全量 E2E 测试，而是"关键页面 screenshot capture + golden comparison"。

**初步方案**：
- 安装 Playwright（仅 `@cat-cafe/web`）
- 写 3-5 个 smoke tests：首页、对话页、设置页、能力看板页
- CI 中运行并输出截图到 `test-results/screenshots/`
- Review 时截图作为 PR artifact 附件

**为什么不是 Storybook**：我们是全栈应用，不是组件库。Page-level screenshot 比 component snapshot 更直接对标铲屎官体验。

**注意**：Pro 说"真正阻断漂移的是验证工件"——截图就是 UI 类功能的验证工件。

#### B2. "冷启动 Verifier" 模式

**概念**（Pro 建议 #4）：一个**只拿需求索引 + 交付物截图**的全新 agent session。不看实现过程，不被 review 历史洗脑。独立判断"这是铲屎官要的吗？"

**Cat Cafe 实现路径**：
- 用现有 A2A 调用能力（invoke-single-cat）spawn 一个临时猫
- Prompt 只包含：Feature aggregate 文件 + Discussion 原文 + 交付物截图
- 输出：通过/不通过 + 具体偏差描述
- **触发时机**：feat-completion Step 0c 之后、PR 之前

**成本**：中等。需要设计 prompt template，但不需要新架构。

#### B3. Feature 文件增加"愿景覆盖度"字段

在 `docs/features/Fxxx.md` 的 frontmatter 或正文中加：

```yaml
vision_coverage:
  original_requirements: 8  # Discussion 中提到的需求点数
  ac_covered: 6             # AC 覆盖了几个
  delivered: 5              # 实际交付了几个
  evidence: [screenshot-1.png, screenshot-2.png]
```

**为什么**：可量化的"愿景覆盖率" = 可审计的"没有做歪"证据。

---

### 不做（报告推荐但不适合我们）

#### C1. LangGraph 式 interrupt/persistence 门禁系统

**为什么不做**：我们的架构是 CLI 子进程（spawn claude/codex/gemini），不是 LangGraph 图编排。引入 LangGraph 级别的门禁需要改架构，成本远大于收益。我们用 Skill + 人工审批已经足够。

#### C2. ASI (Agent Stability Index) 监测仪表盘

**为什么不做**：Rath 的 ASI 是仿真框架指标（Pro 已确认不可当生产阈值）。我们没有 agent 行为向量的数据管道，建仪表盘是空壳。不如先做 B1（截图）和 B2（冷启动 verifier）——这两个就是最实际的"漂移检测器"。

#### C3. 更长更密的 SOP 文本

**Pro 原话**："这通常会变成新的噪声源，进一步 context pollution。"我们的 CLAUDE.md 已经 533 行，不能再膨胀。A1 的"愿景锚点"段落必须**紧凑**（~15 行），多了反而有害。

#### C4. DeepContext GRU/RNN 外部监测模型

**来源**：ChatGPT R3 独家发现的 arXiv:2602.16935。用 GRU 模型实时监测 intent distance。
**为什么不做**：需要训练/部署独立模型，Cat Cafe 是 3 猫小团队项目，投入产出比不合理。

---

## 四、对 Pro 5 个分歧裁决的立场

| # | 分歧 | Pro 裁决 | 我的立场 |
|---|------|----------|----------|
| 1 | 600 次/50% 漂移 | R1 最靠谱，当压测参数不当硬阈值 | **同意**。不会基于此设计门禁阈值 |
| 2 | Goal-persistent design | 术语存在但跨域推广属推断 | **同意**。借鉴"每轮复述目标"机制，不追求术语正统性 |
| 3 | OpenClaw 记忆 | Markdown 真源 + SQLite 索引 | **同意**。对我们的启发：文件系统（真源）+ Redis（索引）的分层我们已有 |
| 4 | 流程嵌入鲁棒性 | 低到中，需要接外置状态 + 门禁 | **同意**。A1（锚点）+ B1（截图）+ B2（冷启动 verifier）正是补强 |
| 5 | 视觉验证 | F041 类 UI 任务为必选项 | **强烈同意**。代码库验证确认：零视觉测试基础设施 |

---

## 五、与我们已有方案的关系

**这次调研不是推翻我们 session 早些时候做的 Skills 修改**，而是在其基础上补强：

```
已做（本 session）:                    待补（调研结论）:
├── 5 Skills 加愿景对照步骤        ← 仍然需要，是第二层
├── SOP Step 2 加 vision check     ← 仍然需要
├── review 要求附原始需求文档       ← 仍然需要
│
│   + A1. 三猫指引加"愿景锚点"     ← 新增：第一层（上下文锚定）
│   + A2. 跨猫签收追踪             ← 新增：强化第二层
│   + A3. 截图证据链               ← 新增：第三层入口
│   + B1. Playwright 截图 CI       ← 新增：第三层技术嵌入
│   + B2. 冷启动 Verifier          ← 新增：独立视角验证
```

---

## 六、铲屎官决策点

以下需要铲屎官拍板（按决策权矩阵，涉及工作流/SOP 变更 + 新增外部依赖）：

1. **A1-A4 可以猫猫自治执行吗？** 都是文档/流程变更，不改代码。我认为属于"日志与可观测性"+"文档跟随更新"层级，可以自治。
2. **B1 Playwright 引入**：新增外部依赖（playwright），需要铲屎官确认。
3. **B2 冷启动 Verifier**：不是新依赖，但改变了 feat-completion 的流程（增加一步 A2A 调用）。需要三猫讨论。
4. **F041 重做的优先级**：调研完了，但 F041 重做要先完成 A1-A3 再开始，还是边做 F041 边迭代流程？

---

*布偶猫/宪宪 🐾*
*2026-02-27*
