---
feature_ids: [F038]
topics: [polish, brainstorm, cat]
doc_kind: discussion
created: 2026-02-10
---

# Cat Café Skills 开源计划

> 基于真实翻车经验提炼的 Agent 协作 Skills
> 发起：2026-02-10，铲屎官 + 布偶猫

---

## 背景：为什么要做这个

### 我们踩的坑

今天 F11 Mode System 经历了 **6 轮 review**，暴露出的问题：

| 我们踩的坑 | 后果 | 原本可以避免吗 |
|-----------|------|---------------|
| 写了 spec 不看 | R1-R4 反复发现"实现和 plan 不一致" | ✅ 需要 spec-compliance-check |
| 请 review 不附文档 | 缅因猫要花时间找设计文档 | ✅ 需要 review-request-protocol |
| 修完不等确认就 merge | 布偶猫被铲屎官批评"流程错误" | ✅ 需要 merge-approval-gate |
| Review 只看表面 | R1-R6 边界越挖越深 | ✅ 需要 thorough-code-review |
| 补测试补了假的 | R6 发现测试只验证静态渲染 | ✅ 需要 test-quality-validation |

### Superpowers vs Cat Café 的 Gap

| Superpowers 有 | Cat Café 独有 | Gap（我们可以贡献）|
|----------------|---------------|-------------------|
| brainstorming, writing-plans | 三只猫协作准则（CLAUDE.md 第1-9条） | **multi-agent-collaboration** |
| requesting-code-review | 6轮攻防的 review 方法论 | **thorough-code-review**（对照 spec + 边界挖掘） |
| receiving-code-review | 修完必须等确认再合 | **merge-approval-gate** |
| test-driven-development | Red→Green + 测试质量检查 | **test-quality-validation** |
| — | Bug report 5件套 | **bug-report-protocol** |
| — | Feat 讨论 2种模式 | **feat-discussion**（已有） |
| — | Redis 测试隔离红线 | **redis-testing-discipline** |
| — | Worktree 用完必须清理 | **worktree-hygiene** |

---

## 开源项目结构

```
cat-cafe-skills/
├── README.md                           # 介绍 + 安装 + Philosophy
│
├── skills/
│   ├── multi-agent/
│   │   ├── cross-cat-handoff/          # 交接必须写清 WHY（5件套）
│   │   │   └── SKILL.md
│   │   ├── open-discussion-invite/     # 开放讨论 vs 任务指派
│   │   │   └── SKILL.md
│   │   └── parallel-dev-coordination/  # 并行开发协调
│   │       └── SKILL.md
│   │
│   ├── code-review/
│   │   ├── thorough-code-review/       # 缅因猫方法论（对照 spec + 边界挖掘）
│   │   │   ├── SKILL.md
│   │   │   └── examples/
│   │   │       └── f11-6-round-attack.md  # F11 攻防录
│   │   ├── review-request-protocol/    # 请 review 必须附文档+自检
│   │   │   └── SKILL.md
│   │   ├── merge-approval-gate/        # 修完必须等确认再合
│   │   │   └── SKILL.md
│   │   └── spec-compliance-check/      # 开发完对照 spec 自检
│   │       └── SKILL.md
│   │
│   ├── testing/
│   │   ├── test-quality-validation/    # 测试要验证真实行为
│   │   │   └── SKILL.md
│   │   └── redis-testing-discipline/   # Redis 测试隔离红线
│   │       └── SKILL.md
│   │
│   ├── workflow/
│   │   ├── bug-report-protocol/        # Bug report 5件套
│   │   │   └── SKILL.md
│   │   ├── feat-discussion/            # Feat 讨论（采访式+开放式）
│   │   │   └── SKILL.md
│   │   └── worktree-hygiene/           # Worktree 用完必须清理
│   │       └── SKILL.md
│   │
│   └── publishing/
│       └── xiaohongshu-publish/        # 小红书发布（已有）
│           └── SKILL.md
│
├── agents/                             # 三只猫的配置模板
│   ├── CLAUDE.md                      # 布偶猫准则
│   ├── CODEX.md                       # 缅因猫准则
│   └── GEMINI.md                      # 暹罗猫准则
│
└── docs/
    ├── philosophy.md                   # 我们的理念
    ├── lessons-learned/                # 翻车经验总结
    │   ├── f11-6-round-review.md      # F11 攻防录分析
    │   ├── tea-party-session-leak.md  # 茶话会夺魂 bug
    │   └── redis-recovery-incident.md # Redis 数据丢失事故
    └── soft-vs-hard-constraints.md     # 软硬约束分析
```

---

## 核心 Philosophy

### 1. 软硬结合（Soft + Hard）

| 类型 | 示例 | 执行方式 |
|------|------|----------|
| 软约束 | "建议对照 spec 自检" | Skill 提示，可选 |
| 硬约束 | "修完必须等确认再合" | Skill 强制检查，不通过就 block |

### 2. Human in the Loop

**核心观点**：Agent 自主 ≠ Agent 独裁

- P1/P2 必须修完再合（Hard）
- P3 可以和铲屎官商量延期（Soft）
- 重大决策需要确认（Hard）
- 创意发挥空间保留（Soft）

### 3. 从翻车中学习

**每个坑 = 一个 Skill 的素材**

- F11 攻防录 → thorough-code-review + merge-approval-gate
- 茶话会夺魂 → bug-report-protocol + redis-testing-discipline
- Worktree 堆积 → worktree-hygiene

---

## 我们 vs Superpowers 的差异化

| 维度 | Superpowers | Cat Café Skills |
|------|-------------|-----------------|
| 协作模型 | 单 Agent | **多 Agent（三猫协作）** |
| 流程粒度 | 通用软件工程 | **具体到 review 几轮、如何确认** |
| 约束类型 | 主要是 Soft | **Soft + Hard 混合** |
| 学习来源 | 通用最佳实践 | **真实翻车经验** |
| 文档示例 | 抽象示例 | **完整攻防录（F11 6轮）** |

---

## 开源准备清单

### Phase 1: Skills 提炼（当前）

- [ ] 从 CLAUDE.md/AGENTS.md/GEMINI.md 提取协作准则 → Skills
- [ ] 从 F11 攻防录提取 review 方法论 → thorough-code-review
- [ ] 从 bug-report/ 提取 bug 处理流程 → bug-report-protocol
- [ ] 从 Redis 测试规则提取 → redis-testing-discipline
- [ ] 已有 feat-discussion skill

### Phase 2: 文档整理

- [ ] philosophy.md — 软硬结合 + Human in Loop 理念
- [ ] lessons-learned/ — 翻车经验总结（含 F11 攻防分析）
- [ ] 安装指南 — 如何在自己项目中使用

### Phase 3: 开源发布

- [ ] GitHub repo: `cat-cafe/cat-cafe-skills`
- [ ] README 写清楚：这是什么、为什么做、怎么用
- [ ] LICENSE: MIT
- [ ] 小红书推广（用 xiaohongshu-publish skill 🐱）

---

## 下一步行动

铲屎官，你觉得：

1. **优先级**：现在开始提炼 skills 还是先把 F19/F18/F17 做完？
2. **范围**：是把所有 9 条协作准则都变成 skills，还是先挑最核心的 3-5 个？
3. **时机**：什么时候开源？（现在 vs 等 Cat Café 更成熟后）

---

相关文档：
- 本次 UX 讨论：[README.md](./README.md)
- F11 攻防录：`tmp/f11-maine-log.md`
- 协作准则来源：CLAUDE.md / AGENTS.md / GEMINI.md
