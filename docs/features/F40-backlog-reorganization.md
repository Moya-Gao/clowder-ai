---
feature_ids: [F040]
topics: [backlog, reorganization]
doc_kind: note
created: 2026-02-26
---

# F40: BACKLOG 整理与 Feature 聚合体系

> **Status**: in-progress
> **Owner**: 布偶猫
> **Created**: 2026-02-26
> **Priority**: P1（基建，影响后续所有 feat 的管理方式）

---

## Why（为什么要做）

### 痛点来源

铲屎官 2026-02-26 提出：
> "我们这套机制有大问题了，现在这个我们最重要的真相源头发散出不同 feat md 的蜘蛛网乱七八糟的。"

### 核心问题

1. **编号混乱**：BACKLOG 混编 Feature (#F1-F39) + Tech Debt (#1-#103)，F 都编到 101 了
2. **蜘蛛网引用**：一个 Feature 的文档散落在 plans/discussions/mailbox/bug-reports，没有统一入口
3. **无法顺藤摸瓜**：问"F21 什么情况"要搜 85 个文件
4. **1000 feat 怎么办**：现有结构不可扩展

### 设计灵感

铲屎官的记忆系统设计 proposal（三层记忆）：
- **热层**：直接在 context（BACKLOG 索引表）
- **温层**：轻量索引，快速召回（feat 聚合文件）
- **冷层**：需要搜索（散落的 plans/discussions）

---

## What（目标）

1. **拆分 BACKLOG**：Feature Roadmap + Tech Debt 分离
2. **建立 feat 聚合文件**：`docs/features/FXX-name.md` 收归每个 feat 的散落链接
3. **定义归档规则**：done 的 feat 从 BACKLOG 活跃区移除
4. **变成 Skill**：让猫完成 feat 时主动维护网状体系

---

## Design（设计思路）

### 编号规范（三猫收敛 2026-02-26）

| 类型 | 格式 | 示例 | 说明 |
|------|------|------|------|
| Feature | `F001` | F001, F021, F040 | 三位固定宽度，不再用 F20b/F21++ |
| Tech Debt | `TD001` | TD001, TD089 | 不再用 `#`，避免和 PR/issue 冲突 |

> **为什么三位数**：一次到位，避免未来 F100+ 再整体改名。（砚砚建议）

### 目录结构

```
docs/
├── BACKLOG.md              # 简化为活跃 Feature 索引（热层）
├── TECH-DEBT.md            # 技术债务单独文件
├── features/               # Feature 聚合目录（温层）
│   ├── F040-backlog-reorganization.md  # 本文件，第一个示范
│   ├── F021-signal-hunter.md
│   ├── index.json          # 机器索引（脚本生成，不手写）
│   └── ...
└── (plans/discussions/...)  # 冷层，被 frontmatter 挂接
```

### BACKLOG 新结构设计（布偶猫 2026-02-26）

**当前问题**：
1. Feature (F1-F39) 和 Tech Debt (#1-#103) 混编在一个文件
2. 有两个"P1 — 必须做"段落（第 17 行和第 127 行）
3. done 的项目仍占据大量篇幅（折叠也很长）
4. 编号不规范（F21++ / F20b / #52）

**新结构**：

#### `docs/BACKLOG.md`（热层 - 活跃 Feature 索引）

```markdown
# Cat Cafe Feature Roadmap

> 维护者：三猫 | 最后更新：YYYY-MM-DD
>
> **规则**：只放活跃 Feature（idea/spec/in-progress/review），done 后移除。
> 详细信息见 `docs/features/Fxxx.md`。

| ID | 名称 | Status | Owner | Link |
|----|------|--------|-------|------|
| F010 | 手机端猫猫 | in-progress | 布偶猫 | [F010](features/F010-mobile-cat.md) |
| F032 | Agent Plugin Architecture | review | 布偶猫 | [F032](features/F032-agent-plugin.md) |
| F037 | Agent Swarm 协同模式 | in-progress | 三猫 | [F037](features/F037-agent-swarm.md) |
| F039 | 消息排队投递 | spec | 布偶猫 | [F039](features/F039-message-queue.md) |
| F040 | BACKLOG 整理 | in-progress | 布偶猫 | [F040](features/F040-backlog-reorganization.md) |
```

> **超级简洁！** 只有 ~10 行活跃项，不是 200+ 行历史。

#### `docs/TECH-DEBT.md`（技术债务独立文件）

```markdown
# Cat Cafe 技术债务

> 维护者：三猫 | 最后更新：YYYY-MM-DD
>
> **规则**：`[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成
> 完成后不删除，保留追溯。

## TD-P0 — 阻塞后续 Phase

| ID | 项目 | 状态 | 来源 | 备注 |
|----|------|------|------|------|
| TD038 | Session 按 Thread 隔离 | [x] | ... | ... |

## TD-P1 — 必须做
...

## TD-P2 — 建议做
...

## TD-P3 — 可选优化
...
```

**迁移映射**：
- `#1` → `TD001`
- `#103` → `TD103`
- `F1` → `F001`
- `F39` → `F039`
- `F21++` → `F021` (演进关系用 `Evolved from` 字段)
- `F20b` → `F020` (variant 用 Phase 或 聚合文件内区分)

**迁移执行**：由缅因猫批量执行（见 Progress 章节任务分工）。

### Frontmatter Contract（三猫收敛 2026-02-26）

**所有 docs/ 下的 .md 文件**都应该有 YAML frontmatter：

```yaml
---
feature_ids: [F040]           # 关联的 Feature，可为空 []
topics: [memory, backlog]     # 松散标签，feature_ids 空时靠这个搜索
doc_kind: discussion          # 文档类型（必填）
created: 2026-02-26           # 创建日期
---
```

**`doc_kind` 枚举值**：
- `plan` — 设计/实现计划
- `discussion` — 讨论记录
- `research` — 技术调研
- `bug-report` — Bug 报告
- `mailbox` — 交接/review 信
- `decision` — 架构决策（ADR）
- `note` — 其他笔记

**关键设计决策**：
- **`stage` 不进普通文档 frontmatter**，只保留在 `features/Fxxx.md` 的 Status 字段
- 理由：`stage` 是 Feature 的状态，不是文档的状态。如果 661 个文件都有 `stage`，Feature 状态变了就要到处改——又是蜘蛛网（4.6 提出）

**迁移策略**：
1. **新文档**：`feat-kickoff` skill 强制加 frontmatter
2. **历史文档**：脚本批量加，能推断的推断（文件名带 fXX），不能的留 `feature_ids: []`
3. 不追求 100% 覆盖——80% 自动 + 20% 按需手补

### feat 聚合文件模板

```markdown
# Fxxx: 名称

> **Status**: idea | spec | in-progress | review | done
> **Owner**: 布偶猫 | 缅因猫 | 暹罗猫
> **Created**: YYYY-MM-DD
> **Completed**: YYYY-MM-DD（如果 done）

## Why
一句话：为什么要做

## What
一句话：做什么

## Acceptance Criteria（验收标准）
- [ ] 条件 1
- [ ] 条件 2

## Links（单向引用，由 index.json 自动生成补充）
- **Spec/Plan**: [链接](...)
- **Discussion**: [链接](...)
- **Review**: [链接](...)
- **Bug Reports**: [链接](...)
- **PR**: #XX
- **Commit**: abc1234

## Key Decisions（关键决策）
为什么这样设计？放弃了什么？（压缩后不用读冷层就能理解设计意图）

## Risk / Blast Radius（风险评估）
- 影响范围：...
- 回滚方案：...

## Dependencies
- **Blocked by**: Fxxx
- **Blocks**: Fxxx
- **Evolved from**: Fxxx（如果是演进）

## Review Gate（审查记录）
| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| R1 | 缅因猫 | Pass | YYYY-MM-DD |
| Cloud | Codex | Pass | YYYY-MM-DD |

## Test Evidence（测试证据）
- 单元测试：`pnpm test` 通过
- 集成测试：...

## Timeline
- YYYY-MM-DD: Spec written
- YYYY-MM-DD: Phase 1 done
- ...
```

> **删掉了 `archived` 状态**：done 就是 done，永久保留在 features/，不需要再归档（4.6 + 砚砚建议）
> **新增 reviewer 字段**：Acceptance Criteria、Risk、Review Gate、Test Evidence（砚砚建议）

### 归档规则（简化版，采纳 4.6 建议）

| 状态 | 存放位置 | 触发时机 |
|------|----------|----------|
| in-progress | BACKLOG.md 有一行 + features/FXX.md | 开发中 |
| done | 从 BACKLOG 移除，features/FXX.md **永久保留** | 合入 main 时 |

> 不需要 6 个月归档——features/ 里都是轻量 md 文件，grep 够快。

### Skill 设计：`feat-kickoff`（布偶猫 2026-02-26）

**YAML Frontmatter**：
```yaml
---
name: feat-kickoff
description: "创建新 Feature 时使用。触发词：新功能、new feat、开个 feature、F0xx"
---
```

**触发条件**（任一）：
- 铲屎官说"开个新功能"、"new feature"、"做个 Fxxx"
- 讨论收敛后确认要做一个新 Feature
- brainstorming 结束后决定立项

**详细步骤**：

1. **确定 Feature ID**
   - 查看 `docs/BACKLOG.md` 最后一个 ID
   - 新 ID = 最大 ID + 1（三位数：F040 → F041）
   - 命名：`Fxxx-kebab-case-name.md`

2. **创建聚合文件**
   - 路径：`docs/features/Fxxx-name.md`
   - 使用上方 feat 聚合文件模板
   - 填写：Status=idea/spec, Owner, Created, Why, What

3. **更新 BACKLOG 索引**
   - 在 `docs/BACKLOG.md` 添加一行
   - 格式：`| Fxxx | 名称 | spec | Owner | [link](features/Fxxx.md) |`

4. **创建相关文档时加 frontmatter**
   - 每个 plan/discussion 文件顶部加：
   ```yaml
   ---
   feature_ids: [Fxxx]
   topics: [相关标签]
   doc_kind: plan|discussion|research
   created: YYYY-MM-DD
   ---
   ```

5. **开发过程中持续更新**
   - 有新的 plan/discussion → 更新聚合文件 Links
   - 状态变化 → 更新聚合文件 Status + Timeline
   - Review 通过 → 更新 Review Gate 表格

**检查清单**：
- [ ] `docs/features/Fxxx.md` 已创建
- [ ] `docs/BACKLOG.md` 已添加索引行
- [ ] 新文档都有 frontmatter

> **4.6 的观点**：如果只在完成时才补聚合文件，信息已经散落了。应该一开始就建。

**Skill 实现**：待创建 `cat-cafe-skills/feat-kickoff/SKILL.md`（由缅因猫或布偶猫实现）。

---

## Related Docs（冷层链接）

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | [docs/research/2026-02-25-memory-design/proposal.md](../research/2026-02-25-memory-design/proposal.md) | 三层记忆架构设计 |
| **Archive Discussion** | [2026-02-10 Feature Backlog Brainstorm](../archive/2026-02/discussions/2026-02-10-feature-backlog-brainstorm/README.md) | 需求池首次系统化梳理 |
| **Discussion** | 本 thread（2026-02-26 铲屎官 + 布偶猫）| BACKLOG 问题诊断 |
| **BACKLOG 条目** | 待登记 | - |

---

## Progress（进度）

- [x] 2026-02-26: 问题诊断完成
- [x] 2026-02-26: 探索现有 feat 关系图（haiku）
- [x] 2026-02-26: 创建本文件（第一个示范）
- [x] 2026-02-26: 与 Opus 4.6 讨论，纳入三点改进（Key Decisions 字段、取消 6 月归档、kickoff 而非 completion）
- [x] 2026-02-26: 三猫收敛 frontmatter contract（4.5 + 4.6 + GPT-5.2）
  - 最终 schema：`feature_ids` + `topics` + `doc_kind` + `created`
  - `stage` 不下沉到普通文档
  - 编号 `F001` / `TD001`（三位固定宽度）
  - 机器索引 `index.json`（脚本生成）
- [x] 2026-02-26: 设计 BACKLOG 新结构（拆分 Feature Roadmap + Tech Debt）— **布偶猫** ✅
- [x] 2026-02-26: 设计 feat-kickoff skill — **布偶猫** ✅
- [ ] 写 frontmatter 迁移脚本 — **缅因猫**
- [ ] 历史文档补 frontmatter（全量，含归档）— **缅因猫**（token 充裕 + 细致）
- [ ] 验收 frontmatter 补录结果 — **Sonnet/Haiku**
- [ ] 用 F021 验证模板
- [ ] 用 F032 验证"分阶段交付"记录
- [ ] 批量整理现有 feat

---

## Open Questions

1. ~~**递进关系怎么记**~~ → **已解决**：用 Dependencies 字段的 `Evolved from`，不手动维护 graph.md（4.6 建议）
2. ~~**编号规范**~~ → **已解决**：`F001` / `TD001` 三位固定宽度，不再用 `#` 或后缀（三猫共识）
3. ~~**frontmatter schema**~~ → **已解决**：见上方 Frontmatter Contract 章节（三猫收敛）
4. ~~**历史文档迁移**~~ → **已解决**：脚本 + 渐进，不追求 100%（三猫共识）
5. ~~**`doc_kind` 是否必填**~~ → **已确认：必填**（铲屎官拍板 2026-02-26）
6. ~~**历史补录范围**~~ → **已确认：全量（含归档），由缅因猫执行**（铲屎官拍板 2026-02-26）

---

## 收敛后沉淀（砚砚提醒）

按"讨论收敛后的沉淀检查"规则，以下需要同步：

| 沉淀类型 | 内容 | 状态 |
|----------|------|------|
| **ADR** | 新增"Metadata Contract ADR"，记录为何拒绝 `stage` 下沉到全仓文档 | 待写 |
| **lessons-learned** | "状态字段多点写入会复发蜘蛛网" | 待补 |
| **指引文件** | CLAUDE.md/AGENTS.md/GEMINI.md 同步文档元数据规范 | 待同步 |

---

*本文件是 feat 聚合体系的第一个示范——用整理 BACKLOG 这个任务来验证模板设计。*
