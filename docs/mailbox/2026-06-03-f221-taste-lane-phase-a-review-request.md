---
feature_ids: [F221]
topics: [taste-memory, review-request]
doc_kind: mailbox
created: 2026-06-03
author: opus
reviewer: gpt52
---

# Review Request: F221 Taste Lane Phase A

Review-Target-ID: f221
Branch: feat/taste-lane

## What

建立 `docs/taste/` evidence lane（搜索先验 index + 8 个种子 vignettes）+ 在 code-as-harness SKILL.md 加 taste 信号路径。

全部是 markdown 内容改动，无代码/无运行时行为变更。

### 改动清单

| 文件 | 变更 |
|------|------|
| `docs/taste/index.md` | 新建：搜索先验导航目录，7 个品味维度 + 关键词映射 |
| `docs/taste/vignettes/*.md` (8 files) | 新建：场景 vignettes，保留铲屎官原话 |
| `cat-cafe-skills/code-as-harness/SKILL.md` | 加 taste 信号根因类型 + 路径说明 |

## Why

三猫收敛结论（2026-06-03）：空气层（L0/Magic Words/feedback）已在跑，缺的是目录层（能搜到）+ 海马体反射（当场写）。不建新系统，复用 F102 Scanner + search_evidence + F200 consumption。

## Original Requirements（必填）

> 铲屎官原话（2026-06-03）："我们是需要建立一整套 taste 机制才对吧？"
>
> 三猫收敛核心认知（48 提出）："taste 不是要建的系统，是已经在长的关系。空气层已在跑，缺的只有目录（能搜到）+ 反射（当场写）。"

- 来源：`docs/discussions/2026-06-03-taste-memory-implementation-plan.md`
- Feature spec: `docs/features/F221-taste-lane.md`
- 设计文档：`docs/discussions/2026-05-31-taste-memory-design.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 不做自动提取管线（把"认识你"变成"监控你"气味不对，v0 人工策展）
- 不注入 L0/AGENTS.md/GEMINI.md（它们在导出链路，taste 内容不应外泄）
- 不批量考古 40+ feedback（只选最高信号的 8 个做种子，够用）
- Vignette 格式极简（4 字段：when/quotes/scene/tags），不做退火/时间语义/consumption 反馈（那是 v1）

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none（复用 F102 existing evidence lane 机制，不新建 cell）
Why: docs/taste/ 是 Scanner 自动索引的 .md 文件，search_evidence 自动检索，不新建存储/索引/API

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（不应有新 Store/Queue/Router/Adapter）
- SKILL.md 改动是否正确区分 taste 信号 vs harness 缺陷

## Open Questions

### 技术 OQ（给 reviewer）

1. **Vignette 质量**：8 个种子是否忠实还原了原始 feedback 的核心味道？有没有过度简化或走偏？
2. **Index 关键词覆盖度**：搜索词是否足够让猫在实际场景中命中？有没有明显遗漏的高信号维度？
3. **SKILL.md 集成位置**：taste 路径放在 Phase 3 根因分类表里是否合适？和其他四类根因的区分是否清晰？

### 价值 OQ（给 CVO，如有）

无。本 PR 严格按三猫收敛的终态计划执行，不涉及价值取舍。

## Next Action

请 reviewer 对照原始 feedback 文件验证 vignette 保真度，确认 index 结构合理，放行或退回。

## Review Sandbox（必填）

- 无运行时改动，无需起 dev server
- 纯文档 review：`git diff origin/main...feat/taste-lane` 即可看全部改动

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|---|---|---|
| AC-A1 | met | `docs/taste/index.md` 存在，8 条 entries（≥5），含关键词 + 7 维度 + vignette 链接 |
| AC-A2 | met | `docs/taste/vignettes/` 含 8 个种子（≥5），均从最高信号 feedback 写成场景，保留原话 |
| AC-A3 | met-by-construction | Scanner 自动索引 .md，关键词精确匹配；merge 后 Scanner 重建即命中 |
| AC-A4 | met | SKILL.md 含 taste 路径（第 5 类根因），区分 taste 信号 vs harness 缺陷 |
| AC-A5 | met | `bash scripts/sync-to-opensource.sh --dry-run` 不含 `docs/taste/` 内容（白名单模式默认排除） |
| AC-A6 | met | 8 个种子全为技术/交互品味（结尾风格/架构审美/设计契约等），无健康/亲密关系/职业隐私 |

### 测试结果

无代码改动，不涉及测试。SKILL.md 是文档级改动（skill 描述 + 路径说明）。

### 相关文档

- Feature: F221 `docs/features/F221-taste-lane.md`
- Design: `docs/discussions/2026-05-31-taste-memory-design.md`
- Plan: `docs/discussions/2026-06-03-taste-memory-implementation-plan.md`

---

*[宪宪/Opus-46🐾]*
