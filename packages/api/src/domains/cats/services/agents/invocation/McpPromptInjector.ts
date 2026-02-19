/**
 * MCP Prompt Injector
 * 给没有原生 MCP 支持的猫 (Codex/Gemini) 注入 HTTP callback 指令。
 * Claude 通过 --mcp-config 原生支持 MCP，不需要注入。
 *
 * 注入后，猫可以通过 curl 调用 post-message / thread-context / pending-mentions / update-task。
 * 凭证来自环境变量 CAT_CAFE_INVOCATION_ID + CAT_CAFE_CALLBACK_TOKEN (由 invokeSingleCat 设置)。
 * 风险: Codex/Gemini 的沙箱可能阻止 curl 出站调用，但注入本身无害。
 */

import type { CatId } from '@cat-cafe/shared';

export interface McpCallbackOptions {
  apiUrl: string;
}

/**
 * Check if a cat needs MCP prompt injection (no native MCP support).
 * Claude (opus) has native MCP via --mcp-config; others need HTTP callback injection.
 */
export function needsMcpInjection(catId: CatId | string): boolean {
  return catId !== 'opus';
}

/**
 * Generate MCP callback instructions for cats without native MCP support.
 *
 * Credentials reference env vars ($CAT_CAFE_INVOCATION_ID, $CAT_CAFE_CALLBACK_TOKEN)
 * which are set by invokeSingleCat when spawning the CLI subprocess.
 *
 * Endpoint paths match the actual routes in callbacks.ts:
 * - POST /api/callbacks/post-message    (auth in body)
 * - GET  /api/callbacks/thread-context  (auth in query)
 * - GET  /api/callbacks/pending-mentions (auth in query)
 * - POST /api/callbacks/update-task     (auth in body)
 */
export function buildMcpCallbackInstructions(opts: McpCallbackOptions): string {
  return `## 可用工具 (HTTP 回调)

你可以通过 HTTP 请求使用以下工具来与团队协作。
凭证已通过环境变量提供: \`$CAT_CAFE_INVOCATION_ID\` 和 \`$CAT_CAFE_CALLBACK_TOKEN\`。

### 发送消息给团队
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/post-message \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"content\\": \\"你的消息\\"
  }"
\`\`\`

### 获取对话上下文
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/thread-context?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN"
\`\`\`

### 获取待处理的 @提及
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/pending-mentions?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN"
\`\`\`

### 更新任务状态
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/update-task \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"taskId\\": \\"任务ID\\",
    \\"status\\": \\"doing\\"
  }"
\`\`\`

### 检索项目证据（Hindsight Recall）
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/search-evidence?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&q=你的查询&limit=5&budget=mid&tags=project:cat-cafe"
\`\`\`

### 项目反思（Hindsight Reflect）
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/reflect \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"query\\": \\"你的反思问题\\"
  }"
\`\`\`

### 沉淀长期记忆（Hindsight Retain）
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/retain-memory \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"content\\": \\"可长期复用的结论\\",
    \\"tags\\": [\\"project:cat-cafe\\", \\"source:codex\\"],
    \\"metadata\\": {\\"anchor\\": \\"docs/decisions/...\\", \\"confidence\\": \\"high\\"}
  }"
\`\`\`

### 请求权限（执行危险操作前必须调用）
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/request-permission \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"action\\": \\"git_commit\\",
    \\"reason\\": \\"提交 bug 修复\\"
  }"
\`\`\`
返回 \`{"status":"granted"}\` / \`{"status":"denied"}\` / \`{"status":"pending","requestId":"..."}\`。
如果返回 pending，用 requestId 轮询查询状态。

### 查询权限审批状态
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/permission-status?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&requestId=请求ID"
\`\`\`

### 创建富消息块
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/create-rich-block \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"invocationId\\": \\"$CAT_CAFE_INVOCATION_ID\\",
    \\"callbackToken\\": \\"$CAT_CAFE_CALLBACK_TOKEN\\",
    \\"block\\": {
      \\"id\\": \\"唯一ID\\",
      \\"kind\\": \\"card\\",
      \\"v\\": 1,
      \\"title\\": \\"标题\\",
      \\"bodyMarkdown\\": \\"内容\\",
      \\"tone\\": \\"info\\"
    }
  }"
\`\`\`
支持的 kind: card（卡片）、diff（代码变更）、checklist（检查清单）、media_gallery（图片集）。
当 HTTP 回调不可用时，可在回复中嵌入文本格式的富消息块作为备选：
\\\`\\\`\\\`cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"标题","tone":"info"}]}
\\\`\\\`\\\`

### 富消息块使用规则（B 风格：平衡）

**核心原则**：结构化信息默认用富块，普通对话不用。先写 1-2 句自然语言摘要，再发富块。

**何时使用**（默认触发）：
- **card** (tone: info/success/warning/danger)
  - review 结论（P1/P2 列表 + 放行/阻塞决策）
  - 任务/阶段状态报告（当前进度、关键指标）
  - 决策摘要（What/Why/Tradeoff）
  - 游戏状态面板（角色信息、回合状态）
- **diff**
  - 代码修改建议（具体的补丁片段）
  - 重构前后对比
- **checklist**
  - 待办事项 / 下一步行动
  - review 要点清单
  - 验证步骤 / 测试计划
- **media_gallery**
  - 截图、设计稿展示
  - 多图对比

**何时不用**（保持纯文本）：
- 日常聊天、闲聊、打招呼
- 简短回答（一两句话能说清的）
- 提问和讨论（除非需要结构化选项）
- 不确定用哪种 → 不用

**字段要求**：
- 每个 block 必须有唯一 \`id\`（如 "b1"/"b2"）和 \`v: 1\`
- card: \`title\` 必填，\`bodyMarkdown\`/\`tone\`/\`fields\` 可选
- diff: \`filePath\` + \`diff\` 必填，\`languageHint\` 可选
- checklist: \`items\` 必填（每项需 \`id\` + \`text\`），\`title\` 可选
- media_gallery: \`items\` 必填（每项需 \`url\`），\`title\`/\`alt\`/\`caption\` 可选

**优先使用 HTTP 回调**创建富块（更可靠）。当 HTTP 不可用时，用 cc_rich 文本备选。

注意: 只在需要异步协作时使用这些工具。普通回复直接输出即可。`;
}
