# F210 H4 AGY trajectory tool-call 渲染 + 卡片对齐 Implementation Plan

**Feature:** F210 — `docs/features/F210-antigravity-cli-migration.md`
**Goal:** 提取并渲染 AGY (antigravity-cli) 轨迹中的 tool call 步骤和运行大猫卡片，在 Cat Cafe 前端 UI 实现与 Claude/Codex 对齐的工具步骤可视化。
**Acceptance Criteria:**
1. **流式 tool_use/tool_result 提取**：在 `observeAgyProgress` 循环中，从 SQLite steps 的 `step_payload` 中通过 Protobuf 解码提取出 `CORTEX_STEP_TYPE_MCP_TOOL`/`CORTEX_STEP_TYPE_TOOL_CALL` 步骤的 toolName、toolCallId、Arguments 并在进程结束前实时 yield 为 `AgentMessage` 中的 `tool_use` 消息。
2. **大猫卡片渲染对齐**：通过流式 yield 活跃猫猫的 tool_use / tool_result，使前端自然绘出这只猫的大猫卡片（ bubble / card ）和工具列表面板。
3. **去重与时序安全**：对同一个 `toolCallId` 只会 yield 一次 `tool_use`；在对应 step 状态为 completed (3) 且已 yield `tool_use` 时，yield `tool_result`，绝不造成 UI 面板重复渲染或乱序。
4. **Fail-open 保护**：protobuf 解码保持 Fail-open 逻辑，解析出错或无 tool 字段时优雅跳过（回落到原本无 tool 卡片的行为），绝不阻断最终 plain text 吐出。
**Architecture cell:** `transport` / `providers`
**Map delta:** none
**Map delta why:** 纯局部 provider/trajectory 事件映射细节优化，不需要更新系统架构图。
**Architecture:** 
- 在 `agy-trajectory-extractor.ts` 中手写一个基于 Protobuf wire format length-delimited bytes 深度优先遍历（DFS）的工具步骤提取器。
- 修改 `agy-trajectory-observer.ts`，让 `observeAgyProgress` poll 数据时带上 `step_payload` 字段。
- 修改 `GeminiAgentService.ts`，在 trajectory 的 merge-loop 中实时消费 `tool_use` 与 `tool_result` 事件并按 toolCallId 进行去重 and 时序控制。
**Tech Stack:** TypeScript, better-sqlite3, Node.js
**前端验证:** Yes（验收时在 UI 上确认 `gemini25` 运行 `list_dir` 任务时出现暹罗猫大卡片，且 tool calls 被渲染为折叠面板）。

---

### Task 1: 扩展并测试 agy-trajectory-extractor

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/agy-trajectory-extractor.ts`
- Test: `packages/api/test/agy-trajectory-extractor.test.js`

**Step 1: 编写失败测试用例**
在 `packages/api/test/agy-trajectory-extractor.test.js` 中新增对 `parseAgyStepTools` 的测试，利用 mock 好的二进制 buffer 包含 known toolName、arguments json、uuid 或是 runCommand 字段，断言其正确提取工具详情。

**Step 2: 运行测试验证失败**
Run: `pnpm --filter api test test/agy-trajectory-extractor.test.js`
Expected: FAIL (因为 `parseAgyStepTools` 还未定义)

**Step 3: 编写最小实现代码**
在 `agy-trajectory-extractor.ts` 中定义 `parseAgyStepTools` 以及 `findLargestNonJsonString` 等 DFS 结构体。

**Step 4: 运行测试验证通过**
Run: `pnpm --filter api test test/agy-trajectory-extractor.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add packages/api/src/domains/cats/services/agents/providers/agy-trajectory-extractor.ts packages/api/test/agy-trajectory-extractor.test.js
git commit -m "feat(f210-h4): add tool step extraction from trajectory payload"
```

---

### Task 2: 更新 agy-trajectory-observer 透传 step_payload

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/agy-trajectory-observer.ts`
- Test: `packages/api/test/agy-trajectory-observer.test.js`

**Step 1: 修改测试断言**
修改 `agy-trajectory-observer.test.js` 断言，确保 `observeAgyProgress` 产出的 events 中带有 `payload` 属性。

**Step 2: 运行测试验证失败**
Run: `pnpm --filter api test test/agy-trajectory-observer.test.js`
Expected: FAIL

**Step 3: 实现 payload 传递**
修改 `AgyTrajectoryObserver.poll` 中的 SQL 查询语句，选择 `step_payload` 字段，并在 yield 时赋值给 `AgyProgressEvent.payload`。

**Step 4: 运行测试验证通过**
Run: `pnpm --filter api test test/agy-trajectory-observer.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add packages/api/src/domains/cats/services/agents/providers/agy-trajectory-observer.ts packages/api/test/agy-trajectory-observer.test.js
git commit -m "feat(f210-h4): propagate step_payload from SQLite through progress events"
```

---

### Task 3: 在 GeminiAgentService 消费工具调用并去重 yield

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`
- Test: `packages/api/test/gemini-agent-service.test.js`

**Step 2: 运行测试验证失败**
Run: `pnpm --filter api test test/gemini-agent-service.test.js`
Expected: FAIL

**Step 3: 实现工具消息流式 yield 与状态控制**
在 `invokeAntigravityCLI` 的 merge loop 内，读取 `progress.payload` 并使用 `parseAgyStepTools` 进行转换。通过 `yieldedToolCallIds: Set<string>` 与 `yieldedToolResults: Set<string>` 保证每个 toolCall 只有一个 `tool_use` 和完成时的 `tool_result` 被 yield。

**Step 4: 运行测试验证通过**
Run: `pnpm --filter api test test/gemini-agent-service.test.js`
Expected: PASS

**Step 5: Commit**
```bash
git add packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts packages/api/test/gemini-agent-service.test.js
git commit -m "feat(f210-h4): stream tool_use and tool_result messages during AGY run"
```

---

### Task 4: 最终集成测试与清理

**Step 1: 运行全量测试**
Run: `pnpm test`
Expected: PASS

**Step 2: 告知 CVO 并提请验收**
通知铲屎官代码落地，进入验收环节。
