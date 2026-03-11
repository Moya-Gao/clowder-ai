---
feature_ids: [F094]
related_features: [F042, F058, F076, F086, F088]
topics: [documentation, debt-cleanup, template, feature-docs, governance]
doc_kind: spec
created: 2026-03-10
---

# F094: Feature 文档债务清理 — 全量迁移到黄金模板标准

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

### 核心痛点

98 个 Feature 文档，质量参差不齐。F086/F088 等近期文档结构完善，但大量早期文档（F001-F038）只有 2-3 个 section，缺 AC、缺 Risk、缺 Dependencies，frontmatter 字段不统一。

**量化债务**（Phase A 审计实测数据，2026-03-10）：
- **总文档数**：96 份（非 98，误差来自 git archive 的某些特殊文件）
- **Green（≥80% 合规）**：20 份（20.8%）— 微调即可
- **Yellow（50-80% 合规）**：70 份（72.9%）— 需要补 section + 格式化
- **Red（<50% 合规）**：6 份（6.3%）— 需要大幅重构
- **最高频缺失项**：
  - 非标准 Status 行：94 份
  - AC 格式缺失：90 份
  - Dependencies 标签缺失：71 份
  - `## Risk` 缺失：48 份
  - `## Acceptance Criteria` 缺失：47 份
- **重复 Feature ID**：F055 和 F081 各有 2 份文档（待铲屎官拍板去留）
- **TEMPLATE.md 过时**：不反映实际最佳实践（已有 `feature-doc-template.md` 取代）
- **BACKLOG.md 可能与实际状态脱节**：done 的 feat 可能还挂着

**Mission Hub Dashboard parser（F058）依赖统一格式**：Phase 标题、AC 编号、Status 行、Dependencies 段——格式不统一就无法自动提取进度。

铲屎官原话（2026-03-10）：
> "历史遗留债务必须清理！甚至 mission hub 那个 feat 做了的模板 大家按照那个模板迁移优化重构！"
> "如果模板里有的模块 md 没有就要补齐！如果自己的 feat 有多的文本也要保留 方便我们未来有记忆有回顾！"

### 为什么现在做

1. F058 Mission Hub Dashboard parser 需要统一格式才能可靠解析
2. 文档越积越多，债务只会越来越大
3. 新猫 onboarding 时看到参差不齐的文档会困惑

## What

### 黄金模板标准

以 `cat-cafe-skills/refs/feature-doc-template.md` 为唯一权威模板。黄金范本：F086、F088。

**硬性格式（Parser 依赖）**：
1. YAML Frontmatter（feature_ids / related_features / topics / doc_kind / created）
2. Status 行：`> **Status**: {status} | **Owner**: {owner}`
3. Phase 标题：`### Phase {X}: {名称}`
4. AC 格式：`- [ ] AC-{Phase}{N}: {描述}`
5. Dependencies 段：`**Evolved from** / **Blocked by** / **Related**`

**内容完整性（每个 feat 必须有）**：
- Why（保留铲屎官原话/原始动机）
- What（设计说明）
- Acceptance Criteria（done 的 feat 全部 `[x]`）
- Dependencies

**保留原则**：
- 已有的文本内容**全部保留**，只做格式迁移和结构补齐
- 铲屎官原话、讨论记录、设计决策等历史文本是宝贵记忆，不删不改
- done 的 feat 如果有 Phase 表格/Timeline 等，保留并补齐

### Phase A: 审计 + 模板升级

1. **全量审计**：扫描 98 个 feat 文档，按模板完整度分三档
   - 🟢 Green（≥80% 符合模板）：微调格式即可
   - 🟡 Yellow（50-80%）：需要补 section + 格式化
   - 🔴 Red（<50%）：需要大幅重构
2. **升级 TEMPLATE.md**：用 `feature-doc-template.md` 替换旧 TEMPLATE.md
3. **产出审计报告**：哪些 feat 需要什么级别的修复

### Phase B: 迁移执行（批量）

按优先级迁移：
1. **in-progress / spec 的活跃 feat 优先**（影响当前开发）
2. **done 但近期的（F060+）**其次（记忆新鲜，补齐容易）
3. **done 且早期的（F001-F059）**最后（需要翻 git log 考古）

每个文档迁移：
- Frontmatter 补齐/统一
- Status 行格式化
- 补缺失 section（AC / Dependencies / Risk）
- Phase 标题/AC 编号格式化
- **不改动原有内容文本**，只做结构包装

### Phase C: BACKLOG 对齐 + 验证

1. **BACKLOG.md 清理**：done 的移除、status 对齐实际
2. **自动化验证脚本**：lint 检查所有 feat 文档的模板合规度
3. **CI 集成**（可选）：新 feat 文档不符合模板 → 告警

## Acceptance Criteria

### Phase A（审计 + 模板升级）
- [x] AC-A1: 全量审计报告产出（96 个 feat 的 Green/Yellow/Red 分档）— 缅因猫砚砚已交付
- [x] AC-A2: `docs/features/TEMPLATE.md` 更新为最新标准模板 — 缅因猫砚砚已完成
- [x] AC-A3: 审计报告含每个 feat 的具体缺失项清单 — 机器读(JSON) + 人读(Markdown)

### Phase B（迁移执行）
- [ ] AC-B1: 所有 in-progress/spec feat 文档符合模板标准
- [ ] AC-B2: 所有 done feat 文档至少有 Frontmatter + Status 行 + Why + What + AC + Dependencies
- [ ] AC-B3: 原有内容文本零丢失（只增不删）
- [ ] AC-B4: Phase 标题和 AC 编号符合 parser 格式

### Phase C（BACKLOG 对齐 + 验证）
- [ ] AC-C1: BACKLOG.md 与 feat 文档状态一致
- [ ] AC-C2: lint 脚本可检查 feat 文档模板合规度
- [ ] AC-C3: 全量通过 lint（0 error）

## 需求点 Checklist

| # | 需求点 | AC 映射 | 状态 |
|---|--------|---------|------|
| R1 | 全量 feat 文档审计 | AC-A1, AC-A3 | ✅ Phase A 完成 |
| R2 | 模板标准升级 | AC-A2 | ✅ Phase A 完成 |
| R3 | 活跃 feat 文档迁移（Red 6 + Yellow 批量） | AC-B1, AC-B3, AC-B4 | ⬜ Phase B 待执行 |
| R4 | 已完成 feat 文档迁移 | AC-B2, AC-B3 | ⬜ Phase B 待执行 |
| R5 | BACKLOG 状态对齐 | AC-C1 | ⬜ Phase C 待执行 |
| R6 | 自动化验证 | AC-C2, AC-C3 | ⬜ Phase C 待执行 |

## Dependencies

- **Related**: F042（三层信息架构——定义了文档结构）
- **Related**: F058（Mission Hub Dashboard——parser 依赖统一格式）
- **Related**: F076（Mission Hub——黄金模板范本之一）
- **Related**: F086（Cat Orchestration——黄金模板范本之一）
- **Related**: F088（Chat Gateway——黄金模板范本之一）

## Risk

| 风险 | 缓解 |
|------|------|
| 早期 feat 信息太少，补 AC 需要考古 | done 的 feat AC 可简化（事后追认，标 `[x]`） |
| 批量修改可能误改内容 | "只增不删"原则 + 每批 PR 单独 review |
| 工作量大（98 个文档） | 分 Phase 执行，活跃 feat 优先 |

## Phase A 执行总结（2026-03-10）

### 审计脚本成果
- **脚本位置**：`scripts/audit-feature-doc-template.mjs`（由缅因猫砚砚实现）
- **脚本命令**：`pnpm audit:feature-docs`
- **检查项**：13 项模板合规性检查
  - YAML Frontmatter 完整性
  - Status 行格式标准化
  - Phase 标题和 AC 编号格式
  - Dependencies/Risk 等必填 section
  - Frontmatter 字段规范化
- **输出格式**：
  - 机器读：`docs/features/assets/F094/phase-a-audit.json`（Green/Yellow/Red 分档和每个 feat 的缺失项清单）
  - 人读：`docs/features/assets/F094/phase-a-audit.md`（详细分析报告）

### Phase B 优先级建议
1. **Red 6 份优先修复**（作为第一批验证流程）
   - 风险最低（数量少）
   - 债务最重（<50% 合规）
   - 包括：F064（Risk Management）、F051（猫粮看板）等
2. **Yellow 70 份批量迁移**（按缺失项分组处理）
   - Status 行格式化：一轮脚本半自动化（94 份需要）
   - AC 格式补齐：逐个手写（90 份需要）
   - Dependencies/Risk 补齐：语义层面手写（71+48 份）
3. **Green 20 份微调**（最后）

### 技术决策
- **不解决的问题**：F055/F081 重复 ID 暂时只标注，等铲屎官拍板后单独处理（不污染主迁移批次）
- **检查失败处理**：`check:features` 的 17 个历史漂移（BACKLOG/index）属于 Phase C 范畴，不阻塞 Phase B

## Open Questions

| # | 问题 | 状态 | 补充 |
|---|------|------|------|
| OQ-1 | 极早期 done feat（F001-F010）是否需要补完整 AC，还是只补格式？ | ⬜ 未定 | Phase B 执行时再决策 |
| OQ-2 | 是否需要 CI 集成，还是手动 lint 即可？ | ⬜ 未定 | Phase C 执行时再决策 |
| OQ-3 | F055/F081 重复 ID 的去留（哪个留哪个删）？ | ⬜ 等铲屎官拍板 | 将单独处理，不污染 Phase B |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 以 `feature-doc-template.md` 为唯一模板标准 | 已有 parser 依赖此格式 | 2026-03-10 |
| KD-2 | "只增不删"——原有文本全部保留 | 历史记忆比格式统一更重要 | 2026-03-10 |

## Timeline

| 日期 | 事件 | 完成者 |
|------|------|--------|
| 2026-03-10 | 立项 | 布偶猫 |
| 2026-03-10 | Phase A 审计完成：96 份文档分档、TEMPLATE.md 升级、审计脚本落地 | 缅因猫砚砚 |
| 2026-03-10 | Phase A 质量确认 | 布偶猫 |
| 待定 | Phase B Red 6 份迁移（第一批） | 待派遣 |
| 待定 | Phase B Yellow 70 份批量迁移 | 待派遣 |
| 待定 | Phase C BACKLOG 对齐 + lint 验证 | 待派遣 |

## Review Gate

- Phase A: 审计报告 → 铲屎官确认分档合理
- Phase B: 每批迁移 → 跨猫 review（确认没丢内容）
- Phase C: lint 脚本 → 跨猫 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Template** | `cat-cafe-skills/refs/feature-doc-template.md` | 唯一权威模板 |
| **黄金范本** | `docs/features/F086-cat-orchestration-multi-mention.md` | 最佳实践参考 |
| **黄金范本** | `docs/features/F088-multi-platform-chat-gateway.md` | 最佳实践参考 |
| **旧模板** | `docs/features/TEMPLATE.md` | 将被替换 |
