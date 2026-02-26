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

### 目录结构

```
docs/
├── BACKLOG.md              # 简化为活跃 Feature 索引（热层）
├── TECH-DEBT.md            # 技术债务单独文件
└── features/               # Feature 聚合目录（温层）
    ├── F40-backlog-reorganization.md  # 本文件，第一个示范
    ├── F21-signal-hunter.md
    └── ...
```

### feat 聚合文件模板

```markdown
# FXX: 名称

> **Status**: idea | spec | in-progress | review | done | archived
> **Owner**: 布偶猫 | 缅因猫 | 暹罗猫
> **Created**: YYYY-MM-DD
> **Completed**: YYYY-MM-DD（如果 done）

## Why
一句话：为什么要做

## What
一句话：做什么

## Links（单向引用）
- **Spec/Plan**: [链接](...)
- **Discussion**: [链接](...)
- **Review**: [链接](...)
- **Bug Reports**: [链接](...)
- **PR**: #XX
- **Commit**: abc1234

## Key Decisions（关键决策）
为什么这样设计？放弃了什么？（压缩后不用读冷层就能理解设计意图）

## Dependencies
- **Blocked by**: FXX
- **Blocks**: FXX
- **Evolved from**: FXX（如果是演进）

## Timeline
- YYYY-MM-DD: Spec written
- YYYY-MM-DD: Phase 1 done
- ...
```

### 归档规则（简化版，采纳 4.6 建议）

| 状态 | 存放位置 | 触发时机 |
|------|----------|----------|
| in-progress | BACKLOG.md 有一行 + features/FXX.md | 开发中 |
| done | 从 BACKLOG 移除，features/FXX.md **永久保留** | 合入 main 时 |

> 不需要 6 个月归档——features/ 里都是轻量 md 文件，grep 够快。

### Skill 设计（采纳 4.6 建议：kickoff 而非 completion）

`feat-kickoff` skill，在**创建 feat 时**触发（不是完成时！）：
1. 创建 `docs/features/FXX-name.md` 聚合文件
2. 在 BACKLOG.md 添加索引行
3. 开发过程中持续更新聚合文件

> 4.6 的观点：如果只在完成时才补聚合文件，信息已经散落了。应该一开始就建。

---

## Related Docs（冷层链接）

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | [docs/research/2026-02-25-memory-design/proposal.md](../research/2026-02-25-memory-design/proposal.md) | 三层记忆架构设计 |
| **Discussion** | 本 thread（2026-02-26 铲屎官 + 布偶猫）| BACKLOG 问题诊断 |
| **BACKLOG 条目** | 待登记 | - |

---

## Progress（进度）

- [x] 2026-02-26: 问题诊断完成
- [x] 2026-02-26: 探索现有 feat 关系图（haiku）
- [x] 2026-02-26: 创建本文件（第一个示范）
- [x] 2026-02-26: 与 Opus 4.6 讨论，纳入三点改进（Key Decisions 字段、取消 6 月归档、kickoff 而非 completion）
- [ ] 设计 BACKLOG 新结构（拆分 Feature Roadmap + Tech Debt）
- [ ] 设计 feat-kickoff skill
- [ ] 用 F21 验证模板
- [ ] 用 F32 验证"分阶段交付"记录
- [ ] 批量整理现有 feat

---

## Open Questions

1. ~~**递进关系怎么记**~~ → **已解决**：用 Dependencies 字段的 `Evolved from` 够了。需要全局图就跑脚本从所有 feat 文件提取生成，不手动维护 graph.md（4.6 建议）
2. **编号规范**：F = Feature，# = Tech Debt，不再混用。已有的 F101 等如果实际是 debt 需要重新编号
3. **历史 feat 要不要补**：渐进式——新 feat 必须建，历史 feat 按需补

---

*本文件是 feat 聚合体系的第一个示范——用整理 BACKLOG 这个任务来验证模板设计。*
