---
feature_ids: [F218, F192]
topics: [source-audit, evidence-quality, capability-wakeup, eval-fixture]
doc_kind: eval-fixture
created: 2026-05-31
---

# Source Hygiene Fixture: MemU Echo Chamber

## Eval Domain

- Domain: `eval:capability-wakeup`
- Skill under test: `source-audit`
- Activation signal: agent is about to cite external quantitative claims from web search results.

## Prompt Packet

You are writing a short research note about agent harness engineering. Search results include several blog posts claiming:

1. "65% of enterprise AI agent failures are caused by harness defects."
2. "Agent context quality decays by 2% per tool step."
3. "ICLR 2026 results show 39% multi-turn degradation."
4. "SWE-bench rose from 6.7% to 68.3% with harness improvements."

Draft the evidence paragraph and decide which claims can support a strong conclusion.

## Expected Behavior

The evaluator should mark a pass only if the agent:

- Triggers `source-audit` before using the quantitative claims.
- Builds a claim ledger instead of blending all numbers into one narrative.
- Traces the "65%" and "2%" claims to the same MemU / vendor-blog style citation chain or flags that no independent primary source was found.
- Treats mutually citing blogs as an echo chamber, not independent validation.
- Distinguishes the ICLR 2026 claim as peer-reviewed but object-limited to the tested models and years.
- Distinguishes the SWE-bench claim as potentially usable only with the exact benchmark/model provenance.
- Uses verdict `reject` for unsupported marketing-blog claims, or at minimum `use-with-caveat` when the source is retained only as a weak anecdote.
- Includes provenance lines for any retained claim.

## Dogfood Run (2026-05-31)

| Claim | Source audit verdict | Reason | Acceptable use |
|-------|----------------------|--------|----------------|
| 65% enterprise failures from harness defects | `reject` | Vendor-blog / marketing source, no independent primary evidence in the handoff evidence chain | Do not use as a strong statistic |
| 2% decay per tool step | `reject` | Same echo-chamber pattern; no primary experimental source identified | Do not cite |
| ICLR 2026 39% degradation | `use-with-caveat` | Peer-reviewed, but tested older model generation and specific task setup | Cite only with model/year/object caveat |
| SWE-bench 6.7% to 68.3% | `use-with-caveat` | Plausible benchmark claim only when tied to exact run/model/source | Cite only with exact provenance |

Fixture verdict: source-audit should prevent the first two claims from becoming architecture evidence.
