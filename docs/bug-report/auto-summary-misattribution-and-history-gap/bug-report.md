# Bug Report: 自动纪要归属混淆 + 历史不可见 + 内容片段化

> **报告人**: 铲屎官（前端 UI 观察）
> **定位猫猫**: 缅因猫 🐾
> **报告日期**: 2026-02-10
> **严重程度**: P1 + P2
> **状态**: 待修复

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：在真实聊天中看到“自动纪要”卡片内容与上下文不完全一致，且出现“像是布偶猫写的”归属争议；并反馈“这个纪要似乎只有我前端看得到”。

---

## 2. 复现步骤（期望 vs 实际）

### 问题 A（P1）：自动纪要创建者归属误导（看起来总是布偶猫）

1. 在同一 thread 内进行多轮对话（超过自动纪要阈值）。
2. 等待系统触发自动纪要卡片。
3. 观察卡片 footer 的创建者。

期望：
- 自动纪要应标识为“系统/自动纪要”，或明确的真实来源，不应伪装成某只猫的主观发言。

实际：
- 自动纪要 `createdBy` 固定为 `opus`，UI 显示为“布偶猫”，造成“是不是布偶写的”混淆。

### 问题 B（P1）：自动纪要在消息历史中不可回放（仅依赖实时推送）

1. 自动纪要产生后，在当前页面可见纪要卡片。
2. 刷新页面，或在另一个会话/标签页进入同 thread。
3. 触发历史加载。

期望：
- 纪要应作为 thread 历史的一部分被稳定回放（至少可从统一历史接口拿到并渲染）。

实际：
- `GET /api/messages` 仅返回 user/assistant 消息，不返回 summary。
- 前端历史加载仅消费 `/api/messages`，因此 summary 卡片不被回填。
- 结果表现为“当时看见了，回头不一定看得见”。

### 问题 C（P2）：自动纪要内容片段化、时间窗口不对齐

1. 在 thread 内先进行若干闲聊，再进入新话题。
2. 达到自动纪要触发条件后查看结论条目。

期望：
- 纪要应主要反映“最近一个讨论窗口”的关键结论与待讨论项。

实际：
- 纪要 topic 取“全线程第一条较长猫消息”。
- 内容抽取用粗粒度正则 + 最近 10 条猫消息切句，容易摘出跨话题片段，形成“只摘前几轮/摘得不完整”的观感。

---

## 3. 根因分析（定位过程）

### 3.1 归属误导的直接根因

- `packages/api/src/domains/cats/services/AutoSummarizer.ts:14` 将自动纪要创建者常量写死为 `createCatId('opus')`。
- `packages/api/src/domains/cats/services/AutoSummarizer.ts:104` 创建 summary 时直接使用该常量。

根因结论：
- 自动纪要是“系统行为”，但数据模型将其伪装成了“布偶猫个人发言”。

### 3.2 “只有前端看得到”现象的直接根因

- 实时链路：`thread_summary` 事件通过 WS 推送，前端收到后仅做本地 `addMessage` 注入：
  - `packages/web/src/components/ChatContainer.tsx:134`
- 历史链路：`GET /api/messages` 只读 messageStore，并仅映射 user/assistant：
  - `packages/api/src/routes/messages.ts:371`
  - `packages/api/src/routes/messages.ts:382`
- 前端历史加载也只消费 `/api/messages`，并将类型硬转为 `user|assistant|system`：
  - `packages/web/src/hooks/useChatHistory.ts:61`
  - `packages/web/src/hooks/useChatHistory.ts:71`

根因结论：
- summary 存在独立存储/推送通道，但未并入“统一历史回放通道”，导致实时可见与历史可见不一致。

### 3.3 内容片段化与时间窗口错位根因

- 已计算 `newMessages`（相对上次 summary 的增量），但真正提取时仍传入 `messages` 全量：
  - `packages/api/src/domains/cats/services/AutoSummarizer.ts:50`
  - `packages/api/src/domains/cats/services/AutoSummarizer.ts:54`
- topic 固定取首条猫消息：
  - `packages/api/src/domains/cats/services/AutoSummarizer.ts:75`
- 提取规则为关键词匹配 + 切句，且窗口仅 `slice(-10)`：
  - `packages/api/src/domains/cats/services/AutoSummarizer.ts:79`
  - `packages/api/src/domains/cats/services/AutoSummarizer.ts:85`

根因结论：
- 触发门槛按“增量”判断，但抽取内容按“全量 + 窄窗口 + 粗规则”执行，语义窗口不一致，容易跨话题漂移。

---

## 4. 修复方案（为什么这样选）

### 方案 A（P1，必须）

1. 为 summary `createdBy` 引入 `system`（或 `auto`）枚举值，UI 显示“系统纪要”。
2. 禁止将自动纪要伪装成任意单只猫身份。

Why：
- 先修“归属真实性”，避免继续制造协作信任噪音。

Tradeoff：
- 需要改 shared type / route schema / UI 映射，多文件联动，但改动面可控。

### 方案 B（P1，必须）

1. 统一历史回放：让 summary 进入历史查询路径（推荐后端聚合消息+summary 后按时间排序返回）。
2. 前端停止只靠 WS 临时注入；刷新后应回放同样内容。

Why：
- “实时可见、刷新消失”是数据一致性缺陷，不只是 UI 问题。

Tradeoff：
- 后端聚合会增加接口复杂度；若先前端双请求合并，可更快落地但会引入客户端排序/去重复杂性。

### 方案 C（P2，建议）

1. `extractSummary` 仅对 `newMessages` 做抽取，topic 也从增量窗口首条生成。
2. 关键词规则升级为“去重 + 最小语义块”并限制跨话题污染。

Why：
- 让抽取窗口与触发窗口一致，减少“摘旧话/摘残句”。

Tradeoff：
- 规则仍是 heuristic，不会达到 LLM 级语义总结质量，但成本低、可先止血。

Open Questions：
- 是否需要把自动纪要与手动纪要在 UI 上视觉区分（标签/颜色/tooltip）？
- `/api/messages` 是否要承担跨实体聚合，还是新增 `/api/timeline` 专门承载混合时间线？

Next Action：
- 由布偶猫优先实现 P1（A+B），缅因猫按 Red→Green 补测试与复审；P2（C）同迭代收敛，避免继续积压。

---

## 5. 验证方式（Red → Green）

### Red（先打红）

1. 新增 `AutoSummarizer` 单测：
   - 断言自动纪要 `createdBy` 不应冒充 `opus`。
   - 断言抽取窗口仅使用增量消息。
2. 新增历史回放集成测试：
   - 触发自动纪要后，刷新/重进 thread，历史接口仍能拿到 summary 并渲染。
3. 新增回归测试：
   - 多轮跨话题消息下，summary topic 与 conclusions 不应回退到最早轮次。

### Green（通过门槛）

1. 以上新增测试全部转绿。
2. 手工验证：
   - 同一 thread 在两个页面打开：一个页面触发纪要，另一个页面刷新后仍可见同条纪要。
   - 纪要创建者显示“系统纪要”（或等效中立身份），不再误导为布偶猫个人发言。

