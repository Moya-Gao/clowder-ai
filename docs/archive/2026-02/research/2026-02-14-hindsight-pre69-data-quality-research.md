# 2026-02-14 Hindsight Pre-#69 Data Quality Research

> 作者：缅因猫（Codex）  
> 日期：2026-02-14  
> 目标：回答“是否应整篇喂入、如何提升语料质量、#69 前怎么收口”

---

## 1. 研究问题

1. `short < 40` 是否是当前语料质量主问题？
2. 我们应走“整篇 Markdown retain”还是“按段/条目 retain”？
3. 官方 Hindsight 对提取质量控制的推荐是什么？
4. #69（评测）前最小可行收口顺序是什么？

---

## 2. 本地现状快照（cat-cafe-shared）

采样时间：2026-02-14（本机 `http://localhost:18888`）

- `total_documents = 11`
- `total_nodes = 491`
- `nodes_by_fact_type = { world: 286, experience: 15, observation: 190 }`
- `<40 字符`：29 条
- 含 `" | When:"` 尾巴：48 条
- `observation 且 chunk_id = null`：190 条

核心发现：

1. `<40` 不是主污染源（仅 29 条，且大多是有锚点的 world 原子事实）。
2. 主污染源是 observation 聚合体（190 条且无 chunk/document 归属），会影响 evidence 检索稳定性。
3. 有少量旧 commit tag 计数残留（`sourceCommit:0cf...`），但文档级主数据已在 `f350e1b`。

---

## 3. 对照研究：pangu-doer-router

对照路径：

- `/Users/lysander/projects/relay-station/pangu-doer-router/scripts/seed_data_async.py`
- `/Users/lysander/projects/relay-station/pangu-doer-router/shared/routing_rules_v2.py`
- `/Users/lysander/projects/relay-station/pangu-doer-router/shared/pain_points.py`

结论：

1. pangu 不是“整篇 md 直接喂”，而是“结构化原子条目批量 retain（async=true）”。
2. 每条内容短且模板化（规则/案例/badcase），可控性高，语义边界清晰。
3. 对我们可借鉴点：治理语料优先“可控抽取单元”，而不是盲目追求整篇输入。

---

## 4. 官方资料结论（Hindsight / Cookbook）

### 4.1 官方并不要求“必须整篇喂”

官方 API 支持：

- 单条 retain
- batch retain（推荐）
- document_id upsert（幂等更新）

Cookbook（Sanity blog）示例是“每篇文章作为一个 document_id + rich content block”，这是针对博客场景，不是唯一模式。

### 4.2 质量控制关键旋钮

官方配置文档给出 retain/observation 的关键参数：

- `HINDSIGHT_API_RETAIN_EXTRACTION_MODE`: `concise | verbose | custom`
- `HINDSIGHT_API_RETAIN_CUSTOM_INSTRUCTIONS`
- `HINDSIGHT_API_RETAIN_CHUNK_SIZE`
- `HINDSIGHT_API_ENABLE_OBSERVATIONS`

默认是 `concise + observations=true`。在我们这种治理语料场景，若 observation 噪声大，应通过：

1. recall 侧 type 过滤（world/experience 优先）
2. retain 侧 custom instructions 收紧抽取

### 4.3 我们当前实例限制

`GET /version` 显示：

- `api_version: 0.4.11`
- `bank_config_api: false`

这意味着当前不能依赖 bank-config API 做在线精细调参，优先走环境变量 + 服务重启策略。

---

## 5. 结论

1. “整篇喂”不是银弹，也不是官方唯一推荐。
2. 对我们最优是“文档分段治理导入 + 强标签 + 提取约束”，而不是回到无控制整篇流。
3. #69 前必须先控噪：
   - 搜索默认只看 `world + experience`
   - retain 改 custom extraction，禁止低价值句式提取

---

## 6. 推荐执行顺序（#69 前）

1. **检索口收敛（立即）**  
   `search-evidence` 默认只查 `types=["world","experience"]`，先排除 observation 噪声。

2. **导入口优化（随后）**  
   配置 retain 为 `custom extraction`，明确禁止“标题式总结/状态口号/无证据短句”。

3. **再跑 #69（最后）**  
   在降噪后评测，避免用脏基线得出误导性结论。

---

## 7. 风险与权衡

- 风险：先过滤 observation 可能短期损失“总结性答案”命中。
- 缓解：先保 correctness（可追溯 world/experience），后续在 #71-full 里再做 observation 质量门禁与白名单回放。

---

## 8. 参考

- Hindsight retain API: https://raw.githubusercontent.com/vectorize-io/hindsight/main/hindsight-docs/docs/developer/api/retain.mdx
- Hindsight retain 架构: https://raw.githubusercontent.com/vectorize-io/hindsight/main/hindsight-docs/docs/developer/retain.md
- Hindsight 配置文档: https://raw.githubusercontent.com/vectorize-io/hindsight/main/hindsight-docs/docs/developer/configuration.md
- Hindsight recall API: https://raw.githubusercontent.com/vectorize-io/hindsight/main/hindsight-docs/docs/developer/api/recall.mdx
- Hindsight cookbook / sanity-blog-memory: https://raw.githubusercontent.com/vectorize-io/hindsight-cookbook/main/applications/sanity-blog-memory/README.md
- pangu 对照实现：
  - `/Users/lysander/projects/relay-station/pangu-doer-router/scripts/seed_data_async.py`
  - `/Users/lysander/projects/relay-station/pangu-doer-router/shared/routing_rules_v2.py`
  - `/Users/lysander/projects/relay-station/pangu-doer-router/shared/pain_points.py`

---

## 9. 经验教训（供后续沿用）

1. 评测前必须先做数据收口；脏基线跑 #69 只会把噪声指标合法化。
2. 先做检索口约束（types/filter）再做导入口调优，见效最快且可回滚。
3. 观测类 memory 噪声不可直接删结论，应先“隔离可见性”再做来源追踪。
4. 文档治理优先稳态规则（tags/types/anchor），再谈召回“看起来更聪明”。
5. 所有调优动作都要保留可审计证据：stats、samples、commit、health-check 结果。
