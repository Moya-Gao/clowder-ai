---
feature_ids: [F041]
topics: [capability, dashboard]
doc_kind: note
created: 2026-02-26
---

# F041: 能力看板 — Hub MCP/Skills 统一管理

> **Status**: done
> **Completed**: 2026-02-27
> **Owner**: 布偶猫
> **Created**: 2026-02-26
> **Priority**: P1（铲屎官明确需求，影响日常管理体验）

---

## Why

铲屎官 2026-02-26 明确提出：
> "我都不知道你们三只猫到底挂了什么！"

**核心痛点**：
1. Hub MCP 工具列表是硬编码假数据（9 个假名字 vs 实际 27 个工具）
2. 不想当人肉路由器——每只猫单独配置太痛苦
3. 多项目场景需要不同的工具集配置
4. Skills 增长后需要按猫控制加载范围，避免 token 浪费

---

## What

1. **能力看板 UI**：Hub 新增统一看板，展示所有 MCP + Skills，支持 tag 过滤和开关
2. **配置编排**：`.cat-cafe/capabilities.json` 作为唯一真相源，自动生成三猫的 CLI 配置
3. **MCP 归一**：三猫统一走原生 MCP 协议，HTTP callback 降级为 fallback
4. **提示词归一**：移除 McpPromptInjector 对走原生 MCP 的猫的 HTTP callback 注入

---

## Acceptance Criteria

### 功能验收

- [x] Hub 能力看板 tab 显示所有实际注册的 MCP 工具 + Skills，无硬编码假数据
- [x] 可按类型（MCP/Skill）、来源（Cat Cafe/外部）、猫猫过滤
- [x] 全局开关：关掉某能力后，三猫下次 spawn 均不加载（MCP: CLI 配置级; Skills: capabilities.json 级，CLI 运行时见 Known Limitations）
- [x] 每猫覆盖：全局开启的能力，可对单只猫关闭（同 provider 限制见 Known Limitations）
- [x] 猫 tab 精简：不再展示 Skills/MCP 列表，只保留模型&预算

### 架构验收

- [x] `.cat-cafe/capabilities.json` 存在且作为唯一真相源
- [x] 配置编排器能正确生成 `.mcp.json`、`.codex/config.toml`、`.gemini/settings.json`
- [x] Cat Cafe 自有工具对三猫均通过原生 MCP 协议提供
- [x] McpPromptInjector 不再给走原生 MCP 的猫注入 HTTP callback 指令
- [x] 热加载验证：翻开关 → 下次 spawn → 能力变化生效（e2e 测试覆盖）

### 边界验收

- [x] 多项目隔离：不同项目可有不同能力配置
- [x] 降级路径：MCP 加载失败时，HTTP callback 作为 fallback 可用

---

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | [2026-02-26-capability-dashboard](../discussions/2026-02-26-capability-dashboard/README.md) | 铲屎官采访 + 架构决策 |
| **Research** | [codex-支持动态加载mcp](../research/codex-支持动态加载mcp.md) | 缅因猫实测验证 |
| **Research** | [gemini-cli支持动态加载mcp](../research/gemini-cli支持动态加载mcp.md) | 缅因猫实测验证 |

---

## Key Decisions

1. **全局 + 每猫覆盖**：不做单层开关，支持两层覆盖（铲屎官拍板）
2. **MCP 归一优先**：三猫统一走原生 MCP，HTTP callback 只作 fallback（推翻"只有 Claude 支持 MCP"的旧假设）
3. **配置编排器生成**：不让用户手写三份 CLI 配置，统一从 `.cat-cafe/capabilities.json` 生成
4. **猫 tab 精简**：能力信息只在能力看板展示，不在猫 tab 重复
5. **一步到位**：不分阶段，B 方案（完整归一）包含 A 方案（展示+开关），不走弯路（铲屎官拍板）
6. **配置编排是核心**：`.cat-cafe/` 作为项目级唯一真相源，编排器生成三猫 CLI 配置

---

## 技术共识（2026-02-27 布偶猫+缅因猫讨论）

> 讨论文档：[tech-discussion-open-questions.md](../discussions/2026-02-26-capability-dashboard/tech-discussion-open-questions.md)

### 已达成共识

#### 1. API 设计

保留 `/api/capabilities` 名称，拆分读写职责：

- `GET /api/capabilities`：返回看板聚合视图（Skills + 外部 MCP + Cat Cafe 自有 MCP + 开关状态）
- `PATCH /api/capabilities`：支持单能力/批量更新，含 `scope: global|cat`、`capabilityId`、`enabled`、`overrides`

> 砚砚提议，布偶猫同意。前端一次请求渲染看板，开关操作走 PATCH。

#### 2. 统一能力内部模型

```typescript
interface CapabilityDescriptor {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  workingDir?: string;
  source: 'cat-cafe' | 'external';
  // transport 字段暂不加（YAGNI，详见 TD104）
}
```

配置适配器层（读写三种格式）：
- `.mcp.json`（Claude，JSON 格式）
- `.codex/config.toml`（Codex，TOML 格式，`[mcp_servers.<name>]`）
- `.gemini/settings.json`（Gemini，JSON 格式，`mcpServers`）

> 砚砚和布偶猫共识：Q2 和 Q4 在同一轮实现，降低迁移风险。

#### 3. 迁移节奏 — 一步到位 + 明确 fallback

- **主路径**：默认全部走原生 MCP
- **Fallback**：仅在"生成配置/进程失败/启动不可用"时触发，短时启用 callback 提示词
- fallback 触发要有条件检测（异常才触发），不能默认每次注入

> 三方（铲屎官+布偶猫+砚砚）共识。

#### 4. 提示词归一与 F042 协调

- `McpPromptInjector` 收敛为"降级时短路注入"，平时走 `SystemPromptBuilder` 的原生 MCP 说明
- callback 文案和原生 MCP 不能共存（会导致猫猫收到矛盾指令）
- F041 先做 MCP 归一 → F042 后做提示词全面优化（避免冲突）

#### 5. 砚砚发现的阻塞项

| 优先级 | 问题 | 位置 | 说明 |
|--------|------|------|------|
| P1 | `mcpSupport` 是 false | `cat.ts:107`, `cat-config.json` | 会把新架构锁在 callback 老路径 |
| P1 | `/api/capabilities` 不完整 | `capabilities.ts:59-75` | 不读 `.codex/config.toml`，不返回 Cat Cafe 自有 MCP |
| P2 | `mcpAvailable` 混用逻辑 | `route-serial.ts:102-105`, `route-parallel.ts:67-70` | 需统一改为能力源头驱动 |

#### 6. 三猫 CLI 配置格式映射（砚砚确认）

**Codex** — `.codex/config.toml`（用户级 `~/.codex/` 或项目级 `.codex/`）：

```toml
[mcp_servers.cat_cafe]
command = "node"
args = ["./mcp-server/build/index.js"]
enabled = true
startup_timeout_sec = 30
```

字段：`command`(string) / `args`(array) / `env`(table) / `enabled`(bool, 可选) / `url`(string, 远端 MCP) / `startup_timeout_sec`(可选)

**Gemini** — `.gemini/settings.json`（用户级 `~/.gemini/` 或项目级 `./.gemini/`）：

```json
{
  "mcpServers": {
    "cat-cafe": {
      "command": "node",
      "args": ["./mcp-server/build/index.js"]
    }
  }
}
```

字段：`command`(string) / `args`(array) / `env`(object, 可选) / `cwd`(string, 可选)

**Claude** — `.mcp.json`（已有，格式与 Gemini 类似但顶层 key 不同）

> **映射备注**：
> - Codex 支持 `enabled` 字段（可直接用于开关），Gemini/Claude 不支持 → 编排器对 Gemini/Claude 通过"不生成该条目"实现关闭
> - Codex 额外支持 `url`（远端 MCP）和 `startup_timeout_sec`，这些在 Cat Cafe 场景暂不使用

#### 7. Gemini CLI enable/disable 边界（砚砚确认）

砚砚核实：仓库现有资料中未找到可复现的、带复现步骤的"已确认 bug 事实"。`docs/research/gemini-cli支持动态加载mcp.md` 只记录了动态开关支持（含 `--session`），无量化 bug 细节。

**稳妥策略**（实施时遵守）：
- 运行期临时禁用/启用必须带 `--session`，避免配置持久污染
- 持久化修改用 `--scope project/user` 的明确目标文件路径
- 每次变更后用 `gemini mcp list` + 一次 spawn 检查是否真正生效

### 执行顺序（三方共识）

> 布偶猫提议，铲屎官认可，砚砚确认（2026-02-27）。
> 砚砚原话："先做能力编排与配置下发，再落 `cat.ts`/`cat-config` 的 `mcpSupport: true`"。

| 步骤 | 做什么 | 为什么 |
|------|--------|--------|
| 1 | 能力发现完整化 + 配置适配器 | 先确保能读写三种 CLI 配置格式 |
| 2 | 配置编排器 | 确保能从 `capabilities.json` 生成三猫 CLI 配置 |
| 3 | 统一能力 API（GET + PATCH）+ 看板 UI | 看板数据和开关就位 |
| 4 | **最后才翻 `mcpSupport` 开关** | 此时原生 MCP 配置已就位，翻开关不会造成能力真空 |
| 5 | 提示词归一 + fallback 条件化 | McpPromptInjector 收敛为降级短路 |
| 6 | 红绿测试 | 发现一致性、config round-trip、注入互斥 |

**能力真空论证**：
```
翻 mcpSupport=true 但编排器还没做时：
  needsMcpInjection(true) = false → 不注入 HTTP callback ❌
  原生 MCP 配置也没生成 → 没有原生工具 ❌
  → 猫猫丧失所有 Cat Cafe 工具能力 💀
```

### 待确认

1. ~~执行顺序~~ → 已确认：砚砚同意"先铺路后点灯"
2. ~~Codex `.codex/config.toml` 格式~~ → 已确认：见共识 §6
3. ~~Gemini `.gemini/settings.json` 格式~~ → 已确认：见共识 §6
4. ~~fallback 触发检测~~ → 铲屎官定调：不重要，大概率是 MCP 调不通。实施时用最简检测（spawn 失败/工具列表为空 → 降级注入 callback）
5. ~~Gemini CLI enable/disable bug~~ → 已确认：无可复现 bug 证据，采用稳妥策略（见共识 §7）

---

## Known Limitations

### Same-provider per-cat override 不可强制执行（P3 降级 — 铲屎官裁决 2026-02-27）

**现象**：同一 provider 下多只猫（如 codex/gpt52/spark 共享 `.codex/config.toml`）的 per-cat disable 无法在 CLI 配置层面执行。`capabilities.json` 正确保存了 per-cat override，但 `collectServersPerProvider` 生成 CLI 配置时采用 union 策略（any-enabled-wins），disabled 状态被合并丢失。

**为什么不是 bug**：
- CLI 配置文件是 per-provider 共享的，不是 per-cat 独立的
- Union 策略是最安全默认——反过来做（any-disabled-wins）会让 sibling cat 被误关
- 修复需要 per-invocation 临时配置生成或运行时 MCP 过滤，超出 F041 范围

**来源**：云端 Codex review PR #83，布偶猫 push back 后铲屎官裁决降级为 P3 known limitation。

### Skills 运行时强制执行受限于 CLI（2026-02-27）

**现象**：Skills 的全局/per-cat 开关状态正确保存在 `capabilities.json`，UI 可 toggle。但 CLI（claude/codex/gemini）从各自 skills 目录自动加载 skills，我们的代码不控制加载过程（不传 `--skills` 等 flags）。

**影响**：disabled skill 在 capabilities.json 中标记为 `enabled: false`，但 CLI 仍会自动加载（如果 symlink 存在）。MCP 工具不受此限制（通过 CLI 配置文件直接控制）。

**后续方案**：
- 修改 agent invocation 传递 `--disable` flags
- 或通过 symlink 管理（创建/删除）实现运行时控制

---

## Risk / Blast Radius

- **影响范围**：McpPromptInjector、SystemPromptBuilder、三猫 system prompt 模板、Hub 前端、`/api/capabilities` 路由、cat-config.json
- **回滚方案**：HTTP callback 保留为 fallback，MCP 归一失败可回退
- **关键风险**：翻 mcpSupport 开关的时机（已通过执行顺序控制）

---

## Dependencies

- **Evolved from**: F038 (Skills 梳理 + 按需发现机制 — F041 将 skills 发现扩展为统一能力看板)
- **Related**: TD102 (SessionBootstrap 同步 F98)
- **Related**: TD103 (课件契约文档同步)
- **Related**: TD104 (transport 字段 YAGNI)
- **Related**: F042 (提示词工程审计 — F041 的 MCP 归一会影响提示词变更范围)
- **Related**: F032 (Agent Plugin Architecture — catRegistry 可复用)
- **Evolves into**: F042 (提示词工程审计), F043 (MCP 归一化)

---

## Open Questions

> 大部分已在技术讨论中关闭，仅保留实施阶段需细化的问题。

1. ~~API 设计~~ → 已共识：GET + PATCH `/api/capabilities`
2. ~~Codex/Gemini 配置格式~~ → 已确认（见技术共识 §6）
3. ~~Skills 发现~~ → 已共识：扩展现有端点
4. ~~迁移节奏~~ → 已共识：一步到位 + fallback
5. ~~fallback 触发检测~~ → 铲屎官定调：不重要，实施时最简检测即可
6. ~~Gemini CLI enable/disable~~ → 已确认无可复现 bug，采用稳妥策略（见技术共识 §7）

---

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 | PR |
|------|----------|------|------|-----|
| R1 | 砚砚/Codex (本地) | 2 P1 + 2 P2 + 1 P3 → 全部修复/push back | 2026-02-27 | #83 |
| R2 | 砚砚/Codex (本地) | 放行 (0 P1/P2) + 2 non-blocking P3 → 修复 | 2026-02-27 | #83 |
| Cloud R1 | Codex (云端) | P1-1 修复 (bootstrap CLI configs) + P1-2 push back (same-provider) | 2026-02-27 | #83 |
| Cloud R2 | Codex (云端) | 同一 P1-2 重提 → 铲屎官裁决降级 P3 | 2026-02-27 | #83 |
| Gap R1 | 砚砚/Codex (本地) | 放行 (0 P1/P2), 1 P3 (skills hint) → 修复 | 2026-02-27 | #85 |
| Gap R2 | 砚砚/Codex (本地) | P1 React key + P2 toggling state → 修复 → 放行 | 2026-02-27 | #85 |
| Cloud R1-R2 | Codex (云端) | P1 ID collision + P2 coexistence → 修复 | 2026-02-27 | #85 |
| Cloud R3-R5 | Codex (云端) | P2×4: cat filter 语义 + sparse cats + 无效 toggle | 2026-02-27 | #85 |
| Cloud R6-R9 | Codex (云端) | P2+P1: stale prune + scan failure guard + ENOENT/size | 2026-02-27 | #85 |
| Cloud R10 | Codex (云端) | **通过** ("Breezy!") — 0 P1/0 P2 | 2026-02-27 | #85 |

---

## Test Evidence

| 测试文件 | 测试数 | 覆盖 |
|----------|--------|------|
| `mcp-config-adapters.test.js` | 27 | 读写 3 CLI 格式, merge-by-name 保留用户配置 |
| `capability-orchestrator.test.js` | 20 | safePath, bootstrap, round-trip, per-cat resolve |
| `capabilities-route.test.js` | 15 | PATCH global/cat/skill toggle, override cleanup, same-name coexistence, compound PATCH, sparse cats, stale prune, scan failure guard, Fastify 路由 |
| `f041-integration.test.js` | 14 | Config round-trip, hot-reload (disable→remove, enable→restore), injection 互斥, discovery 一致性, per-cat override |

**总计**: 76 tests / 0 fail

---

## Timeline

- 2026-02-26: 铲屎官提出需求，采访澄清
- 2026-02-26: 缅因猫实测验证 Codex/Gemini MCP 支持
- 2026-02-26: Discussion 收敛，Spec 完成
- 2026-02-26: 升级为 F041（原 TD101）
- 2026-02-27: 布偶猫+缅因猫技术讨论，达成 API/迁移/提示词共识
- 2026-02-27: 铲屎官认可执行顺序
- 2026-02-27: 砚砚确认执行顺序 + 提供 Codex/Gemini 配置格式 + Gemini bug 结论
- 2026-02-27: 布偶猫实现（6 步: adapters → orchestrator → API+UI → mcpSupport flip → prompt fallback → red-green tests）
- 2026-02-27: 砚砚本地 review R1-R2（2 P1 + 2 P2 → 全部修复 → 放行）
- 2026-02-27: 云端 Codex review R1-R2（P1-1 修复 + P1-2 铲屎官裁决降级 P3）
- 2026-02-27: PR #83 合入 main（`61308a6`）
- 2026-02-27: Gap fixes（猫猫过滤 + Skills toggle + compound ID + 热加载 e2e）
- 2026-02-27: 砚砚本地全量 review R1-R2 → 放行
- 2026-02-27: 云端 Codex review R1-R10（系统性修复: sparse cats, prune guard, ENOENT 区分）→ R10 通过
- 2026-02-27: PR #85 合入 main（`a36bcb4`）
- 2026-02-27: Feature completed, PR #83 + #85 merged

---

*从 TD101 升级而来。详见 `docs/TECH-DEBT.md` 重定向注释。*
