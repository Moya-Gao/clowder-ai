---
feature_ids: [F152]
related_features: [F070, F102]
topics: [knowledge-engineering, skill, expedition-memory, ai-fde]
doc_kind: plan
created: 2026-04-09
phase: "Phase 0"
---

# F152 Phase 0: Knowledge Engineering Skill — Implementation Plan

**Feature:** F152 — `docs/features/F152-expedition-memory.md`
**Goal:** 创建 knowledge-engineering skill，让猫猫能作为 AI FDE 指导外部项目用户做文档重构，使项目知识可被记忆引擎索引
**Acceptance Criteria:**
- AC-01: `knowledge-engineering` skill 存在且可被猫猫加载
- AC-02: Skill 能识别外部项目的文档现状（有结构化文档 / 只有代码 / 文档散落 / 代码文档分仓）
- AC-03: Skill 输出三层知识注入建议（领域手册 → 模式库 → 检索管道），内容基于 IdeaHub 咨询方法论
- AC-04: Skill 能生成文档骨架模板（概念词典、规则表、操作映射），用户填充后可被 CatCafeScanner 索引
- AC-05: Bootstrap 流程中，猫在路径选择点（Guided vs Autonomous）向用户说明两条路径的差异
**Architecture:** 纯 skill 层——一个 SKILL.md + manifest 注册。不改引擎代码。方法论从 IdeaHub 社区咨询实证（`docs/research/2026-04-09-ideahub-test-automation-knowledge-consultation.md`）提炼为可复用 skill。
**Tech Stack:** Markdown (SKILL.md) + YAML (manifest.yaml)
**前端验证:** No — 纯 skill，无 UI 变更

---

## Straight-Line Check

**终点（B）**：猫猫进入外部项目，加载 knowledge-engineering skill，能完整指导用户从"文档缺失"走到"结构化文档可被记忆引擎索引"。

**不做的事**：
- 不改 EvidenceItem / IndexBuilder / SQLite schema（Phase A）
- 不改 bootstrap 编排器（Phase B）
- 不做全局经验回流（Phase C）
- 不写 TypeScript 运行时代码

**Terminal schema**：SKILL.md 五个核心段落——Assessment → Path Selection → P0 Domain Handbook → P1 Pattern Library → P2 Retrieval Pipeline + Skeleton Templates。

---

## Task 1: Create SKILL.md — Frontmatter + Overview + Assessment

**Files:**
- Create: `cat-cafe-skills/knowledge-engineering/SKILL.md`

**Step 1: Create SKILL.md with frontmatter**

```yaml
---
name: knowledge-engineering
description: >
  猫猫指导外部项目文档重构 — AI FDE 知识工程方法论。
  Use when: 猫猫部署到外部项目、用户项目缺少结构化文档、需要知识工程指导、冷启动理解业务。
  Not for: cat-cafe 项目自身开发、已有完善 docs/ 结构的项目（直接用 CatCafeScanner）。
  Output: 文档现状诊断 + 路径选择 + 三层知识注入建议 + 文档骨架模板。
triggers:
  - "知识工程"
  - "文档重构"
  - "外部项目"
  - "knowledge engineering"
  - "冷启动"
  - "AI FDE"
  - "帮我整理文档"
---
```

**Step 2: Write overview section**

Skill 开头说明 AI FDE 概念 + 本 skill 的定位：
- 来自 IdeaHub 咨询的真实教训：Scanner 再强也只能吃已有文档，文档不存在就只能尽力而为
- 本 skill = 猫指导用户把隐性知识显性化为结构化文档
- 引用真相源：`docs/research/2026-04-09-ideahub-test-automation-knowledge-consultation.md`

**Step 3: Write Project Documentation Assessment section (AC-02)**

四种场景 + 判定信号 + 推荐动作：

| 场景 | 判定信号 | 推荐动作 |
|------|---------|---------|
| A: 已有 `docs/` + frontmatter 结构 | 存在 `docs/*.md` 且有 YAML frontmatter | 不需要本 skill，CatCafeScanner 直接吃 |
| B: 只有代码无文档 | 无 `docs/` 或 `README.md` 为空/极简 | **Guided path 核心场景**——从代码推导文档骨架 |
| C: 文档散落 | 有 wiki/Confluence/飞书链接但仓库内无 .md | 先迁移策略，再 Guided path |
| D: 代码仓与文档仓分离 | `README.md` 引用外部文档仓 | 识别并提醒用户，指导在代码仓内建索引入口 |

猫的评估步骤（skill 中写成指令）：
1. 检查 `docs/` 目录是否存在及其内容
2. 检查 README.md 内容密度
3. 检查 package.json / Cargo.toml / pyproject.toml 等 manifest
4. 检查是否有 ADR / CHANGELOG / CONTRIBUTING
5. 判定场景 → 输出诊断结论

**Step 4: Commit**

```bash
git add cat-cafe-skills/knowledge-engineering/SKILL.md
git commit -m "feat(F152): create knowledge-engineering skill skeleton with assessment phase [宪宪/Opus-46🐾]"
```

---

## Task 2: Write Path Selection — Guided vs Autonomous (AC-05)

**Files:**
- Modify: `cat-cafe-skills/knowledge-engineering/SKILL.md`

**Step 1: Add path selection decision tree**

Assessment 完成后，猫向用户展示两条路径：

```
路径 1（Guided）— 猫指导文档重构
  适合：首次接触知识工程、团队缺文档规范、想建长期可维护体系
  投入：3-7 天（猫指导 + 用户填充内容）
  产出：结构化文档体系 → CatCafeScanner 直接索引 → 高置信度记忆
  方法：三层知识注入（本 skill 核心）

路径 2（Autonomous）— 猫自动扫描
  适合：已有一定文档、只想快速让猫理解项目、不需要文档改善
  投入：即时（GenericRepoScanner 自动扫描，Phase A 实现）
  产出：尽力索引，provenance 置信度较低
  限制：项目知识覆盖不完整，猫理解深度有限
```

**猫的职责**（写进 skill 指令）：
- 必须向用户说明两条路径的差异和 trade-off
- 不替用户选——呈现事实后等用户决定
- 如果用户选 Guided → 继续本 skill 下面的三层方法论
- 如果用户选 Autonomous → 告知"GenericRepoScanner 会自动处理"（Phase A 才有实现）

**Step 2: Commit**

```bash
git add cat-cafe-skills/knowledge-engineering/SKILL.md
git commit -m "feat(F152): add Guided vs Autonomous path selection (AC-05) [宪宪/Opus-46🐾]"
```

---

## Task 3: Write Three-Layer Knowledge Injection (AC-03)

**Files:**
- Modify: `cat-cafe-skills/knowledge-engineering/SKILL.md`

**Step 1: Write P0 — Domain Handbook section**

从 IdeaHub 咨询方法论提炼（`docs/research/2026-04-09-ideahub-test-automation-knowledge-consultation.md` § 2.1）：

**P0 领域手册（1-2 天，最优先）**：
- a) **业务概念词典**（Domain Glossary）：核心概念 + 场景 + 对应 API/操作
- b) **业务规则表**（Business Rules）：实体关系 + 约束 + 互斥/依赖
- c) **操作路径映射**（Action Mapping）：用户描述语言 → 系统操作序列

猫的指导方式：
1. 先从 README / manifest / 代码结构推导概念候选列表
2. 向用户确认/补充每个概念的定义
3. 引导用户列出关键业务规则
4. 帮用户梳理"人话描述→系统操作"的映射

**Step 2: Write P1 — Pattern Library section**

从 IdeaHub 咨询方法论提炼（§ 2.2）：

**P1 模式库（2-3 天）**：
- 从已有代码/脚本中抽取可复用模式
- 核心洞察："AI 抄 example 是 1:1，学 pattern 是 1:N"
- 模式结构：名称 → 结构（步骤模板）→ 变量 → 适用场景

猫的指导方式：
1. 扫描项目中重复出现的代码模式
2. 抽象为模板（带变量占位符）
3. 标注每个模式的适用场景和边界

**Step 3: Write P2-P3 — Retrieval Pipeline section**

从 IdeaHub 咨询方法论提炼（§ 2.3）：

**P2-P3 检索管道（指向 F102 记忆引擎）**：
- 用户完成 P0+P1 后，文档已可被 CatCafeScanner 索引
- 记忆引擎自动处理：FTS5 全文检索 + 向量语义搜索 + 混合 rerank
- 猫告诉用户："这一层你不需要手动做，文档放对位置后记忆引擎自动索引"

**Step 4: Commit**

```bash
git add cat-cafe-skills/knowledge-engineering/SKILL.md
git commit -m "feat(F152): add three-layer knowledge injection methodology (AC-03) [宪宪/Opus-46🐾]"
```

---

## Task 4: Write Document Skeleton Templates (AC-04)

**Files:**
- Modify: `cat-cafe-skills/knowledge-engineering/SKILL.md`

**Step 1: Add skeleton templates**

模板必须有 YAML frontmatter（让 CatCafeScanner / GenericRepoScanner 能索引）。
`doc_kind` 映射到 `research`（IndexBuilder KIND_DIRS 已有此枚举，无需扩展）。

**Template 1: 业务概念词典**

```markdown
---
doc_kind: research
topics: [domain-glossary, {project-name}]
created: {YYYY-MM-DD}
---

# {Project Name} — 业务概念词典

## 核心概念

### {概念名}
{一句话定义}

- **场景**：{什么时候出现这个概念}
- **关联概念**：{与哪些概念有关系}
- **对应操作/API**：{系统中对应的函数/接口}
```

**Template 2: 业务规则表**

```markdown
---
doc_kind: research
topics: [business-rules, {project-name}]
created: {YYYY-MM-DD}
---

# {Project Name} — 业务规则表

## 规则

| 规则名 | 实体 A | 实体 B | 关系 | 约束条件 | 原因 |
|--------|--------|--------|------|---------|------|
| {name} | {entity} | {entity} | {互斥/依赖/触发} | {condition} | {why} |
```

**Template 3: 操作路径映射**

```markdown
---
doc_kind: research
topics: [action-mapping, {project-name}]
created: {YYYY-MM-DD}
---

# {Project Name} — 操作路径映射

## 映射表

| 用户描述（自然语言） | 操作序列（代码/API） | 前置条件 | 预期结果 |
|---------------------|---------------------|---------|---------|
| "{user action description}" | `api.step1()` → `api.step2()` | {precondition} | {expected} |
```

**Template 4: 可复用模式**

```markdown
---
doc_kind: research
topics: [pattern, {pattern-name}, {project-name}]
created: {YYYY-MM-DD}
---

# 模式：{Pattern Name}

## 结构
1. setup: {准备步骤}
2. action: {核心操作}
3. assert: {验证条件}
4. teardown: {清理}

## 模板（伪代码）
{template with {variable} placeholders}

## 适用场景
- {scenario 1}
- {scenario 2}

## 不适用场景
- {anti-scenario}
```

**Step 2: Verify templates use valid frontmatter**

确认 `doc_kind: research` 在 IndexBuilder KIND_DIRS 中有对应的 `research/` 目录映射。用户把填好的模板放在项目的 `docs/research/` 下即可被索引。

对于没有 cat-cafe `docs/` 结构的项目：模板放在 `docs/` 下任意位置，GenericRepoScanner（Phase A）会扫 `docs/**/*.md`。

**Step 3: Commit**

```bash
git add cat-cafe-skills/knowledge-engineering/SKILL.md
git commit -m "feat(F152): add document skeleton templates (AC-04) [宪宪/Opus-46🐾]"
```

---

## Task 5: Register in manifest.yaml + sync

**Files:**
- Modify: `cat-cafe-skills/manifest.yaml`

**Step 1: Add entry to manifest.yaml**

在适当位置（开发流程链之后、standalone skills 区域）添加：

```yaml
  # ── 知识工程（F152 Phase 0）──
  knowledge-engineering:
    description: >
      猫猫指导外部项目文档重构 — AI FDE 知识工程方法论。
      Use when: 猫猫部署到外部项目、用户项目缺少结构化文档、需要知识工程指导、冷启动理解业务。
      Not for: cat-cafe 项目自身开发、已有完善 docs/ 结构的项目（直接用 CatCafeScanner）。
      Output: 文档现状诊断 + 路径选择 + 三层知识注入建议 + 文档骨架模板。
    triggers:
      - "知识工程"
      - "文档重构"
      - "外部项目"
      - "knowledge engineering"
      - "冷启动"
      - "AI FDE"
      - "帮我整理文档"
    not_for:
      - "cat-cafe 自身开发"
      - "已有完善 docs/ 结构"
    output: "Documentation assessment + path selection + three-layer knowledge injection + skeleton templates"
    next: []
    sop_step: null
    merged_from: null
```

**Step 2: Run `pnpm sync:skills`**

```bash
pnpm sync:skills
```

预期：HOME 级 symlinks 同步成功，skill 可被猫猫加载。

**Step 3: Verify skill appears in available list**

检查 skill 能被正确路由。

**Step 4: Commit**

```bash
git add cat-cafe-skills/manifest.yaml
git commit -m "feat(F152): register knowledge-engineering skill in manifest [宪宪/Opus-46🐾]"
```

---

## Task 6: End-to-end AC Verification

**Checklist:**

| AC | 验证方式 | 通过标准 |
|----|---------|---------|
| AC-01 | `pnpm sync:skills` 成功 + skill 出现在可加载列表 | skill 文件存在 + manifest 注册 |
| AC-02 | SKILL.md 包含四场景评估段落（A/B/C/D） | 每种场景有判定信号 + 推荐动作 |
| AC-03 | SKILL.md 包含 P0→P1→P2-P3 三层方法论 | 内容可追溯到 IdeaHub 咨询实证 |
| AC-04 | SKILL.md 包含 4 个骨架模板 + 有效 frontmatter | `doc_kind: research` + 可被 scanner 索引 |
| AC-05 | SKILL.md 包含 Guided vs Autonomous 决策树 | 猫有指令必须向用户说明差异 |

---

## Implementation Notes

- **Skill 创建流程**：实现时加载 `writing-skills` skill（CSO + 测试 + 发布）
- **PR scope**：只改 `cat-cafe-skills/`，不碰 CLAUDE.md / AGENTS.md（feedback memory: `feedback_skill_pr_scope.md`）
- **sync 必做**：新建 skill 后必须 `pnpm sync:skills`（feedback memory: `feedback_sync_skills_after_new_skill.md`）
- **Review Gate**：Phase 0 走 writing-skills 流程验收（spec Review Gate 段落）

## Next

计划写完 → worktree → writing-skills（创建 skill）→ quality-gate → request-review。
