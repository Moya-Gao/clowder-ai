# Bug Report: Resume 后旧内容重复发送（跨猫复查版）

> **报告人**: 铲屎官
> **定位猫猫**: 缅因猫 🐾
> **复查范围**: 布偶猫 / 缅因猫 / 暹罗猫
> **报告日期**: 2026-02-09
> **严重程度**: P1（功能异常 + token 膨胀 + 对话质量下降）
> **状态**: 待修复（已完成跨猫复查）

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：恢复布偶猫 CLI 会话（resume）后，观察到“以前内容被多次重复发送”

---

## 2. 复现步骤（期望 vs 实际）

### 复现步骤

1. 恢复同一只猫的 CLI 会话（resume）。
2. 在同一 thread 连续发送 3~4 条消息。
3. 观察 prompt 中的历史块（尤其是 `[对话历史 - 最近 N 条]`）。

### 期望行为

- 每轮只注入必要增量历史，不重复回放旧包。
- 历史上下文增长应近似线性。

### 实际行为

- 旧历史在后续轮次反复出现。
- 历史块可出现“包中包”式重复，导致膨胀。
- 用户体感为“以前内容在重复发送”。

---

## 3. 根因分析（含三猫复查）

### 3.1 代码链路复查结论

| 猫猫 | 是否使用 resume | 是否使用 Context prepend | 结论 |
|---|---|---|---|
| 布偶猫（Opus / Claude） | 是（`--resume`） | 是 | **高风险，已出现用户报告现象** |
| 缅因猫（Codex） | 是（`exec resume`） | 是 | **同机制高风险（未见本次用户直接报案，但链路一致）** |
| 暹罗猫（Gemini） | 否（当前默认不走 `--resume`） | 是 | **不属于同一主因路径，风险低于前两者** |

证据点：
- Opus resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/ClaudeAgentService.ts:162`
- Codex resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/CodexAgentService.ts:115`
- Gemini 不走 resume：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/GeminiAgentService.ts:153`
- 三猫统一 prepend 历史：`/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/route-strategies.ts:137`

### 3.2 根因结论

本问题的主因不是“单一猫异常”，而是**架构层双通道上下文叠加且缺少去重边界**：

- 通道 A：Agent CLI resume 带入会话历史（Opus/Codex）。
- 通道 B：服务端每轮再 prepend 最近历史（三猫统一）。
- 当历史文本中已含历史包装结构时，下一轮又被当普通消息拼回去，形成重复放大。

补充：
- 该行为在设计文档里曾被视作“可接受重复”（依赖模型自去重），见：
  `/Users/lysander/projects/relay-station/cat-cafe/docs/phases/phase-3.6-debt-cleanup.md:372`
- 现网表现说明这个假设对 Opus/Codex 不成立或不稳定。

---

## 4. 修复方案（建议）

### 4.1 P0（止血）

对 **Opus/Codex**：当本轮存在 `sessionId`（即 resume 生效）时，不再注入全量 `[对话历史 - 最近 N 条]`。

- 可选折中：仅注入跨猫增量历史，避免丢失协作可见性。

### 4.2 P1（长期）

在 ContextAssembler 前增加“历史 envelope 清洗/去重”：

- 识别并剥离历史包装头与重复分隔块；
- 防止历史块被递归写入后再次拼装。

### 为什么这样改

- P0 直接切断 Opus/Codex 的“resume + prepend 双叠加”。
- P1 提供系统兜底，不再依赖模型“自动 dedupe”。

### 放弃方案

- 全局禁用 resume：损失会话连续性与 token 效益，不推荐。

---

## 5. 验证方式

### 已完成复查（本次）

- 代码复查：完成三猫链路核对（见上方证据路径）。
- 测试复查：执行

```bash
pnpm -C packages/api build && cd packages/api && node --test test/claude-agent-service.test.js test/codex-agent-service.test.js test/gemini-agent-service.test.js
```

结果：41/41 通过，确认三猫当前 resume/非 resume 行为符合代码结论。

### 修复后验收（必须）

1. Opus resume 连续 4 轮：历史块不重复膨胀。
2. Codex resume 连续 4 轮：同上。
3. Gemini 连续 4 轮：保持现有行为，不引入回归。
4. 新增集成断言：prompt 中历史 header 最多 1 次，长度增长近似线性。

---

## 6. 结论

你说得对，这不是“只有布偶猫有问题”的报告口径。更准确是：

- **Opus + Codex：同一主因链路，高风险；**
- **Gemini：当前不走 resume，不属于同级主因。**

本报告已按三猫复查结果修订。

---

*签名: 缅因猫 🐾*
