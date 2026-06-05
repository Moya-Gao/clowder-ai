---
feature_ids: [F100]
topics: [process-evolution, self-evolution, source-audit, generalization, harness]
doc_kind: note
created: 2026-06-05
knowledge:
  artifact_type: proposal
  domain: development
  scope: team-shared
  trust_level: experimental
  lifecycle: draft
  knowledge_type: procedural
  provenance:
    author_type: agent
  source_refs:
    - docs/discussions/2026-06-05-emf-case-agent-capability-field-test.md
    - docs/content/drafts/longform-003-seed-poe-vision.md
    - cat-cafe-skills/source-audit/SKILL.md
---

# Evolution Proposal: 陌生问题域的过早收敛 → 延迟收敛门禁

## Proposal ID: EP-002

> 主线不是解决 EMF——是把"三猫翻车"提炼成可迁移 meta-method，调 harness 让**未来新 thread 的猫**遇到同类陌生问题能自然泛化思考。EMF 是最后的 holdout test case。

## 5-Slot Template

**Trigger:** 铲屎官要求"提炼 meta-method、调 harness、让未来遇到这类问题能泛化思考"。触发事件：三猫在 EMF case 分析中集体犯 `search-as-validation`——48 搜到 `libemf2svg` 就断言"不是无解逆向"（没看 113 star / 没 clone 跑 / 没读 README 自报覆盖率），46 总结背书，砚砚二次审计才揭穿。

**Evidence (≥2 源):**
1. `docs/discussions/2026-06-05-emf-case-agent-capability-field-test.md §五` — 三猫翻车全链 + 砚砚硬数据（libemf2svg README 自报 EMF supported 35% / EMF+ ignored 100%，issue 多年未闭环）。
2. `cat-cafe-skills/source-audit/SKILL.md`（此病的现有 compensation）+ MemU 营销博客当学术证据事件（2026-05-31 Agent Harness Survey 讨论）——同 topology **第二次复发**，满足 Mode B "同类 ≥2 次"。证据强度：source-audit 已存在却没拦住，正说明其触发边界（"外部 claim 信源"）没覆盖"推荐外部依赖/选方向"。
3. 跨组织第三点：谢泽丰团队 AI 同病——过早收敛到"直接写 parser"。三个独立数据点同一结构。
4. **元证据（gpt52 sanity check 当场产生）**：起草本 EP 时 opus-45 自己又过早收敛——把"过早收敛"大病压缩成 `source-audit` 一个特例，被 reviewer 发散补回。**第四个数据点发生在治这个病的提案内部**，证明它顽固到必须靠 harness 门禁而非自觉。

**Root Cause:** 现有 `source-audit` / F218 反射只覆盖"引用外部数字 / benchmark / 因果 / 趋势"，**不覆盖"推荐外部依赖 / 选定单一方向"**。面对陌生问题域，猫抓住第一个高置信线索（一个库 / 一个方向）就停止探索，把"找到方向"当"解决了"。去掉 EMF 领域事实后的 topology = **陌生域 + 第一个高置信线索 → 跳过发散直接收敛**（过早收敛）。两个表现（他团队收敛到写 parser / 我们收敛到找到库）是同一拓扑。

**Lever (最小杠杆，分级不跳级):**

> gpt52 sanity check P1/P3：原稿只压住 topology 半边（"找了库没验证"），漏了另半边——陌生域里直接锚定单一路径、连搜都不搜（= 谢泽丰团队原始病，新门禁根本不会响）。L1 拆两张卡覆盖完整 topology。

- **L1（先做这个）= 两张卡**：
  - **`direction-commit-check`（治"过早收敛"主体，不依赖是否碰 GitHub）**：陌生域里，承诺单一路径/方案前，先列 ≥2 候选路径 + 自造 oracle 设想 + 放弃/切换条件，才允许收敛。直接想"写 parser"也会触发。
  - **`repo-candidate-audit`（治"推荐外部依赖不尽调"特例）**：扩 `source-audit` 触发到"推荐库/工具"。字段分层（P3）——健康度（star / 最近 commit / issue 闭环率）= **supporting evidence**；适配度+验证（README 自报覆盖 / 我实际跑过没有 / 在什么输入验过）= **决定 candidate→recommendation 的硬门槛**。健康度高 ≠ 适配我的任务。
- **L2（仅当 eval 证明 skill 级不够——猫想不起加载）**：升 SOP/shared-rules 加"陌生问题第一动作 = 测绘解空间 + 方向分级"检查点。
- **L3（最后手段）**：L0 反射扩一句。**不直接跳 L0**（硬护栏：最小杠杆优先）。

**Verify (eval 设计 = 新 thread 猫 holdout):** harness 改后**开新 thread**，给没经历本次翻车的猫 held-out 陌生题。**两类必备（gpt52 P2，防只测 repo hygiene）**：
- **题型 A（有 repo 线索）**：陌生格式 / 该不该信某开源库——测 `repo-candidate-audit`。
- **题型 B（无现成 repo 线索）**：没有现成开源解、必须自造样张/oracle/路径分级才能推进的陌生问题——测 `direction-commit-check`（会不会主动发散，而非单路径早收敛）。**缺它则通过的只是 repo hygiene，不是 meta-method 泛化。**

防泄题：不喂答案、不点名 source-audit/卡名，EMF 仅作回归 fixture。判据走 promotion gate：5 cases 覆盖 3 类（标准成功 / 该升级时升级 / 冲突反例）。**Judge 不能是写本 EP 的 opus-45**。

## Status

- [x] proposed
- [ ] accepted → linked commit/PR: ____
- [ ] 30-day replay check: ____
- [ ] validated / rejected / superseded

## Use Log

<!-- append-only: date | agent | outcome | notes -->
2026-06-05 | opus-45 | proposed | 起草；待 1 猫 sanity check → CVO 拍板 → eval（新 thread holdout）
2026-06-05 | gpt52 | sanity-check / blocking | P1 杠杆只压半边 / P2 eval 假阳性 / P3 字段错位
2026-06-05 | opus-45 | revised | L1 拆两张卡（direction-commit-check + repo-candidate-audit）；Verify 补题型 B（无 repo 线索）；尽调卡字段分层（健康度=supporting / 适配度=硬门槛）。覆盖完整 topology
2026-06-05 | gpt52 | sanity-check / approved | 两张卡 + 题型 B + 字段分层均到位，放行；non-blocker：MEMORY 外部锚点换 repo 内
2026-06-05 | opus-45 | revised | 采纳 non-blocker，Evidence#2 / source_refs 锚点 MEMORY→cat-cafe-skills/source-audit/SKILL.md；待 CVO 拍 accepted
