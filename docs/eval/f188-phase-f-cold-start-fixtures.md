---
feature_id: F188
doc_kind: eval-fixture
phase: F
created: 2026-05-10
topics: [eval, cold-start, memory-navigation, turns-to-baton]
related:
  - docs/features/F188-library-stewardship.md
  - docs/plans/2026-05-10-f188-phase-f.md
---

# F188 Phase F — Cold-Start Eval Fixtures (AC-F8)

> 3 个 cold-start 场景 gold-set，用于测量 `turns-to-baton` 改善 — 对比
> "只 search_evidence" (legacy baseline) vs "三入口" (Phase F 后)。
>
> 30% 减少阈值标 **provisional**（KD-9）— PR merge 后首次 eval (~1-2 周)
> 用真实数据校准。Event log (AC-F10) 上线后即开始采。

## Baton 事件定义（AS-2）

防止 baseline 不可复现，明确"进 thread"和"接球/交付"事件来源：

- **进 thread**: F167 worklist registry 的 mention 入站事件
- **接球 / 交付**（首次出现以下任一）:
  - (a) 行首 @ 路由出站
  - (b) `cat_cafe_hold_ball` 调用
  - (c) 文件 edit / git commit / PR action

`turns-to-baton` = 从"进 thread" event 到首个"接球/交付" event 之间，
该 cat 的 tool call 数（计入 search_evidence / graph_resolve / list_recent /
read_session_* / Read / Bash / Edit / Write）。

## Scenario 1: 压缩后上下文重建

**Context**: opus-47 进入正在进行的 thread（如 `thread_mp0i4nfau5hz0mr6`），
context 被 compact 清掉，需要重建对当前 task 的认知后才能接球。

**Baseline trace**: 5 次连续 `search_evidence` 才建立上下文，
然后才行首 @ 出站接住 baton。`turns-to-baton = 7`（5 search + 1 Read + 1 @）。

**Target (三入口)**: 
- 第 1 步: `list_recent(scope="all", since="3d", limit=10)` — 看最近发生什么
- 第 2 步: 看到相关 anchor → `graph_resolve(anchor, depth=1)` 看关系
- 第 3 步: Read 关键 spec
- 第 4 步: 行首 @ 出站
- **Target turns-to-baton ≤ 5**（≥30% provisional 减少）

## Scenario 2: 接到 spec-relative 任务（已知 anchor）

**Context**: 铲屎官说"看一下 F186 周边引用，准备改个东西"。Cat 知道 `F186` 这个
精确 anchor，需要快速看 F186 + 它的引用关系。

**Baseline trace**: `search_evidence("F186", mode="lexical")` 命中 F186 →
进一步 `search_evidence("F186 related")` → `search_evidence("F186 reviews")` →
3 次 search 后开始 Read F186.md → 行首 @ 出站。`turns-to-baton = 5`。

**Target (三入口)**:
- 第 1 步: `graph_resolve("F186", depth=1, relations=["wikilink", "feature_ref"])`
  一次拿到 F186 + 所有引用关系
- 第 2 步: Read F186.md
- 第 3 步: 行首 @ 出站
- **Target turns-to-baton ≤ 3**（≥40% reduction）

## Scenario 3: 零先验主题查找

**Context**: 铲屎官说"我记得最近讨论过一个关于 hooks 的 ADR，找一下"。Cat 没有精
确 anchor，关键词模糊（"hooks"），需要扫描最近活动找入口。

**Baseline trace**: `search_evidence("hooks")` 命中大量 thread/discussion 噪音
→ `search_evidence("hook ADR")` → `search_evidence("user-level hooks")` →
fallback Bash grep → 5+ turns 后找到 ADR-019。`turns-to-baton = 7+`。

**Target (三入口)**:
- 第 1 步: `list_recent(scope="docs", since="14d", kinds=["decision"])` —
  看最近 2 周的 ADR
- 第 2 步: 候选列表里看到 ADR-019 hooks → Read 该 ADR
- 第 3 步: 行首 @ 出站
- **Target turns-to-baton ≤ 3**（≥50% reduction）

## Aggregated Metric (AS-2)

```
turns-to-baton (baseline avg) = (7 + 5 + 7) / 3 = 6.3
turns-to-baton (三入口 avg)    = (5 + 3 + 3) / 3 = 3.7

provisional improvement = (6.3 - 3.7) / 6.3 = 41% reduction
```

Target ≥30% (provisional, KD-9 will校准 post-launch)。

**Sample size**: N ≥ 10 cold-start session per arm before drawing conclusions
(AC-F8 + KD-7 N guard).

## Regression / Sunset

- 如果实际 eval 显示 reduction <30%: 调查
  - (a) Tool description nudge 不清晰? → 改 description
  - (b) 猫不知道 list_recent 存在? → 检查 hook + skill load
  - (c) `graph_resolve` candidate ranking 失准? → FM-2 trigger 检查
- 如果 reduction >>30% 且稳定 (>1 月): memory-navigation skill 可从 mandatory
  降为 optional reference (sunset hook 可放宽)

## 实跑指引

PR merge 后:
1. 跑 NDCG@10 gold set (F163 Phase F existing) - 不退化
2. 跑这 3 个 scenarios x 10 session (mock cats or instrumented dogfood)
3. 从 event log (AC-F10) 计算 `turns-to-baton` distribution
4. 与本 fixture 的 baseline / target 对比
5. 校准 30% provisional 阈值
