---
name: feat-lifecycle
description: >
  Feature 立项、讨论、完成的全生命周期管理。
  Use when: 开个新功能、new feature、F0xx、立项、feature 完成、验收通过、讨论新功能需求。
  Not for: 代码实现、review、merge（那些有专门的 skill）。
  Output: Feature 聚合文件 + BACKLOG 索引 + 真相源同步。
triggers:
  - "开个新功能"
  - "new feature"
  - "F0xx"
  - "立项"
  - "feature 完成"
  - "F0xx done"
  - "验收通过"
  - "讨论新功能需求"
argument-hint: "[阶段: kickoff|discussion|completion] [F0xx 或主题]"
---

# Feature Lifecycle

管理 Feature 从诞生到收尾：立项建追溯链、讨论沉淀决策、完成闭环同步。

## 核心知识

**Feature vs Tech Debt**：铲屎官能感知变化 → Feature；只有开发者知道 → Tech Debt。不确定先记 TD。

**追溯链架构**：`BACKLOG.md`（热层）→ `docs/features/Fxxx.md`（温层，唯一入口）→ discussions/research/plans（冷层）

**演化关系**：`Evolved from`（功能演进）/ `Blocked by`（硬依赖）/ `Related`（松耦合）

## 立项 (Kickoff)

**触发**：铲屎官说"新功能"/"立项"、讨论收敛确认要做。**不触发**：还在探索 → `collaborative-thinking` Mode A；小修补 → TD。

**5 步流程**：

1. **分配 ID**：`grep -E "^\| F[0-9]+" docs/BACKLOG.md | tail -1`，新 ID = 最大 + 1，三位数

2. **创建聚合文件** `docs/features/Fxxx-name.md`（kebab-case 文件名）

   ```yaml
   ---
   feature_ids: [F042]
   related_features: []
   topics: [关键词]
   doc_kind: spec
   created: 2026-02-28
   ---
   ```
   核心章节：Why / What / Acceptance Criteria / Links / Key Decisions / Dependencies (`Evolved from`) / Risk / Open Questions / Review Gate / Timeline
   并在 spec 中补一节：`## 需求点 Checklist`（模板见 `cat-cafe-skills/refs/requirements-checklist-template.md`）

3. **更新 BACKLOG.md**：末尾加 `| F042 | 名称 | spec | Owner | [F042](features/...) |`

4. **关联文档**：Links 章节列出相关 research/discussion；更新这些文档的 `feature_ids: [F042]`

5. **Commit**：`docs(F042): kickoff {名称} [{猫猫签名}]`，body 含 What/Why

**检查**：聚合文件创建 ✓ frontmatter 完整 ✓ BACKLOG 索引 ✓ 关联文档双向链接 ✓ 已 commit ✓

## 讨论 (Discussion)

**两种模式**：

- **采访式（默认）**：铲屎官口述 → 一次一问澄清（"为什么要？现在怎么做？做完后怎么用？"）→ 排优先级 → 记开放问题。**Anti-anchor**：先让铲屎官表达完，再分析。

- **开放讨论**：多猫协作。结构：背景 + 我的分析（仅供参考，**先自己想再看**）+ 开放问题（按角色分组）+ 我的倾向（透明推理链）。明确标"这是讨论不是任务"，保护观点独立性。

**讨论结束必须做**：
1. 落盘到 `docs/discussions/YYYY-MM-DD-{topic}/README.md`（含铲屎官原话、决策过程、优先级排序）
2. BACKLOG.md 该 Feature 行 ref 讨论文档链接
3. Commit：`docs: {topic} discussion + backlog update [{猫猫签名}]`

## 完成 (Completion)

**触发**：AC 全部打勾 + PR 合入 + 云端 review 通过。**不触发**：只是 Phase 完成 / 只是 review 过了。

**Step 0: 愿景对照（必须先做，不可跳过）🔴**

AC 全打勾 ≠ 完成（F041 血泪教训：12 项 AC ✅ 但 UI 不可用）。先读原始 Discussion/Interview（铲屎官原话在那里）：

```bash
grep -r "Fxxx" docs/ --include="*.md" -l  # 找关联文档
```

自问三个问题：① 铲屎官最初要解决的核心问题是什么？② 交付物能解决那个问题吗？③ 铲屎官坐在 Hub 前用这个功能，体验是什么样的？

**跨猫交叉验证（强制）**：另一只猫独立读原始文档、独立回答三问，答案对齐才继续。分歧 → 讨论收敛；交付物不匹配愿景 → 停止 completion，重新打开 Feature。

在聚合文件末尾追加签收表（猫猫 / 读了哪些文档 / 三问结论 / 签收）。

前端 UI/UX 额外要求：≤3 张截图 + 15s 录屏 + "需求→截图"映射表。

**Step 1**: AC 全部 `[x]`；未完成项先确认（完成 / 转 TD / 确认不需要）

**Step 2**: 聚合文件 → `Status: done`，加 `Completed: YYYY-MM-DD`，Timeline 加收尾记录

**Step 3**: 演化关系 — 确认 `Evolved from` 填写；考虑"往哪去"：有明确后续 → 触发 kickoff 立项

**Step 4**: 从 `docs/BACKLOG.md` **移除**该行；`docs/features/README.md` 加入"已完成"表格（聚合文件永久保留，不删）

**Step 5**: 真相源同步 — 所有关联文档 `feature_ids` 正确；Links 章节无遗漏

**Step 6**: Commit：`docs(Fxxx): mark feature as done [{猫猫签名}]`，body 含 What/Why/Evolved from

## Quick Reference

| 阶段 | 关键动作 | 文件 |
|------|---------|------|
| Kickoff | 分 ID → 聚合文件 → BACKLOG → 双向链接 | `docs/features/Fxxx.md` |
| Discussion | 采访/开放 → 落盘 → BACKLOG ref | `docs/discussions/` |
| Completion | 愿景对照 → 跨猫验证 → 更新状态 → 移出 BACKLOG | `docs/features/Fxxx.md` |

## Common Mistakes

| 错误 | 正确 |
|------|------|
| 完成后才补聚合文件 | Kickoff 时就建 |
| AC 打勾就标 done，不读原始需求 | Step 0 愿景对照（F041 教训） |
| 自己验完就收尾 | 跨猫交叉验证是强制的 |
| 删了聚合文件 | 只从 BACKLOG 移除，聚合文件永久保留 |
| 不记录演化关系 | Completion Step 3 必须思考 |
| 讨论完不落盘 | 讨论结束写入 `docs/discussions/` |

## 下一步

- Kickoff 后 → `writing-plans`（写实现计划）
- 开发完成后 → `quality-gate` → `request-review`
- Review 通过后 → `merge-gate`（合入）→ 回来用 completion 闭环
- 讨论收敛后 → `collaborative-thinking` Mode C（沉淀 ADR/规则/教训）
