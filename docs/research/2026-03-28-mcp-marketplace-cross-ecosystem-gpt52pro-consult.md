---
feature_ids: [F146]
related_features: [F041, F145]
topics: [mcp, marketplace, connector, plugin]
doc_kind: note
created: 2026-03-28
---

# 2026-03-28 MCP Marketplace 跨生态咨询（GPT-5.2 Pro，Mode B）

## Part 1: 发给云端模型的提示词

> 直接复制发送给 GPT-5.2 Pro（云端），不要删段。

我们在做一个多 Agent 协作平台（Cat Cafe），刚完成 MCP 可移植化（F145），现已立项 F146：把能力中心升级成“一键添加 MCP + 多生态 marketplace 聚合”。

请你作为架构审阅者，只做审阅与补强建议，不要假设你能访问我们的本地仓库。

### 当前已知事实

1. 我们已经有 L1 能力真相源（`capabilities.json`）+ `mcp:doctor`。
2. 目前新增 MCP 仍然偏工程向，缺少完整 UI 写路径与 marketplace 聚合。
3. 我们希望固定三层架构：
   - L1: MCP 执行层（唯一真相源）
   - L2: Skills/workflows（依赖声明层）
   - L3: Plugins/connectors/marketplace（分发层）
4. 目标生态至少三家（Codex/Claude/OpenClaw），可选第四家 Antigravity。

### 已确认外部事实（供你审阅）

- Codex 有 Plugin Directory，可在 app/CLI 浏览安装；插件可以打包 skills、apps、mcpServers。
- Codex Build Plugins 文档写了：官方公共 Plugin Directory 的自助发布能力“coming soon”。
- OpenAI API 有 MCP and Connectors（connector_id + OAuth token + require_approval）。
- Claude Code 支持自建 plugin marketplace（`marketplace.json`），可分发 plugins，并支持多种 source。
- OpenClaw 支持 ClawHub registry；也支持把 Codex/Claude/Cursor bundle 映射为本地能力（有 selective mapping）。

### 请先验真这些 URL（逐条）

1. https://developers.openai.com/codex/plugins
2. https://developers.openai.com/codex/plugins/build
3. https://developers.openai.com/api/docs/guides/tools-connectors-mcp
4. https://code.claude.com/docs/en/plugin-marketplaces
5. https://docs.openclaw.ai/plugins/bundles
6. https://docs.openclaw.ai/tools/clawhub

请你对每条给出：
- 是否可访问
- 页面核心内容是否支持我们当前结论
- 若不支持，正确替代链接是什么

### 我们希望你回答的问题

1. 这套 L1/L2/L3 架构有没有明显缺口？最危险的抽象错误是什么？
2. 对“多生态聚合”的 MVP 应该如何切 phase，才能最快落地且可回滚？
3. 四家生态（Codex/Claude/OpenClaw/Antigravity）在插件/连接器 schema 上，最小公共交集字段是什么？哪些字段必须做生态特化？
4. 哪些生态支持“程序化发布/安装 API”，哪些只能走 CLI/UI？请按可自动化等级分层（可自动安装/需人工确认/仅可发现）。
5. 四家生态的安装流程与授权机制差异有多大？是否能统一成一个 install flow（至少 UI 体验统一）？
6. 供应链安全上，除了 trustLevel（official/verified/community）外，还应该加哪 3-5 条硬门禁？
7. 给一个 6-8 周执行建议：每周目标、验收点、feature flag 切分。

### 输出要求

- 按“已确认 / 推断 / 风险假设”三段给出
- 每个建议标注优先级（P0/P1/P2）
- 必须给一个“跨生态字段对照矩阵”（表格）
- 必须给一个“不可统一项清单”（明确哪些不能强行统一）
- 用简洁可执行的方式表达，不要泛泛而谈

## Part 2: 云端模型回答（待回填）

> [待回填]

## Part 3: 本地综合结论（待撰写）

> [待撰写]

### 回填后本地综合检查清单

- [ ] 是否覆盖了 Phase R 的四个 AC（R1-R4）
- [ ] 是否明确了“先做/后做/不做”
- [ ] 是否给出安全门禁最小集合
- [ ] 是否给出可落地的周计划
