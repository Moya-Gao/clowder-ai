---
title: 金融数据 Provider Stack 选型 — 布偶猫综合分析
author: 布偶猫/Opus-46
date: 2026-05-19
sources:
  - 2026-05-18-finance-provider-stack-claude-response.md (39K, Claude deep research)
  - 2026-05-18-finance-provider-stack-gemini-response.md (305K, Gemini deep research)
  - 2026-05-18-finance-provider-stack-gpt-response.md (27K, GPT Pro deep research)
feature: F207
phase: B
---

# 金融数据 Provider Stack 选型 — 布偶猫综合分析

> 布偶猫独立阅读三份云端 deep research 报告后的交叉分析。
> 本文不是摘要——是对三份报告的收敛/分歧/盲区的审视，加上我自己的判断。

---

## 一、三位研究员的风格画像

在对比内容之前，先看方法论——三份报告的写法差异本身就是选择 deep research provider 的重要信号。

### Claude Deep Research — 证据加权工程备忘录

**写法**：每个判断紧贴具体证据（GitHub issue 编号、star 数、fork 数、版本号、安装命令）。整体结构是 Key Findings → Provider Stack 推荐表 → Tool 评估表 → 三套方案。行文节制，不做大段理论铺垫。

**典型句式**：直接给出 issue 编号和引述原文片段，然后接一句 verdict。

**强项**：
- MCP 生态扫描最细：逐个项目评 star/fork/最后 release，给出 install 命令
- 数据点密度最高：Tushare 积分细节、yfinance 版本变更（v0.2.28+ auto_adjust 行为变化）、FRED 具体 series URL
- 对 FinanceMCP 的 bug 修复历史做了追踪（moneyflow_dc 频次限制、字段命名 bug）

**弱项**：
- 过于平铺——所有工具都给了详细参数，但"所以呢"的判断力度不够
- yfinance 给了 "Adopt" 标签但同时列了一堆风险，读者需要自己判断真实态度

**风格标签**：`工程师的 due diligence checklist`

### GPT Pro Deep Research — 反证驱动的决策备忘录

**写法**：开篇就是"反证优先"——先逐条攻击 7 个常见假设，每条给结论（支持/反对/保留），然后才建 Provider Stack。末尾有自评置信度和 Gap Check 表。

**典型句式**：先说"这个假设不成立"，给证据，再说"但在这个边界内可以用"。

**强项**：
- 方法论最诚实：自我评估置信度（"中高"），标注"我最有把握的部分"和"保留的部分"
- Gap Check 表是三份报告中最有实战价值的独创内容——6 个长期投资者会忽略的数据类别（交易日历、复权因子、ETF 持仓费率、指数估值口径、宏观修订值、汇率税负）
- "Provider orchestration, not provider monogamy" 这个框架精准命名了三份报告共同收敛的结论
- QDII 难度重新定位：不是"最难"，而是"中等难度"——比私有公司估值和统一口径指数估值更容易

**弱项**：
- 引用格式噪声大（`citeturn27view1turn29view0...`），降低可读性
- 篇幅最短（27K），部分领域覆盖不如另外两份深

**风格标签**：`审计师的反证报告 + 工程师的部署指南`

### Gemini Deep Research — 学术深度研究论文

**写法**：正式学术论文风格。开篇是完整的问题定义和研究边界，然后用"证伪"框架逐一分析假设。305K 是三份中最长的（约 8 倍于 GPT）。

**典型句式**：先铺 2-3 段理论背景，再给技术细节，最后做判断。判断措辞更强烈。

**强项**：
- 技术深度最强：对 yfinance 反爬机制的分析到了 TLS 指纹伪装（curl_cffi）层面，其他两份没有到这个粒度
- 观点最鲜明：yfinance 只给"有条件试点"（不是 Adopt）；AKShare 给"谨慎试点"；Tushare 推荐 5000 积分而不是 2000
- 独家推荐 Exa API 做私有公司语义搜索（其他两份没提）
- 独家推荐 ChinaData.live 做中国宏观交叉验证
- 盲区扫描增加了 EPU（经济政策不确定性指数）和内部人士交易数据

**弱项**：
- 篇幅过长，信噪比低——大量学术化铺垫稀释了 actionable 内容
- 部分判断与自身推荐矛盾（推荐 ChinaData.live 但随后"暂时搁置"）
- 对工程落地的具体指导不如 Claude 和 GPT 直接

**风格标签**：`学术期刊的综述论文`

### 风格对比矩阵

| 维度 | Claude | GPT Pro | Gemini |
|------|--------|---------|--------|
| 篇幅 | 39K（中） | 27K（短） | 305K（极长） |
| 方法论 | 逐工具 due diligence | 反证驱动 + 置信度自评 | 学术证伪 + 深度论证 |
| 判断力度 | 温和（多数 Adopt） | 中等（区分支持/保留） | 强烈（有条件试点/谨慎试点） |
| MCP 生态覆盖 | 最详细 | 够用 | 中等 |
| 独创贡献 | 工具级细节 | Gap Check + orchestration 框架 | TLS 分析 + Exa API + EPU |
| 可操作性 | 高（直接 install） | 最高（直接 copy-paste） | 中（需要自己提炼） |
| 适合场景 | 要选具体工具时参考 | 要做架构决策时参考 | 要深入理解某技术时参考 |

---

## 二、三方收敛分析

### 强共识（三份报告完全一致）

1. **Tushare Pro 是中国证券付费主干** — 三份都给了最高推荐（Claude: truth source, GPT: 中国证券主干, Gemini: 核心采纳）
2. **FRED 是美国宏观唯一标准** — 零分歧
3. **yfinance 有用但脆弱** — 非官方、rate-limited、Yahoo 随时变更。三份都认为只能当便利层不能当真相源
4. **AKShare 是免费补洞层** — 覆盖广但稳定性差（Eastmoney 反爬、接口漂移），不能当真相源
5. **中国宏观没有 FRED 等价物** — PMI/LPR/MLF/TSF 只能从 Tushare/AKShare/直连官方获取
6. **MCP 生态可用但不成熟** — 社区项目需要 spike 验证；官方 MCP（Tushare、Alpha Vantage）更可靠
7. **私有公司数据只能做证据链** — 没有结构化公开 API，Reuters/FT/公开发言是唯一路径
8. **正确策略是 provider orchestration** — 分层、分市场、分可信度，不追求单一万能源

### 关键分歧

| 分歧点 | Claude | GPT Pro | Gemini | 布偶猫判断 |
|--------|--------|---------|--------|-----------|
| **Tushare 积分档位** | 2000 分（~200 RMB） | 2000 分（~200 RMB） | 5000 分（~500 RMB） | **2000 分起步**。铲屎官是非交易型长期投资者，2000 分 200req/min 够用；500 元预算全砸 Tushare 不留余量不明智。3 个月后评估是否升级 |
| **yfinance 定位** | Adopt（有条件） | Adopt（便利层） | 有条件试点 | **Adopt 但标注风险**。Gemini 过于保守——日频长期投资者不会触发高频限流；但确实不能当真相源 |
| **AKShare 定位** | fallback 层 | 补洞层 | 谨慎试点 | **补洞层 + QDII 主力**。AKShare 在基金/QDII/中国宏观这三个 Tushare 低积分覆盖不到的领域是唯一免费选项 |
| **新闻索引方案** | RSS-based MCP | GDELT + provider company-news | Exa API（语义搜索） | **Phase B 不做新闻**。新闻是 Phase C 分析层的输入，当前只需确认技术可行性，不需要落地 |
| **Exa API** | 未提及 | 未提及 | 核心采纳 | **记录但不采纳**。有趣但不在当前 scope——F207 Phase B 是数据基建，不是情报网络 |

### 独特贡献（只有一份报告提到）

| 贡献 | 来源 | 价值评估 |
|------|------|---------|
| Gap Check 6 类遗漏数据 | GPT Pro | **高价值**。交易日历、复权因子、ETF 持仓费率、指数估值口径、宏观修订值（ALFRED）、汇率税负——这些是铲屎官做实际分析时会踩的坑 |
| yfinance TLS 指纹伪装分析 | Gemini | **中价值**。技术有趣但 curl_cffi 是 workaround，不改变"yfinance 不可靠"的结论 |
| FinanceMCP bug 修复追踪 | Claude | **中价值**。选 MCP 时有用，但项目在快速迭代，bug 清单会过时 |
| EPU（经济政策不确定性指数） | Gemini | **中价值**。宏观分析有用，但不在 Phase B 数据基建 scope |
| 内部人士交易数据 | Gemini | **低价值当前**。铲屎官不做个股选择，ESOP 单一持仓不需要 insider trading 信号 |
| QDII 难度重定位 | GPT Pro | **高价值**。纠正了"QDII 最难"的假设——AKShare + 天天基金 + 集思录已有覆盖，真正难的是统一口径指数估值 |
| ChinaData.live | Gemini | **低价值**。Gemini 自己也说"暂时搁置"，AKShare 宏观模块已覆盖 |
| provider orchestration 命名 | GPT Pro | **高价值**。精准命名了三份报告的核心共识，应写入 F207 设计文档 |

---

## 三、布偶猫的 Provider Stack 推荐

基于三份报告的交叉分析，我的推荐如下。与三份报告的区别：我按 F207 Phase 优先级排序，而不是按数据域排序。

### Phase B 核心落地（现在就做）

| 优先级 | 数据域 | 推荐方案 | 预算 | 理由 |
|--------|--------|---------|------|------|
| P0 | A 股 + 中国证券 | Tushare Pro 2000 分 + FinanceMCP | ~200 RMB/年 | 三方强共识。铲屎官 57% 净资产是华为 ESOP，中国资产是硬需求 |
| P0 | 美国宏观 | FRED API + fred-mcp-server | 免费 | 三方零分歧。FIRE 计算依赖利率/通胀数据 |
| P1 | 美股 + 全球 ETF | yfinance（通过 MCP wrapper） | 免费 | 三方共识可用但脆弱。铲屎官 Bogleheads 三基金需要 VTI/VXUS/BND 数据 |
| P1 | 中国宏观 | AKShare macro_china_* 系列 | 免费 | FRED 不覆盖 PMI/LPR/MLF/TSF。估值定投策略需要 |
| P2 | 基金 + QDII | AKShare 基金接口 + Tushare fund_basic | 免费/已含 | QDII 是国际配置渠道，Tushare 低积分基金接口有限 |
| P2 | 汇率 | yfinance CNY=X + FRED DEXCHUS | 免费 | 跨市场配置需要，两个免费源互为 fallback |

### Phase B Spike（验证可行性但不落地）

| 数据域 | Spike 目标 | 工具 |
|--------|-----------|------|
| MCP 集成 | 验证 FinanceMCP + akshare-one-mcp 实际可用性 | 本地 spike 脚本 |
| 交易日历 | 验证 Tushare trade_cal 覆盖度 | 直接 API 调用 |
| 复权因子 | 验证 Tushare vs yfinance 复权口径差异 | 对比测试 |

### Phase C+ 延后项（记录但不现在做）

| 数据域 | 延后理由 | 备注 |
|--------|---------|------|
| 新闻索引 | 属于分析层输入，不是数据基建 | 三份报告各推不同方案，无共识 |
| 私有公司估值 | 证据链模式，不需要 API 基建 | 铲屎官当前能力圈外（穷查理宝典·能力圈） |
| Exa API | Gemini 独家推荐，其他两份未提 | 有趣但不在 scope |
| EPU 指数 | 宏观分析层，不是数据基建 | 可从 FRED 衍生序列获取 |
| Alpha Vantage 升级 | 当前 500 元预算不支持 $49.99/月 | 未来升级路径已明确 |

### 预算分配

| 项目 | 费用 | 占比 |
|------|------|------|
| Tushare Pro 2000 分 | ~200 RMB | 40% |
| FRED API key | 免费 | — |
| yfinance | 免费 | — |
| AKShare | 免费 | — |
| **预留升级余量** | **~300 RMB** | **60%** |
| **总计** | **≤500 RMB/年** | 100% |

留 60% 余量的理由：3 个月后如果 2000 分不够用，可以无缝升级到 5000 分（Gemini 的推荐）。不一次性 all-in 是因为铲屎官还没开始实际使用数据层，需求可能变化。

---

## 四、对铲屎官的建议

1. **三份报告可以互补使用**：选工具看 Claude 的，做架构决策看 GPT Pro 的，深入技术细节看 Gemini 的
2. **GPT Pro 的 Gap Check 表值得单独存档** — 那 6 个遗漏类别是真实的实操盲区
3. **不要被 305K 的 Gemini 报告吓到** — 核心判断集中在"置信度总评"一节，其他是支撑论证
4. **"Provider orchestration, not provider monogamy"** 应该写入 F207 设计原则

---

## 五、下一步

本文档是布偶猫的独立分析产出。砚砚也已完成综合文档（`2026-05-18-finance-provider-stack-codex-synthesis.md`，268 行）。铲屎官下一步选一只猫猫做归档整合。

**产出位置**：`docs/research/2026-05-19-finance-provider-stack-opus-synthesis.md`

[布偶猫/Opus-46🐾]
