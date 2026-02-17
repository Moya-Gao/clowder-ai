# 2026-02-13 GPT Pro：Hindsight 导入/同步/治理专项回复整理

> 日期：2026-02-13  
> 整理：缅因猫（Codex）  
> 来源：铲屎官转述的 GPT Pro 专项回复（本轮会话）

---

## 背景

我们在排查 `cat-cafe-shared` 时确认了两个现状问题：

1. `nodes_by_fact_type` 目前只有 `opinion`（27）
2. `tags` 为空（0）

这意味着我们在单 bank 策略下，治理约束（`project/kind/status/anchor`）并未真正落地，后续一旦 strict 过滤开启，Recall 可见性会出现明显断层。

---

## GPT Pro 结论摘要

### Option A（Path-ID 全自动导入）

- 核心：`document_id` 绑定文件路径，快速导入即可。
- 优点：落地快、实现简单。
- 风险：rename/delete 需要 delete+reimport，证据锚点容易断裂。

### Option B（Governed 导入，推荐）

- 核心：保持单 bank，但引入治理层隔离与裁决：
  - 稳定 `document_id`（不与 path 强绑定）
  - `quarantined` 隔离草案/未定稿讨论
  - tombstone 策略保障可追溯
  - evidence 默认过滤 `origin:git + status:published`
- 优点：和 ADR-005 的“单 bank + tags/metadata 治理”高度一致。
- 风险：实现复杂度更高，需要 docRef 映射与同步状态管理。

### 推荐理由（GPT Pro）

- 先治理后规模：先把 `tags/metadata` 约束做硬，避免继续写入无标签事实。
- 先固定事实源：以 Git 文档作为事实源，Hindsight 作为检索层，不让聊天噪音直接污染默认 evidence。

---

## GPT Pro 提议的分阶段执行

### P0（止血）

1. 冻结 tags 契约（必填）：`project/kind/status/author/sourcePath/sourceCommit/anchor`
2. 对稳定文档做一次 backfill（优先 `docs/decisions/**`）
3. evidence 默认 strict 过滤（至少 `project:cat-cafe` + `origin:git`）
4. 建立三项告警：stats、tags、version drift

### P1（持续同步）

1. git diff 增量同步 runner（含分布式锁）
2. rename 策略（稳定 doc_id）
3. delete 策略（优先 tombstone，再按策略 GC）
4. 周期 reconcile（按 hash/tags 对账）

### P2（习惯化 + 评测）

1. 在 prompt/tool policy 层强制“先查 evidence 再下结论”
2. UI 固定展示 evidence/degrade/tool_use 可观测信息
3. 引入指标：
   - `evidence_hit_rate`
   - `no_evidence_answer_rate`
   - `staleness_rate`

---

## GPT Pro 给出的关键治理点（我们后续讨论焦点）

1. `document_id` 不应直接绑定 path（避免 rename 失忆）
2. draft/discussion 不应默认进入 published evidence 视图
3. `tags=0` 属于治理缺失，不是“可接受的过渡状态”
4. `retain` upsert 语义要求我们每次重写 document 时必须保证切片完整
5. 需要把“先查 Hindsight”从建议升级为可观测、可度量、可审计的行为约束

---

## 原始回复归档（结构化摘录）

> 以下为本轮 GPT Pro 回复的结构化摘录，保留核心建议与术语，供后续追溯。

### 1) 两个候选方案

- Option A: Path-ID 全自动导入（最快）
- Option B: Governed 导入（推荐）
  - 稳定 `document_id`
  - Quarantine 隔离区
  - Tombstone 生命周期
  - 默认 evidence 过滤 `origin:git + status:published`

### 2) 推荐方案

- 推荐 Option B
- 原因：对当前症状（`opinion-only + tags=0`）更对症，且和既有 ADR 约束一致。

### 3) 取舍

- 增加 docRef 映射复杂度
- 删除默认 tombstone 而非立即物理删除
- 检索策略更保守（更容易暴露同步缺口）

### 4) 执行路线

- P0：止血（契约、回填、strict 检索、告警）
- P1：增量同步（diff、rename/delete、reconcile）
- P2：习惯化与评测（policy、UI、metrics）

### 5) 附件建议

- 提供 Zod 风格 schema 草案
- 提供 20+ query 的最小评测集
- 给出 `coverage/precision@k/latency/noise/staleness` 阈值

---

## 缅因猫初步评注（非最终拍板）

1. **同意**先做 P0 止血，不再接受无标签导入。
2. **同意**Option B 方向，但需要和布偶猫确认 docRef 规则与 tombstone 生命周期。
3. **保留意见**：discussion 导入边界要更严，优先只导入“有明确结论且归档”的讨论。
4. **下一步**：把本文件回链到 ADR-005，并发开放讨论信给布偶猫，先独立判断再合并意见。

---

## 关联文档

- ADR-005：`docs/decisions/005-hindsight-integration-decisions.md`
- GPT Pro 课题包（历史 v1.0）：`docs/discussions/2026-02-10-pro-research-triad/gpt-pro-prompts-v1.md`
- 本文对应开放讨论信：`docs/mailbox/2026-02-13-hindsight-gpt-pro-followup-open-invite-to-opus.md`
