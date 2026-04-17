---
title: "F146 Phase R — Gemini Deep Think 咨询：四家 MCP 生态格式交集"
date: 2026-04-17
feature: F146
model: Gemini Deep Think
mode: Mode B (云端模型咨询)
---

# F146 Phase R — Gemini Deep Think 咨询

## Part 1: 发给云端模型的提示词

> 已发送。Prompt 见 `docs/prompts/2026-04-17-f146-phase-r-marketplace-ecosystem-research-prompt.md`

## Part 2: Gemini Deep Think 回答（待回填）

这是一份基于 2026 年最新各大生态演进现状、MCP（Model Context Protocol）开源社区实践以及近期供应链安全披露的研究简报。

本研究严格遵循 F146 Phase A 的写路径兼容性要求及 F129 Pack 系统的约束，在“多引擎协作”和“人在环路（CVO）”的前提下进行了深度交叉验证。

---

## 3. Disconfirm First（先找反例）

在展开矩阵与论证前，我们通过寻找反例对当前的假设进行了压力测试：

1. **“统一 adapter 失败”案例**：开源社区曾尝试构建统一的跨生态包管理器（如已被归档的早期 `mcp-get`），最终发现试图在 Adapter 层**抹平鉴权（Auth Layer）和环境依赖（Runtime Dependencies）**是不可行的。如今存活的聚合器（如 `Smithery`）全部退化为纯粹的 **Metaregistry（元数据注册表）**，只分发配置，不处理运行时的握手。
2. **Schema 差异比预期更大的陷阱**：我们假设的“8个公共字段”**严重不足**。
   - **传输陷阱**：MCP 支持本地进程 `stdio` 和远程调用 `sse` (Server-Sent Events) / HTTP。Claude 偏向 `stdio`，而大量企业级应用和 Antigravity 偏向 `sse`（需要 `serverUrl`）。不区分协议会导致通信彻底断裂。
   - **Auth 陷阱**：以为靠 `env` 传 Token 就能统一，但 Codex 在 Schema 中专设了 OAuth `callback_port`；Antigravity 甚至依赖宿主机隐式的 Google ADC（Application Default Credentials）。强行统一会破坏原生的 Auth 流。
3. **程序化安装带来的安全事故**：根据近期社区对 MCP 供应链的安全审查，由于 `stdio` 协议的机制，底层隐式拉起 `npx` 或 `uvx`。若自动化安装仿冒包（Typosquatting），即使有 CVO 点击同意，恶意包也能在后台实现 **Zero-Click RCE（零点击远程代码执行）**。人类根本无法肉眼排查混淆过的依赖树。
4. **遗漏的关键字段**：**`enabled_tools`（细粒度工具白名单）**。像 GitHub 或 Zapier 的 MCP Server 动辄包含几十个子能力，全量暴露不仅撑爆 Token 上下文导致幻觉，更面临严重的越权风险。Codex 的原生 Schema 已支持这一黑白名单机制。
5. **不需要全量自写爬虫**：与其试图去解析四家生态底层杂乱的爬虫页面，不如部分对接成熟的 Metaregistry 开放 API（如 Smithery 官方接口、ClawHub API），作为统一检索的代理层。

---

## 6. Output Schema（输出格式）

### 6.1 四家 Schema 对照矩阵

| 字段 | Claude MCP | Codex MCP | OpenClaw Skill/Bundle | Antigravity MCP | 统一可行性 |
|------|-----------|-----------|----------------------|-----------------|-----------|
| **Server ID/名称** | `[mcpServers.<name>]` | `[mcp_servers.<name>]` | Registry Slug / URN | `mcp_config` ID | 🟢 **高** (映射为 F129 Pack `artifact_id`) |
| **命令/入口** | `command` / `url` | `command` / `url` | `entrypoint` | `command` / `serverUrl` | 🟡 **中** (需新增 `transport_type` 区分 stdio/sse) |
| **参数 (args)** | `args` 数组 | `args` 数组 | 归一化后的 `arguments` | `args` 数组 | 🟢 **高** |
| **环境变量 (env)** | `env` 键值对 | `env` / `env_vars`透传 | Bundle Env 注入 | `env` / `headers` | 🟡 **中** (需切分敏感 Secret 与普通 Config) |
| **认证 (auth)** | 硬编码至 Env | 原生 OAuth / Bearer | ClawHub Bearer Token | Google ADC / SSO | 🔴 **低** (鉴权生命周期异构，需下放给各引擎处理) |
| **版本 (version)** | 依赖包管理器 (`npm`) | SemVer / Pinned | Skill Tags | 不支持/覆写 | 🟡 **中** (需在 F129 Pack 层补充元数据) |
| **来源 URL** | GitHub/NPM/Smithery | Store/远端 URL | ClawHub API URL | 内网限定 | 🟢 **高** (映射为 `source_locator`) |
| **信任等级** | Admin 策略隔离 | 受信任项目白名单 | 社区审计状态 | 内部审计放行 | 🟢 **高** (统一由 Cat Cafe 平台接管和打标) |
| **权限声明** | 极弱 (无细粒度) | `enabled_tools` 白名单 | Sandbox Scopes / `allow` | 基于账号 RBAC | 🔴 **需新增公共字段** (向细粒度对齐) |
| **依赖声明** | 隐式 (依赖 Node/Python) | `timeout_sec` 控制 | 显式 Node 18+ 等要求 | 云端/宿主机环境 | 🔴 **需新增公共字段** (`runtime_env` 预检) |

### 6.2 程序化安装 API 可用性

*(注：除了检索元数据的 Read API 存在，真实的 Write API 在各家底层均退化为“配置文件驱动”)*

| 生态 | API 类型 | 端点/命令 | 认证方式 | 第三方可用 | 稳定性 |
|------|---------|----------|---------|-----------|--------|
| **Claude** | Metaregistry API / 本地文件 | Smithery API / 写 `claude_desktop_config.json` | 宿主文件权限 | ✅ 读 API 可用，写靠文件 | 高 |
| **Codex** | CLI / 配置文件 | `codex mcp add` / 写 `.codex/config.toml` | 宿主文件权限 | 🟡 仅限本地节点操作 | 中 |
| **OpenClaw** | REST API | ClawHub `/api/v1/bundles` | API Key | ✅ 读写 API 可用 | 高 |
| **Antigravity**| 本地文件挂载 | 覆写 `mcp_config.json` | 内部 Lab 凭证 | ❌ 仅限 Lab 环境手动 | 低 |

### 6.3 支持我们假设的证据

| 证据 | 来源 | 置信度 | 可验证性 |
|------|------|---------|---------|
| **最小公共交集仅限于 MCP Server**：LangChain 和第三方聚合器的源码显示，跨框架调用时，全部剥离了各家的 Agent 编排逻辑，只调用原生的 JSON-RPC 协议底层（`tools`, `resources`, `prompts`）。 | 社区 MCP Client 开源代码 | 高 | 源码逻辑可见 |
| **Catalog ≠ Runtime (菜单不是上菜记录)**：MCP Registry 官方架构白皮书明确指出，注册表应设计为 "Metaregistry"，只存描述与定位，不存二进制。这完美印证了 F146 L3 三态分离（cache / lock / binding）的优越性。 | 官方 MCP Registry 规范 | 高 | GitHub `modelcontextprotocol` 规范文档 |

### 6.4 反对我们假设的证据

| 证据 | 来源 | 置信度 | 影响评估 |
|------|------|---------|---------|
| **8 个公共字段不足以支撑安装**：强行拉起缺失环境参数的 MCP 会直接导致引擎挂起。比如我们不知道它是依赖 Node 还是 Python（缺失 `runtime`），不知道该走 stdio 还是 sse（缺失 `transport`）。 | 真实 MCP 配置集 | 高 | **必须扩容 Schema**。从 8 字段扩展为涵盖通信协议和环境的前置检查机制。 |
| **人工审批无法防范供应链投毒**：因为 `stdio` 依赖宿主的 shell 执行。如果在 `args` 数组中埋入恶意混淆管道符，即便 Trust Level 受限且有人类确认，一旦拉起直接突破防线。 | 业界近期 MCP 安全审查与漏洞报告 | 极高 | **致命**。只靠看名字审批不够，必须透出底层执行命令明文并加沙箱。 |

### 6.5 我们没考虑到的维度

| 维度 | 为什么重要 | 建议的调研深入方向 |
|------|----------|------------------|
| **Secret 泄露到版本控制 (Git-track)** | F146 Phase A 的写路径会把配置存入 Git 管理的 `capabilities.json`。由于生态习惯把 Token 放 `env`，这会导致极高风险的明文密钥上库。 | Adapter 必须在产出阶段分离静态配置与 `secrets_refs`，真实密钥存独立 Vault。 |
| **宿主机预检 (Preflight Checks)** | 如果平台下发了依赖 `uvx` 的计划，而节点根本没装 Python，会产生“假死”（UI成功但模型永远超时）。 | 在 Phase A 执行前增加一行前置环境探测指令。 |
| **企业 MDM 策略静默拦截** | Codex 会读取宿主机的安全策略，我们写的配置文件可能被底层引擎静默阻断，产生“幽灵状态”。 | 安装 L3 Binding State 必须执行实际的 `ping` 探针，有回包才算激活。 |

### 6.6 置信度总评

- **假设 1（最小公共交集仅 MCP）：支持** — 剥离非标外壳，聚焦 `tools/resources` 基线是唯一的工程解。
- **假设 2（分层 adapter 可行）：部分支持（需修正）** — 架构可行，但字段不够。必须增加 `transport`, `runtime_env`, `enabled_tools`，至少升级为 11 个公共字段。
- **假设 3（程序化安装覆盖度）：反对（形式变更）** — 云端“安装 API”不存在。Adapter 的核心职责只负责“读”，它的写出形态必须降维成：**“多模态配置编译器（输出针对各家格式的 File Patch）”**。
- **假设 4（catalog ≠ runtime）：强烈支持** — 元数据隔离完全符合 Metaregistry 最佳实践，能有效防止 Tool Shadowing（影子工具提示词污染）攻击。
- **假设 5（trust_level 分级够用）：强烈反对** — 人眼防不住恶意 `npx` 依赖链。面对基于 STDIO 的 RCE 风险，除了打标，还必须增加沙箱机制与命令透出。

---

## 7. Decision Interface（决策映射）

对于接下来的 F146 Phase B 与 Pack 系统建设，建议立即采取以下行动：

| 调研发现 | 建议的行动 | 如何落地到具体模块 (Phase B/C & F129 Pack) |
|---------|-----------------------|-----------------------------------------|
| **写路径本质是 File I/O** | **采纳** | Phase B 的 `installPlan` 放弃调用在线安装 API。改为生成具体的**配置 Patch 指令**（如向 `.codex/config.toml` 中注入特定段落），交由本地守护进程覆写。 |
| **工具缺乏细粒度管控** | **采纳** | 在 F129 Pack 定义中强行注入 `policy.enabled_tools` 白名单。在 Phase C 人工门禁时，CVO 必须能够勾选剔除危险或无用的子能力。 |
| **鉴权体系极度异构** | **搁置** | 在统一 Adapter 侧放弃处理 Auth 握手。遇到需动态授权的包，只生成带占位符的配置，真正的鉴权生命周期交由各引擎底层原生流程处理（如触发 Codex 自身的登录流）。 |
| **防范 STDIO 逃逸提权** | **采纳** | Phase C: `buildInstallPreview` 卡片上**必须红字高亮展示解析后的完整 `command + args`**。对于未验证 Trust Level 的包，强制开启 `sandbox_mode`，挂载入受限容器中执行。 |
| **防止密钥 Git 上库** | **采纳** | 重构 Phase A 写接口：`capabilities.json` 中的 `env` 必须剥离真实 Value，仅存 Schema（如 `{"API_KEY": "required"}`），运行时从非代码库的 `.env.local` 动态获取。 |

---

## 8. Risk Register（风险登记）

如果我们基于本次调研结论做决策进入开发，最可能踩坑的三个环节：

1. **【安全脱轨】凭据硬编码上库 (Secret Leakage)**
   - *为什么可能错*：为求快速跑通联调，开发者将包含目标 MCP Bearer Token 的 `env` 对象直接序列化，被 `capabilities.json` 捕获并推送到 Git 远端，造成严重安全事故。
   - *缓解建议*：在 `POST /api/capabilities/mcp/install` 增加高熵字符串检测器。如果发现匹配高熵的哈希、`sk-` 开头的密钥，直接返回 400 Bad Request 拒绝执行写入。
2. **【运维危机】强行拉起缺失环境的进程导致死锁**
   - *为什么可能错*：`installPlan` 顺利写入了配置并显示 Active。但因为该节点缺失 Python 3.10 环境，底层进程启动无限 Crash。由于它是长连接，大模型调用时只会在数十秒后报 Timeout，排障极难。
   - *缓解建议*：在 `withCapabilityLock` 抢占写锁后，加入 **Pre-flight Checks（环境预检）**，调用 Adapter 生成的一条探针指令（如 `python -c "import sys; sys.exit(0)"`），预检通过才落盘配置。
3. **【架构危机】传输协议断层 (Transport Mismatch)**
   - *为什么可能错*：如果我们假定天下 MCP 只有 `stdio`（通过命令行拉起），那些来自企业内部、使用 `sse` 或云厂商托管的大型 HTTP MCP Server 将直接报废，丧失了集成 Antigravity 的可能性。
   - *缓解建议*：立即在 Schema 与 UI 中新增 `transport_type: enum("stdio", "sse")`。在生成 `installPlan` 时，采用完全不同的两套模版分支去处理。
[待回填]

## Part 3: 综合后的最终版本（待撰写）

> 本地猫（布偶猫）综合 GPT Pro + Gemini 两路结果后撰写

[待撰写]
