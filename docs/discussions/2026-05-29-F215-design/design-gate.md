---
feature: F215
doc_kind: design-gate
date: 2026-05-29
participants: [opus-45, sonnet]
status: pending-cvo-signoff
---

# F215 Design Gate — Malformed Tool-Call Recovery

> 本文件记录 2026-05-29 F215 Phase A 取证完成后的 Design Gate 讨论。
> 待铲屎官醒来确认 OQ-2/OQ-3 后正式关闭。

---

## 背景速查

opus-4.8 在长 context 下 decoder 漂移，工具调用格式从 JSON tool_use 退化。
猫咖侧当前不识别错误，用户看到空返回（~40% session 撞，4/10 直接炸）。
根因在 Anthropic 模型侧（#49747），但 harness 可以补。

---

## Phase A 取证结论（✅ 已关闭 OQ-1）

### 两种 malformed 形式

**形式 B（text+XML，~57% of 4.8 samples）**

Stream 结构：
```
BLOCK_START type=thinking
BLOCK_STOP
BLOCK_START type=text      ← 错了，应该是 tool_use
text_delta: "...正文...\n\ncall\n<invoke name="Bash">"
text_delta: "\n<parameter name="command">...</parameter>\n</invoke>"
BLOCK_STOP
→ assistant event: content=[{type:"text", text:"...XML..."}]
```

**CC SDK 内部已有降级处理**：识别到 text+XML 不是 tool_use，通知模型格式错，模型下一轮自愈（多消耗 1 轮，无 synthetic error）。

真实样本：`cat-cafe-runtime/packages/api/data/cli-raw-archive/2026-05-28/c12569a2-b67e-4a86-92b3-e061a09567d0.ndjson`（lines 245-279）

---

**形式 A（thinking-only，~43% of 4.8 samples）**

Stream 结构：
```
BLOCK_START type=thinking
... thinking_delta ...
signature_delta
BLOCK_STOP
message_stop   ← 无 text 无 tool_use，直接结束
→ assistant event: content=[{type:"thinking"}]（only thinking）
→ JSONL: isApiErrorMessage:true, "could not be parsed (retry also failed)"
```

**CC SDK retry 也失败 → synthetic error**。模型无法自愈。

真实样本：`cat-cafe-runtime/packages/api/data/cli-raw-archive/2026-05-28/d137d9eb-c53f-4f18-90d6-822c784df8f5.ndjson`

---

### 关键架构发现（@sonnet peer review）

`transformClaudeEvent` 处理 CLI 已完成输出的 assistant event，此处 yield `{type:'tool_use'}` AgentMessage **只改前端展示，不触发工具执行**（工具执行在 CC SDK 内部，不走我们 yield 路径）。

→ **原 plan A 落点（transformClaudeEvent 转换）不是有效的治本路径**。

---

## 设计决策（@opus48 确认）

### 已确认项

| 决策 | 内容 |
|------|------|
| 架构归属 | `cats/agents/providers` + `cats/agents/invocation`，扩展现有逻辑 |
| 治本目标 | 形式 B（有 XML 可处理）；形式 A 只能兜底 |
| 兜底层 | seal → fresh-context retry（sessionId=undefined）→ 46 接力（已有 F118 框架可复用） |
| KD-3 不注入提示 | 根因是 decoder 漂移（手抖），注入提示无效 |
| 代理层 plan B 不用 | XML 在我们自己 stream 层可达，不碰圣域 |
| 转换器鲁棒性 | 禁止靠前缀词（call/court/直接）匹配，只靠 `<invoke name>/<parameter name>` 结构 |

---

### 待确认项（需铲屎官 + @opus48 拍板）

**OQ-2：统一检测方案（@opus48 提出，@sonnet 修正检测点后收敛）**

经过两轮 peer review，方案已基本收敛：

```
统一方案（B4，@opus48 提出 + @sonnet 修正检测点）：
  1. 删除 XML→tool_use 转换（KD-5：转换不能让工具执行，死路）
  2. 形式 A 检测点：textEventCount === 0（ClaudeAgentService L594 已有 warn log）
     → 触发 seal + fresh-context retry（sessionId=undefined）+ 46接力兜底
  3. 形式 B：依赖 CC SDK 已有降级（4.7 自愈确认；4.8 archive 无真实失败样本）
     可选：检测 assistant text 含 <invoke name= 模式，也触发 seal+fresh 作为保险

注意：
  - "could not be parsed" 字符串在 stream 层无独立信号，不用检测（KD-6）
  - 4.8 主要是形式 A，统一方案的核心就是处理 textEventCount===0（KD-4 修正）
  - fresh retry 通过改变 context 长度改变触发概率（OQ-1 形式 A 根因确认）
```

⬜ 铲屎官确认方向后关闭 OQ-2？（技术细节两猫已收敛，等 CVO 拍板方向）

---

**OQ-3：46 接力前端展示形态**

@opus48 设计自决：发两条消息——(1) 系统通知 "🙀 opus-4.8 炸毛，opus-4.6 接棒中…" ；(2) 46 自己身份回复。

铲屎官确认这个形态？还是有其他偏好？

---

## 实现路线图（OQ-2/OQ-3 拍板后更新）

```
Phase A ✅ → Phase C（兜底，依赖 F118）→ Phase B（治本，取决于 OQ-2）→ Phase D（体验）
```

Phase C（兜底）可以不等 OQ-2 先做——兜底层无论 OQ-2 怎么拍都需要。
Phase B（治本）等 OQ-2 确认落点后再开工。

---

## 审美自检（元审美）

- 治本 = 坐标变换（修复 malformed 使其变为有效输入）✅
- 兜底 = 安全网（治本够不着时接住）✅
- 两层边界清晰，不堆 fallback ✅
- 不碰圣域（代理层）✅
- 不区别对待 opus-4.8（W1 Agent Quality）✅

---

*@sonnet 2026-05-29 | 等铲屎官醒后关闭 OQ-2/OQ-3*
