# Financial Data Provider Stack for a Personal FIRE Investor Using Claude Code + MCP (China context, May 2026)

## TL;DR
- **Adopt this layered stack today: (1) `yfinance` via an MCP wrapper for US/HK/ETF prices+fundamentals, (2) FRED MCP server for US macro and a handful of China series (CPI, CNY/USD), (3) Tushare Pro at the 2000-point / ~200 RMB tier as your truth source for A-shares + China public funds + China macro that FRED doesn't have (PMI, LPR, MLF, TSF), wrapped by `guangxiangdebizi/FinanceMCP` (538★, 110 forks, last issue #19 opened Dec 17, 2025), (4) AKShare as a free fallback library called via `zwldarren/akshare-one-mcp` (162★, last release v0.3.9 on Mar 14 2026) plus your own thin Python-MCP bridges for QDII/场内基金 and gap-filling.** Total cost ≈ 200 RMB/year; the 500 RMB budget is sufficient and leaves headroom.
- **The single biggest risk is that yfinance and AKShare both scrape unofficial endpoints and break repeatedly.** The yfinance README itself states: *"yfinance is not affiliated, endorsed, or vetted by Yahoo, Inc. It's an open-source tool that uses Yahoo's publicly available APIs, and is intended for research and educational purposes."* — Yahoo has tightened rate-limits, with GitHub issue #2422 (opened Apr 29, 2025) and discussion #2431 documenting routine `YFRateLimitError` for v0.2.57+ users even across different IPs. AKShare has parallel Eastmoney IP-ban issues #6092 (Apr 21, 2025) and #6167 (May 9, 2025). Tushare Pro at 2000 points is the only one of the three with a stability SLA, which is why it earns the "one paid slot." Treat free libraries as cache-able convenience layers, not as production sources.
- **Existing finance MCP servers in 2026 are usable but demo-grade.** Pick `guangxiangdebizi/FinanceMCP` (Tushare) and `zwldarren/akshare-one-mcp` (AKShare) as starting points; both have explicit adjust handling and recent commits, but you will still need a thin local MCP wrapper of your own for: QDII NAVs (Eastmoney/AKShare), Chinese RSS news indexing, and FRED-China cross-fill — about 1-2 days of TS/Python work.

---

## Key Findings

### 1. yfinance: the indispensable free baseline, but a fragile dependency
- yfinance is an *unofficial scraper* of Yahoo Finance's JSON+HTML endpoints. The maintainers' README states: *"yfinance is not affiliated, endorsed, or vetted by Yahoo, Inc. It's an open-source tool that uses Yahoo's publicly available APIs, and is intended for research and educational purposes."* Rate-limit errors (`YFRateLimitError: Too Many Requests`) are now routine: GitHub issue #2422 (Apr 29, 2025) and ongoing discussion #2431 show v0.2.57+ users hitting limits even from different IPs.
- For a long-term investor, this is **acceptable** because (a) you query daily, not in tight loops; (b) the data covers what you need: US stocks, US/global ETFs, HK stocks (e.g., `0700.HK`, `0388.HK`), and A-shares with `.SS`/`.SZ` suffixes (e.g., `600031.SS`, `300750.SZ`). Yahoo's pages do show A-share tickers via Stock-Connect coverage, so basic price queries work — but financial-statement fields are noticeably thinner for A-share/HK tickers than for US tickers.
- **Adjustment semantics changed in v0.2.28+**: `auto_adjust=True` is now the default — Yahoo OHLC is already split-adjusted, and yfinance now applies dividends on top, producing one clean "Close" column and dropping "Adj Close." If your MCP wrapper has older code expecting `Adj Close`, it will silently break. There are also documented Yahoo bugs where pre-split dividends are not back-adjusted (quantmod issue #253), causing incorrect Adj Close on dates around splits — material for dividend-paying long-holds.

### 2. Tushare Pro vs AKShare: complementary, not competitive
- **Tushare Pro pricing for personal investors (2026):** The official 积分 page (`tushare.pro/document/1?doc_id=290`) confirms **2000 points (≈200 RMB recharge, 1-year validity, points not consumed)** unlocks A-share daily K-line, financial statements, and most basic interfaces at 200 requests/minute / 100k/day. **5000 points (≈500 RMB)** removes per-day caps. Critically: **HK and US stock daily data require 5000+ points**, and minute-level + news/announcement data are *separate paid permissions* unrelated to point tier. For a non-trading long-term investor, the 2000-point tier is sufficient.
- **AKShare strengths:** the published API surface includes stock/index/fund/QDII/macro/futures/crypto/bond endpoints — totaling well over 1,000 interfaces (the AKShare 1.18.60 documentation indexes 78 tool categories with 190+ data interfaces in the Dify plugin alone, and the full library is broader). Completely free, returns clean Pandas DataFrames, covers QDII (`fund_open_fund_daily_em`, `fund_em_open_fund_info`), HK indices (`stock_hk_index_*`), macro China (`macro_china_cpi_monthly`, `macro_china_pmi_yearly`, `macro_china_central_bank_balance`).
- **AKShare weaknesses validated by 2025 GitHub issues:** Eastmoney anti-scraping has caused repeated outages. Issue #6092 (Apr 21, 2025): *"从2025年4月21日 晚20:00整 出现这个问题…stock_zh_a_hist 无法下载股票日线数据…ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))"*. Issue #6167 (May 9, 2025): *"stock_zh_a_spot_em 经常被 ban IP … 多调用几次，ip就被冻结，需要更换或重新获取动态公网ip"*. The AKShare changelog shows monthly "修复 macro_china_xxx 接口" entries — interfaces drift. **AKShare has no SLA, no rate-limit guarantee, and ToS-gray status** (it scrapes Sina/Eastmoney/Jin10/CNINFO without licenses).
- **Verdict:** Use Tushare Pro as the *truth source* for A-share prices/fundamentals/macro that have official Tushare endpoints; use AKShare as the *fallback layer* with caching and retry, primarily for QDII/fund data Tushare gates behind 5000 points.

### 3. China macro: no single FRED equivalent — multi-source patch required
- **FRED has only partial China coverage** (verified via specific series URLs):
  - `CHNCPIALLMINMEI` — China CPI All Items (OECD, monthly, Jan 1993 → Apr 2025)
  - `EXCHUS` — CNY/USD monthly average (Fed Board, since 1981)
  - `DEXCHUS` — same FX, daily, "noon buying rates in New York City for cable transfers"
  - `INTDSRCNM193N` — China discount rate (IMF IFS, monthly)
  - `MYAGM2CNM189N` — **DISCONTINUED** (Dec 1998 – Aug 2019); no current FRED M2 series for China
  - FRED carries 100+ China-related monthly series via OECD/IMF feeds, but **none cover PMI, LPR, MLF, 7-day OMO, or TSF**.
- **IMF Data API works for monthly China indicators** (restructured to SDMX 2.1/3.0 in 2025; library `sdmx1`; free; no key required). Useful for monthly CPI cross-verification but doesn't cover PMI/LPR/MLF/TSF either. Per the official IMF data pages and BD Economics SDMX tutorials, the new `CPI` dataflow uses keys like `CHN.CPI._T.IX.M`.
- **World Bank API is annual-only for China** macro indicators (WDI database). Monthly frequency works only for a handful of high-frequency series like exchange rates (`DPANUSSPB`) — *not* CPI, PMI, or M2 for China.
- **What this means:** PMI (manufacturing/non-manufacturing/Caixin), LPR, MLF rate, 7-day OMO rate, social financing TSF, current monthly M2 — these are **only available through (a) Tushare Pro, (b) AKShare's `macro_china_*` family, or (c) directly scraping NBS/PBOC**. The AKShare macro endpoints rely on Jin10 (金十数据), which has been *more* stable than the Eastmoney-dependent stock endpoints, with no major outage filed in 2025-2026.

### 4. MCP ecosystem maturity: usable but not turnkey
- **`Alex2Yang97/yahoo-finance-mcp`** — full yfinance wrapper (price history, statements, options, holders, recommendations, news). Installs with `uvx --from git+https://github.com/Alex2Yang97/yahoo-finance-mcp yahoo-finance-mcp`. Inherits all yfinance rate-limit risks.
- **`maxscheijen/mcp-yahoo-finance`** — lightweight, `uvx mcp-yahoo-finance`, `pip install mcp-yahoo-finance`. Author explicitly notes "early development."
- **`narumi/yfmcp`** (`uvx yfmcp@latest`) — MIT, Docker-ready, no key required.
- **`guangxiangdebizi/FinanceMCP`** — **538★ / 110 forks (confirmed via repo Activity page, May 2026); last open issue #19 Dec 17, 2025; actively maintained.** Integrates Tushare for A-shares + Binance for crypto, plus a news aggregator over Eastmoney/财联社/华尔街见闻 RSS. Author has documented bug fixes for Tushare's "moneyflow_dc 每天2次" rate-cap (now uses standard `moneyflow` endpoint requiring 2000+ points), field-naming bugs (`BK0447 → BK0486.DC`), and pin notes: *"主力净额使用 net_mf_amount，各档净额按'买入-卖出'计算，量纲统一为元"*. Auto-applies qfq (front-adjustment) on daily K — no toggle. Self-acknowledged risks per author's paper: *"①API限流(Tushare免费版有调用频率限制)；②API变更(接口升级可能导致兼容性问题)；③数据质量(第三方数据可能存在错误或延迟)…Tushare数据有一定延迟(通常15-30分钟)，不适合高频交易场景."*
- **`zwldarren/akshare-one-mcp`** — **162★ as of May 2026 (per GitHub Topics listing); last release v0.3.9 on Mar 14, 2026.** Cleanest API: explicit `adjust=none|qfq|hfq` and `source=eastmoney|eastmoney_direct|sina` params. Single-maintainer (~6 followers) — fork-or-vendor risk; few open issues but also low transparency.
- **`sunyalou/Tushare-mcp-server`** — **only 1★, Sep 2025**, basic prices only. Skip.
- **`jackdark425/aigroup-market-mcp`** — Node.js/TS, Tushare + Baidu News. Author runs 4-5 parallel MCP repos; lower priority for now.
- **`stefanoamorelli/fred-mcp-server`** — well-maintained, Zenodo-cited (`DOI 10.5281/zenodo.14536707`), supports all 800k+ FRED series. Install: `npx -y @smithery/cli install @stefanoamorelli/fred-mcp-server --client claude`.
- **No usable, dedicated China-macro MCP server** exists today beyond what FinanceMCP/akshare-one-mcp expose. You will need to write a thin wrapper.

### 5. QDII fund data is achievable for free via AKShare + Eastmoney
- AKShare's `fund_open_fund_daily_em` returns daily NAV for all open-end funds including QDII (10,000+ funds). `fund_em_open_fund_info` returns detailed history. `qdii_e_index_jsl` (集思录) provides QDII premium/discount.
- The underlying URL is Eastmoney's public endpoint `fundgz.1234567.com.cn/js/{code}.js` and `fund.eastmoney.com/pingzhongdata/{code}.js` — same anti-scrape risk profile as other Eastmoney endpoints, though less aggressive than stock endpoints. Cache aggressively.
- For *holdings* (持仓): only updates quarterly with reporting lag; AKShare `fund_em_portfolio_hold` works but data is intrinsically delayed by 1-2 months.

### 6. News: index-only is the right strategy, MCP options exist
- For "is this news worth a note?" use case, you only need title + summary + URL + timestamp + source — **never bypass paywalls**.
- `jvenkatasandeep/finance-news-mcp` (FastMCP + RSS, covers Bloomberg, WSJ, CNBC, Seeking Alpha, MarketWatch, FT).
- `guangxiangdebizi/FinanceMCP`'s built-in `finance_news` tool covers 新浪财经/华尔街见闻/同花顺/财联社/凤凰/新华 etc.
- For Chinese news, building your own RSS-MCP over `财新`, `第一财经`, `华尔街见闻 (only headline RSS)`, `Caixin Global` is ~50 lines of FastMCP code.

---

## Section 6a — Provider Stack Recommendation

| Market Domain | Official Truth Source | Convenience Library / API | Fallback | Recommendation Reasoning |
|---|---|---|---|---|
| **US Stocks (price + fundamentals)** | SEC EDGAR (10-K/10-Q) | yfinance (Yahoo) | EODHD free / Alpha Vantage 25/day / Stooq CSV | yfinance covers 99% of personal-investor needs for free; SEC EDGAR is the authoritative fallback for financial statements |
| **US ETFs (price + holdings)** | ETF issuer site / SEC N-PORT | yfinance | Stooq, EODHD | yfinance returns NAV, AUM, expense ratio, top holdings |
| **A-Shares (China mainland)** | Tushare Pro (2000积分) | Tushare Pro via FinanceMCP | AKShare (`stock_zh_a_hist`) | Tushare Pro has structured fields, 200 req/min; AKShare backs it up but breaks under Eastmoney bans |
| **Hong Kong Stocks** | yfinance (`.HK`) — daily, 15-min delayed | AKShare (`stock_hk_daily`, `stock_hk_spot_em`) | Tushare Pro (requires 5000+ points) | yfinance is free + sufficient for daily HK data; Tushare HK gating makes it expensive at the personal tier |
| **US Macro (rates, CPI, GDP)** | FRED (St. Louis Fed) — official | `fred-mcp-server` (Amorelli) | World Bank, IMF | FRED is the gold standard: 800k+ series, free key, official MCP |
| **China Macro (PBOC rates, CPI, PMI, M2, TSF)** | NBS + PBOC + 国务院 (manual) | AKShare `macro_china_*` (free) | Tushare Pro macro endpoints, FRED for CPI/FX only | No FRED equivalent for PMI/LPR/MLF/TSF; AKShare macro family sources Jin10 and has been stable through 2025-2026 |
| **FX (USD/CNY, USD/HKD)** | PBOC mid-rate (`pbc.gov.cn`) | yfinance (`CNY=X`), FRED `DEXCHUS` daily | AKShare `currency_*` | yfinance and FRED both cover daily; PBOC for the official mid-rate |
| **China Public Funds (公募基金)** | CSRC fund disclosures | AKShare `fund_open_fund_daily_em` | Tushare Pro `fund_basic` + `fund_nav` | Tushare Pro has cleaner fields; AKShare is free and equally complete for NAV |
| **QDII Funds** | Eastmoney fund pages | AKShare `fund_open_fund_daily_em` + `qdii_e_index_jsl` | Direct Eastmoney `fundgz.1234567.com.cn` API | No first-party API exists; Eastmoney is the de-facto standard |
| **Crypto** | CoinGecko (free, generous limits) | CoinGecko MCP / Binance via FinanceMCP | yfinance (`BTC-USD`) | Optional; not central to FIRE allocation |
| **Financial News** | Source RSS feeds | `finance-news-mcp` (RSS aggregator) + FinanceMCP `finance_news` | Custom FastMCP RSS wrapper | Index-only (title/url/ts/source); never proxy paywalled content |

---

## Section 6b — Tool/Source Evaluation Table

| Tool/Source | Market Coverage | Data Types | Official/Wrapper | Cost | API Key | License/ToS Risk | Data Delay | Adjustment | Last Maintained | Install | Integration Path | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **yfinance (Python)** | US/HK/A-share/ETF/FX/crypto (global) | OHLCV daily, statements, dividends, splits, holders, news, options | Wrapper (unofficial Yahoo scrape) | Free | None | **HIGH** — unofficial, ToS-gray | EOD or 15-min delayed | `auto_adjust=True` default since 0.2.28 | Active, 23.7k★ / 3.3k forks (v1.3.0 Apr 16, 2026) | `pip install yfinance` | Direct MCP via Alex2Yang97/maxscheijen/narumi | **Adopt** (with caching) |
| **Tushare Pro** | A-shares, HK (5000+pt), funds, futures, macro | Daily K, fundamentals, financial statements, dividends, macro | Official paid SDK | ~200 RMB/yr (2000pt), ~500 RMB (5000pt) | Yes (token) | **LOW** — official, paid SLA | EOD ~17:00 CST | Pre-/post-adjusted via `pro_bar(adj='qfq'/'hfq')` | Active | `pip install tushare` | Direct via FinanceMCP, sunyalou, aigroup | **Adopt** at 2000pt tier |
| **AKShare** | A/HK/US/funds/QDII/macro/futures/crypto/bonds | OHLCV, NAV, macro, fundamentals (1,000+ endpoints) | Wrapper (Sina/Eastmoney/Jin10/CNINFO scrape) | Free | None | **HIGH** — scraping, repeat outages (issues #6092, #6167) | EOD; some intraday with delay | Explicit `adjust=''/'qfq'/'hfq'` | Active, 16.6k★ / 2.9k forks; monthly fixes | `pip install akshare --upgrade` | Via akshare-one-mcp or custom Python bridge | **Adopt** (as fallback + QDII source) |
| **FRED API + fredapi** | US macro + global indicators incl. some China | Time series, 800k+ series | Official | Free | Yes (free key) | **NONE** — public domain | EOD/monthly per series | N/A | Active | `pip install fredapi` | `npx fred-mcp-server` | **Adopt** |
| **Alex2Yang97/yahoo-finance-mcp** | Global via yfinance | All yfinance tools | Wrapper of yfinance | Free | None | Same as yfinance | Same as yfinance | Inherits yfinance | Recently updated | `uvx --from git+...` | Direct MCP | **Adopt** as primary yfinance MCP |
| **maxscheijen/mcp-yahoo-finance** | Global via yfinance | Subset (price, info, comparisons) | Wrapper | Free | None | Same as yfinance | Same | Inherits | "Early development" per author | `pip install mcp-yahoo-finance` | Direct MCP | **Pilot** |
| **narumi/yfmcp** | Global via yfinance | Standard tools | Wrapper | Free | None | Same | Same | Inherits | MIT, Docker | `uvx yfmcp@latest` | Direct MCP | **Pilot** |
| **guangxiangdebizi/FinanceMCP** | A/HK/US (via Tushare), crypto (Binance), news, macro | Stocks, indices, macro, news, company financials | Wrapper of Tushare + Binance + RSS | Free server (needs Tushare token) | Tushare token | Inherits Tushare ToS | Tushare delay (15-30 min EOD) | Auto-qfq on daily K (no toggle) | **Active — 538★ / 110 forks, last issue #19 Dec 17, 2025** | `npx -y finance-mcp` | Direct MCP (stdio or HTTP) | **Adopt** as primary A-share MCP |
| **zwldarren/akshare-one-mcp** | A-shares via AKShare | Historical, real-time, news, statements | Wrapper of akshare-one | Free | None | Inherits AKShare | Inherits | Explicit `adjust` param | **162★, v0.3.9 Mar 14, 2026** | `uvx akshare-one-mcp` | Direct MCP | **Adopt** as primary AKShare MCP |
| **sunyalou/Tushare-mcp-server** | A-shares (basic) | Daily/weekly/monthly prices | Wrapper of Tushare | Free | Tushare token | Inherits Tushare | Same | Unspecified | Sep 2025, 1★ | git clone | Reference only | **Shelve** |
| **jackdark425/aigroup-market-mcp** | A/US/HK + news (via Tushare) | Stocks, indices, funds, macro, news | TS wrapper of Tushare + Baidu News | Free | Tushare token | Inherits | Same | Unspecified | Active but low traffic | `npx -y aigroup-market-mcp` | Direct MCP | **Pilot** |
| **Polygon.io** | US (primary) | Real-time, EOD, fundamentals, options | Official | Free 5/min; $29-199/mo paid | Yes | **NONE** (official) | Real-time on paid | Adjusted | Active | `pip install polygon-api-client` | Custom MCP / official MCP | **Shelve** (not for personal long-term) |
| **Alpha Vantage** | US + 20 exchanges global | EOD, fundamentals, FX, crypto, indicators | Official, NASDAQ-licensed | Free 25/day; $30-200/mo | Yes (free) | **NONE** | EOD or 15-min delayed | Adjusted available | Active, **has official MCP server** | `pip install alpha_vantage` | Official MCP | **Pilot** (US backup) |
| **Finnhub** | Global, US-focused | Quotes, news, fundamentals, sentiment | Official | Free 60/min; $49/mo | Yes | **NONE** | 15-min delayed | Adjusted | Active | `pip install finnhub-python` | Community MCP exists | **Pilot** (best free real-time tier) |
| **EODHD** | 70+ global exchanges incl. SS/SZ/HK | EOD, intraday, fundamentals, macro | Official | $19.99-$99.99/mo (no free) | Yes | **NONE** | EOD | Adjusted | Active, **official MCP server v1+v2 at mcpv2.eodhd.dev** | `mcpv2.eodhd.dev/v1/mcp?apikey=…` | Direct MCP (remote) | **Shelve** at 500 RMB budget (cheapest paid plan ≈ 1700 RMB/yr > budget) |
| **Stooq** | Global daily; ~21k stocks + ETFs + indices + FX + crypto | EOD CSV download | Free public site, no API | Free | None | **LOW** (open data) | EOD | Adjusted close available | Active | `pandas-datareader.stooq` | Python bridge | **Pilot** (long-history backtest) |
| **天天基金 (Eastmoney Fund)** | China funds + QDII | Daily NAV (incl. real-time est.), holdings, fees, ratings | Public undoc'd JSON endpoints | Free | None | **HIGH** — unofficial, undocumented | EOD ~17:00 CST; QDII updated through night | N/A | Endpoints stable for years | Direct: `fundgz.1234567.com.cn/js/{code}.js` | AKShare wraps it; custom MCP | **Adopt** (via AKShare) |
| **雪球 (Xueqiu)** | Global (via Xueqiu mirror) | Quotes, fundamentals, discussions | No official API; unofficial scrapers exist | Free | Cookie required | **VERY HIGH** — explicit anti-scraping, ToS prohibition | Various | Varies | Cat-and-mouse | Various scrapers (avoid) | Reference only | **Shelve** |
| **Eastmoney (东方财富)** | Full China + global | Quotes, fund, board, news | Public web + some JSON | Free | None | **HIGH** — anti-scrape, IP-ban | EOD/15-min | Varies | Active | AKShare wraps most of it | Custom Python bridge | **Adopt indirectly via AKShare** |
| **World Bank API** | Global annual macro | GDP, inflation, demographics | Official | Free | None | **NONE** | Annual; monthly only for FX | N/A | Active | `pip install wbgapi` | Custom MCP | **Pilot** (cross-country comparisons) |
| **IMF Data API** | Global macro, monthly | CPI, BoP, IFS — restructured 2025 (SDMX) | Official | Free | None | **NONE** | Monthly | N/A | Active | `pip install sdmx1` | Custom MCP | **Pilot** for cross-verification |
| **NBS (国家统计局) data.stats.gov.cn** | China official statistics | All NBS releases | Official portal, no public API | Free | None | **LOW** | Per release schedule | N/A | Active | Manual / scraping | Reference only | **Pilot** (authoritative cross-check) |
| **PBOC (人民银行)** | Monetary stats, FX mid-rate | Money supply, balance sheet, rates, gold reserves | Official portal, no public API | Free | None | **LOW** | Monthly | N/A | Active | Manual / AKShare wraps some | AKShare bridge | **Adopt indirectly via AKShare** |
| **掘金量化 (Goldminer/GM) SDK** | A-share + futures (free tier) | Daily K + financial + estimation | Official semi-free | Free w/ registration | Yes | **LOW** (official) | EOD | Adjusted | Active | `pip install gm` | Custom Python MCP | **Pilot** (alternative to Tushare for free quota) |
| **BaoStock** | A-share daily + financials | Historical only | Open source semi-official | Free, no token | None | **LOW** | EOD next day | Adjusted | Active | `pip install baostock -i tuna` | Python bridge | **Pilot** (free, but no fundamentals depth) |
| **`finance-news-mcp` (jvenkatasandeep)** | Bloomberg/WSJ/CNBC/SA/MarketWatch/FT RSS | Title + summary + URL + ts | RSS aggregator wrapper | Free | None | **LOW** (RSS public) | RSS poll interval | N/A | Active | `uv run python main.py` | Direct MCP (FastMCP) | **Adopt** |

Note: Adopt = sufficient evidence, integrate directly; Pilot = has potential but spike-validate first; Shelve = not applicable for this use case or insufficient evidence.

---

## Section 6c — Risk Register

| Tool/Source | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| yfinance | Yahoo tightens rate limits / blocks IP | High | Very high (issue #2422 Apr 29, 2025) | Local SQLite cache; query during off-hours; back off on `YFRateLimitError`; have AKShare/Stooq fallback |
| yfinance | Yahoo changes JSON shape, library breaks | Medium | Medium (happens 1–2×/year) | Pin version; track ranaroussi/yfinance issues; have fallback |
| yfinance | ToS violation if "high-volume" → cease and desist? | Low | Very low for personal use (<1k req/day) | Throttle; identify as personal research |
| yfinance | Adjusted-close drift on splits (quantmod issue #253) | Medium | Low | For dividend/split-rich stocks, verify against issuer or Stooq |
| AKShare | Eastmoney/Sina anti-scrape bans IP | High | High (issues #6061, #6092, #6167 in 2025) | Aggressive caching; `time.sleep(4)`; accept partial outages; do NOT rotate IPs (ToS-gray) |
| AKShare | Interface drift after upstream HTML change | Medium | High (monthly changelog "修复 xxx 接口") | Pin major.minor; subscribe to akfamily/akshare releases |
| AKShare | ToS gray for scraped data (Sina/Eastmoney/CNINFO) | Medium | Medium | Personal non-commercial use; do not redistribute |
| Tushare Pro | Points expire after 1 year | Low | Certain | Renew at 200 RMB/yr; budget covers it |
| Tushare Pro | "Required to credit 数据来源：Tushare" per FAQ | Low | Certain | Add credit line in any shared notes |
| Tushare Pro | Specific endpoints (e.g., `moneyflow_dc`) cap at "every day 2 times" even for paid tiers | Medium | Medium (FinanceMCP author has documented and worked around this) | Use standard `moneyflow` endpoint; cache results |
| FRED | Discontinued series without warning (e.g., `MYAGM2CNM189N` for China M2 ended Aug 2019) | Low | Medium | Detect stale data; cross-verify with AKShare for current month |
| 天天基金 / Eastmoney APIs | Endpoint cookie/header requirements change | Medium | Medium | Wrap via AKShare which is community-maintained |
| Existing MCP servers | Single-maintainer abandonment | Medium | Medium (sunyalou/Tushare-mcp-server already feels stale) | Prefer servers with active commit history; fork what you depend on |
| Existing MCP servers | Auto-applies qfq without exposing toggle (FinanceMCP) | Low | Certain | Aware of choice; use akshare-one-mcp for explicit control when needed |
| Xueqiu/Eastmoney scraping | Lawsuits over "fund data scraping" in China have precedent | Medium | Low for personal use | Use AKShare's wrapper; avoid direct scraping; non-commercial |
| News MCP servers | RSS feed deprecation by source publisher | Low | Medium | Multi-source; failover; don't depend on a single feed |

---

## Section 6d — Three Plans

### Plan 1: Zero-cost MVP (all free)
- **Stack:** `Alex2Yang97/yahoo-finance-mcp` (US/HK/global) + `zwldarren/akshare-one-mcp` (A-share + China funds + QDII + China macro) + `stefanoamorelli/fred-mcp-server` (US macro + a few China series) + `jvenkatasandeep/finance-news-mcp` (English news)
- **Coverage:** Daily prices for all markets; A-share fundamentals via AKShare; macro for US (complete) + China (PMI/CPI/LPR via AKShare's Jin10-sourced endpoints, USD/CNY via FRED); QDII via AKShare; news for major English sources
- **Gaps:** No official SLA on any source; AKShare can break for days when Eastmoney upgrades anti-scrape; no Chinese financial news index (need DIY); A-share fundamentals less structured than Tushare
- **Best for:** "Try the workflow for 1-2 weeks before paying"

### Plan 2: ≤500 RMB/year MVP — **recommended**
- Plan 1 stack **+ Tushare Pro at 2000 points (~200 RMB/yr)** via `guangxiangdebizi/FinanceMCP`
- **Coverage gains:** Structured A-share fundamentals (income/balance/cashflow with consistent field names), dividends `dividend` endpoint, daily macro (Chinese CPI/PMI/M2/LPR from authoritative ingestion, not scraped), stable SLA at 200 req/min, official news feed (`news` endpoint covers 新浪/华尔街见闻/同花顺/凤凰/财联社)
- **Coverage still missing:** HK daily K still via yfinance/AKShare (Tushare HK needs 5000+ pts); US stocks still via yfinance; intraday data (acceptable per requirements)
- **Headroom:** 300 RMB/yr unused — can add one of: bump Tushare to 5000 pts (+300 RMB) for unlimited frequency + HK daily; or buy Finnhub Basic ($49/mo blows the budget — skip); or save for later

### Plan 3: Best-quality upgrade path (future)
- **+300 RMB/yr**: Tushare Pro 5000 points → adds HK daily, removes daily query cap, adds dividend & restated financials
- **+~150 RMB/mo ≈ 1700 RMB/yr**: Add **EODHD All-World** plan ($19.99/mo) for clean US/HK/Europe fundamentals with adjusted EOD + official MCP server at `mcpv2.eodhd.dev/v1/mcp` — replaces yfinance fragility entirely
- **+$0**: Add **Alpha Vantage** free tier (25 req/day) — has *official* MCP server, NASDAQ-licensed, useful as a "compliance-grade" cross-check for any single quote you'd cite in a note
- **Self-hosted enrichment:** Build your own thin MCP servers for (a) PBOC daily mid-rate scrape from `pbc.gov.cn`, (b) Caixin/财新 RSS index, (c) cross-reference between Tushare and AKShare for the same ticker (sanity check)

---

## Section 6e — Gap Check (Blind Spots for a Financial Outsider)

| Data Category We Didn't Consider | Why It Matters for Personal Long-Term Investors | Recommended Source |
|---|---|---|
| **Treasury yield curve (1M / 3M / 2Y / 10Y / 30Y)** | Yield-curve inversion (2s10s, 3m10y) is the single most-cited recession indicator. FIRE allocations should rebalance defensives when curve flips. | FRED: `DGS10`, `DGS2`, `T10Y2Y`, `T10Y3M`. China: CFETS/中债 via AKShare `bond_zh_us_rate`, `bond_china_yield` |
| **Credit spreads (HY OAS, IG OAS)** | Leading indicator of stress; widens 6–12 months before equity drawdowns | FRED: `BAMLH0A0HYM2` (HY OAS), `BAMLC0A0CM` (IG OAS) |
| **Short interest / days-to-cover** | Tells you when a stock is positioning-vulnerable; useful for sizing risk in concentrated holdings | NYSE/Nasdaq bi-monthly via FINRA; yfinance `Ticker.info['shortRatio']`, `Ticker.shares` |
| **Options open interest + put/call ratio** | Aggregate put/call is a sentiment indicator usable as a rebalance trigger | CBOE PCR via `^VIX`-adjacent yfinance; AKShare `option_finance_board` for SSE 50 ETF options |
| **ETF flows (creates/redeems)** | Tells you what the marginal dollar is buying; ETF.com / SPDR.com daily flows | etfdb.com (free web), `etf-flows` Bloomberg-only; use SPDR/iShares CSV downloads via custom MCP |
| **Insider transactions (Form 4)** | Strong long-term alpha signal at the individual stock level | SEC EDGAR Form 4 RSS; openinsider.com (free); `secedgar` Python package |
| **Dividend history + 12m forward yield** | Critical for FIRE income planning; coverage ratio (FCF/dividend) flags cuts | yfinance `Ticker.dividends`, `Ticker.info['trailingAnnualDividendYield']`; Tushare `dividend` endpoint |
| **Currency-hedged returns** | A QDII US-equity fund vs an unhedged one can differ by 5–15% in a CNY-volatile year — material for FIRE in CNY terms | Compute manually: CNY-denominated return = USD return × CNY/USD change; yfinance + FRED |
| **Earnings calendar + revisions** | Upcoming-earnings volatility timing; revision trend = sentiment | yfinance `Ticker.calendar`; AKShare `stock_yjyg_em` (业绩预告); `stock_jzdy_em` |
| **CBOE VIX / VIX term structure / VVIX** | Hedging cost proxy; > 30 historically signals "buy more risk" for long-term DCA | FRED `VIXCLS`; CBOE for term structure |
| **Commodity prices (Brent, WTI, copper, gold)** | Macro signal + inflation hedge allocation | FRED `DCOILWTICO`, `DCOILBRENTEU`, `GOLDAMGBD228NLBM`; AKShare `futures_main_sina` |
| **Real estate (REITs + 70-城房价指数)** | REITs are a real-asset bucket in FIRE allocation; China property is correlated with banking risk | yfinance for US REIT ETFs (VNQ, IYR); AKShare `macro_china_house_price_index` for 70-城 |
| **Geopolitical risk index** | Tail risk for global allocators; GPR index by Caldara & Iacoviello | FRED-style download from `policyuncertainty.com`; manual ingestion |
| **TIPS breakevens (inflation expectations)** | Direct readout of market's inflation forecast; informs bond duration | FRED `T5YIE`, `T10YIE` |
| **Hong Kong-Shanghai Stock Connect flows (北向/南向 资金)** | Marginal foreign money in/out of A-shares; closely watched leading indicator | AKShare `stock_hsgt_hist_em`, `stock_hsgt_north_net_flow_in_em` |
| **A-H premium index** | A-share vs H-share dual-listed premium = mainland sentiment vs offshore | Hang Seng publishes; AKShare wraps |
| **Margin trading balance (融资融券余额)** | Retail leverage indicator in A-share — a sentiment gauge | AKShare `stock_margin_underlying_info_szse`, `stock_margin_sse` |
| **Mutual fund issuance volume (新发基金 募集规模)** | Contrarian indicator: heavy issuance peaks → market top | AKShare `fund_new_found_em` |
| **CFETS RMB index (basket)** | Better gauge of CNY than CNY/USD alone | AKShare `currency_currencies` / `macro_china_cny_eer` |
| **TED spread / SOFR-OIS spread** | Funding stress; spiked in 2008/2020 | FRED `TEDRATE` (discontinued; use OIS spread instead via FRED) |
| **Buffett indicator (total market cap / GDP)** | High-level valuation check; FIRE allocators use 80%/130% bands | Compute from FRED `NCBEILQ027S` + yfinance Wilshire 5000 / `^GSPC` |
| **CRSP / Fama-French factor returns** | If you want to learn factor investing — value/momentum/quality decomposition | Ken French's data library (free), monthly CSV; build custom MCP |

---

## Confidence Assessment of Original 7 Hypotheses

1. **"yfinance is the best free entry for US/global stock prices + fundamentals + ETFs"** — **SUPPORT** — Confirmed by both popularity (23.7k★) and feature coverage. Caveat: fragility (rate limits, anti-scrape) means you must treat it as cache-first, not query-on-demand.
2. **"Tushare Pro (~500 RMB/yr) is the best structured A-share source"** — **PARTIALLY SUPPORTED** — Tushare Pro is the best paid structured source, but at the **2000-point (~200 RMB) tier**, not 5000-point. The 5000-point tier is only needed if you want HK daily and unlimited frequency. The original hypothesis overestimates the necessary spend.
3. **"FRED is the official free standard for US macro"** — **STRONGLY SUPPORTED** — 800k+ series, free API, official MCP servers, public-domain data. No competition for US macro.
4. **"China macro likely has no unified FRED equivalent, requires multi-source patching"** — **SUPPORT** — Confirmed in detail. FRED covers CPI level + CNY/USD only; PMI/LPR/MLF/M2 current/TSF must come from AKShare's `macro_china_*` (which sources Jin10) or Tushare Pro.
5. **"MCP ecosystem already has finance servers that may be directly usable"** — **PARTIALLY SUPPORTED** — Yes, several exist (`Alex2Yang97/yahoo-finance-mcp`, `guangxiangdebizi/FinanceMCP`, `zwldarren/akshare-one-mcp`, `stefanoamorelli/fred-mcp-server`). But they range from demo-grade to production-grade; "directly usable" applies to ~50% of them. You will still write 1–2 custom wrappers (Chinese news RSS, QDII-specific endpoints, PBOC scrape). The "286 stars" figure mentioned in the brief refers to an older snapshot of `Alex2Yang97/yahoo-finance-mcp`; the larger and more active project in this space is `guangxiangdebizi/FinanceMCP` (538★) for the China side.
6. **"Domestic fund/ETF/QDII data may be hardest"** — **REFUTED** — AKShare's `fund_open_fund_daily_em` and Eastmoney's public JSON endpoints actually make this *easy*, not hard. The harder part is holdings data (only quarterly with lag).
7. **"Private company valuations cannot have structured APIs, only news evidence"** — **STRONGLY SUPPORTED** — Confirmed. PitchBook/CB Insights are paid; for OpenAI/Anthropic/ByteDance valuations, you index news mentions of funding rounds and treat them as the evidence chain. No structured API for unlisted-company valuations exists at retail tier.

---

## Section 7 — Decision Interface (Engineering-Ready Actions)

### Run today via `npx`/`uvx`/`pip install` (no code):
1. **FRED MCP** — `npx -y @smithery/cli install @stefanoamorelli/fred-mcp-server --client claude` — needs free FRED API key from `https://fred.stlouisfed.org/docs/api/api_key.html`
2. **Yahoo Finance MCP** — `uvx --from git+https://github.com/Alex2Yang97/yahoo-finance-mcp yahoo-finance-mcp` — no key
3. **AKShare-One MCP** — `uvx akshare-one-mcp` or `npx -y @smithery/cli install @zwldarren/akshare-one-mcp --client claude` — no key
4. **FinanceMCP (Tushare)** — register at `tushare.pro` → top up 200 RMB → get token → `npx -y finance-mcp` with `TUSHARE_TOKEN=…` env. Then in `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{ "mcpServers": { "finance-mcp": { "command": "npx", "args": ["-y", "finance-mcp"], "env": { "TUSHARE_TOKEN": "your_token" } } } }
```
5. **Finance News RSS MCP** — `git clone https://github.com/jvenkatasandeep/finance-news-mcp && uv sync && uv run python main.py`

### Need a thin wrapper layer (estimated 1-3 hours each):
6. **QDII-specific MCP** — wrap AKShare's `fund_open_fund_daily_em`, `qdii_e_index_jsl`, `fund_em_portfolio_hold` as one focused MCP tool with caching. ~50 lines of FastMCP.
7. **Chinese News RSS MCP** — fork `finance-news-mcp`, swap the RSS URLs to 财新 / 华尔街见闻 / 同花顺 / 第一财经 / 雪球热门话题 / 财联社电报. ~30 lines.
8. **PBOC mid-rate MCP** — daily scrape of `pbc.gov.cn/zhengcehuobisi/...` central-parity rate, cache, expose as a tool. ~80 lines.
9. **Cross-source consistency checker MCP** — given a ticker, fetch from Tushare + AKShare + yfinance, return a diff report. ~100 lines. **Important for trust calibration.**

### Need API key application:
- **Tushare Pro** — register at `tushare.pro/register` → fill profile (+20 points) → recharge ¥200 → 2000 points → 1-year validity
- **FRED** — register at `fred.stlouisfed.org` → free API key, instant
- **Alpha Vantage** (Plan 3) — `alphavantage.co/support/#api-key` → free, instant
- **EODHD** (Plan 3) — `eodhd.com/register` → paid plan from $19.99/mo

---

## Caveats and Honest Disclosures

- **Cost timing:** Tushare Pro recharge is 1:10 (¥200 → 2000 points); points expire after 1 year but are *not consumed* by queries. The budget assumption is steady-state per year.
- **ToS gray areas explicitly flagged:** yfinance, AKShare, Tiantian/Eastmoney direct calls, and Xueqiu scraping all sit in gray zones. Personal, non-commercial, non-redistributed use is the norm but is not legally guaranteed. The user has elected to accept this risk.
- **MCP server stability:** None of the community MCP servers come with an SLA. Forks may abandon. The "Adopt" verdict is current as of May 2026; re-evaluate every 6 months.
- **The "daily-level data is sufficient" constraint** means you can — and should — heavily cache. A nightly cron job that pulls all your portfolio data to a local SQLite/Parquet store and exposes *that* via MCP would make the entire system 100× more robust than calling external APIs on every Claude question. This is the highest-leverage engineering decision you can make beyond picking sources.
- **Repository popularity figures verified May 2026:** yfinance 23.7k★ / 3.3k forks (v1.3.0 Apr 16, 2026); akfamily/akshare 16.6k★ / 2.9k forks; guangxiangdebizi/FinanceMCP 538★ / 110 forks; zwldarren/akshare-one-mcp 162★ (v0.3.9 Mar 14, 2026). These will drift; re-check before commitment.
- **"Don't bypass paywalls" guidance honored:** all news recommendations index headlines + summaries + URLs from RSS feeds; full-text retrieval is left to the human clicking the link in Claude.
- **Out of scope per the user's constraints:** order routing, Level 2, real-time ticks, options pricing models, factor backtesting frameworks (zipline/vectorbt/backtrader), self-hosted data ingestion/scrapers, minute-level data.
- **Unverified item:** the brief's mention of "Alex2Yang97/yahoo-finance-mcp with 286 stars" was not directly confirmed in May 2026 searches; the repo exists and is functional but the star count has likely shifted. Practical impact: none — recommendation stands.