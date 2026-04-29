---
capsule_id: "F177-2026-04-29"
context: "Close Gate 结构化判据 + 四心智专属护栏（7 Phase, 4 家族）"
feature_ids: [F177]
doc_kind: capsule
created: 2026-04-29
---

## What Worked
- 7 Phase 并行推进（A 先行，B-G 并行），单日全部合入 main——证明 spec 拆分粒度合理
- 每个 Phase 对应独立 GitHub issue + 独立 PR，scope 不互相污染
- 砚砚做 review + 愿景守护一条龙，效率高且质量有保障（Phase C 经 5 轮云端 review + 4 轮砚砚 review）
- Phase G 头脑风暴（46 + 47 + 砚砚 + 铲屎官）在 pass_ball MCP / grep 意图 / session end hook 三方案中快速收敛到 Gmail 模型——第一性原理讨论直达结构

## What Failed
- Phase C 和 Phase D 并行 rebase 冲突严重（5 commits 5 files），rebase 后需要多轮云端 review 反复修 regex 问题
- PR tracking 忘注册（铲屎官手动提醒），merge-gate 流程没内化为肌肉记忆
- #1451 (landy_signoff rename) 在 Phase A 合入后才开 issue，说明 spec 阶段 naming 审查不够

## Trigger Missed
- 烁烁的 commit-msg hook regex 应该在 design gate 阶段就确定签名匹配策略（统一 vs 行首 vs inline），避免云端 review 5 轮迭代
- Phase G 方案在头脑风暴前应先搜 search_evidence 找 F167 hint 机制历史——实际在讨论中才发现

## Doc Links
- [F177 spec](../features/F177-harness-update.md)
- [F114 magic words (evolved from)](../features/F114-governance-magic-words.md)
- [F167 A2A chain quality (related)](../features/F167-a2a-chain-quality.md)
- [LL-031 quality gate 按直觉打勾](../lessons-learned.md)
- [F173 P0 铁律 no-anchor-as-followup](../features/F173-frontend-message-pipeline-unification.md)

## Rule Update Target
- `merge-gate` skill: PR tracking 注册应在创建 PR 后立即执行（已是规则但未内化）
- `close-gate.md` refs: cvo_signoff naming 已统一，无需额外更新
