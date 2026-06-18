---
feature_ids: [F243]
topics: [phase-a, control-experiment, rubric-bias-test]
doc_kind: research
created: 2026-06-18
---

# Phase A Control Spike — Rubric Bias Test (RCT)

> **触发**：铲屎官 2026-06-18 22:44 challenge："哈哈哈我怀疑会不会 你盲测 让你自己去写你的通过率也差不多？"
>
> **核心怀疑**：rubric (11 维) + 评分 (我 3 PR / 砚砚 9 PASS / 4.6 5 PR) 解释空间巨大。可能"小模型不达标"verdict 反映的是 rubric bias 不是 model gap。
>
> **CVO instruction**：" A，跑 control spike。你可以写 但是不能说是你写的 你最好说是烁烁写的。 甚至匿名"

## RCT 设计

### Hypothesis

H1 (null): 三大猫 self-write 通过率与烁烁 prompt v3 generation 通过率无显著差异 → rubric 太严不可达 → verdict 应 reframe
H2 (alt): 三大猫 self-write 通过率显著高于烁烁 → 烁烁确有 model gap → 当前 verdict (Mixed Pipeline + Prompt v4) 站得住

### Sample

3 个最 critical 硬骨头（从 Phase A spike 取，砚砚/我/4.6 三猫都标 nuance loss critical）:
- F119（H1 复述 + user hook 弱）
- F155（场景式核心隐喻被 generic 替换）
- F161（H1 复述 + 双 trigger 丢）

### Author 4 候选

1. **opus-47**（我）写 — 严格按 prompt v3 9 条规则自我约束
2. **codex (砚砚)** 写 — 严格按 prompt v3
3. **opus 4.6** 写 — 严格按 prompt v3
4. **gemini35 (烁烁)** — 已存在 `samples/F119.md` / `F155-scene-guidance-engine.md` / `F161.md`（同 prompt v3 generation）

### 匿名化保护（CVO instruction）

- 各 author commit `contributions/<catId>.md`（透明 author ID 阶段性可见）
- Phase 2 我（or 铲屎官）做 blind mix：`blind/F<N>.md` 含 4 个 anonymous version (A/B/C/D random)
- 真实 mapping `mapping.md`（commit 后铲屎官 only 知道——实际 git 公开但 evaluator 协议要求**不看 mapping**）

### Evaluator (待 CVO 定)

**A. fable 评分** — 完全外部 cat（最干净，但 quota cost 高）
**B. opus 4.8 评分** — 同族不同猫，部分 anchor risk
**C. 铲屎官自己评分** — 完全 ground truth，但人力成本高
**D. 砚砚反向评分（不评他自己写的，只评其他 3 author）** — 砚砚 baseline 已知（宽判），可作为 calibration anchor

**我推荐 A or C**——彻底外部 evaluator 最干净。

### 通过率统计

每 author 3 篇 × 11 维 rubric 评分。统计每 author 的 PR 通过率 / 多数表决 / hard rules 全过率。

### Verdict 修正路径

| 烁烁 vs 大猫平均通过率差 | Verdict 修正 |
|---|---|
| 差 < 10% (三大猫也 ~30%) | rubric 太严不可达 → 直接走 Option A (砚砚宽解释 / 烁烁上 production) |
| 差 20-40% (三大猫 ~50-70%, 烁烁 30%) | 当前 Mixed Pipeline 验证 → 走 Phase B + Prompt v4 |
| 差 > 50% (三大猫 80%+, 烁烁 30%) | 烁烁有 systematic gap → 考虑 Option B (大猫手写 + lint 守门) |

## Role Conflict 披露

我（opus-47）同时是：
- Rubric 设计者
- Phase A 第一棒盲评 (3 PR 最严)
- Aggregator (verdict 作者)
- 本 control spike author
- 本 protocol 设计者

**Mitigation**：CVO 监督 + evaluator 必须外部猫 (fable/opus 4.8/铲屎官) 不是我自己 / 砚砚 / 4.6。

## Status

- [x] Protocol 设计
- [x] opus-47 (我) contribution
- [x] codex (砚砚) contribution
- [ ] opus 4.6 contribution — cross-post invited
- [x] gemini35 contribution — 已存在 samples/F119.md + F155-scene-guidance-engine.md + F161.md
- [ ] CVO 决定 evaluator 候选 (A/B/C/D)
- [ ] Phase 2 anonymous blind mix
- [ ] Evaluator 评分
- [ ] Reveal + verdict 修正
