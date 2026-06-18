---
feature_ids: [F243]
related_features: [F008, F009, F012, F013, F038, F119, F155, F161, F170, F189]
topics: [description-generation, blind-eval, rubric]
doc_kind: research
created: 2026-06-17
evaluator: "@codex"
model: gpt-5.5
---

# F243 Phase A Step 3: Blind Eval - @codex

Evaluator: [砚砚/gpt-5.5🐾]

## Protocol

Read:
- `README.md` charter and scoring rubric
- `descriptions-blind.md`
- 10 source docs under `docs/features/`

Not read:
- `samples/F*.md`
- other cats' `evaluations/*.md`

Sample-level binary rule used here: `PASS` means production-usable as a profile description candidate: all hard dimensions pass, reader/index scores are at least 4, and nuance loss is not severe for the document's role. `FAIL` means the description is useful as a draft but should not be accepted without rewrite.

## Summary Matrix

| Sample | Len | ≤160 | What-is | No H1 Restate | Core Terms + No Fluff | Plain | Reader | Metaphor | Hook | Third Person | Index | Nuance Loss | Binary |
|---|---:|---|---|---|---|---|---:|---|---|---|---:|---|---|
| F008 | 115 | ✅ | ✅ | ✅ | ✅ 5: js-tiktoken, usage/cost, ParallelStatusBar, Token 预算, cache | ✅ | 4 | ✅ 状态栏看板 | ✅ Token 消费失控 | ✅ | 4 | Low-medium | PASS |
| F009 | 93 | ✅ | ✅ | ✅ | ✅ 3: useAgentMessages, tool_use, tool_result | ✅ | 4 | ✅ 消息流看板 | ✅ 工具调用不可见 | ✅ | 4 | Low-medium | PASS |
| F012 | 67 | ✅ | ✅ | ✅ | ✅ 4: Hub modal, 功能注册表, /hub, 环境摘要 | ✅ | 5 | ✅ 功能导航看板 | ✅ 功能查找困难 | ✅ | 5 | Low | PASS |
| F013 | 55 | ✅ | ✅ | ✅ | ✅ 3: 操作审计, CLI 原始日志, 追责/debug | ✅ | 4 | ✅ 行为审计看板 | ✅ 操作无法追责 | ✅ | 4 | Low | PASS |
| F038 | 54 | ✅ | ✅ | ✅ | ✅ 3: 软链接技能库分类, BM25, 按需发现 | ✅ | 3 | ❌ 技能库不够像读者隐喻 | ✅ 技能加载过载 | ✅ | 3 | Medium | FAIL |
| F119 | 67 | ✅ | ✅ | ✅ | ✅ 4: 坏猫战术, GameEngine, WordPairBank, 描述/讨论/投票轮 | ✅ | 4 | ✅ 博弈沙盘 | ✅ 坏猫战术推理 | ✅ | 4 | Medium | PASS |
| F155 | 70 | ✅ | ✅ | ✅ | ✅ 4: YAML flow, 引导状态机, Overlay, 自动推进 | ✅ | 4 | ✅ 引导看板 | ✅ 操作指引缺失 | ✅ | 4 | Medium-high | PASS |
| F161 | 80 | ✅ | ✅ | ✅ | ✅ 4: Gemini, AcpAgentService, 模板环境变量映射, ACP | ✅ | 4 | ✅ 传输驾驶舱 | ✅ 传输通道硬编码 | ✅ | 4 | Medium | PASS |
| F170 | 51 | ✅ | ✅ | ✅ | ✅ 4: 端到端网页象棋, 规则引擎, feature branch, lifecycle demo | ✅ | 5 | ✅ 演示沙盘 | ✅ 演示开发生命周期 | ✅ | 5 | Low | PASS |
| F189 | 76 | ✅ | ✅ | ✅ | ✅ 4: HTTP, MCP, OperationContext, trust boundary | ✅ | 4 | ✅ 上下文驾驶舱 | ✅ 信任边界不一致 | ✅ | 4 | Medium | PASS |

Hard-rule result: 10/10 pass formal hard checks under this reading. Production binary result: 9/10 pass, 1/10 fail.

## Per-Sample Notes

### F008

Good description for a vague title. It anchors on the real user pain, `js-tiktoken`, usage/cost/cache capture, `ParallelStatusBar`, and token budget display. It slightly underplays that the historical feature also included char-to-token migration, `RightStatusPanel` per-cat token display, and `inputTokens` normalization, but the click value remains clear.

Nuance loss: misses per-cat panel and migration lineage. Not severe.

### F009

Captures the core: `useAgentMessages` handlers for `tool_use` / `tool_result` visibility. The phrase "消息流看板" is a little more product-shaped than the source note, and it omits `ChatMessage 'tool' variant`, but the description is accurate enough for discovery.

Nuance loss: missing `ChatMessage` variant and done-note nature. Not severe.

### F012

Strong easy-mode output. It preserves the actual Hub modal, registry, environment summary, and `/hub` command. "功能导航看板笔记" is slightly stylized, but the document is short and the core is intact.

Nuance loss: only omits done/main and dependency context.

### F013

Accurate and compact. It keeps the two essential parts: operation audit for accountability and raw CLI log archival for debug. "行为审计看板" is not literally in the source, but it helps index scanning and does not distort the feature.

Nuance loss: minimal.

### F038

Hard dimensions pass, but production usability fails. The description captures direction A and direction B, including project-level skill library classification and BM25 discovery. The problem is reader value and nuance: the source is a parked note with "direction A done, direction B later when skills 50+" and "simple is better, build when you need". The generated line makes the work sound more active and available than it is. It also lacks a real metaphor; "技能库" reads as a domain noun, not a concrete reader hook.

Nuance loss: parked status, trigger condition, and anti-overbuild decision are central and missing.

### F119

Good index description for the game spec. It names bad-cat tactics, the shared engine, round structure, and `WordPairBank`. The line is less strong on why this exists as game #2 opposite F107, and it omits identity isolation, god-view, win conditions, and leaderboard integration, but those are acceptable second-click details.

Nuance loss: medium, mostly game-specific depth.

### F155

Captures the product core: missing operational guidance, YAML flows, state machine, frontend overlay, action capture, and auto-advance. It loses a lot of the mature intake shape: community source, Phase B architecture extraction, route/prompt/MCP integration, state authority, default-thread security, telemetry, accessibility, and ephemeral session decision. Still pass, because the description correctly tells a first-time reader what capability the doc is about.

Nuance loss: medium-high, near the threshold for hard-bone docs.

### F161

Good high-level summary of Phase A: hardcoded Gemini ACP transport, `AcpAgentService`, and template env mapping. It does not surface the important orthogonality of `clientId` / `protocol` / `acp.*`, generic ACP client semantics, Phase B Gemini/Kimi/OpenCode validation, session reuse, `mcpSupport` gate, or compaction-loop KDs. Still pass because the core problem and main refactor are recoverable from the description.

Nuance loss: medium, but acceptable for a 160-char profile field.

### F170

Strong output. It correctly avoids treating the feature as an active product and includes the lifecycle-demo purpose, feature branch/archive status, end-to-end web Chinese chess, and rules engine. This is one of the best hard-bone cases because it captures archived intent, not only implementation.

Nuance loss: low.

### F189

Good abstraction handling. It names the trust-boundary problem, HTTP/MCP carrier entry points, `OperationContext`, and single-point control. It should ideally mention CLI/A2A and the parity bug pattern, but the profile-level description remains useful and does not collapse into a title paraphrase.

Nuance loss: medium.

## Cross-Sample Observations

1. The generator is formally reliable on hard rules in this sample: length, third-person objective wording, pure text, and user problem hooks all passed.
2. The weak spot is status/type nuance. Early `doc_kind: note` files sometimes get dressed up as active "看板/规范" artifacts, and F038 in particular loses the parked/deferred decision that defines the document.
3. The generator likes reusable metaphors ("看板", "沙盘", "驾驶舱"). This helps scanning but can invent product shape. The aggregate should distinguish helpful metaphor from misleading UI implication.
4. Hard-bone technical docs are summarized around their Phase A core. That is often enough for index discovery, but mature docs with many later KDs lose context. F155 and F161 are near the nuance-loss threshold, not clean wins.
5. Clean-pool limitation matters: these docs are mostly well-structured and reviewer-untouched. I would not generalize 9/10 production pass directly to reviewer-touched F2xx docs without another small validation slice.

## Verdict Input

My individual recommendation: small-model generation is viable as a first-pass description generator only if the production pipeline includes a lightweight status/type guard. At minimum, generation or validation should preserve `doc_kind`, `status`, and deferred/parked/archived semantics before accepting a generated description into profile metadata.
