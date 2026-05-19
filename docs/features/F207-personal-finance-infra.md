---
feature_ids: [F207]
related_features: [F188]
topics: [finance, knowledge, infrastructure, cron, data-pipeline]
doc_kind: spec
created: 2026-05-18
---

# F207: AI Family Office — 个人投资学习基建

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P2

## Why

铲屎官从 2026-04-22 开始投资学习（FIRE / ESOP / Bogleheads 资产配置），目前已完成：
- 财务画像（85%+ 储蓄率、200 万净资产、FIRE 目标 300 万）
- 人生路线图（"任性底气"模型 — 2026-2031 华为任性工作 + 分散化）
- 学习路径设计（5 层 + Layer 0 快照）

但猫猫团队在辅助过程中暴露了一个结构性缺陷：**没有金融数据基础设施**。WebFetch 对金融网站大量 403，模型知识库过时，导致猫猫只能"用老数据坐而论道"。

铲屎官原话（2026-05-18）：
> "我们家要干的第一件事，不是这样疯狂的 webfetch，而是干我们最擅长的事情——基建！"
> "我养猫，猫变成专家！我和猫贴贴！"
> "书不是我学，是你们学。"

铲屎官的愿景不是"自己学理财"，是**养一个 AI 家族办公室**：猫猫是分析师团队，铲屎官是 CVO，看报告拍板。

## What

四层架构，每层一个 Phase：

### Phase A: 知识层 — F188 金融知识 Collection

在 F188 联邦图书馆里新增金融知识 Collection，把铲屎官学习路径里的书和框架结构化为猫猫可查询的知识库。

内容范围：
- README 里列的 5 层学习书单（《金钱心理学》《漫步华尔街》《原则》《黑天鹅》等）
- 铲屎官新增的 3 本中国实操书（《解读基金》《指数基金投资指南》《漫步华尔街》）
- 核心框架：Bogleheads 三基金、4% 法则、FIRE 测算、AUDHD 投资护栏
- 铲屎官的个人决策文档（trilemma、Layer 0 快照、任性底气模型）

交付物：F188 Library 里一个 `finance` Collection，猫猫用 `search_evidence` 可查到书里的框架和铲屎官的决策历史。

### Phase B: 数据层 — Finance Provider Stack

**Blocked by**: 三路 deep research 结果回收 + 综合（prompt 已发，2026-05-18）

基于 deep research 结果选定 provider stack，接入数据管道：
- 市场快照（指数/股价/汇率/黄金 — 日线级别）
- 公司基本面（财报/估值/同比）
- 宏观指标（利率/CPI/国债收益率）
- 基金/ETF 数据（净值/费率/持仓）
- 财经新闻索引（标题/摘要/链接，不抓全文）

形态待定（直接 MCP / CLI 包装 / Python bridge），由 deep research 结果决定。

铲屎官朋友（蛋散）的实战反馈：Agent 只做数据搬运，分析是人脑做。数据源包括天天基金 skill、腾讯自选股、东方财富、同花顺、金投网。

### Phase C: 分析层 — 定期报告 + 事件触发

猫猫用知识层 + 数据层产出结构化分析：

1. **周报**（cron，每周一早）：市场快照 + 宏观变化 + 对铲屎官配置的影响评估
2. **季度评估**（cron，每季度初）：资产配置再平衡建议 + 置信度 + 证据链
3. **事件触发**（财经新闻命中铲屎官关注的标的时）：简报 + "是否需要行动"判断

所有分析输出必须包含：
- 数据来源 + asOf 时间
- 置信度（高/中/低）
- 证据链（可追溯到数据层的具体查询）
- 明确建议（行动/观望/需要更多信息）

### Phase D: 决策层 — CVO 审批工作流

铲屎官（CVO）的操作界面：

1. 收到猫猫的分析报告（rich block / 文档）
2. 审阅：同意 / 拒绝 / 追问
3. 如果同意再平衡 → 猫猫生成具体操作清单（"买 X 基金 Y 元"）
4. 铲屎官自己执行交易（猫猫不碰交易操作）

AUDHD 护栏设计：
- 默认年度再平衡，不鼓励频繁操作
- 报告简洁，核心结论在前，详细数据在后
- 不推送"紧急"信号（避免触发焦虑/多巴胺追逐）
- 除非偏离阈值超 10%，否则季度报告建议"继续持有不动"

## Acceptance Criteria

### Phase A（知识层）
- [ ] AC-A1: F188 Library 中存在 `finance` Collection
- [ ] AC-A2: `search_evidence("bogleheads 三基金")` 能返回结构化框架内容
- [ ] AC-A3: `search_evidence("铲屎官 FIRE 决策")` 能找到 trilemma + Layer 0 文档
- [ ] AC-A4: README 中列出的所有书都有对应知识条目

### Phase B（数据层）
- [ ] AC-B1: 猫猫能查询美股/A 股/港股当日收盘价
- [ ] AC-B2: 猫猫能查询指定公司的最近一季财报
- [ ] AC-B3: 猫猫能查询当前国债收益率/CPI/基准利率
- [ ] AC-B4: 猫猫能查询指定基金的净值和费率
- [ ] AC-B5: 数据查询结果包含 source + asOf + 置信度

### Phase C（分析层）
- [ ] AC-C1: 每周一自动产出市场周报
- [ ] AC-C2: 每季度初自动产出再平衡评估
- [ ] AC-C3: 报告包含置信度 + 证据链 + 明确建议

### Phase D（决策层）
- [ ] AC-D1: 铲屎官能在 Hub 中看到分析报告并做 approve/reject
- [ ] AC-D2: approve 后生成具体操作清单
- [ ] AC-D3: AUDHD 护栏生效（年度默认频率、不推送紧急信号）

## Dependencies

- **Builds on**: F188（图书馆联邦知识系统 — 知识层载体）
- **Blocked by**: Deep research 结果（2026-05-18 已发三路，等待回收）
- **Related**: `docs/stories/investment-learning/README.md`（学习路径真相源）
- **Related**: `docs/discussions/career-planning/2026-04-22-promotion-esop-jd-trilemma.md`（ESOP 决策）

## Risk

| 风险 | 缓解 |
|------|------|
| 数据源不稳定（yfinance 非官方 API 可能 break） | Phase B 选型时要求每个域有 fallback |
| 猫猫分析质量不可靠（训练数据 ≠ 专家判断） | 所有分析标注置信度，低置信度建议铲屎官找专业人士 |
| 铲屎官可能过度依赖猫猫判断 | Phase D 的 AUDHD 护栏 + 定期提醒"猫是分析师不是基金经理" |
| 中国市场数据获取有法律灰区 | 仅个人使用 + 不公开 + deep research 标注 ToS 风险 |
| F188 知识 Collection 可能还没准备好接入 | Phase A 先确认 F188 当前状态再动手 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 数据层具体用哪些工具？ | ⏳ 等 deep research 回收 |
| OQ-2 | F188 Library 的 Collection 创建机制是否就绪？ | ⬜ 未定 |
| OQ-3 | 铲屎官朋友提到的"天天基金 skill"具体是什么？ | ⬜ 未定 |
| OQ-4 | 周报/季度报告的具体格式和发送渠道？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 架构分四层（知识/数据/分析/决策） | 铲屎官 + 三猫讨论收敛 | 2026-05-18 |
| KD-2 | 猫猫是分析师不是基金经理，交易由铲屎官自己执行 | AUDHD 护栏 + 风险控制 | 2026-05-18 |
| KD-3 | 默认年度再平衡，不做高频操作 | AUDHD 多巴胺护栏 + 铲屎官非交易员 | 2026-05-18 |
| KD-4 | 数据层工具选型由 deep research 驱动 | 我们是金融外行，Agent Team Leadership 7 步法 | 2026-05-18 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | 铲屎官开始投资学习 |
| 2026-05-18 | 识别 info-gap → 转向基建 → 三猫讨论 → deep research 发出 |
| 2026-05-18 | F207 立项 |
| TBD | Deep research 回收 → Phase B 选型 |

## Review Gate

- Phase A: 砚砚 review（知识 Collection 结构）
- Phase B: 砚砚 + 47 review（provider stack 选型）
- Phase C/D: 铲屎官 signoff（报告格式和 AUDHD 护栏）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **学习路径** | `docs/stories/investment-learning/README.md` | 书单 + 学习层级 |
| **ESOP 决策** | `docs/discussions/career-planning/2026-04-22-promotion-esop-jd-trilemma.md` | 三难决策 + 4-08 共识 |
| **Deep Research Prompt** | `docs/prompts/2026-05-18-finance-provider-stack-research-prompt.md` | 数据层选型调研 brief |
| **F188** | `docs/features/F188-library-stewardship.md` | 联邦知识系统（知识层载体） |
