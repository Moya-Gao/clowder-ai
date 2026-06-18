---
purpose: blind-eval-input
generated_by: opus-47 (协调者)
extracted_from: samples/<F号>.md 第一行（纯 description，无烁烁自评）
warning: 盲评猫只读本文件 + 各 F号 原 doc，禁读 samples/<F号>.md（含烁烁 self-evaluation，会 anchor 评分）
---

# F243 Phase A Step 3 — Blind Evaluation Input

**协议**（charter §盲评协议 + 评分 Rubric）：
- 烁烁（@gemini35）已生成 10 篇 description（Step 2）— 见下方
- 三猫**盲评**：@opus-47 / @codex / @antig-opus，每猫独立 invocation
- 每猫看：① 本文件（pure descriptions） + ② 对应 F号 原 doc（`docs/features/F<N>-*.md`）
- 每猫**严禁看**：① `samples/<F号>.md`（含烁烁自评，污染）② 其他猫的 `evaluations/*.md`
- 评分输出：`docs/research/2026-06-17-f243-description-spike/evaluations/<cat-id>.md`（cat-id 用 `opus-47` / `codex` / `antig-opus`）
- 完成后行首 `@opus-47` cross_post 主 thread `thread_mqg40i0bgpahdh9s` 报告

---

## 10 篇 description（pure）

### 1. F008（硬骨头：标题虚 / 抽象）

> F008 是针对 Token 消费失控问题，集成 js-tiktoken 实现 usage 与 cost 实时捕获，并在 ParallelStatusBar 状态栏看板上展示 Token 预算与缓存状态的 CLI 深度可观测规范。

原 doc：`docs/features/F008-token-budget-observability.md`

---

### 2. F009（easy：tool use / tool result 主题集中）

> F009 是解决工具调用不可见，通过 useAgentMessages 钩子捕获并解析 tool_use 与 tool_result 处理器数据，并在消息流看板上渲染工具调用细节的笔记。

原 doc：`docs/features/F009-tool-use-tool-result.md`

---

### 3. F012（easy：feature discoverability 早期实现）

> F012 是解决功能查找困难，通过引入 Hub modal 弹窗、功能注册表及 /hub 命令，向用户展示环境摘要的功能导航看板笔记。

原 doc：`docs/features/F012-feature-discoverability.md`

---

### 4. F013（easy：audit log 简短早期）

> F013 是解决操作无法追责，通过实现操作审计与 CLI 原始日志归档，建立用于排查与追责的行为审计看板笔记。

原 doc：`docs/features/F013-audit-log-v2.md`

---

### 5. F038（硬骨头：ADR-like / doc_kind=note）

> F038 是解决技能加载过载，规范项目级软链接技能库分类，并规划引入基于 BM25 词频排序的按需发现笔记。

原 doc：`docs/features/F038-skills-discovery.md`

---

### 6. F119（easy：谁是卧底游戏主题清晰）

> F119 是提供坏猫战术推理，复用基础引擎构建描述、讨论与投票轮流程，并配备 WordPairBank 词组库的谁是卧底博弈沙盘规范。

原 doc：`docs/features/F119-who-is-spy-game.md`

---

### 7. F155-scene-guidance-engine（硬骨头：scope 复杂 / community / multi-phase done）

> F155 是解决操作指引缺失，通过 YAML 流程定义与引导状态机，在前端 Overlay 上实现分步动作捕获与自动推进的交互引导看板规范。

原 doc：`docs/features/F155-scene-guidance-engine.md`

---

### 8. F161（硬骨头：technical acronym / carrier / env mapping）

> F161 是解决传输通道硬编码，将 Gemini 专属传输重构为 AcpAgentService，并引入模板环境变量映射以解耦客户端的 ACP 传输驾驶舱规范。

原 doc：`docs/features/F161-acp-carrier-generalization.md`

---

### 9. F170（硬骨头：archived/interview-demo 类 superseded）

> F170 是为演示开发生命周期，在分支上开发并归档的端到端网页象棋游戏规则引擎及生命周期演示沙盘规范。

原 doc：`docs/features/F170-web-chinese-chess.md`

---

### 10. F189（硬骨头：abstract concept / 单点化）

> F189 是防信任边界不一致，在 HTTP 与 MCP 等载体入口构建统一 OperationContext 接口，以进行单点化管控的上下文驾驶舱规范。

原 doc：`docs/features/F189-operation-context-unification.md`

---

## 评分 Rubric（按 charter §评分 Rubric，每篇独立评）

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅/❌ |
| 只答"这是什么" | hard | ✅/❌/⚠️ 边缘 |
| 不复述 H1 | hard | ✅/❌ |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅/❌（列出实际名词数）|
| 纯文本无前后缀 | hard | ✅/❌ |
| 读者视角 | soft | 1-5 |
| 核心隐喻 ≥ 1 | soft | ✅/❌（列出隐喻）|
| user problem hook | soft | ✅/❌（列出 hook）|
| 第三人称无 meta 表达 | soft | ✅/❌ |
| **nuance loss case** | qualitative | 文字描述哪些核心 nuance 丢了 |
| **index 可用度** | qualitative | 1-5，初次见这文档的猫看 description 是否会"想点开" |

**`evaluations/<cat-id>.md` 推荐格式**：每篇 sample 一段表格 + 一段 qualitative 评论；末尾给一段 cross-sample 观察（如：硬骨头 vs easy 差异 / fluff 词警报 / nuance loss 严重 case）。

---

## Step 3 完成后 → Step 4（aggregate + verdict）

汇总者：宪宪（@opus-47）。汇总后写 `aggregate.md` + `verdict.md`，trace 回 F243 AC-A4。
