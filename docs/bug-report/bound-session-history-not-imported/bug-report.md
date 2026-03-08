---
feature_ids: [F081, F033]
topics: [bind, session, transcript, history, continuity]
doc_kind: bug-report
created: 2026-03-07
---

# Bug Report: Bound Session 只能接管未来，不能回灌过去历史

> **报告人**: 铲屎官（真实使用 + Codex app bind 现场）
> **定位猫猫**: 缅因猫/砚砚
> **报告日期**: 2026-03-07
> **严重程度**: P1
> **状态**: 调查完成，待定方案

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：将一只已经在 `Codex app` 内持续对话的大猫猫手动 bind 进猫猫咖啡后，发现主区可以继续和它对话，但此前在 app 里已经存在的聊天历史并没有出现在主区。

---

## 2. 复现步骤（期望 vs 实际）

1. 在外部 `Codex app` 或 CLI 中，让某只猫已经产生一段可见聊天历史。
2. 记下该会话的 thread/session id。
3. 在猫猫咖啡中，对同一个 thread 使用“绑定外部 Session”入口，提交该 id。
4. 回到主聊天区或重新进入该 thread。

期望：
- bind 成功后，猫猫咖啡不只能够继续 `resume` 这只猫，主区还应能看到这只猫在外部会话里已经说过的话，至少做到“历史回灌一致”。

实际：
- bind 成功后，后续可以继续驱动这只猫。
- 但主区历史仍只显示猫猫咖啡自身 `messageStore` 里原本有的消息。
- 外部会话里已经存在的历史内容，没有被导入主区时间线。

---

## 3. 根因分析（定位过程）

### 3.1 `bind` 只写 session chain，不写消息历史

- `PATCH /api/threads/:threadId/sessions/:catId/bind` 只接收并写入 `cliSessionId`，更新目标是 `sessionChainStore`。
- 这条路径没有任何 `messageStore.append(...)` 或 transcript import 逻辑。

证据：
- [session-chain.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/routes/session-chain.ts#L166)

根因结论：
- bind 的当前语义是“把未来 resume 的控制权接过来”，不是“把过去历史带过来”。

### 3.2 后续 invoke 会消费绑定的 `cliSessionId`，但只影响未来

- `invokeSingleCat()` 会把 active session record 中的 `cliSessionId` 当成权威值。
- 这使得 bind 后的下一次调用可以 `--resume` 外部会话。

证据：
- [invoke-single-cat.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts#L270)

根因结论：
- bind 解决的是“以后从哪条 session 继续跑”，不是“以前已经发生过什么”。

### 3.3 主区历史的真相源不是 transcript，而是 `messageStore + draftStore`

- `GET /api/messages` 只读取 `messageStore`，并在首页追加 `draftStore` 活动草稿。
- 该路径不读取 `sessionChainStore`，也不读取 `TranscriptReader`。

证据：
- [messages.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/routes/messages.ts#L654)

根因结论：
- 前端主区不是“看到 session 就能看历史”，而是“看到 `/api/messages` 给的时间线”。

### 3.4 transcript 读取能力存在，但属于另一套只读诊断通道

- 我们确实有 transcript 读取 API，但那是 `GET /api/sessions/:sessionId/events|digest|invocations/...`。
- 这条通道是给审计/查看 sealed session 用的，不会自动并入主区消息时间线。

证据：
- [session-transcript.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/routes/session-transcript.ts#L1)
- [TranscriptReader.ts](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/api/src/domains/cats/services/session/TranscriptReader.ts#L1)

根因结论：
- “能读 transcript” 不等于 “主区会显示 transcript”。

### 3.5 前端 bind UI 也只做了第一步，没有第二步“导入历史”

- 前端的 bind 入口只会提交 `cliSessionId` 到 bind API。
- 没有后续“触发 backfill/import/rebuild timeline”的动作。

证据：
- [BindNewSessionSection.tsx](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/web/src/components/BindNewSessionSection.tsx)
- [SessionChainPanel.tsx](/Users/lysander/projects/relay-station/cat-cafe-f081-bind-history-import/packages/web/src/components/SessionChainPanel.tsx)

根因结论：
- 现有产品流允许“绑进来一只会继续说话的猫”，但不保证“把它已经说过的话带进来”。

### 根因总结

这不是单纯的 Redis 丢数据，也不只是前端少渲染一条消息。

真正的问题是三套东西没有接桥：

1. `sessionChainStore.cliSessionId`：负责未来 resume
2. `messageStore + draftStore`：负责主区历史
3. transcript/jsonl：负责外部或 sealed session 的历史证据

现在 bind 只连上了第 1 套，没有把第 3 套回灌到第 2 套。

---

## 4. 修复方案（为什么这样选）

### 方案 A：bind 时同步做一次历史 backfill

做法：
- `PATCH .../bind` 成功后，立即从可用 transcript/jsonl 读取既有历史。
- 归一化成猫猫咖啡的 assistant/user timeline 后写入 `messageStore`。

优点：
- 用户心智最直观，bind 完就看到历史。

代价：
- bind 会变成重操作。
- 需要定义幂等、去重和“导入失败但 bind 成功”的语义。

### 方案 B：bind 只登记，首次进入 thread 时 lazy backfill

做法：
- bind 仍只写 session chain。
- 当主区发现 thread 里有 bound session 但缺历史时，显式调用导入接口或触发后端懒导入。

优点：
- bind API 保持轻量。
- 更容易做“先显示 thread，再补历史”的渐进体验。

代价：
- 产品行为会变成两阶段。
- 需要额外前后端握手与 debug 证据。

### 方案 C：不导入 `messageStore`，主区按需混合读取 transcript

做法：
- 前端时间线不是只读 `/api/messages`，而是再混读 transcript 视图。

放弃原因：
- 会制造双真相源。
- 排序、去重、未读、引用回复、导出、删除恢复都会变复杂。

### 当前建议

优先考虑 **方案 B**：
- 先把“外部会话历史导入到 `messageStore`”做成一个明确、可观测、可重试的 backfill 动作。
- bind 本身仍只负责控制权。
- 主区在识别到“已 bind 但无历史”时触发或提示 backfill。

理由：
- 更符合我们现在的分层，不会让 bind API 过载。
- 也更容易把导入过程记进 F081 的可观测性时间线。

---

## 5. 验证方式（Red → Green）

### Red（先打红）

1. 新增 API/集成测试：
   - 给 thread 绑定一个已知外部 session id。
   - 模拟存在可读取的 transcript/jsonl。
   - 验证当前 `/api/messages` 仍然拿不到既有历史。

2. 新增前端回归：
   - bind 成功后，主区不会自动看到过去历史。
   - 直到显式 backfill/import 后，主区才补齐。

### Green（修复通过）

1. bind 后或首次进入 thread 后，既有外部历史会稳定进入主区时间线。
2. 再次刷新/切线程后，这些导入消息仍可通过 `/api/messages` 回放。
3. debug 证据能明确显示：
   - 这是外部历史导入，而不是 live socket 新生成
   - 本次导入的来源、条数、是否去重、是否失败

### 回归保护

1. 已有 F081 的 replace hydration 修复不回退。
2. 已有 F33 的 bind-overwrite 修复不回退。
3. 导入后的消息不会和后续 live resume 产出的新消息重复成双胞胎。
