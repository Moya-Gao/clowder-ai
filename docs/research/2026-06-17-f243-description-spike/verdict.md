---
feature_ids: [F243]
topics: [phase-a, verdict, mode-decision]
doc_kind: research
created: 2026-06-18
verdict_author: opus-47
trace_to_ac: AC-A4 (description generation 形态判定)
---

# F243 Phase A Step 4 — Verdict（description generation 形态判定）

> **Trace 回 spec**: F243 spec AC-A4 "description generation 形态判定（小模型/大猫/模板任一）有数据支撑"
> **Aggregate data**: `aggregate.md`（commit 同此 PR）
> **Evaluator provenance**: opus-47 (502519c90) + codex (cf6793199) + opus 4.6 (25466d94c 替代 antig-opus, CVO 2026-06-18 08:44 signoff)

## TL;DR

**形态判定 = Mixed Pipeline + Prompt v4 Sharpen**：

- 小模型 draft 仍 viable as first-pass generator（easy mode 75% PR + 三猫"无分歧硬底" 3/10 一致 PR）
- **必须**强制 PR-time 大猫 confirm-and-edit gate（不是橡皮章 review；spec KD-4 已规定）
- **必须**Prompt v4 sharpen（v3 在硬骨头 + status 字段两个维度系统性 weakness）
- **不进**直接小模型 production（不达 charter 7/10 阈值）
- **不退**到纯大猫手写（数据支撑 3/10-4/10 PR rate，draft 仍 saves cost on easy mode）

## 1. 数据 summary

| 维度 | 数据 | 阈值 (charter) | 判定 |
|---|---|---|---|
| 三猫一致 PR | **3/10** (F012/F013/F170) | ≥ 7/10 | ❌ 不达 |
| 多数表决 PR | **4/10** (+F009) | — | informational |
| 至少 1 猫 PR | **7/10** (+F008/F038/F155/F161/F189，少 F119/F189 多数 fail) | — | informational |
| 硬骨头 nuance loss | 严判 83% / 宽判 ~50% | ≤ 30% | ❌ 不达 |
| Easy nuance loss | < 20% | ≤ 30% | ✅ 达 |
| hard rules formal | 10/10（含 ⚠️ 边缘）/ 5/10（严判 H1 复述 ❌） | — | informational |
| soft 维度 avg | ~4/5 | ≥ 4/5 | ✅ 达 |
| fluff 黑名单 | 0/10 命中 | 0 | ✅ 达 |

## 2. 形态判定推论

### 2.1 不选 Option A "小模型生产 production-ready"

- 三猫一致 PR 3/10 远低于 7/10 阈值
- 硬骨头 nuance loss 50-83% 远超 30% 阈值
- H1 复述（严判 5/10 hard fail）+ status 字段（10/10 sample 9 篇 status 丢失）两个 systemic gap
- charter 阈值字面执行 → 不可行

### 2.2 不选 Option B "大猫手写"

- 三猫一致 3 sample PR（F012/F013/F170）说明小模型在 easy + meta-purpose well-defined sample 上确实 viable
- 多数表决 4/10 PR + 至少 1 猫 PR 7/10 说明 draft quality 仍 above baseline
- 完全 nuke 小模型 → 浪费已验证的部分 viability + 增加大猫工作量 100%（vs ~70% with draft）

### 2.3 不选 Option D "模板（H1 + status + topics 无 description）"

- F170 / F012 / F013 三猫一致 PR 证明 description 在适合的 sample 上能加 reader value
- 完全 nuke description → 损失 cold-start friction reduction 上限
- Index 入口效用降低（H1 + status + topics 单独 entry 信息量不如 + description）

### 2.4 选 Option C "Mixed Pipeline + Prompt v4 Sharpen"（**推荐**）

数据支撑：
- 小模型 draft viable for easy mode（75% PR）
- 硬骨头需要大猫精修——这本来就在 spec KD-4 强制 PR-time 大猫 confirm
- "draft + confirm gate" 设计正好命中：直接 PR 的 30-40% 不修；7/10 sample 需大猫精修 nuance loss（但有 draft 作 anchor，cost ~70% vs 100%）

## 3. 推荐 Production Pipeline 形态

```
[New PR / scope change / status transition]
  ↓
[小模型 (烁烁 @gemini35) 生成 description draft via prompt v4]
  ↓
[PR comment: draft + self-check (9 hard rules + 字数 + status 维度)]
  ↓
[作者必须显式 confirm (PR template checkbox)]
    ↓ confirm
  [作者可 edit description 后再 confirm（精修 nuance loss）]
    ↓ confirm-edited
  [CI lint: hard rules + status field presence + frontmatter schema]
    ↓ pass
  [PR mergeable]
  ↓
[每月 eval：扫漂移 top 10 + 抽查（不是 gate）]
```

**关键 invariants**（spec 已规定）：
- **不抽查代 gate**（KD-4）：抽查 only eval 层
- **decision provenance trail**（Risk row "小猫代偿决策"）：`Description by: [@gemini35-draft → @author-confirmed]`
- **触发节流**（KD-3）：H1/scope/status 改才重新生成 draft（其他小改不触发）

## 4. Prompt v4 必要 sharpening（基于三猫共识）

### Rule 10（新增 — status 字段强制）

```
10. **必须传达 status 维度**：在 description 内嵌入 status 信号
   （done/spec/parked/archived/implemented 至少一个）。
   示例：✓ "F038 是已搁置（parked）的技能加载方案..."
        ✗ "F038 是技能加载方案..."（reader 无法判断 active 与否）
```

**根因**：三猫共识 10/10 sample 中仅 F170 通过"归档"二字精准传达 status。这是 description 作为 index entry 的最大 systemic 问题。

### Rule 3 重表述（H1 复述边界明确）

```
3. **不照搬 H1 句式但允许重用领域 token**：
   - ✗ description 含 H1 完整短语（如 "ACP 传输 + 模板环境变量映射"）
   - ✗ description subtitle 几乎原文复现
   - ✓ 复用 H1 中的领域名词作为关键技术 anchor（如 "tool_use" / "OperationContext"）
   - ✓ 句式必须与 H1 不同（H1 描述 What, description 描述 Why+What）
```

**根因**：opus 严判 H1 复述 hard fail vs 砚砚 H1 token 重用可接受——两人都对但解释不同。重表述明确边界。

### Rule 11（新增 — 禁止 doc_kind suffix template）

```
11. **禁止 doc_kind formulaic suffix**：
   不要以 "规范" / "笔记" / "文档" / "spec" 结尾，因为 doc_kind 已在
   frontmatter，suffix 不增加 discrimination。
```

**根因**：opus 4.6 独立发现 10/10 sample 100% doc_kind suffix。建议 prompt v4 禁。

### Rule 12（新增 — 隐喻保留 vs 替换）

```
12. **优先保留原 doc 隐喻，禁止用 generic 隐喻替换原生隐喻**：
   - 原 doc 含 "spotlight" / "HUD" / "孤岛" / "图书馆" 等具象隐喻 →
     description 必须包含至少一个原 doc 隐喻 token
   - 原 doc 无显著隐喻 → 可添加 generic "看板" / "驾驶舱" / "沙盘"
   - 禁止：用 "看板" 替换 F155 的 "场景式" 这种 regression
```

**根因**：opus 4.6 finding F155 "场景式" 核心隐喻被 generic "看板" 替换 = critical nuance loss（feature 命名核心被抹掉）。

## 5. Phase B 启动 Prerequisite（建议）

按本 verdict 走 Mixed Pipeline + Prompt v4，Phase B 启动前还需：

| Prerequisite | 责任 | 备注 |
|---|---|---|
| Prompt v4 fixate (12 条 rules) | 宪宪 / 砚砚 co-design | Phase A spike 数据驱动 |
| Mini-spike v4（验证 Rule 10/3/11/12 是否 close gap）| 烁烁 generate 3 篇 critical sample (F119/F155/F161) | 不重跑 10 篇 stratified（cost 不值），验证 H1+status 关键修复够不够 |
| PR template 设计 (confirm checkbox + 大猫 edit + decision provenance trail) | Phase B AC-B1/B2 scope | spec 已规定 |
| CI lint design (frontmatter schema + status field presence + hard rules) | Phase B AC-B3 scope | spec 已规定 |

## 6. Clean-pool Bias 显式 limitation（trace from charter）

**重申**：本 verdict 基于 10 sample 全 reviewer-untouched 早期 docs。Production reviewer-touched docs 可能有不同 stress profile：
- 更难：reviewer 历史让 doc 结构更复杂，H1 + subtitle 更长，nuance 密度更高
- 不那么难：reviewer 可能已经在 doc Why 段写了 quality description 作 anchor

**建议**：Phase D extend evaluation 时用 reviewer-touched production docs 验证 generalize（不是 Phase A scope）。

## 7. Retraction conditions

1. **Mixed pipeline cost-benefit 假设**：我假设 "draft + 精修 ~70% cost" vs "纯手写 100% cost" 是 30% saving。如果实际 confirm gate setup cost（PR template / CI / provenance trail）超过 30% saving，应回到 Option B (大猫手写)
2. **Prompt v4 是否真能 close gap**：我建议加 Rule 10/3/11/12 但没数据证明这些 rules 真能 fix H1 复述 + status missing。Mini-spike v4 验证是 Phase B prerequisite
3. **Inter-rater agreement 弱（opus 系 vs 砚砚）的影响**：如果 charter 本意倾向砚砚的宽解释（"H1 token 重用 acceptable for 160-char profile"），形态判定可能直接是 Option A viable + minor status guard。当前判定走中间路径，aggregator 偏 opus 系 prior 可能影响判断
4. **第三棒替代影响**：opus 4.6 替代 antig-opus 让 opus 系占 2/3，跨族 perspective 减弱。如果 antig-opus 实际能跑（不阻塞），verdict 可能更偏砚砚那一端

## 8. Verdict 决策位

**形态判定**：**Mixed Pipeline + Prompt v4 Sharpen**（Option C）

**下一棒**：
- F243 spec AC-A4 标记完成 + verdict 链接
- Charter Step 4 标记完成
- Phase B prerequisite 列表（prompt v4 fixate / mini-spike v4 / PR template / CI lint）入 spec backlog
- 跨 thread post 回评分 thread 通知 4.6 + 砚砚（spike chain 闭环）
- 主 thread (OKF) status update + CVO ack

**CVO signoff required for**：Phase B 启动（Prompt v4 fixate + mini-spike v4 走完后立 PR template / CI lint）。
