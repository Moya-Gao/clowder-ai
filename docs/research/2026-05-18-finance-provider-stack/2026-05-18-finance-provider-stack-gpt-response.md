# 个人投资学习场景的金融数据 Provider Stack 选型研究

## 核心判断

在你给定的约束下，最合理的结论不是“找一个万能 provider”，而是建立一套**分层、分市场、分可信度**的 provider stack。对中国证券数据，把预算优先投给 **Tushare Pro**；对中国宏观、基金、QDII 和各种“边角料”，用 **AKShare/AKTools** 补洞；对美股与全球日线行情，用 **Yahoo 系封装**做便利层，但不要把它当真相源；对美国宏观，直接用 **FRED API**；对新闻与私有公司指标，接受“**证据链而不是结构化真相源**”这一现实。这个结论同时符合你的预算、MCP 兼容性、macOS 环境以及“中国市场是硬需求”的边界。citeturn27view1turn29view0turn17view3turn26search1turn17view2turn19view0turn37search1turn37search2

如果只能买一个付费源，**不该先买国外商业市场 API**。原因很直接：Alpha Vantage 的 premium 起价是 **49.99 美元/月**，EODHD 的商业化起点是 **19.99 欧元/月**，二者都明显高于你给定的 **500 元/年**预算；而 Tushare 的积分档里，**500 元/年**即可到 **5000 积分**、**500 次/分钟**、常规数据“无总量上限”，它对个人长期投资学习场景的性价比远高于同价位海外 provider。citeturn14search0turn11search4turn17view7

但这里也必须立刻加一个保留：**500 元/年的 Tushare 不是“中国全覆盖”通行证**。它的 `etf_basic` 文档明确写着需要 **8000 积分**，而且港美股与分钟数据权限又是**积分体系之外的单独权限**。所以，正确策略不是“买了 Tushare 就关掉 AKShare”，而是“**Tushare 做中国证券主干，AKShare 继续补 ETF/QDII/宏观缺口**”。citeturn17view6turn17view7

对 MCP 生态，我的结论也不是一刀切的“成熟”或“不成熟”。**官方 MCP 已经开始出现**：Tushare 已提供官方 MCP 配置流程，Alpha Vantage 也上线了官方 MCP server；但社区里的 Yahoo Finance MCP，多数仍建立在 Yahoo 非官方接口或 `yfinance` 之上，其中有的项目甚至在 README 里明确标注“**early development**”。因此，**能直接采纳的是官方 MCP；社区 finance MCP 更适合先做 spike，不适合盲目当生产基座**。citeturn29view0turn13view3turn13view1

## 反证优先

先说最重要的反证：**“yfinance 足够当真相源”这个直觉不成立。** yfinance 官方文档自己就写明，它**不隶属于 Yahoo**，使用的是 Yahoo 的公开接口，且用于**research and educational purposes**，实际下载数据要遵守 Yahoo 的条款，并特别提醒“**Yahoo finance API is intended for personal use only**”。同时，它在 2025–2026 的 issue 中持续出现“possibly delisted”“401/401 auth”“market parameter ignored”“近期 release 改坏既有返回结构”等问题。这不是小概率边角 bug，而是**典型的非官方数据面风险**。citeturn17view2turn22search6turn22search10turn22search14turn22search0turn22search16

第二个需要修正的假设是：**“AKShare 免费，所以可以当真相源。”** 这也不成立。AKShare 官方文档明确声明：数据接口和数据**仅用于学术研究，不可做任何商业用途**；数据**仅供参考**；未来还可能因为不可抗力**移除部分接口**。而且它自己的 changelog 在 2026 年仍在高频修复大量接口，GitHub issue 里也能看到 `stock_zh_a_hist`、`macro_china_nbs_nation`、新浪 A 股实时行情等接口的持续失效与报错。这说明 AKShare 的强项是**覆盖度与补洞能力**，不是“官方真相源”属性。citeturn17view3turn21search3turn4search9turn23view0

第三个要校正的是：**“Tushare Pro 能一把梭解决中国市场。”** Tushare 的确是当前最像“结构化中国证券数据平台”的选择：它提供语言无关的 **HTTP POST API**，还有官方 MCP，且官方自述已经建立了“**自有数据存储和数据治理体系**”。但它同样有现实边界：低积分用户会遇到**频次限制与 timeout**；它的复权逻辑与很多行情软件不一致，因为它是以用户请求的 `end_date` 向前复权，而不是以“最新交易日”向前复权；同时，很多基金、ETF、特色数据都有**额外积分门槛**。所以，Tushare 是**中国市场主干**，不是“中国所有数据问题的终极解”。citeturn27view1turn28search6turn17view8turn17view7turn17view6

第四个被反证的直觉是：**“现成 finance MCP server 已经成熟到可直接上生产。”** 你能找到星标很多的 Yahoo Finance MCP，也能找到集成多源 failover 的 `stock-data-mcp`，还能找到 README 很完整的 FRED MCP；但在我审阅的项目里，至少有一个 Yahoo MCP 项目明确写着“**currently in early development**”，而多源聚合 MCP 虽然方向正确，也只有几十 star、最近 release 在 2026 年 2 月，远算不上“行业标准件”。真正更扎实的，是 **Tushare 官方 MCP** 和 **Alpha Vantage 官方 MCP** 这种 provider 自己下场支持的路径。citeturn13view1turn31view0turn29view0turn13view3

第五个经常被低估的现实是：**“通用 News API 可以低成本解决财经新闻索引。”** NewsAPI 的 Developer 计划虽然免费，但文档写得很清楚：它只适用于**development and testing**，文章**有 24 小时延迟**，每天 **100 requests**，且**不能用于生产环境**；真正可用于 production 的 Business plan 是 **449 美元/月**。这对你的预算与使用场景都不匹配。财经新闻这块要么用**GDELT 这类开放元数据源做轻量索引**，要么用**金融 provider 自带 company news** 做 ticker 绑定，要么直接走**Reuters/FT/SEC/公司 PR 证据链**。citeturn36view4turn36view3turn36view2

更值得注意的是，**已有成功案例本身就在反驳“单一 provider”思路**。AWS 中国官方博客演示的投研助手，实际采用的是 **AKShare + yfinance + pandas-datareader/FRED** 的组合，并且在 skill 里明确写了 AKShare 非交易时段可能返回前一交易日数据、yfinance 偶尔会被 Yahoo 限流；另一个开源项目 SimTradeData 则直接把 **BaoStock + Mootdx + EastMoney + yfinance** 做成多源协同，存进 DuckDB/Parquet；`stock-data-mcp` 甚至把“**多数据源自动故障转移**”写进了项目定位。这些一手工程样本共同指向一个结论：**个人投资学习基建的正确解法，是 provider orchestration，而不是 provider monogamy。** citeturn31view3turn31view2turn31view0

## Provider Stack 推荐表

| 市场域 | 官方真相源 | 便利接入库/API | Fallback | 推荐理由 |
|---|---|---|---|---|
| 美股与全球股票日线 | SEC EDGAR、公司 IR、ETF 发行人披露；对“官方统一免费价格 API”我在本轮审阅中**没有找到**能同时满足免费、广覆盖、合规与可编程的统一方案 | `yfinance`；TypeScript 侧优先试点 `yahoo-finance2` | Alpha Vantage free / official MCP；未来若愿升级，可考虑 EODHD | Yahoo 系免费广覆盖、维护活跃、无 key 门槛，适合做**便利层**；但它是非官方、个人用途、稳定性受 Yahoo 变更影响，因此不应被当作真相源。citeturn17view2turn17view1turn22search1turn22search6turn38search0turn14search0turn13view4 |
| A 股与场内 ETF | 上交所、深交所、上市公司公告、基金公司公告 | **Tushare Pro** | AKShare / AKTools；BaoStock | Tushare 是中国证券数据里最接近“结构化主干”的方案：有官方 HTTP、官方 MCP、数据治理描述、价格档清晰；但要注意积分门槛和复权口径差异。citeturn27view1turn28search6turn17view7turn17view8turn29view0 |
| 公募基金与 QDII | 基金公司公告、招募说明书、交易所 ETF 披露 | AKShare 基金/QDII 接口；Tushare 部分 ETF 接口 | 天天基金页面、集思录页面、手工官方页核验 | QDII **没有想象中那么“拿不到”**：AKShare 已覆盖天天基金与集思录路径，能拿到净值、费率、部分持仓与估值/溢价信息；但部分 Jisilu 路径需要登录 cookie，且 Tushare 某些 ETF 接口要 8000 分以上，所以更像“多源拼接问题”，而不是“完全无解”。citeturn17view5turn5search1turn17view6turn33search4 |
| 美国宏观与利率 | **FRED**；必要时配合美国财政部原始页面 | FRED API；`pandas-datareader`；FRED MCP | Alpha Vantage 经济数据端点 | FRED 仍然是美国宏观的最佳免费标准：官方 API、海量序列、搜索能力完善；但其 terms 也提醒部分第三方序列有版权限制，构建面向他人的应用时要注意数据所有者权利。citeturn19view0turn18search2turn19view3turn19view1 |
| 中国宏观 | 国家统计局国家数据、人民银行统计数据、中国货币网、SAFE | **AKShare / AKTools** | 人工直连官方站点；必要时自做 아주薄的 HTTP wrapper | 中国宏观**没有一个对标 FRED 的统一官方开放入口**。现实可行路径是按主题路由到官方源，再用 AKShare 把这些源结构化。AKShare 的 `macro_china_nbs_nation` 就直接映射到国家统计局 `easyquery`。citeturn6search0turn17view4turn7search3turn6search5turn6search6turn6search2 |
| 汇率与人民币中间价 | 中国货币网、SAFE、CFETS 相关官方发布 | AKShare；Yahoo/Alpha Vantage 做全球 FX 便利层 | 银行官网页面核验 | 对中国投资者最关键的是把“全球 FX 便利查询”和“人民币中间价官方口径”分开。前者可以容忍 Yahoo/Alpha Vantage，后者应以中国货币网与 SAFE 为真相源。citeturn7search5turn6search2turn14search2 |
| 财经新闻索引 | 公司 PR、SEC 8-K/6-K、交易所公告 | Finnhub company news；Alpha Vantage News/Sentiment；GDELT | Reuters/FT/主流媒体证据链 | 你的约束是“只索引，不存全文”，这使得新闻 provider 更容易选择。NewsAPI 免费计划不适合生产；更可行的是金融 provider 自带 company news 或 GDELT 这类开放新闻元数据，再把标题、摘要、链接、时间、来源做入库。citeturn10search2turn35search5turn14search2turn36view2turn36view4 |
| 私有公司估值与 ARR | 无统一官方公开 API | Reuters、FT、公司高管公开表述与融资新闻 | 多媒体交叉佐证 | OpenAI、Anthropic、字节这类公司的 revenue run-rate、估值、融资条款，现实里主要来自 Reuters/FT 等新闻报道或公司高管公开发言，而不是结构化公共 API；这类问题天然应进入“证据链模式”。citeturn37search1turn37search2turn37search7 |

## 工具与项目评估表

| Tool/Source | Market Coverage | Data Types | Official/Wrapper | Cost | API Key | License/ToS Risk | Data Delay | Adj. Types | Last Maintained | Install Command | Integration Path | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yfinance | Yahoo 覆盖的美股、ETF、基金、全球市场 | 历史价格、基本面、财报、期权、新闻 | Wrapper | 免费 | 否 | **高**：文档明确非官方，且实际数据使用受 Yahoo personal-use 限制 | 依 Yahoo/交易所而定 | 有调整后序列与公司行动，但不是中国式 qfq/hfq | 2026-04-16 | `pip install yfinance` | Python bridge / 薄 MCP 包装 | **采纳**，但仅作美股/全球便利层，不作真相源。citeturn17view2turn22search1turn22search3turn22search6turn22search0 |
| Tushare Pro | 以 A 股为核心，含 ETF、基金、宏观；港美股/分钟部分是单独权限 | 行情、财务、参考数据、ETF、公募基金、宏观 | Official | 免费限量；¥200/¥500/¥1000+ | Token | **中**：账号与权限门槛明确，平台服务可调整；重分发风险需自控 | 以日频/接口更新节奏为主 | 支持复权，但口径与常见行情软件不同 | 2026 年持续更新 | `pip install tushare` | 直接 HTTP / Python SDK / 官方 MCP | **采纳**，是中国证券主干。citeturn27view1turn17view7turn17view8turn28search6turn28search3 |
| Tushare MCP | 同 Tushare 授权范围 | 同 Tushare | Official MCP | 绑定 Tushare 账户 | MCP key / token | **中**：同 Tushare 本体 | 同 Tushare | 同 Tushare | 2026-05 官方文档可用 | 登录个人中心复制 JSON / URL | 直接 MCP | **采纳**，是 Claude Code 最省事的中国证券接入。citeturn29view0turn28search3 |
| AKShare | A 股、港股、宏观、基金、QDII、期货、外汇等覆盖极广 | 行情、宏观、基金、QDII、另类数据 | Wrapper | 免费 | 通常否 | **高**：官方声明仅学术研究、不可商业，且接口可能被移除 | 随目标站点而变 | 部分接口支持 qfq/hfq | 2026-05-18 release-v1.18.62 | `pip install akshare --upgrade` | Python bridge / 通过 AKTools 暴露 HTTP | **采纳**，但定位是“补洞层”，不是“真相层”。citeturn17view3turn21search1turn21search2turn21search3turn23view0 |
| AKTools | 继承 AKShare 覆盖面 | HTTP 化后的 AKShare 接口 | Official HTTP wrapper | 免费 | 否 | **高**：继承 AKShare 的来源与许可风险 | 随底层接口而变 | 继承底层接口 | 2026 年官方文档在线 | `pip install aktools`；`python -m aktools` | 先起本地 HTTP，再薄封装成 MCP | **采纳**，尤其适合 Node/TS 环境。citeturn26search1turn26search2turn26search4 |
| BaoStock | 中国股票市场历史与部分财务/估值 | K 线、行业、分红、季度指标、指数、估值 | Official SDK | 免费 | 否 | **中**：本轮未深审条款，但产品定位清楚且不覆盖基金/宏观全域 | 以日线/季频为主 | 本轮未逐接口复核 | 2026-04-14 | `pip install baostock` | Python bridge / BaoStock MCP | **试点**，适合作为 A 股日线 fallback。citeturn24search3turn15search7turn24search1 |
| FRED API | 美国为主、含多来源全球宏观 | 宏观时间序列、搜索、分类、release | Official | 免费 | 是 | **中低**：官方稳定，但部分第三方序列有版权限制 | 按官方 release cadence | N/A | 官方服务持续在线 | 无；直接 HTTP GET | 直接 API / 薄 MCP 包装 | **采纳**，美国宏观首选。citeturn19view0turn19view1turn19view3 |
| `stefanoamorelli/fred-mcp-server` | FRED 全部序列 | 搜索、浏览、拉取序列 | Community MCP | 免费 | 通常需要 FRED key | **中**：底层源官方，但 server 本身是社区项目，且 AGPL | 继承 FRED | N/A | 2026-02 社区索引仍在更新 | `npx -y @smithery/cli install @stefanoamorelli/fred-mcp-server --client claude` | 直接 MCP | **试点**，适合快速接入；长期更稳的是自己封 FRED API。citeturn13view2turn12search15turn12search21 |
| Alpha Vantage API / official MCP | 全球股票、ETF、指数、FX、商品、宏观、新闻 | 实时/历史、技术指标、news/sentiment、宏观 | Official | 免费 25/day；Premium $49.99/mo 起 | 是 | **中**：个人/商业用途分层，实时美股还涉及 entitlements | 免费层偏轻量；实时/15 分钟延迟美股为 premium | 有 `TIME_SERIES_DAILY_ADJUSTED` 等调整接口 | 官方站点 2026-05 更新 | `uvx marketdata-mcp-server YOUR_API_KEY` | 直接 MCP / 直接 HTTP | **试点**；是未来升级的优先项，不适合当前 500 元预算做主干。citeturn13view3turn14search0turn13view6turn14search6turn14search2 |
| `maxscheijen/mcp-yahoo-finance` | Yahoo Finance 覆盖市场 | 价格、公司信息等 | Community MCP | 免费 | 否 | **高**：社区项目 + Yahoo 非官方双重风险 | 继承 Yahoo | 依底层 | 本轮未精确复核最新 commit；README 明示 early development | `uvx mcp-yahoo-finance` | 直接 MCP | **搁置为主、试点为辅**；适合 demo，不适合当核心。citeturn13view1turn17view2 |
| `stock-data-mcp` | A/HK/US/crypto，多源自动故障转移 | 历史价、实时价、新闻、财务指标、资金流 | Community multi-source MCP | 免费；部分能力可接 Alpha key | 可选 | **中高**：方向对，但依赖多源 wrapper，复杂性与漂移风险高 | 随各 provider | 混合 | v0.2.4 发布于 2026-02-11 | `uvx stock-data-mcp` | 直接 MCP | **试点**；值得借鉴其 failover 架构，但不建议直接当唯一生产入口。citeturn31view0turn31view1 |

## 三套方案与工程落地

| 方案 | 具体组合 | 覆盖度 | 主要缺口 |
|---|---|---|---|
| Zero-cost MVP | AKShare + AKTools + yfinance + FRED API + GDELT/ provider 自带轻量新闻 | 能覆盖你的日常前 3 个问题的大部分：市场快照、公司日线与基本面粗查、宏观趋势；新闻可做到标题/链接级索引 | A 股/ETF 的结构化质量不如 Tushare；AKShare 接口漂移要靠重试与 fallback；QDII 某些估值/溢价路径需要 cookie；美股没有官方许可型统一价格源。citeturn17view3turn26search1turn17view2turn19view0turn36view2 |
| ≤500 RMB/year MVP | **Tushare Pro + Tushare MCP** + AKShare/AKTools + yfinance + FRED API | 中国证券主干显著增强，Claude Code 可直接走官方 Tushare MCP；AKShare 继续补 QDII/基金/中国宏观；美股和美国宏观仍然可用 | 5000 分档并不能解锁所有 ETF/QDII 相关接口；港美股/分钟权限还是单独问题；新闻与私有公司指标仍要证据链。citeturn29view0turn17view7turn17view6turn17view3turn19view0 |
| Best-quality upgrade path | Tushare Pro + FRED API + **Alpha Vantage official MCP premium**；若更重性价比而非 MCP，可改看 EODHD | 美国侧增加官方 MCP、授权更清晰的实时/延迟美股数据与新闻/技术指标；中国侧继续由 Tushare + AKShare 负责 | 成本大幅高于当前预算；中国市场依然不能靠海外 provider 替代；私有公司数据仍是证据链问题。citeturn13view3turn14search0turn14search6turn13view4turn11search4 |

对工程落地，我建议直接拆成几件很薄的事来做，而不是先写一个“大而全金融中台”。

| 工程任务 | 今天就能跑起来的东西 | 需要写的薄包装层 | 我的工作量估算 |
|---|---|---|---|
| 中国证券核心 | Tushare MCP；或 `pip install tushare` 后直接调 HTTP/SDK citeturn29view0turn27view1 | 统一字段名、权限报错翻译、复权口径标记 | 0.5–1 天 |
| 中国宏观/基金/QDII | `pip install aktools` 后 `python -m aktools` 起本地 HTTP；或直接 `pip install akshare --upgrade` citeturn26search1turn26search4turn21search5 | 只暴露你真正需要的 10–20 个 endpoint，别全量透传 | 0.5–1 天 |
| 美股/全球便利层 | `pip install yfinance`；TS 侧试点 `yahoo-finance2` 仓库能力 citeturn17view2turn22search1turn38search0 | 统一 symbol、currency、timezone、price adjustment 字段 | 1 天 |
| 美国宏观 | 直接打 FRED API；或先用现成 FRED MCP 做 spike citeturn19view0turn13view2 | 常用 series 白名单、series 搜索缓存、图表前处理 | 0.5 天 |
| 新闻证据链 | 先接 provider news/GDELT，只存标题、摘要、链接、时间、来源 citeturn36view2turn14search2 | ticker 映射、去重、来源打分、证据链合并 | 1 天 |

你真正需要申请或拷贝的 key 很少。**Tushare** 需要注册后拿 token，官方 MCP 直接在个人中心拷贝 JSON/URL；**FRED** 需要 API key；**Alpha Vantage** 免费 key 可以即时申请；如果要试 Finnhub 也需要它自己的 key。citeturn27view0turn29view0turn19view1turn13view3turn10search25

## 风险登记与遗漏检查

| Tool/Source | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| Yahoo 系接口 | Yahoo 变更导致 401/“possibly delisted”/字段结构漂移 | 高 | 高 | 只作便利层；本地缓存；关键问题落到 SEC/IR；保留 Alpha Vantage/EODHD 备用口。citeturn17view2turn22search6turn22search14turn22search0 |
| Tushare Pro | 预算内积分不够，某些 ETF/QDII 接口拿不到；复权口径与常见行情软件不同 | 中高 | 中高 | 在 schema 中强制记录 `adjustment_method`；用 AKShare 补 ETF/QDII；先按你最常用的 20 个接口做权限验收。citeturn17view6turn17view7turn17view8 |
| AKShare / AKTools | 底层网站变更导致接口失效；官方声明不可商业、接口可能移除 | 高 | 高 | 仅用于个人；限制使用面；固定版本；对高频坏接口做灰名单；重要问题回落官方网页。citeturn17view3turn21search3turn23view0turn4search9 |
| FRED API | 某些第三方序列有版权限制；FRED 可随时调整限制 | 中 | 中 | 只把 FRED 用在个人学习和内部 agent；面对他人展示时检查 series notes 与版权归属。citeturn19view1 |
| 社区 MCP | schema 漂移、时区 bug、底层 provider 变化后 server 无人修 | 中高 | 中高 | 对社区 MCP 一律先 spike；核心路径优先走官方 MCP 或自己封一层。citeturn13view1turn31view0 |
| News provider 通用 API | 免费版延迟或不能生产使用 | 中 | 高 | 通用新闻 API 不当主干；优先 company-news 或 GDELT 元数据；只存索引。citeturn36view4turn36view2 |
| 私有公司指标 | 数值来自新闻与匿名信源，口径可能是 ARR/run-rate 而非审计收入 | 中高 | 高 | 为每条事实存 2–3 个证据节点，保留发布时间、来源、口径说明。citeturn37search1turn37search2turn37search7 |

你原 brief 最值得补上的数据类别，不是“更多价格接口”，而是下面这些**长期投资者真正会长期反复用到**的元数据。

| 我们没考虑到的数据类别 | 为什么对个人长期投资者重要 | 推荐的数据源 |
|---|---|---|
| 交易日历与市场状态 | 你问“今天环境变了吗”时，首先要知道市场是否开盘、是否是假期、数据是不是上一交易日 | Tushare `trade_cal`、交易所日历、EODHD Market Status（未来付费可选） citeturn27view1turn13view5 |
| 公司行动与复权因子 | 没有分红、拆股、配股、复权因子，历史收益率与估值对比很容易错 | Tushare、yfinance corporate actions、基金/交易所公告 citeturn17view8turn17view2 |
| ETF/基金持仓与费率 | Bogleheads 组合、QDII 选择、税费拖累，都离不开持仓和费率 | 天天基金 / AKShare、Tushare ETF、公募基金公告 citeturn33search4turn5search1turn17view6 |
| 指数估值口径与方法 | “纳指现在贵不贵”本质不是一个原始行情问题，而是一个**方法论+口径**问题 | 指数提供方 factsheet、第三方估值接口；在 agent 输出里必须附 source label 与 methodology note citeturn21search3 |
| 宏观数据修订值与 vintage | 真要做“宏观环境是否影响 FIRE 配置”，历史回看最好区分初值与修订值 | FRED + ALFRED 路径 citeturn19view0 |
| 汇率与税负 | 中国投资者看美股、QDII、本币购买力，最终都绕不过 FX 与税 | 中国货币网、SAFE、基金招募说明书、券商税务说明 citeturn7search5turn6search2 |

## 置信度总评

整体上，我对这份结论的置信度是**中高**。我最有把握的部分，是 **FRED 作为美国宏观主源**、**Tushare 作为中国证券主干**、以及 **中国宏观需要分官方域名拼接**；我相对保留的部分，是 **社区 finance MCP 的长期稳定性**、**QDII 细项接口的持续可用性**，以及 **美股免费统一价格源的合规/稳定替代**。citeturn19view0turn29view0turn17view3turn13view1turn31view0

| 假设 | 结论 | 理由 | 建议动作 |
|---|---|---|---|
| yfinance 是最佳免费美股入口 | **支持，但有保留** | 免费、广覆盖、维护活跃，的确是最强免费便利层之一；但它非官方、个人用途、且 bug/限流/字段漂移都是真实存在的。citeturn17view2turn22search1turn22search6turn22search0 | **采纳**为便利层；必须保留 fallback。 |
| Tushare Pro 是最适合个人的 A 股源 | **支持** | 它是当前最像“中国证券结构化主干”的低成本选择，有官方 HTTP、官方 MCP、数据治理表述、清晰积分体系；但 500 元档不能覆盖全部 ETF/QDII 接口。citeturn27view1turn29view0turn17view7turn17view6 | **采纳**为付费主源，继续留 AKShare 补洞。 |
| FRED 是最佳美国宏观标准 | **支持** | 官方、免费、序列量巨大、API 完整，仍是最稳妥答案。citeturn19view0turn18search2turn19view3 | **采纳**。 |
| 中国宏观没有统一入口 | **支持** | 官方真相源分散在 NBS、PBOC、ChinaMoney、SAFE 等站点；AKShare 只是做了便利封装。citeturn6search0turn17view4turn7search3turn6search5turn6search2 | **采纳**“按主题路由官方源”的架构。 |
| 现有 MCP 已成熟到可直接用 | **未定，偏反对** | 官方 MCP 已出现，尤其是 Tushare 与 Alpha Vantage；但社区 Yahoo/FRED/聚合 MCP 仍普遍需要 spike 证明。citeturn29view0turn13view3turn13view1turn31view0 | **官方 MCP 采纳；社区 MCP 先试点。** |
| QDII 数据最难获取 | **反对，或至少不完全成立** | QDII 的净值、费率、部分持仓、估值与溢价并非完全无路可走；AKShare + 天天基金 + 集思录 + Tushare 已能覆盖不少场景。更难的其实是私有公司指标和统一口径的指数估值。citeturn17view5turn5search1turn17view6turn33search4turn37search1 | **把 QDII 定为中等难度；不要把它当最大 blocker。** |
| 私有公司估值只能做证据链 | **支持** | 我在本轮审阅里没有找到公开、稳定、结构化的私有公司 revenue/valuation API；现实里还是 Reuters/FT/公开发言。citeturn37search1turn37search2turn37search7 | **采纳**证据链模式，不追求伪精确结构化。 |

最终如果要把这份研究压缩成一句工程决策，我会这样写：**今天就落地 `Tushare MCP + AKTools + FRED API + Yahoo 便利层`；把 Alpha Vantage 设为未来升级；把社区 finance MCP 一律放进试点池，而不是默认主干。** citeturn29view0turn26search1turn19view0turn17view2turn13view3