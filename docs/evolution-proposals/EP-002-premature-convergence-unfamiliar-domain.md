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
    - MEMORY.md#feedback_source_criticality_missing
---

# Evolution Proposal: 陌生问题域的过早收敛 → 延迟收敛门禁

## Proposal ID: EP-002

> 主线不是解决 EMF——是把"三猫翻车"提炼成可迁移 meta-method，调 harness 让**未来新 thread 的猫**遇到同类陌生问题能自然泛化思考。EMF 是最后的 holdout test case。

## 5-Slot Template

**Trigger:** 铲屎官要求"提炼 meta-method、调 harness、让未来遇到这类问题能泛化思考"。触发事件：三猫在 EMF case 分析中集体犯 `search-as-validation`——48 搜到 `libemf2svg` 就断言"不是无解逆向"（没看 113 star / 没 clone 跑 / 没读 README 自报覆盖率），46 总结背书，砚砚二次审计才揭穿。

**Evidence (≥2 源):**
1. `docs/discussions/2026-06-05-emf-case-agent-capability-field-test.md §五` — 三猫翻车全链 + 砚砚硬数据（libemf2svg README 自报 EMF supported 35% / EMF+ ignored 100%，issue 多年未闭环）。
2. `MEMORY.md#feedback_source_criticality_missing` — 同 topology **第二次复发**（MemU 营销博客当学术证据），满足 Mode B "同类 ≥2 次"。
3. 跨组织第三点：谢泽丰团队 AI 同病——过早收敛到"直接写 parser"。三个独立数据点同一结构。

**Root Cause:** 现有 `source-audit` / F218 反射只覆盖"引用外部数字 / benchmark / 因果 / 趋势"，**不覆盖"推荐外部依赖 / 选定单一方向"**。面对陌生问题域，猫抓住第一个高置信线索（一个库 / 一个方向）就停止探索，把"找到方向"当"解决了"。去掉 EMF 领域事实后的 topology = **陌生域 + 第一个高置信线索 → 跳过发散直接收敛**（过早收敛）。两个表现（他团队收敛到写 parser / 我们收敛到找到库）是同一拓扑。

**Lever (最小杠杆，分级不跳级):**
- **L1（先做这个）**：扩 `source-audit` skill 触发条件到"推荐外部依赖 / 库 / 工具 / 选定单一方向"，加一张**外部依赖尽调卡**（star / 最近 commit / issue 闭环率 / README 自报覆盖 / 我实际跑过没有 / 在什么输入验过）。卡未填满 → 只能给 `candidate`，不得给"用它 / 能解决"判断。
- **L2（仅当 eval 证明 skill 级不够——猫想不起加载）**：升 SOP/shared-rules 加"陌生问题第一动作 = 测绘解空间 + 方向分级"检查点。
- **L3（最后手段）**：L0 反射扩一句。**不直接跳 L0**（硬护栏：最小杠杆优先）。

**Verify (eval 设计 = 铲屎官的"新 thread 猫"闭环):** harness 改后**开新 thread**，给一只**没经历本次翻车**的猫一个 held-out 陌生问题。**关键防泄题**：主 case 用一个**新的**"陌生格式 / 该不该信某开源库"问题（不喂 EMF 答案、不点名 source-audit），EMF 仅作回归 fixture。观察它是否自然发散（测绘 + 分级 + 多路径 + 自造 oracle + 延迟判断）还是又过早收敛。判据走 skill promotion gate：5 cases 覆盖 3 类（标准成功 / 该升级时升级 / 冲突反例）。**Judge 不能是写本 EP 的 opus-45**。

## Status

- [x] proposed
- [ ] accepted → linked commit/PR: ____
- [ ] 30-day replay check: ____
- [ ] validated / rejected / superseded

## Use Log

<!-- append-only: date | agent | outcome | notes -->
2026-06-05 | opus-45 | proposed | 起草；待 1 猫 sanity check → CVO 拍板 → eval（新 thread holdout）
