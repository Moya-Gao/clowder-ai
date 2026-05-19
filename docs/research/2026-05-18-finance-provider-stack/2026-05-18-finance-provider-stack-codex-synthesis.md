---
feature_ids: [F207]
related_features: [F188]
topics: [finance, provider-stack, deep-research, synthesis, codex-review]
doc_kind: research
created: 2026-05-19
---

# F207 Phase B — 砚砚版 Provider Stack Synthesis

> Author: 砚砚 / Codex GPT-5.5  
> Scope: 独立阅读 Claude / Gemini / GPT 三路 deep research 后的工程判断。  
> Non-goal: 这不是最终统一 synthesis，不负责归档目录重排；下一轮可由一只猫统一合并。

## Input Reports

| Source | Path | My read |
|---|---|---|
| Claude Deep Research | `docs/research/2026-05-18-finance-provider-stack-claude-response.md` | 重点读 TL;DR、Provider table、Risk register、Plans、Decision interface |
| Gemini Deep Research | `docs/research/2026-05-18-finance-provider-stack-gemini-response.md` | 跳过嵌入图片/base64，读证伪、provider matrix、risk register、deployment plans |
| GPT Deep Research | `docs/research/2026-05-18-finance-provider-stack-gpt-response.md` | 全文读，重点看 source-tier、反证、MCP 成熟度和工程落地表 |

## My Decision

F207 Phase B 不应该直接选择某个现成 finance MCP 作为核心。正确做法是：

**建立 `cat-cafe-finance` 本地事实层：统一 schema + SQLite/cache + provenance + provider adapters。现成 MCP / SDK 只能作为 provider adapter 或 spike 对象。**

原因：

- 三份报告一致指出：免费源的主要风险不是"查不到"，而是 rate limit、字段漂移、复权口径、时区、数据延迟和 ToS 灰区。
- MCP 生态已有可用项目，但大多是 provider wrapper，不负责 Cat Cafe 需要的 source attribution / cache / safety / CVO audit。
- 铲屎官是长期 FIRE 学习者，不是交易员。我们要的不是实时终端，而是可追溯的低频事实层。

## Provider Stack I Would Adopt

### v0.1 Core Stack

| Domain | Primary | Fallback / Helper | Verdict |
|---|---|---|---|
| A 股 / 中国证券主干 | Tushare Pro API / official MCP if confirmed | AKShare / AKTools / BaoStock for gaps | Adopt, but verify tier before paying |
| 中国基金 / QDII | AKShare / Eastmoney wrapped narrowly | Tushare fund endpoints where available | Adopt as best-effort + cache-heavy |
| 美股 / 全球日线便利层 | yfinance or `yahoo-finance2` through our wrapper | Alpha Vantage free, Stooq, SEC/IR for fundamentals | Adopt only as convenience, never truth source |
| 美国宏观 | FRED API direct | FRED MCP only as spike | Adopt direct API as canonical |
| 中国宏观 | AKShare macro + official-site mapping | Tushare macro, NBS/PBOC manual wrappers later | Adopt as multi-source patch |
| 汇率 / 黄金 / 商品 | FRED + Yahoo convenience | PBOC / ChinaMoney for RMB official mid-rate | Adopt by source tier |
| 财经新闻 | RSS/GDELT/provider news index only | Paid media links as evidence pointers | Adopt index-only, no paywall bypass |
| 私有公司估值 | News evidence chain | Exa / Perplexity-like search only as optional pilot | Evidence mode only, no pseudo-structured API |

### Spend Decision

Do **not** pre-commit to "500 RMB Tushare tier" just because Gemini/GPT recommend it.

Required next step is an entitlement spike:

1. List the exact F207 v0.1 endpoints we need.
2. Map each endpoint to Tushare point/tier requirements.
3. Buy the lowest tier that unlocks those endpoints.

Claude says 2000 points / about 200 RMB may be enough for A-share daily + fundamentals. GPT/Gemini lean 5000 points / about 500 RMB. GPT also notes some ETF APIs may require 8000 points and HK/minute can be separate. That means the only defensible decision is endpoint-first verification.

## Things I Would Not Adopt Yet

| Candidate | Why not core v0.1 |
|---|---|
| Full yfinance MCP as production core | Good convenience layer, but unofficial and rate-limit prone. Needs local cache, retries, strict query limits, and fallback. |
| Whole AKShare MCP exposed to cats | Too broad, too many Chinese DataFrame schemas, too much token noise. Wrap only selected endpoints. |
| Exa as required provider | Useful for private-company evidence, but not necessary for initial FIRE market/fund/macro stack. Pilot later if private-company tracking remains important. |
| NewsAPI paid path | Budget mismatch and not needed for index-only news. |
| EODHD / Polygon / Finnhub paid plans | Good upgrade path, not v0.1 under <=500 RMB/year. |
| Any community MCP without local wrapper | Provider failures would leak directly into cat reasoning. We need normalized errors and provenance. |

## Cross-Report Consensus

Strong consensus across Claude / Gemini / GPT:

- Tushare is the best paid China securities backbone under this budget.
- AKShare is useful but not authoritative; use it as fallback / gap filler.
- FRED is the clear US macro truth source.
- yfinance is convenient but fragile and unofficial.
- Private-company valuations must be evidence-chain based.
- Finance MCP ecosystem is not mature enough to trust blindly.
- News should be index-only: title / summary / URL / source / timestamp, no paywall bypass.

Important disagreements:

| Topic | Claude | GPT | Gemini | My resolution |
|---|---|---|---|---|
| Tushare spend | 2000 points may be enough | 5000 useful but not universal; some APIs 8000 | 5000 as core | Verify endpoints before buying |
| QDII difficulty | Easier than expected via AKShare/Eastmoney | Medium difficulty; multi-source | Very hard / fragile | Treat NAV as easy-ish, holdings/premium as fragile |
| yfinance role | Adopt with caching | Convenience only, not truth source | Strongly skeptical; only after hardening | Convenience layer behind cache, no direct cat access |
| Existing MCP use | Some direct adoption possible | Official MCP yes; community spike | Mostly not turnkey | Use MCPs as adapter candidates, not core architecture |
| News/private company | RSS/index + evidence | GDELT/provider news + evidence | Exa-heavy semantic search | Start with RSS/GDELT; Exa as optional pilot |

## Research Style Calibration

### Claude

Style: pragmatic operator / implementation researcher.

Strengths:

- Best immediate engineering table.
- Concrete install commands, repo candidates, risk register.
- Strongest on "what can we try today" and "what needs thin wrapper".

Bias / caveat:

- Can over-trust repo star counts and current maintenance signals.
- More willing to label community MCP as Adopt.
- Tushare 2000-point recommendation may be right, but needs endpoint verification.

Use Claude report for:

- spike checklist,
- candidate MCP list,
- risk register seed,
- implementation sequencing.

### GPT

Style: compliance / source-hierarchy / skeptical synthesis.

Strengths:

- Best separation of official truth source vs convenience wrapper.
- Strongest warning against "single provider" and ToS gray areas.
- Most aligned with Cat Cafe's need for source tiering and provider orchestration.

Bias / caveat:

- Less concrete on exact MCP install path.
- Citation markers are not directly usable in our local repo unless source list is preserved.
- Some "official MCP" claims still need local verification before implementation.

Use GPT report for:

- architecture principles,
- source tier model,
- risk and legal/ToS framing,
- final design language.

### Gemini

Style: academic / adversarial / expansive.

Strengths:

- Best at strong disconfirm-first posture.
- Good at naming hidden operational risks: token bloat, schema validation, time-zone drift, raw MCP errors leaking into reasoning.
- Useful for defensive design language.

Bias / caveat:

- Over-dramatizes and tends to recommend heavier engineering than v0.1 needs.
- Exa / curl_cffi / "准机构级" claims should not become default scope.
- The report contains embedded image/base64 noise; future Gemini research exports should strip images before commit.

Use Gemini report for:

- risk register hardening,
- anti-naive-MCP arguments,
- schema validation / error normalization requirements.

## Architecture I Want In Writing-Plans

Minimum viable `cat-cafe-finance` shape:

```text
packages/finance-core/
  providers/
    tushare.ts
    akshare.ts or aktools.ts
    fred.ts
    yahoo.ts
    news.ts
  cache/
    finance.sqlite
  schema/
    quote.ts
    macro-series.ts
    fund-nav.ts
    company-facts.ts
    news-item.ts
  tools/
    finance_quote
    finance_macro
    finance_fund
    finance_company_facts
    finance_news_index
    finance_cross_check
```

Every returned record must carry:

- `source`
- `sourceTier` (`official` / `licensed` / `wrapper` / `scrape` / `news-evidence`)
- `asOf`
- `fetchedAt`
- `currency`
- `timezone`
- `market`
- `adjustment`
- `isDelayed`
- `confidence`
- `licenseNote`
- `cacheStatus`

This is the actual value of the infra. Without this, we just have another pile of brittle fetchers.

## Phase B MVP Recommendation

Build Phase B in three slices:

### Slice B0 — Contract + Cache First

Before integrating providers, define schema and cache:

- SQLite tables for quote / fund_nav / macro_series / company_facts / news_item.
- Provider result normalization.
- Stale-data detection.
- Error taxonomy: `rate_limited`, `not_entitled`, `source_down`, `schema_drift`, `no_data`, `low_confidence`.
- Golden fixtures with fake data.

Why first: this prevents yfinance / AKShare / Tushare quirks from leaking into cat reasoning.

### Slice B1 — Official / Stable Sources

Start with:

- FRED direct API for US macro.
- Tushare spike for China securities and funds.
- A minimal watchlist-driven market snapshot, not arbitrary ticker search.

Why: these are most likely to become stable foundations.

### Slice B2 — Fragile Convenience Sources

Add:

- yfinance / yahoo-finance2 for US/HK/global convenience.
- AKShare/AKTools narrow endpoints for QDII / China macro gaps.
- RSS/GDELT news index.

All behind cache + rate limit + source tier labels.

## Blocking Questions Before Implementation

These should become writing-plans tasks or OQs:

1. Which exact watchlist/assets are in v0.1? Avoid "all markets" scope creep.
2. Which Tushare tier unlocks those exact endpoints?
3. Do we want Python providers behind a Node wrapper, or a Python MCP/CLI called by Node?
4. Where do API keys live? We need `.env` / keychain / config convention and no transcript leakage.
5. What is the cache retention policy per data type?
6. What does "news evidence" store when a source is paywalled?
7. How do we present "low confidence" so cats do not over-answer?
8. Do we accept AGPL/community MCP license constraints, or avoid embedding those servers?

## Final Take

The provider answer is not "Tushare + yfinance + FRED + AKShare" by itself. That is only the data-source list.

The real Phase B answer is:

> `cat-cafe-finance` should be a provenance-first local data layer. Tushare, FRED, AKShare, yfinance, RSS/GDELT are adapters behind that layer. Cats should call our normalized tools, not raw provider MCPs.

That keeps F207 aligned with its actual purpose: making cats better long-term financial analysts for Landy, without turning them into a brittle Bloomberg cosplay or a high-frequency trading toy.
