/**
 * MCP Prompt Injector
 * 给没有原生 MCP 支持的猫 (Codex/Gemini) 注入 HTTP callback 指令。
 * Claude 通过 --mcp-config 原生支持 MCP，不需要注入。
 *
 * 注入后，猫可以通过 curl 调用 post_message / get_thread_context / get_pending_mentions。
 * 风险: Codex/Gemini 的沙箱可能阻止 curl 出站调用，但注入本身无害。
 */

import type { CatId } from '@cat-cafe/shared';

export interface McpCallbackOptions {
  apiUrl: string;
  threadId: string;
  catId: string;
  invocationId?: string;
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
 * Returns a prompt section with curl examples for each callback endpoint.
 */
export function buildMcpCallbackInstructions(opts: McpCallbackOptions): string {
  const invHeader = opts.invocationId
    ? `  -H "X-Invocation-Id: ${opts.invocationId}" \\`
    : '';

  return `## 可用工具 (HTTP 回调)

你可以通过 HTTP 请求使用以下工具来与团队协作:

### 发送消息给团队
\`\`\`bash
curl -X POST ${opts.apiUrl}/api/callbacks/post_message \\
  -H "Content-Type: application/json" \\
${invHeader}
  -d '{"content": "你的消息", "threadId": "${opts.threadId}"}'
\`\`\`

### 获取对话上下文
\`\`\`bash
curl ${opts.apiUrl}/api/callbacks/get_thread_context \\
${invHeader}
  -G -d "threadId=${opts.threadId}"
\`\`\`

### 获取待处理的 @提及
\`\`\`bash
curl ${opts.apiUrl}/api/callbacks/get_pending_mentions \\
${invHeader}
  -G -d "catId=${opts.catId}"
\`\`\`

注意: 只在需要异步协作时使用这些工具。普通回复直接输出即可。`;
}
