# Context 入口 Anchor 化盘点 —— "信息进主 context"的 dump 现状 + 优先级

> 类型：research（收敛用，**不开 F 号**，待 CVO 判 feature/ADR/Phase）
> 触发：铲屎官从 rtk teardown 引出——"我们家能不能更省 token？哪些入口噪音太大？"
> 方法：3 路 subagent 盘代码现状（强约束 anchor 返回）+ recall 现有愿景 + 对照 F148
> 作者：宪宪 (@opus-48) · 2026-06-15

---

## 0. 一句话结论（TL;DR）

**我们的 anchor-first 愿景不是要"学 rtk"，是本来就有、且已部分落地**——记忆系统是教科书级标杆，F148 已解决"**过去→context**"（A2A 消息注入分层）。真正的缺口在 **"当下→context"**：当前猫**实时**调 MCP 工具 / subagent 返回的那一跳，全是 dump、零分层。最高 ROI 缺口是**协作类 MCP 工具**（完全我们可控）。

**rtk 对照**：rtk 是有损 truncate（丢东西）；我们的 anchor 是无损 lazy（指针在、原文按需取、不丢）——方向比 rtk 高级，只是没贯彻到所有入口。

---

## 1. 现状地图：context 入口 × 现状 × 可控性

| 入口 | 现状 | 可控性 | 证据（path:line） |
|---|---|---|---|
| **记忆三入口** `search_evidence`/`graph_resolve`/`list_recent` | ✅ **已 anchor 化（标杆）** | 我们可改 | `evidence-tools.ts:246`（snippet 截 200 + drilldown hint）/ `recent-tools.ts:107` |
| **`read_file_slice`**（drill 终点） | ✅ 教科书级 bounded lazy reader | 我们可改 | `file-tools.ts:96`（默认 120 行 / 硬上限 400 / 流式 / 超界 error） |
| **A2A 消息注入**（@-mention 冷启动） | ✅ **F148 已解决** | 我们可改 | F148 Phase A：smart window + tombstone + evidence recall |
| **历史消息里的 tool payload** | ✅ **F148 已 scrub** | 我们可改 | F148 **AC-A5**：非最后一跳 tool 结果压成 `<tool_result truncated: …>` |
| **🔴 实时 MCP 协作工具返回** | ❌ **dump 全文** | **我们可改（最高 ROI）** | 见 §2 Top 3 |
| **🟡 runtime tool_result**（codex/agy） | ❌ 透传无截断 | 部分可控（transform 层） | `codex-event-transform.ts:143` / `antigravity-event-transformer.ts:257` |
| **⚫ cc / opencode 内置工具返回** | ❌ dump | **runtime 锁定（连看都看不到）** | `claude-ndjson-parser.ts:286`（result skip）/ `opencode-event-transform.ts:79`（不发 tool_result） |
| **⚫ CLI 内置 Agent/subagent 返回** | ❌ 零契约零校验 | **runtime 锁定** | 全仓无 subagent-return 校验；`invoke-single-cat.ts:2536` 统一 sink 只盖 OTel 不裁剪 |

> **关键边界**：F148 管的是「组装注入 context」（过去的消息/工具结果进来时压缩）；管不到「猫**正在**调工具/subagent」那一跳——那在 CLI subprocess 内部。这就是缺口的本质。

---

## 2. 最高 ROI 缺口：协作类 MCP 工具（完全可控）

Top 3（来自 MCP 工具盘点，agentId `a35e9f5d25dfa7711` 可 drill 全量）：

1. **`get_thread_context`** 🔴 最高频最易爆 —— schema **default=100 / max=200** 条 **full message body 无截断**，单次可塞爆 context。`callbacks.ts:1975-1990`（schema `callback-tools.ts:303`）
2. **`get_pending_mentions`** —— 每条 mention inline 完整正文（最多 20 条）。`callbacks.ts:1645-1651`
3. **`list_tasks`** —— 回完整 TaskItem，`why` 字段可达 1000 字符 + 跨 thread 全平铺。`callback-task-routes.ts:239-246`

**统一改法**（复制记忆系统模板）：列表层回 `preview + messageId/anchor`，全文走已有的 `get_message` / `read_file_slice` drill。**记忆系统已经证明这套可行，是 copy-paste 不是发明。**

---

## 3. 三层 harness 方案（软+硬+eval —— 你说的对，承诺没用）

| 层 | 做法 |
|---|---|
| **软** | 约定/skill：新增读类 MCP 工具默认 `preview + anchor`，全文靠第二跳 drill |
| **硬** | ① **截断在最内层封顶**（API/store 层加 `maxChars`，不靠 MCP wrapper——见 §4 教训）；② 通用 `anchorize()` helper 包装协作读返回；③ 迁 `server.tool()` → `registerTool()` 用 outputSchema（SDK 已支持，我们没接，`server-toolsets.ts:231`） |
| **eval** | telemetry 测高频工具（`get_thread_context` 等）平均返回 token，降→生效；可加 lint 检测新读类工具缺 preview |

---

## 4. 盘点中的关键发现 / 我的更正

- **记忆系统的教训（Agent2 `a371ee1e9d01cd68d`）**：截断必须在返回值**最内层（store/API）封顶**，别压到最外层 MCP wrapper——否则换个调用方就漏。现有 2 处轻残留正是反例：`read_session_digest`（MCP 零截断 passthrough，`session-chain-tools.ts:196`）、`depth=raw` passage（store 返全文 `SqliteEvidenceStore.ts:865` 靠 MCP 截断保命）。
- **🔧 我上一条说错了，更正**：我对你说"Workflow `agent({schema})` 能强制 subagent schema"——Agent3（`a9173e8eeacb0e362`）实测推翻：cat-cafe 调猫是 **subprocess + 事件流**（`spawnCli --output-format stream-json`，全仓 0 个 Agent SDK import），**Workflow schema 那条路对我们架构根本不可达**。我又犯了"凭推理说能力"的毛病。真相是：subagent 返回**零契约**，能补的是 MCP 层 outputSchema（软层缺失，可补），不是 Workflow。
- **dogfood 观察（本次 research 自证）**：我用 prompt **软约束** 3 个 subagent 返回 anchor（"只给 path:line + 一句话，禁贴代码"）。效果：**管住了形式**（没人 dump 大段代码）但**管不住量**（条目多、返回仍偏长，74k/93k/115k subagent_tokens）。这正是活体证据——**软约束能限形式、限不了量；非有硬层（最内层封顶 + 结构 schema）+ eval 不可**。

---

## 5. 给 CVO 的决策点

这天然是 **F148 的延伸**——F148 = "过去→context"分层（已 done），缺口 = "**当下→context**"分层（实时工具/subagent 返回）。三个选项：

- **A. 当 F148 Phase I 重开**（同一愿景延续，scope = 实时 MCP 协作工具 anchor 化）
- **B. 新开 feature**（如"Context 入口 Anchor 化"，独立 scope）
- **C. 先沉淀 ADR**（把"所有进 context 的返回必须 anchor-first + 最内层封顶"立成架构原则，再逐步落地）

我的倾向：**C（ADR 立原则）+ A（F148 Phase I 落 Top 3 协作工具）** 组合——原则先立（防止新工具继续 dump），高 ROI 的 Top 3 先落地见效。但 scope/开不开 F 号是你的 signoff。

> subagent 全量盘点可 drill：MCP 工具 `a35e9f5d25dfa7711` / 记忆标杆 `a371ee1e9d01cd68d` / runtime 异构 `a9173e8eeacb0e362`
