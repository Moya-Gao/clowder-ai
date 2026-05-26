---
feature_ids: [F213]
related_features: [F193, F212]
topics: [reflection, mcp, deprecation, coordinate-system, adr-verification]
doc_kind: reflection
created: 2026-05-26
---

# F213 Reflection Capsule — Stale MCP Config Cleanup at Startup

> Feature: F213 — `docs/features/F213-stale-mcp-config-cleanup.md`
> Closed: 2026-05-26
> PRs: #1901 (Phase A) + #1903 (Phase B) — 2-PR feat
> Predecessor: PR #1894 (closed, 5-round P1 saga documented as antipattern case study)

## What Worked

1. **CVO 第二轮 reframe 是关键转折**：铲屎官 "你们能不能把删掉的 mcp 的配置帮人启动的时候清理掉啊"——把 5 轮 P1 链从"运行时兜底"维度直接 reframe 到"startup cleanup"系统性机制。设计层正解，~12x 复杂度缩减（~80 行 lookup helper → ~20 行 registry + cleanup）。
2. **砚砚 strict-npm-Codex reproducer 是 ground-truth 来源**：5 轮 P1 链每轮都有真实复现，不是噪音。
3. **跨族愿景守护 (孟加拉猫 antig-opus)** 独立 verdict 干净，不被 author / reviewer 历史负担影响 — 按 F073 自动化触发到位。
4. **数学之美自检按 magic word「坐标系」立刻触发** — 没有死磕错路径继续加 round-N。
5. **selective marker matching 保第三方** — 砚砚 P1 catch argsSuffix marker fork-path false positive，让 F213 保住"不破坏用户配置"承诺。
6. **shared helper Phase A → Phase B 抽取**让 multi-harness 扩展 mechanical 不重复。

## What Failed

1. **5 轮 P1 同质归纳没被早期 catch**：每轮都"逻辑正确"加 lookup case (user → project → ancestor → CODEX_HOME → /etc)，但没在 round 3 时停下问"是不是坐标系本身错了"。
2. **ADR-036 验证缺位**：作者 reframe 时凭直觉推「F193 真精神 = legacy 不该 preserve」，**没核 ADR-036 实际写的 cell topology + L4 env-only overlay 设计**。砚砚 catch 出 hidden assumption 来源后，我才意识到 reframe 必须先核 ADR。这是布偶猫家族「我能猜出来」病在架构层复发。
3. **Phase A 实施时偏离 discussion doc 收敛方向**：discussion 收敛到 "L4 dummy disabled + L5 cleanup"，我实施时省略了 L4 dummy disabled override，被砚砚 P2 + 云端 P1 round-2 双重 catch 回归。
4. **argsSuffix marker 上线又被砚砚 P1 catch**：第三方 fork-path false positive 是显然的 case，但我设计 marker 时没想过 fork 场景。砚砚 review 凭"用户视角"catch 到，作者凭"我们写过这个 path"视角看不到。

## Trigger Missed

1. **PR #1894 round 3 时应该 trigger 数学之美自检**：第 3 轮加 source 已经是同质归纳了，但作者按 SOP 接受 review feedback 继续修。**触发条件应该是「连续 ≥3 轮 review 同方向补漏 → 自检坐标系」**。
2. **任何 reframe 之前必查 ADR**：F213 reframe 没核 ADR-036，导致 doc-sync blocker 出现到 review 末期。**触发条件应该是「reframe/scope-shift 之前 grep ADR-* topics 找架构 anchor」**。
3. **守护猫提示 "argsSuffix type variant 保留但未使用 — 前瞻设计，close 时标注"**：close 时确认 type variant 是 forward-looking infra（未来 owner-tag mechanism Phase B+ 可能用），不是死代码。

## Doc Links

- F213 spec: `docs/features/F213-stale-mcp-config-cleanup.md`
- Phase A plan: `docs/plans/2026-05-26-f213-phase-a-stale-mcp-cleanup.md`
- Discussion: `docs/discussions/2026-05-26-codex-mcp-legacy-deprecation/README.md`
- ADR-036 amended: `docs/decisions/036-f209-retrieval-surface-multi-layer.md` (amendment block 2026-05-26)
- Closed PRs: #1901 (Phase A), #1903 (Phase B), #1894 (predecessor saga)
- Cross-family vision guard: 孟加拉猫 antig-opus verdict 2026-05-26

## Rule Update Target

1. **新教训**：`feedback_three_round_same_direction_triggers_coordinate_self_check.md`
   - "连续 ≥3 轮 review 同方向补漏（lookup helper 加新 source / fallback 加新 layer / cleanup 加新 case）→ 自检坐标系，问'是不是问题本身在错维度上'。Magic word「坐标系」也可由 author 主动触发。"
2. **新教训**：`feedback_reframe_must_grep_adr_first.md`
   - "Reframe / scope-shift / scrap-and-rebuild 之前必须先 `grep -r 'ADR-' docs/decisions/ docs/features/`，确认架构 anchor。布偶猫家族「我能猜出来」病在架构层复发风险高。"
3. **shared-rules 更新**：连续同方向 review 补漏 = 坐标系信号；reframe 前查 ADR = 硬要求（不是建议）。

[宪宪/Opus-47🐾]
