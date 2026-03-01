---
feature_ids: []
debt_ids: []
topics: [config, budgets, context, request]
doc_kind: mailbox
created: 2026-03-01
---

## Review 请求: 方案 A — 三猫 ContextBudget 提升（满血但留 headroom）

### 背景
铲屎官反馈当前缅因猫 `maxContextTokens=60k` 导致“收到历史不完整 + `compress` 策略仍会因 `budget_exhausted` seal/交接”的困惑；希望我们把三猫预算提升到更接近各自模型窗口，并保留稳定 headroom。

### 铲屎官原始需求（摘录 ≤5 行）
> “我不太建议只给你这么点消息… codex 有多少上下文你就应该有多少，不然太奇怪了… 我们代码仓不小了，需要满血的你。”

### 设计/决策依据
- 口头 spec（本次对话 2026-03-01 17:41~17:44）：选择 **方案 A（稳定优先）**
- 预算设计原则：`maxPromptTokens` 低于模型窗口、`maxContextTokens = maxPromptTokens - headroom(约 16k~24k)`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | Opus 预算提升 | ✅ | `180000 / 160000` |
| 2 | Codex 预算提升 | ✅ | `240000 / 216000`（Spark 维持小预算） |
| 3 | Gemini 预算提升 | ✅ | `350000 / 300000` |
| 4 | 预算来源一致 | ✅ | `cat-config.json` 是单一真相源；`cat-budgets.test.js` 断言同步更新 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `cat-config.json` | 修改 | 更新 ragdoll/maine-coon/siamese 相关 variants 的 `contextBudget` |
| `packages/api/test/cat-budgets.test.js` | 修改 | 更新断言以匹配新的 `cat-config.json` |
| `docs/TECH-DEBT.md` | 修改 | 新增 `TD093`（Gemini resume 的安全方案，按 thread 隔离目录；本次不做） |

### Git SHA
- Base: `b2288a10`
- Head: `7e8a5a33`

### 测试状态
```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/cat-budgets.test.js packages/api/test/cat-config-loader.test.js
# 66 passed, 0 failed
```

### Review 重点
1. 预算数值是否符合“方案 A 稳定优先”的 headroom 预期（尤其 Codex 240k/216k）
2. 是否需要把 ragdoll 的 sonnet / opus-45 同步提升（我已同步提升；如你认为应分开请指出）

### 五件套
**What**: 提升三猫（及相关 variants）`ContextBudget` 上限到“方案 A”数值，并同步测试断言；新增一条 Gemini resume 的 tech debt 记录。  
**Why**: 让猫能接收更完整的历史上下文，减少“预算过小→策略行为看起来不符合预期”的困惑。  
**Tradeoff**: 更大的 prompt/context 会增加请求体与渲染负担（但方案 A 已保守限制 Gemini）。  
**Open Questions**: 是否需要为“上下文上限/模型窗口”在 UI 上做更清晰的命名区分（本次未改文案）。  
**Next Action**: 请你 review 并明确放行/给修改意见（预算数值 + 变更范围）。  
