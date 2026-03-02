---
feature_ids: [F042, F043, F046, F049]
topics: [roadmap, convergence, knowledge-engineering, architecture]
doc_kind: meeting-notes
created: 2026-03-02
---

# F042 路线图收敛 × 知识工程拉通

**Thread**: 铲屎官 2026-03-01 21:02 发起
**参与者**: 布偶猫 宪宪 (Opus 4.6) + 缅因猫 砚砚 (Codex)
**扇入者**: 布偶猫（铲屎官指定）
**模式**: collaborative-thinking Mode B → Mode C

> **⚠️ 修正 (2026-03-02 22:44)**：本纪要原始版本错误地将 `feat/f042-routing-policy-scopes` 标记为"未合入"并建议毕业到 F049 Phase B。实际上该分支已通过另一线程的砚砚 rebase 后以 PR #148 (`b0cadb6a`) 合入 `origin/main`。错因：盘点时本地 main 未拉最新，导致 `git cherry` 对比结果误导。这恰恰是 LL-027（spec/代码时间线漂移）的现场案例。已修正 F042/F049 spec。

---

## 背景

铲屎官要求两猫独立分析 F042 的未来路线，考虑是否与 F043/F046/F049 拉通。
知识工程研究（`docs/research/knowledge-enginnering/`）作为共同基底。

## 各方观点摘要

### 布偶猫（扇入者）

1. **四层知识工程栈**：F042(知识编码) → F043(协作基建) → F046(愿景守护) → F049(任务编排)，层层依赖
2. **F042 应正式关闭**：~70% 已完成，剩余项"毕业"到上层 Feature，不让 F042 成为僵尸
3. **F046 最优先**：Anti-Drift 是乘数效应，每个后续 Feature 都受益
4. **`feat/f042-routing-policy-scopes`** → 吸收进 F049 Phase B

### 砚砚

1. **F042 作为"基座契约"**：不并入其他 Feature，以依赖关系拉通
2. **M1→M3 三里程碑**：F042 收口 → F049 承接运行时锚点 → F043+F046 双门禁
3. **F043 先不拆 server**：只加 P0/P1 工具
4. 与布偶猫一致：硬编码清理、spec 更新、分工

## 共识区

| # | 共识 |
|---|------|
| 1 | F042 应收尾，剩余项毕业到其他 Feature |
| 2 | 四个 Feature 通过知识工程栈关联，但保持独立 spec 和生命周期 |
| 3 | `feat/f042-routing-policy-scopes` 不阻塞 F042 收尾 |
| 4 | 分工：Opus 架构守护 / Codex 实现 / GPT-5.2 review |
| 5 | F043 先加工具再拆 server（Phase A 不依赖 F041） |
| 6 | 知识工程研究是 F042 的核心产出，需正式关联 |

## 分歧区

| # | 分歧点 | 布偶猫 | 砚砚 | 最终决策（布偶猫拍板） |
|---|--------|--------|------|----------------------|
| 1 | F046 vs F049 优先级 | F046 先（乘数效应） | F049 先（承接 F042 运行时） | **F046 先**。F041 教训证明：没有漂移防护，后续 Feature 有"做完做错"风险。F049 MVP 已够用，Phase B 可等。 |
| 2 | F042 最终状态 | Done（关闭） | 基座契约（保持活跃） | **Done**。"基座"概念正确但不应作为 Feature 状态——知识工程原则已沉淀在 manifest.yaml + 研究文档中，F042 的使命完成。 |
| 3 | F043 server 拆分时机 | Phase 3 做 | 先不做 | **砚砚对**，先不拆。拆分依赖 F041 配置编排器，目前没就位。 |

## 最终路线图（布偶猫拍板）

```
M1: F042 收尾         ← 现在做（小）
M2: F046 Phase B      ← 最优先（乘数效应）
M3: F043 Phase A      ← 然后（基建）
M4: F049 Phase B      ← 之后（编排层成熟）
```

### M1: F042 收尾（Now）

| 项目 | 负责 |
|------|------|
| 更新 F042 spec → Done + graduation map | 布偶猫 |
| 清理 skill 正文硬编码猫名（优先 merge-gate, cross-cat-handoff） | 砚砚 |
| 关联知识工程研究为 F042 deliverable | 布偶猫 |
| `feat/f042-routing-policy-scopes` → 记入 F049 backlog，删本地分支 | 砚砚 |

### M2: F046 Phase B（Next Priority）

| 项目 | 来源 |
|------|------|
| B1: 截图/录屏证据流程 | F046 原有 |
| B2: Cold-start Verifier 试点 | F046 原有 |
| B3: 需求点 checklist | F046 原有 |
| B4: skill-lint CI gate（`pnpm check:skills`） | ← F042 Wave 2 毕业 |
| B5: ≥10 条对话场景回归 | ← F042 Wave 3 毕业 |
| B6: 同族 reviewer identity check gate | ← F042 Wave 3 毕业 |

### M3: F043 Phase A（Then）

| 项目 | 来源 |
|------|------|
| P0: `search_messages`（catId/keyword 过滤） | F043 原有 |
| P1: `list_threads` + `feat_index` | F043 原有 |
| Thread metadata stage tracking | ← F042 Wave 3 毕业 |
| Server 拆分 1→3 | **延后**，等 F041 配置编排 |

### M4: F049 Phase B（After）

| 项目 | 来源 |
|------|------|
| Lease/heartbeat 并发安全 | F049 原有 |
| 权限棘轮（self-claim） | F049 原有 |
| Thread-scoped routing policy | ← `feat/f042-routing-policy-scopes` |

## 知识工程栈架构（共识）

```
┌─────────────────────────────────────────────────┐
│  Layer 4: Mission Hub (F049)                    │  任务编排
│  Layer 3: Anti-Drift (F046)                     │  愿景守护
│  Layer 2: MCP Unification (F043)                │  协作基建
│  Layer 1: Prompt/Skills (F042) ← Done           │  知识编码
│  Layer 0: Knowledge Engineering Research ← Done │  方法论基底
└─────────────────────────────────────────────────┘
```

每层依赖下层：F049 需要 F043 的 MCP 工具；F046 需要 F042 的 Skills chain。

## 分工

| 角色 | 职责 |
|------|------|
| 布偶猫（Opus 4.6） | M1 文档更新 + 架构守护 + 路线 review |
| 砚砚（Codex） | M1 代码清理 + M2/M3/M4 实现 |
| 砚砚（GPT-5.2） | 每个里程碑的 review gate |

## 收敛检查

1. 否决理由 → ADR？**有** — 否决"F042 并入 F043/F046"（保持独立 spec + graduation）；否决"F043 立即拆 server"（等 F041）
2. 踩坑教训 → lessons-learned？**有** — spec 与实现时间线漂移误导路线判断（F042 spec 停在 2026-02-28 但代码已推进 6 PR）
3. 操作规则 → 指引文件？**有** — "Feature 合入 PR 后 48h 内必须同步 spec Timeline/Status"

## 追溯链

```
BACKLOG F042/F043/F046/F049
  └→ 本纪要（收敛决策）
      ├→ F042 spec（→ Done + graduation map）
      ├→ F046 spec（→ 吸收 B4/B5/B6）
      ├→ F043 spec（→ 更新依赖 + 延后拆分）
      ├→ F049 spec（→ 吸收 routing-policy-scopes）
      └→ docs/research/knowledge-enginnering/（方法论基底）
```

---

[宪宪/Opus-46🐾]
