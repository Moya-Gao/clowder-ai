# Research Brief: F146 Phase R — 四家 MCP 生态格式交集与统一 Adapter 可行性

## 1. Problem Frame（任务边界）

**我们要回答的问题**：
Claude、Codex、OpenClaw、Antigravity 四家 MCP/插件生态的格式交集有多大？能否安全地构建统一 marketplace adapter？哪些生态支持程序化安装 API，哪些只支持手工路径？

**非目标（明确排除）**：
- 不研究各生态的商业模式或定价策略
- 不研究 LLM 模型本身的能力差异
- 不研究非 MCP 类型的插件（如 OpenAI 旧版 ChatGPT Plugins、Chrome Extensions）
- 不评估哪个生态"更好"——我们是多引擎架构，四家都要支持

**为什么现在要研究这个**：
F146 MCP Marketplace Control Plane Phase A（能力中心写路径）已完成。Phase B 要实现四家生态的统一搜索与安装。在写代码前，我们需要确认：格式交集是否足够大以支撑统一 adapter？还是应该为每家写独立 adapter？先搞清楚再动手，避免在"看起来相似"的接口上误判。

## 2. Current Hypotheses（我们的假设）

我们目前的判断是：

1. **四家的最小公共交集仅限于 MCP server 类能力**——skills + MCP 是公共基线，apps/connectors/native capabilities 各家差异过大无法统一
2. **统一 adapter 可行，但必须分层**——8 个必填公共字段（ecosystem, artifact_id, display_name, source_locator, component_summary, install_mode, auth_mode, trust_level）+ 各生态扩展字段
3. **程序化安装：Claude CLI ✅、OpenClaw/ClawHub API ✅、Codex 待确认、Antigravity 可能仅 lab 模式**
4. **"菜单不是上菜记录"**——catalog 元数据 ≠ runtime 可执行能力，L3 必须分三态：catalog_cache / install_lock / binding_state
5. **供应链安全的最小可行策略是 trust_level 分级 + 安装前 preview + 人工确认门禁**，而非试图统一各家的签名/审核机制

**证据缺口**：
- Codex 官方目录的 publish API 是否对第三方开放？目前我们只确认了 CLI 工具链，不确定有无 REST API
- Claude Enterprise 的 org-level policy 如何映射到 MCP 安装权限？（admin 能否锁定某些 MCP？）
- Antigravity 的 marketplace/gallery API 是否有稳定公开版本？还是仅限内部 lab 模式？
- 各家的 MCP server schema 版本演进策略：breaking change 如何处理？是否有 schema version 字段？
- 四家在 `env`/`headers`/`auth` 字段上的实际格式差异有多大？

## 3. Disconfirm First（先找反例）

在给出支持性证据之前，请优先：

1. 寻找"统一 adapter 失败"的案例——有没有项目试图统一多个插件生态但最终放弃的？为什么失败？
2. 寻找"各家 MCP schema 差异比我们假设更大"的证据——是否有字段名相同但语义不同的陷阱？
3. 寻找"程序化安装带来安全事故"的案例——自动安装 MCP server 导致的供应链攻击实例
4. 检验我们的"8 个公共字段"假设——是否遗漏了关键字段（如 version pinning、dependency declaration、permission scope）？
5. 考虑是否存在"不需要 adapter 的替代方案"——比如各生态的 native marketplace 已经足够好，聚合反而增加复杂性？

## 4. Source Mix Quota（来源配额）

请确保来源覆盖以下类型（不必每类都有，但不能只有一种）：

- [ ] **官方文档**：Claude MCP docs、Codex/OpenAI official docs、OpenClaw/ClawHub docs、Antigravity developer docs
- [ ] **工程博客 / 技术复盘**：实际集成多个 MCP 生态的一手工程经验，非 AI 生成总结
- [ ] **开源项目实现**：GitHub 上的 MCP adapter/aggregator/registry 实现（如 mcp-get、smithery、opentools 等社区项目）
- [ ] **安全研究**：MCP 供应链安全分析、插件安全审计报告、prompt injection via tool descriptions 研究
- [ ] **竞品/同行方案**：其他多引擎 AI 平台如何处理插件/工具聚合（Langchain tool registry、CrewAI tool management、AutoGen 等）

## 5. Local Constraints（我们的约束）

调研结论必须在以下约束下可行：

- **多引擎协作**：我们是 Claude/GPT/Gemini 三猫协作架构，MCP marketplace 必须对四家引擎一视同仁，不能偏向任何一家
- **人在环路**：MCP 安装必须经过人类 CVO 确认（install preview → 用户审批 → 执行），不支持全自动安装
- **知识在 repo 里**：所有配置存在 `capabilities.json`（git-tracked），不依赖外部数据库
- **已有写路径**：Phase A 已实现 `POST /api/capabilities/mcp/install`、`withCapabilityLock` 串行化、`buildInstallPreview` 预览——Phase B 的 adapter 必须输出兼容这个写入接口的 `installPlan`
- **F129 Pack 体系**：我们有 Pack 概念（可分发的能力包），marketplace 条目需要能映射为 Pack 的 `kind=pack` 分发单元
- **渐进式接入**：不要求一次实现四家完整 adapter，可以按 "Claude first → OpenClaw → Codex → Antigravity" 顺序渐进

## 6. Output Schema（输出格式）

请按以下结构组织输出：

### 6.1 四家 Schema 对照矩阵

| 字段 | Claude MCP | Codex MCP | OpenClaw Skill/Bundle | Antigravity MCP | 统一可行性 |
|------|-----------|-----------|----------------------|-----------------|-----------|
| Server ID/名称 | | | | | |
| 命令/入口 | | | | | |
| 参数 (args) | | | | | |
| 环境变量 (env) | | | | | |
| 认证 (auth) | | | | | |
| 版本 (version) | | | | | |
| 来源 URL | | | | | |
| 信任等级 | | | | | |
| 权限声明 | | | | | |
| 依赖声明 | | | | | |

### 6.2 程序化安装 API 可用性

| 生态 | API 类型 | 端点/命令 | 认证方式 | 第三方可用 | 稳定性 |
|------|---------|----------|---------|-----------|--------|
| Claude | | | | | |
| Codex | | | | | |
| OpenClaw | | | | | |
| Antigravity | | | | | |

### 6.3 支持我们假设的证据
| 证据 | 来源 | 置信度（高/中/低） | 可验证性 |
|------|------|---------|---------|

### 6.4 反对我们假设的证据
| 证据 | 来源 | 置信度（高/中/低） | 影响评估 |
|------|------|---------|---------|

### 6.5 我们没考虑到的维度
| 维度 | 为什么重要 | 建议的调研深入方向 |
|------|----------|------------------|

### 6.6 置信度总评
- 假设 1（最小公共交集仅 MCP）：{支持/反对/未定} — 理由
- 假设 2（分层 adapter 可行）：{支持/反对/未定} — 理由
- 假设 3（程序化安装覆盖度）：{支持/反对/未定} — 理由
- 假设 4（catalog ≠ runtime）：{支持/反对/未定} — 理由
- 假设 5（trust_level 分级够用）：{支持/反对/未定} — 理由

## 7. Decision Interface（决策映射）

对于每个调研发现，请标注建议的行动：
- **采纳**：证据充分，建议我们直接采用
- **试点**：有潜力但需要小范围验证
- **搁置**：当前不适用或证据不足

并说明如何落地到：
- Phase B 的 adapter 接口设计
- Phase C 的安全治理策略
- F129 Pack 的 marketplace 分发模型

## 8. Risk Register（风险登记）

如果我们基于本次调研结论做决策，最可能出错的地方是：

1. {风险 1}：{为什么可能错} → {缓解建议}
2. {风险 2}：{为什么可能错} → {缓解建议}
3. {风险 3}：{为什么可能错} → {缓解建议}

---

## 本地锚点（Local Context Injection）

### 当前 Feature Spec 摘要

**F146 MCP Marketplace Control Plane** (`docs/features/F146-mcp-marketplace-control-plane.md`)
- **Why**: Cat Cafe 需要一个统一的 MCP 市场控制面，让用户从四家生态（Claude/Codex/OpenClaw/Antigravity）发现、预览、安装 MCP server
- **What**: 四个 Phase — A(写路径✅) → R(调研) → B(聚合) → C(安全) → D(L1/L2/L3联动)
- **Phase B 目标**: 统一搜索接口返回四方结果，带 trustLevel 过滤，能把 marketplace 条目映射成可执行 installPlan

### 相关 Feature

**F129 Pack System** (`docs/features/F129-pack-system.md`)
- Pack 是 Cat Cafe 的可分发能力包，包含 MCP server 配置 + 元数据 + 安装计划
- Marketplace 条目需映射为 Pack 的 `kind=pack` 分发单元
- Pack 的 installPlan 必须兼容 Phase A 的 `POST /api/capabilities/mcp/install` 接口

### 已有调研结论（避免重复）

**2026-03-25 OpenClaw/ClawHub 生态调研**：
- ClawHub 13,000+ skills，三层结构（skills registry + plugin registry + soul registry）
- Bundle 是"有损归一化"层——选择性映射 Codex/Claude/Cursor 内容，非完整运行时
- 社区偏开发/自动化（1,184 coding agents），companion/worldbuilding 稀少

**2026-03-28 跨生态 GPT-5.2 Pro 咨询结论**：
- 最小公共交集仅 skills + MCP
- 8 个必填公共字段已初步确定
- 6 个外部文档 URL 全部验真通过
- "菜单不是上菜记录"架构洞察：catalog ≠ runtime

**请在这些结论基础上深入，不要重复已验证的内容。**

### 最近教训

- **LL: 验证假设再动手**：F146 Phase A 开发前假设 Antigravity MCP API 可直接调用，结果发现仅 lab 模式，浪费时间。调研阶段必须确认 API 实际可用性。
- **LL: research before spec**：讨论收敛后先走 research pipeline 再立项，不能跳过调研直接写 spec。
