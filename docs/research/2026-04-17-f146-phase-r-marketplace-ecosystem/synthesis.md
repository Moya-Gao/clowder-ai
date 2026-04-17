---
title: "F146 Phase R — 综合：四家 MCP 生态格式交集与统一 Adapter 可行性"
date: 2026-04-17
feature: F146
author: 布偶猫 (@opus)
sources:
  - gpt-pro-consult.md
  - gemini-deepthink-consult.md
  - docs/research/2026-03-25-openclaw-clawhub-ecosystem/ (prior art)
  - docs/research/2026-03-28-mcp-marketplace-cross-ecosystem-gpt52pro-consult.md (prior art)
---

# F146 Phase R — 综合

## 综合方法

1. 读 GPT Pro + Gemini Deep Think 两路回答
2. 对照本地 codebase 验证（Phase A 已有实现 + F129 Pack 接口）
3. 与 2026-03-28 已有咨询结论对比：确认/推翻/补充
4. 标注"直接可用 / 需验证 / 项目特殊约束"

---

## 云端报告的盲区（Codebase 验证纠偏）

**两份报告都踩了同一个坑：从外部文档推断我们的实现，没看我们的代码。**

| 云端断言 | 实际 codebase | 判定 |
|---------|-------------|------|
| "需新增 `transport_type` 区分 stdio/sse" (Gemini) | `McpTransport = 'stdio' \| 'streamableHttp' \| 'sse'` 已在 `shared/capability.ts:9` | ❌ 已有 |
| "写 API 不存在，退化为配置文件驱动" (Gemini) | `POST /api/capabilities/mcp/install` 已实现 (capability-mcp-write.ts) | ❌ 已有 |
| "缺少 URL/headers 支持" (隐含) | `url?: string`, `headers?: Record<string, string>` 已在 schema | ❌ 已有 |
| "8 个公共字段不够" (两家) | Phase A schema 已有 ~10 个字段（含 transport/url/headers/resolver） | ⚠️ 部分正确——我们比他们以为的多，但确实还缺几个 |

**铲屎官的直觉完全正确**："各个 agent 是支持的（sse/streamable HTTP），本质我们也是支持的"——代码里 `transport: 'streamableHttp'` 已经是一等公民，remote MCP 跳过 probe 直接 bind。

---

## AC 映射

| AC | 问题 | 状态 | 结论来源 |
|----|------|------|---------|
| AC-R1 | 四方 schema 对照表 | ✅ | GPT Pro 表 6.1（最全）|
| AC-R2 | 三类能力边界 | ✅ | 综合两路 + codebase |
| AC-R3 | 统一 adapter 最小字段集 | ✅ | GPT Pro 修正版 + codebase 比对 |
| AC-R4 | 先做/不做收敛结论 | ✅ | 综合 |
| AC-R5 | 外部文档 URL 验真 | ✅ | 已完成（2026-03-28，6/6 通过）|
| AC-R6 | F129 Pack 映射契约 | ✅ | GPT Pro §7 + 本地适配 |

---

## AC-R1: 四方 Schema 对照结论

**GPT Pro 的对照矩阵（表 6.1）是本轮最有价值的产出。** 三个关键反证：

1. **同名不同义**：OpenClaw `mcp` 一词两义（"把自己跑成 MCP server" vs "保存外部 MCP 定义"）
2. **同厂不统一**：Antigravity 用 `serverUrl`，Gemini CLI 用 `httpUrl`
3. **字段拓扑不同**：Codex 把 `env/env_vars/http_headers/env_http_headers` 拆四份，Claude 只有 `env/headers`

**结论**：字段级直接映射不可行。Adapter 必须按 `host_schema_family` 分模板，不能做 naive field copy。

## AC-R2: 三类能力边界

| 能力类型 | Claude | Codex | OpenClaw | Antigravity | 安装模式 |
|---------|--------|-------|----------|-------------|---------|
| **MCP Server (stdio/streamableHttp)** | ✅ CLI | ✅ CLI + JSON-RPC | ✅ CLI | ❌ 手动 config | `direct_mcp` / `manual_file` |
| **Native Plugin** | ✅ marketplace | ✅ directory | ✅ native install | ❌ 内建 | `delegated_cli` |
| **Skill/Bundle (content pack)** | 部分（prompt 层） | 部分 | ✅ registry | ❌ | `delegated_cli` / `manual_ui` |
| **Apps/Connectors/Hook** | 各家独立 | 各家独立 | 各家独立 | 各家独立 | 🚫 不统一 |

**结论**：Phase B 只做第一行（MCP Server），第二三行做 `delegated` 降级展示，第四行搁置。

## AC-R3: 统一 Adapter 字段集（对照 Phase A 已有 Schema）

### 已有字段（Phase A，无需新增）

| 字段 | 类型 | 位置 |
|------|------|------|
| `id` (artifact_id) | string | CapabilityEntry.id |
| `command` | string | mcpServer.command |
| `args` | string[] | mcpServer.args |
| `url` | string? | mcpServer.url |
| `headers` | Record? | mcpServer.headers |
| `env` | Record? | mcpServer.env |
| `transport` | 'stdio' \| 'streamableHttp' \| 'sse' | mcpServer.transport |
| `resolver` | string? | mcpServer.resolver |
| `source` | string | CapabilityEntry.source |
| `enabled` | boolean | CapabilityEntry.enabled |

### Phase B 需新增字段（两路共识 + codebase 缺口）

| 字段 | 用途 | 层级 | 优先级 |
|------|------|------|--------|
| `artifact_kind` | 区分 mcp_server / skill / plugin / bundle | L1 搜索 | P0 |
| `display_name` | 人类可读名称（搜索卡片） | L1 搜索 | P0 |
| `version_ref` | 版本锁定（防 rug pull） | L2 安装 | P0 |
| `install_scope` | user / project / workspace / admin | L2 安装 | P1 |
| `tool_policy` | enabled_tools / disabled_tools 白名单 | L2 安装 | P1 |
| `publisher_identity` | 发布者身份（超越 trust_level 的溯源） | L2 安装 | P2 |
| `binding_snapshot_hash` | 工具描述 hash（检测漂移/篡改） | L3 绑定 | P1 |
| `policy_verdict` | org/admin 策略判定结果 | L3 绑定 | P2 |
| `secret_refs` | 敏感 env 值引用（不存实际值到 git） | L3 绑定 | P1 |

**关键纠偏**：两家都说"8→11/13 字段"，但我们 Phase A 已有 10 个。实际缺口是 **9 个新字段**，按 P0→P2 分批进入。

## AC-R4: 先做/不做收敛结论

### 先做（Phase B 必须）

1. **统一搜索层**（L1）：四家 catalog 元数据聚合，返回 `artifact_kind + display_name + trust_level + source_locator`
2. **分级安装通道**（L2）：`installPlan.mode` 支持 `direct_mcp | delegated_cli | manual_file | manual_ui`
3. **接入顺序**：Claude first → OpenClaw → Codex → Antigravity(read-only)
4. **`buildInstallPreview` 增强**：红字高亮完整 command + args（防 STDIO 注入），展示 transport 类型

### 不做（明确搁置）

1. ❌ 统一 Auth 握手——鉴权生命周期异构，交给各引擎原生流处理（两路共识）
2. ❌ 统一 Apps/Connectors/Hook——Phase B 只展示不安装（GPT Pro 建议）
3. ❌ 统一运行时——"统一目录 + 分级安装通道"，不做"统一运行时幻觉"（GPT Pro 原话）
4. ❌ Antigravity 自动安装——仍在 preview，先做 read-only adapter + manual handoff
5. ❌ 跨生态 dependency resolution——Open Plugin Spec 自己也列为 future work

### 试点（需小范围验证）

1. 🧪 LangChain 路径：只统一 runtime tool consumption，不统一 install（GPT Pro 的 fallback track）
2. 🧪 Smithery/ClawHub 作为代理层：对接成熟 Metaregistry API 而非自己爬（Gemini 建议）
3. 🧪 `secret_refs` 分离：env 只存 schema `{"API_KEY": "required"}`，运行时从 .env.local 注入（Gemini 建议，需验证对 Phase A 写路径的影响）

## AC-R5: 外部文档 URL 验真

✅ 已完成（2026-03-28，6/6 通过）。GPT Pro 本轮补充验证了更多端点，均可访问。

## AC-R6: F129 Pack 映射契约

| Pack 字段 | 映射来源 | 说明 |
|-----------|---------|------|
| `kind` | `'mcp'` / `'skill'` / `'plugin'` | 来自 adapter 的 `artifact_kind` |
| `installPlan.mode` | `'direct_mcp'` \| `'delegated_cli'` \| `'manual_file'` \| `'manual_ui'` | 按生态 + 能力类型决定 |
| `installPlan.mcpEntry` | Phase A `McpInstallRequest` 格式 | 仅 `direct_mcp` 模式有值 |
| `installPlan.delegatedCommand` | 各生态原生 CLI 命令 | `delegated_cli` 模式：如 `claude mcp add ...` |
| `installPlan.manualSteps` | 人类可读步骤 | `manual_*` 模式的 handoff 说明 |
| `metadata.version_ref` | 版本锁定 | SemVer / commit hash / tag |
| `metadata.publisher_identity` | 发布者溯源 | org / repo / signer |
| `metadata.tool_snapshot_hash` | 工具描述 hash | 检测漂移用 |
| `policy.tool_policy` | 白名单/黑名单 | 来自 Codex `enabled_tools` 或平台打标 |

---

## 假设验证总评

| # | 假设 | 判定 | 理由 |
|---|------|------|------|
| 1 | 最小公共交集仅 MCP | **✅ 支持** | 两路一致 + Open Plugin Spec core 确认 |
| 2 | 分层 adapter 可行 | **✅ 支持（需修正）** | 可行但必须三层（catalog / install / binding），且 install 层按 mode 分流 |
| 3 | 程序化安装覆盖度 | **✅ 支持（修正措辞）** | Claude ✅ CLI, Codex ✅ CLI+JSON-RPC, OpenClaw ✅ CLI, Antigravity ❌ 手动 only |
| 4 | Catalog ≠ Runtime | **✅ 强烈支持** | 本轮最稳结论，两路+官方规范+Open Plugin Spec 全部确认 |
| 5 | trust_level 分级够用 | **❌ 反对** | 两路一致反对。必须加 version pin + hash + change detection + re-approval |

---

## 三方分歧分析（最有价值的信号）

| 分歧点 | GPT Pro | Gemini | 布偶猫判定 |
|--------|---------|--------|----------|
| **写路径本质** | "统一目录 + 分级安装通道" | "写 API 不存在，全是 File I/O" | **GPT Pro 更准**。我们有真实的写 API，不是纯 file patch。但 Adapter 输出确实应该是 `installPlan`，不是直接调远端 API |
| **字段扩展数量** | 8→13+（加 5 必填 + 多个可选） | 8→11（加 3 必填） | **GPT Pro 更全面**。但我们已有 10 个字段，实际缺口比两家估计的都小 |
| **secret 泄露风险** | 未重点提及 | **红旗**：env 值会直接进 git | **Gemini 看到了真问题**。Phase A 确实把 env 写进 capabilities.json（git-tracked）。需要 `secret_refs` 分离，但这是 Phase C 安全治理范畴，不阻塞 Phase B |
| **替代方案** | LangChain runtime-only adapter 作为 fallback | 对接 Smithery/ClawHub 作为代理层 | **两条都值得试点**。不互斥——一个解决搜索聚合，一个解决运行时消费 |

---

## 决策建议（回写 F146）

### Phase B Adapter 接口设计原则

1. **搜索统一，安装分流**——L1 统一返回，L2 按 `installPlan.mode` 四条通道分流
2. **三层字段递增**——L1 只需 8 个展示字段，L2 加安装字段，L3 加安全字段
3. **Auth 不碰**——遇到需动态授权的包，生成带占位符的配置，Auth 交给引擎原生流
4. **Antigravity 后置**——Phase B 先跑 Claude + OpenClaw + Codex 三家，Antigravity 做 read-only

### Phase C 安全治理必做清单（本轮调研发现）

1. `buildInstallPreview` 红字展示完整 command + args（防 STDIO 注入）
2. Version pinning + `tool_snapshot_hash`（防 rug pull）
3. `secret_refs` 分离（env 值不进 git）
4. Change detection + re-approval（工具描述变更触发重审）
5. 环境预检（Pre-flight check：目标节点是否有 node/python/uvx）

### 接入路线修正

原计划：Claude → OpenClaw → Codex → Antigravity
修正为：**Claude → Codex → OpenClaw → Antigravity(read-only)**

理由：Codex 已确认 CLI + JSON-RPC 双通道（比预期好），且字段格式与 Claude 最接近；OpenClaw 的 bundle 一词多义需要额外 adapter 逻辑。
