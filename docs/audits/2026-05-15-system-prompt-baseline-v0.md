---
feature_ids: [F203]
topics: [system-prompt, baseline, token-budget]
doc_kind: audit
created: 2026-05-15
---

# F203 Spike S1 — System Prompt Baseline (pre-migration)

> **Phase A acceptance**: AC-A1
> **Script**: `scripts/measure-system-prompt.mjs`
> **Reproducible**: `pnpm --filter @cat-cafe/api run build && node scripts/measure-system-prompt.mjs`
> **Cat Cafe build**: HEAD `8f467d780` (worktree `feat/f203-spike-s1-baseline`)

Measured: 2026-05-15T14:40:48.255Z
Tokenizer: js-tiktoken cl100k_base (gpt-4o), ~85-90% accurate for Claude

## Total per catId × mode

| catId | mode | total | static | dynamic | dynamic/total% |
|-------|------|-------|--------|---------|----------------|
| opus | independent | 3278 | 3060 | 187 | 5.7% |
| opus | serial | 3778 | 3060 | 687 | 18.2% |
| opus | parallel | 3378 | 3060 | 287 | 8.5% |
| opus-47 | independent | 3195 | 2971 | 183 | 5.7% |
| opus-47 | serial | 3695 | 2971 | 683 | 18.5% |
| opus-47 | parallel | 3297 | 2971 | 285 | 8.6% |
| sonnet | independent | 3248 | 3060 | 188 | 5.8% |
| sonnet | serial | 3748 | 3060 | 688 | 18.4% |
| sonnet | parallel | 3349 | 3060 | 289 | 8.6% |
| codex | independent | 3024 | 2805 | 188 | 6.2% |
| codex | serial | 3524 | 2805 | 688 | 19.5% |
| codex | parallel | 3125 | 2805 | 289 | 9.2% |
| gpt52 | independent | 2994 | 2807 | 186 | 6.2% |
| gpt52 | serial | 3494 | 2807 | 686 | 19.6% |
| gpt52 | parallel | 3096 | 2807 | 288 | 9.3% |
| gemini25 | independent | 2873 | 2684 | 188 | 6.5% |
| gemini25 | serial | 3373 | 2684 | 688 | 20.4% |
| gemini25 | parallel | 2975 | 2684 | 290 | 9.7% |

## Static identity segment breakdown

| catId | identity+preamble | collab | roster | workflow | cvo | governance | mcp | static total |
|-------|-------------------|--------|--------|----------|-----|------------|-----|--------------|
| opus | 92 | 298 | 635 | 88 | 53 | 1427 | 467 | 3060 |
| opus-47 | 101 | 302 | 621 | 0 | 53 | 1427 | 467 | 2971 |
| sonnet | 87 | 305 | 633 | 88 | 53 | 1427 | 467 | 3060 |
| codex | 90 | 301 | 635 | 300 | 53 | 1426 | 0 | 2805 |
| gpt52 | 92 | 302 | 634 | 300 | 53 | 1426 | 0 | 2807 |
| gemini25 | 116 | 302 | 611 | 176 | 53 | 1426 | 0 | 2684 |

## Notes

- `dynamic` portion is per-invocation (teammates / mode / ping-pong / cross-thread hint / SOP stage). Not eligible for L0 (must stay in user message).
- `static` portion is what Phase B compiles into `system-prompt-l0.md` + per-cat WORKFLOW_TRIGGERS overlay.
- `governance` segment = `GOVERNANCE_L0_DIGEST` — current "family rules" content. F203 Phase B will rewrite + expand with 14-item L0 + "objective carry-over" segments.
- `mcp` segment present only when `mcpAvailable=true` (claude family). Phase B compresses original MCP_TOOLS_SECTION (~700 tokens) into quick index (~150 tokens, ADR-030 §10.2 KD-7).
- `opus-47 workflow=0`: known segmentation precision miss (regex 没匹配到 ragdoll WORKFLOW_TRIGGERS header on opus-47 — 实际内容 ~88 token，被吸到相邻 segment）。不影响 total / static / governance / mcp 的准确性。Phase B 重构 builder 时可修。

## Summary

- **Average full system prompt**: 3,302 tokens
- **Range**: 2,873 - 3,778 tokens (across 6 cats × 3 modes = 18 samples)
- **Static dominates**: 80-94% of total（serial mode 因 A2A 球权检查 + activeParticipants 注入，dynamic 占比上升到 ~19%）
- **GOVERNANCE_L0_DIGEST**: 1,426-1,427 tokens — 47% of static budget, the largest single segment
- **Roster**: 611-635 tokens — 大致稳定 per-breed
- **MCP_TOOLS_SECTION**: 467 tokens（Claude only）— 比 ADR-030 §10.2 估算 ~600-700 偏少
- **WORKFLOW_TRIGGERS**: opus/sonnet 88t (ragdoll), codex/gpt52 300t (maine-coon with 执行纪律), gemini 176t (siamese), opus-47 segmented as 0 (see note)

## Phase B budget reference

- Total target: ≤ 4,500 tokens (F203 AC-B3, KD-7 加客观性 carry-over 段后上调)
- L0 governance digest 扩到 14 项后估算 ~1,800-2,200 tokens（当前 1,427 → +400-800）
- 客观性 carry-over 段估算 ~500-800 tokens（工具能力 / 并行 / safety / 压缩感知 / Skill+TaskCreate+Schedule / Git 模板压缩重写）
- MCP quick index ≈ 150 tokens（替代 467 tokens 完整 SECTION）= 净节省 ~317
- 预期 Phase B 编译产出：~3,200-3,800 total（介于 baseline 2,873-3,778 之间——客观性 carry-over 净增 + MCP 压缩 + governance 扩展互相抵消）

## Conclusion

Baseline 在 ADR-030 §10.2 47 估算的 3,650-4,550 范围之下（实际 2,873-3,778），主因 MCP_TOOLS_SECTION 比预估 ~700 偏少（实测 467）。L0 token 目标 ≤ 4,500 有充足 buffer。

Phase B 推进时关键预算决策：
1. 客观性 carry-over 段写多少——目标 ≤ 800 token，覆盖 6 项硬约束
2. governance 14 项扩展——目标 ≤ 2,200 token（当前 1,427 + 增 800）
3. MCP quick index 严格 ≤ 200 token

Phase C runtime 重启后跑同一脚本 → 对比 Phase 前后 → 确认 token 总量未爆 + 客观性能力未退化。
