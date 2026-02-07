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

注意: 只在需要异步协作时使用这些工具。普通回复直接输出即可。`;
}
