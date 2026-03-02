---
feature_ids: [F050]
topics: [a2a, cli, interoperability, dare]
doc_kind: discussion
created: 2026-03-02
---

# F050 讨论纪要：Cat Cafe 外部 Agent（A2A/CLI）接入分析

> 日期：2026-03-02  
> 参与：铲屎官、砚砚（Codex）  
> 目标：给出 Cat Cafe 接入外部 agent（尤其 DARE）的完整 gap 分析与落地路径

---

## 1) 先纠偏：我们已具备哪些基础

### 1.1 三猫 MCP 是统一动态注入（不是静态硬编码）

证据：

- `packages/api/src/config/capabilities/capability-orchestrator.ts`
- `packages/api/src/config/capabilities/mcp-config-adapters.ts`
- `docs/features/F041-capability-dashboard.md`

结论：我们已经能统一编排 Claude/Codex/Gemini 的 MCP 配置，这是外部接入的“能力层基础”。

### 1.2 我们“当前 A2A”是内部协作路径

证据：

- `packages/api/src/domains/cats/services/agents/routing/a2a-mentions.ts`
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- `packages/api/src/routes/callback-a2a-trigger.ts`

结论：当前 A2A 是“内部消息协作机制”，不是对外 A2A 协议适配器。

### 1.3 AgentService 已抽象，但 provider 入口仍受限

证据：

- `packages/api/src/domains/cats/services/types.ts`（`AgentService.invoke`）
- `packages/api/src/index.ts`（provider switch）
- `packages/api/src/config/cat-config-loader.ts`（provider enum 三值）
- `packages/shared/src/types/cat.ts`（`CatProvider` 三值）

结论：内核扩展点在，入口治理还没放开到“任意外部 provider”。

---

## 2) DARE 当前能力快照（以 main 为准）

### 2.1 已具备能力（正向）

1. A2A server/client 模块已存在  
证据：
- `dare_framework/a2a/server/transport.py`
- `dare_framework/a2a/server/handlers.py`
- `dare_framework/a2a/client/client.py`

2. 统一对外 CLI 已存在，且支持 `--output json` 与 script 模式  
证据：
- `client/main.py`
- `client/README.md`

3. MCP 运行期重载/卸载能力已存在  
证据：
- `client/commands/mcp.py`
- `dare_framework/mcp/manager.py`
- `dare_framework/agent/builder.py`

4. skills 发现/列举链路已存在  
证据：
- `dare_framework/skill/skill_store_builder.py`
- `client/commands/info.py`（`skills:list`）

### 2.2 主要 gap（对接 Cat Cafe 视角）

1. **事件语义 gap**：DARE CLI JSON 输出格式与我们现有 provider 事件模型不一致，需要专门 mapper。
2. **会话恢复 gap**：需要明确、稳定的跨进程 resume 协议，避免每次会话重建。
3. **协议入口 gap**：A2A 模块与外部 CLI 仍是分离能力，缺统一桥接入口。
4. **接入治理 gap**：外部托管接入场景下，需补齐我们需要的 auth/audit 边界。

---

## 3) “任何支持 A2A 都能接吗”——结论

**不能直接接。**

可以理解为：

1. A2A 协议是必要条件，不是充分条件。
2. 还要满足我们平台层的会话、能力注入、安全与审计契约。
3. 所以必须经过 adapter + compatibility gate，不能裸连。

---

## 4) 接入分级（建议执行）

| 等级 | 能力定义 | 结论 |
|---|---|---|
| L0 | 无机器流/无治理边界 | 不可接 |
| L1 | CLI 可调用 + 基础事件映射 + 最小治理 | 可灰度 |
| L2 | A2A 协议接入闭环（AgentCard + tasks/send） | 可上线 |
| L3 | A2A + 动态 MCP + 审批/审计闭环 | 推荐默认 |

---

## 5) 对 DARE / opencode 的判断策略

1. DARE：优先走 L1（CLI adapter）打样，再补 L2（A2A adapter）
2. opencode：不凭印象判断，按同一 compatibility checklist 跑证据
3. 所有外部 agent 一律按同一 EAC v1 契约门禁

---

## 6) 落地动作（已转 F050 spec）

已在 `docs/features/F050-a2a-external-agent-onboarding.md` 固化：

1. External Agent Contract v1
2. 双通道接入模型（CLI + A2A）
3. 接入验收分级（L0~L3）
4. DARE/opencode 兼容性评估入口

