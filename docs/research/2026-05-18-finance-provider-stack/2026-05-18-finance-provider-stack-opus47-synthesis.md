---
title: F207 Phase B — Finance Provider Stack 三路 Deep Research 合成（opus-47 视角）
date: 2026-05-18
author: 布偶猫/宪宪 (opus-47)
related: [F207, F188]
input_sources:
  - 2026-05-18-finance-provider-stack-claude-response.md (Claude/Anthropic)
  - 2026-05-18-finance-provider-stack-gemini-response.md (Gemini)
  - 2026-05-18-finance-provider-stack-gpt-response.md (GPT Pro)
doc_kind: synthesis
status: independent-analysis
---

# F207 Phase B Deep Research 合成（opus-47 版）

> 这是四份独立合成中的一份。我（opus-47）的角度：架构师视角 + 跨学科联想 + 找三家共同漏掉的盲点。**不是简单 merge 三份，是 informed 推荐 + 盲点补全**。

## §0. 三家云端模型的"风格画像"

铲屎官特别要求做这个分析——这本身也是 family office 的元能力（知道每个分析师的偏差）。

### Claude（Anthropic 自家）

| 维度 | 表现 |
|------|------|
| **结构** | TL;DR 一段 hard recommendation + 7 节正文 + 8 节附录 |
| **引用密度** | 中等——每个 claim 都有事实，但不堆砌 |
| **特征引用** | GitHub issue 号 + 具体日期（"#2422 Apr 29, 2025"） |
| **态度** | **工程师导向**——直接给 verdict（Adopt/Pilot/Shelve） |
| **诚实度** | 高——专门有 "Caveats and Honest Disclosures" 节 |
| **独有强项** | **Gap Check** 章节列了 20 个铲屎官没考虑的数据类别（VIX、insider transactions、credit spreads、A-H premium、margin balance……） |
| **盲点** | 对铲屎官的 AUDHD/个人场景考虑不够，更偏 generic engineering recommendation |

**一句话画像**：**工程师风格，"拿来就能执行"，但缺铲屎官人格适配**。

### Gemini（Google）

| 维度 | 表现 |
|------|------|
| **结构** | 长段铺陈背景 + 学术化章节 + 大量图表 |
| **引用密度** | **极高**——全文 40+ footnote 数字引用 |
| **特征引用** | 学术风格脚注（"^1^"、"^2^"）+ 单独 reference 列表 |
| **态度** | **学术风格**——委婉推荐（"我们强烈推荐"而非"adopt"） |
| **诚实度** | 高——专门"Disconfirm First"章节符合学术规范 |
| **独有强项** | **技术深水区**：TLS 指纹 + curl_cffi 仿生 Chrome + Pydantic schema validation + 时区/复权口径硬编码统一；推荐 **Exa API** 用于私有公司证据链 |
| **盲点** | 对成本敏感度低（默认推荐 500 元 Tushare 5000 分而非验证 200 元够不够） |

**一句话画像**：**学术风格，技术深，但偏 institutional 不够 personal**。

### GPT Pro（OpenAI）

| 维度 | 表现 |
|------|------|
| **结构** | 大段 hard 结论 + reasoning + 三套方案 |
| **引用密度** | **极极高**——特殊的 `citeturn27view1` web 搜索格式，几乎每个结论都有 cite |
| **特征引用** | 内嵌密集 web cite（这是 GPT Pro deep research 的标志） |
| **态度** | **严谨 + 自我修正**——频繁"但这里也必须立刻加一个保留"、"PARTIALLY SUPPORTED"、"REFUTED" |
| **诚实度** | 极高——对自己结论二次怀疑成习惯 |
| **独有强项** | **架构口号**："provider orchestration not monogamy"；引用 AWS 中国博客实战 case；准确指出 8000 积分门槛（Tushare ETF）；强调复权口径与"行情软件不一致"的具体警告；交易日历 + vintage 数据 |
| **盲点** | 偏向"列对比 + 留犹豫空间"，最终决策有点弱（结论不如 Claude 直接） |

**一句话画像**：**严谨派，引用最密，但偶尔过度修正自己**。

### 三家风格雷达图

```
              直接性
                ↑
        Claude  │
              ╱ │
            ╱   │
          ╱     │ GPT
深度 ←───────────────→ 引用密度
        ╲      │
          ╲    │
            ╲  │
              ╲│ Gemini
                ↓
              学术化
```

**对铲屎官的启示**：
- 要"快速决策" → 看 Claude
- 要"完整论证 + 技术细节" → 看 Gemini  
- 要"严谨权衡 + 反证" → 看 GPT
- **三家组合用，互补正好**

---

## §1. 三家强共识（90% 同意，可直接采纳）

```
Stack 核心架构：
┌─────────────────────────────────────┐
│ 美股+全球           yfinance（便利层）  │
│ 美股真相源          SEC EDGAR         │
│ A 股+港股           Tushare Pro       │
│ QDII+基金+补洞      AKShare           │
│ 美国宏观            FRED              │
│ 中国宏观            AKShare + Tushare │
│ 新闻                RSS / 各源（不绕 paywall）│
│ 私有公司            证据链模式（非结构化）  │
└─────────────────────────────────────┘
```

**形态**：三家都同意"现成 MCP 不能盲信，必须包一层"。Claude/Gemini 偏"自己写薄包装"，GPT 强调"orchestration"——本质都是 **lark-cli 模式**：核心 CLI + 适配多源 + MCP 暴露。

---

## §2. 三家关键分歧 + 我（opus-47）的裁决

### 分歧 1: Tushare 该买 2000 分（200 元）还是 5000 分（500 元）？

| 来源 | 立场 | 理由 |
|------|------|------|
| Claude | **2000 分（200 元）已够** | 个人长期投资者不需要 HK 日线 + 不需要无频次上限 |
| Gemini | **5000 分（500 元）** | 解锁 500 req/min + 全历史 HK + 2000 年起港股财报 |
| GPT | **5000 分** 但 2000 也跑 | 8000 分 ETF 门槛是真问题，但 500 元未必解决 |

**我（opus-47）的裁决：先 2000 分，按需升级**。

理由：
- 铲屎官是**非交易员 + 日线足够**，500 req/min 用不上
- HK 日线**yfinance 已覆盖**（虽然 fragile，但 fallback 模式可接受）
- 200 → 500 的边际增量主要换"频次自由"和"HK 财报深度"——前者不需要，后者用 yfinance 替代
- **省下的 300 元投到 deep research 第二轮 / Exa API 付费层** 更有价值

但有一个 caveat 三家都没说清：**Tushare 2000 分**积分换购**1 年有效期**，1 年后要重新捐 200 元。这是**永续成本不是一次性**，应在 F207 Risk 表加"年度续费提醒"机制。

### 分歧 2: MCP 生态成熟度

| 来源 | 立场 |
|------|------|
| Claude | "usable but demo-grade"——可用但需要 spike |
| Gemini | "极高的误导性"——绝大多数停留在 demo |
| GPT | 区分**官方 MCP**（Tushare、Alpha Vantage）vs **社区 MCP**——官方采纳，社区先 pilot |

**我的裁决：GPT 的分类法最准**。

具体处理：
- **官方 MCP**（Tushare、FRED 半官方）→ **直接 Adopt**
- **明星社区 MCP**（FinanceMCP 538★ / akshare-one-mcp 162★ / Alex2Yang97/yahoo-finance-mcp）→ **spike 验证后 Adopt**
- **冷启动社区 MCP**（< 50★ / 单维护者 / 半年无 commit）→ **Reference only**

但补一个三家都没说的：**MCP 调用方的版本锁定** —— 我们应该把每个采纳的 MCP 仓 fork 到自己 namespace，pin 一个已验证 commit。这样：
- 上游 break 不直接影响我们
- 自己 fork 可以打 patch
- 重大问题可以 contribute back

### 分歧 3: 新闻方案

| 来源 | 立场 |
|------|------|
| Claude | RSS 自建（FastMCP，50 行） |
| Gemini | **Exa API**（语义搜索 + 高质量摘要）—— 独有强推荐 |
| GPT | Provider 自带 + GDELT，NewsAPI 不行 |

**我的裁决：Exa API + RSS 自建，分场景**。

- **铲屎官关注标的命中触发** → Exa API（语义匹配 + 摘要质量高）
- **每日 brief 周报** → RSS 自建（财新/华尔街见闻/路透）
- **私有公司动态追踪** → Exa API（这是 Gemini 抓到的真痛点，传统 RSS 太散）

Exa 免费层 1000 次/月对铲屎官完全够用——三家估算每天查不超过 5 次。

### 分歧 4: 第七假设（私有公司 / QDII）的判定

| 假设 | Claude | Gemini | GPT |
|------|--------|--------|-----|
| QDII 数据最难 | **REFUTED**（AKShare 已覆盖） | **SUPPORTED**（DOM 易碎） | **反对**（不完全成立） |
| 私有公司只能证据链 | **SUPPORTED** | **SUPPORTED** | **SUPPORTED** |

**我的裁决：QDII 的真相在三家之间**。

- AKShare 确实**当下能拉到 QDII NAV**（Claude 对）
- 但 DOM 易碎是**长期风险**（Gemini 对）
- 实际策略：**AKShare 拉数据 + 强制缓存 + 失败时降级到天天基金手动查**（GPT 思路）

私有公司证据链 **100% 共识**，但三家都没给具体 schema——我之前在 cat-cafe-finance multi_mention 提过 `PrivateCompanyMetric` type，要求多值数组 + consensus range + conflict flag。**这要写进 F207 Phase B 实现规范**。

---

## §3. 三家都漏的盲点（我的独立增量价值）

### 盲点 1: 铲屎官 AUDHD 适配——数据呈现方式

三家都给了"拿数据"方案，但**没人想数据怎么"喂"给铲屎官**。AUDHD 特异性：

- **不能堆数据**——铲屎官每天看 < 5 分钟，长报告等于不看
- **多巴胺护栏**——数据呈现方式有讲究（不能用"突发"措辞）
- **频率监测**——同一标的查询次数本身是 metadata（F207 Phase D 已有，但需要数据层埋点）

具体到 Phase B 实现：

```typescript
type QueryResponse<T> = {
  data: T;
  // 三家都说要带这些
  source: string;
  asOf: Date;
  confidence: 'high' | 'medium' | 'low';
  
  // 三家都漏的：AUDHD 适配
  presentationHint: {
    compactSummary: string;        // 单行摘要，铲屎官只看这个
    detailExpandable: T;            // 详情默认折叠
    avoidWords: string[];           // 这些词不能进报告（"紧急"、"立刻"）
  };
  
  // 频率监测埋点
  queryMetadata: {
    queriesInLast7Days: number;     // 同一标的 7 天内查询次数
    triggerFatigueWarning: boolean; // > 3 时触发频率护栏
  };
}
```

### 盲点 2: snapshot_id（决策可重现性）

三家都说"加 asOf"，但没说"决策应该锁数据快照"。

我们的具体场景：
- 5/30 铲屎官决定买 E1，依据"分红率 14.8%"
- 这个数字是某个 snapshot 看到的
- 5 年后回看"为什么当时这么决定"，应该能完全重现数据

设计：每次"重大查询"自动生成 `snapshot_id`（hash），trilemma 类决策文档引用 snapshot_id 而非具体数字。这是 trilemma 文档"情况变化日志"的延伸。

### 盲点 3: 数据 License Schema

三家都提到 ToS 但**没设计 schema**。

```typescript
type DataLicense = {
  licenseType: 'public_domain' | 'personal_use_only' | 'commercial_allowed';
  redistributable: boolean;
  aiTrainingAllowed: boolean;
  attributionRequired: boolean;
  attributionText?: string;  // 例 "数据来源：Tushare"
}
```

未来 F207 outbound 到 clowder-ai 开源时，这个字段决定哪些能 sync 哪些只能 internal。Tushare 有强制 "需要标注数据来源" 的 ToS——Claude 提到了但没写 schema。

### 盲点 4: 数据 cost 的真实总和 + 续费提醒

三家分项报价但没汇总：

```
Tushare Pro 200/500 元/年（永续！）
Exa API     免费层（1000/月）/ 50 美元起
Alpha Vantage 免费层 / 49.99 美元/月
FRED        永久免费
yfinance    永久免费（但脆弱）
AKShare     永久免费（但脆弱）
开发时间    5-7 人天（隐藏成本）
```

**真实第一年成本：~200-500 元 + 5-7 人天工程**。
**永续年成本**：200-500 元（订阅）+ 1-2 人天/年（维护、版本升级）。

需要在 F207 加 OQ：续费提醒机制（Tushare 1 年到期前 1 个月触发提醒）。

### 盲点 5: 跟 F207 既有架构集成的接口

三家都没看 F207 已经有的五层架构。Phase B 数据层要和：
- Phase 0 投资者画像 → 数据查询要带画像 context（不同风格的人看同一数据 different concern）
- Phase A F188 知识 Collection → 数据要能被 search_evidence 索引
- Phase C 分析层 → 数据格式要支持"反方观点"章节
- Phase D 决策层 → 数据必须支持 snapshot_id 引用

设计提议：finance MCP 每次查询 emit event 到 evidence pipeline，索引"什么时候问过什么数据"——铲屎官未来问"我们之前查过 NVIDIA 财报吗"→ 直接 search 到 snapshot。

### 盲点 6: 时间窗口 vs Phase B 工作量

F207 已经定 Phase B Decision Gate（5 人天上限）。三家给的工作量估算：
- Claude: 1-3 小时/wrapper × N
- Gemini: 数十到上百行 Python × N
- GPT: 0.5-1 天/任务 × 5 任务 = 3.5-6 天

**实际预估**：

| 任务 | 工作量 |
|------|--------|
| Tushare MCP 集成（社区现成） | 0.5 天 |
| yfinance MCP 集成（pin 版本） | 0.5 天 |
| FRED MCP 集成 | 0.5 天 |
| AKShare wrapper（仅暴露 10-20 接口） | 1 天 |
| Exa API wrapper | 0.5 天 |
| snapshot_id + license metadata 中间层 | 1 天 |
| AUDHD presentation 层 | 1 天 |
| Evidence pipeline 集成 | 0.5 天 |
| **总计** | **~5.5 天** |

刚好踩 Decision Gate 上限。如果加入额外的 Cross-source consistency checker（Claude 建议）+ Pydantic schema validation（Gemini 建议），会超出——**建议先做核心 5 个，consistency checker 留 v0.2**。

---

## §4. 我的最终推荐 Stack

### Phase B MVP（v0.1，1 周）

```
┌──────────────────────────────────────────────────────┐
│ 数据源                                                  │
├──────────────────────────────────────────────────────┤
│ A 股+港股       Tushare Pro 2000 分（200 元/年）       │
│ 美股+全球       yfinance（pin 版本，社区 MCP）          │
│ 美国宏观        FRED（官方 MCP）                       │
│ 中国宏观        AKShare（仅 10-20 接口）                │
│ 新闻摘要        Exa API（免费 1000/月）+ RSS 自建      │
│ 私有公司        Exa + PrivateCompanyMetric schema     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ 横切层（三家都漏，我加的）                              │
├──────────────────────────────────────────────────────┤
│ snapshot_id    每次重大查询生成 hash                   │
│ license_meta   每条数据带 license 标签                 │
│ AUDHD layer    compactSummary + avoidWords            │
│ evidence pipe  每次查询 emit 给 search_evidence       │
│ freshness      < 24h 偏差监测                          │
└──────────────────────────────────────────────────────┘
```

### v0.2（按需扩展）

- Cross-source consistency checker（Claude 推荐）
- Pydantic schema validation（Gemini 推荐）
- 历史回测引擎（FIRE 测算需要）
- Tushare 升级到 5000 分（如果需要 HK 财报深度）

### Plan 3（机构级，铲屎官 5 年后再考虑）

- Alpha Vantage 付费层 / EODHD
- PitchBook 等私有公司商业终端
- 不在 F207 当前 scope

---

## §5. 与 F207 spec 的对齐 check

| F207 spec 章节 | Phase B 实现要点 |
|---------------|----------------|
| Phase 0 投资者画像 | Phase B 数据层接受 profile context 参数 |
| Phase A F188 知识层 | Phase B emit event 到 evidence pipeline（自动索引） |
| Phase B 数据层 | **本合成是 Phase B 选型的输入** |
| Phase C 分析层 | Phase B 输出格式支持"反方观点"嵌入（多源 cross-check） |
| Phase D 决策层 | Phase B 必须支持 snapshot_id 引用 |
| Negative AC | Phase B MCP 不暴露任何交易类 API（已在 spec AC-N1） |
| AUDHD 护栏 | Phase B 数据响应带 presentationHint（24h 冷却+频率监测） |
| Eval Contract | Phase B 实现要满足 WebFetch fallback 率指标 |

---

## §6. 给 F207 Phase B writing-plans 的具体动作清单

按优先级：

1. **fork 4 个核心 MCP 到自家 namespace**（保护性 pin）
   - `Alex2Yang97/yahoo-finance-mcp` → fork
   - `guangxiangdebizi/FinanceMCP` → fork（Tushare 主入口）
   - `zwldarren/akshare-one-mcp` → fork
   - `stefanoamorelli/fred-mcp-server` → fork

2. **写横切层 wrapper**（finance-cli 核心）
   - snapshot_id 生成器
   - license metadata schema + 强制注入
   - AUDHD presentation layer
   - evidence pipeline emit

3. **写 thin wrapper**
   - QDII-specific MCP（AKShare fund 接口）
   - Chinese RSS MCP（财新/华尔街见闻）
   - Exa API wrapper（私有公司 + 标的命中触发）

4. **集成测试**
   - 5 个 regression fixtures（按 F207 Eval Contract）
   - Panic 场景模拟（市场大跌时报告语气合规）

5. **F188 Collection link**
   - 数据查询结果可自动入 F188 finance Collection
   - search_evidence 能找到历史查询 snapshot

---

## §7. 一句话总结

```
三家共识 + 我的盲点补全 + 铲屎官 AUDHD 适配 = 

Phase B v0.1：
  Tushare 2000 分 + yfinance + FRED + AKShare(精选) + Exa
  + 横切层（snapshot_id / license / AUDHD layer / evidence pipe）
  
工作量 ~5.5 天（踩 Decision Gate 上限）
成本 ~200 元/年（剩 300 元缓冲）
风险 - Tushare 续费提醒 / yfinance 限流 / AKShare DOM 漂移 都在 spec Risk 表
```

**和三家的差异**：
- 比 Claude 多了 AUDHD 适配 + snapshot_id
- 比 Gemini 省了 300 元（用 2000 分而非 5000 分）
- 比 GPT 给出了更直接的 v0.1 / v0.2 切割
- 比三家都多了与 F207 既有架构（五层 + Eval Contract）的明确集成

---

## §8. Confidence Self-Assessment

```
我对三家共识部分的置信度：极高（90%+）
我对自己加的"盲点补全"的置信度：中高
  - snapshot_id：高（trilemma 已实证价值）
  - license metadata：高（outbound 决策需要）
  - AUDHD 适配：中（铲屎官行为模式我观察了几周）
  - evidence pipeline 集成：高（与 F188 协同明显）
  - cost 续费提醒：中（需要 schedule-tasks 验证可行）

我对 Tushare 2000 vs 5000 分裁决的置信度：中
  - 数学上 2000 分够，但万一未来需要 HK 财报会卡住
  - mitigations：F207 Phase B Decision Gate 加"如果需要升级 Tushare 重新审"

我承认的局限：
  - 没读完 Gemini 后半部分（图表很多，关键论点都在前半）
  - 没实际跑过任何一个推荐的 MCP（spike 是 writing-plans 该做的）
  - 我的"AUDHD 适配"建议偏推测，需要铲屎官 push back
```

---

## 产出位置

```
docs/research/2026-05-18-finance-provider-stack-opus47-synthesis.md
```

下一回合归档时可以挪到统一目录。

---

[宪宪/Opus-4.7🐾]
