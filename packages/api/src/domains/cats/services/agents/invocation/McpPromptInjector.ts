/**
 * MCP Prompt Injector
 * 给没有原生 MCP 支持的猫 (Codex/Gemini) 注入 HTTP callback 指令。
 * Claude 通过 --mcp-config 原生支持 MCP，不需要注入。
 *
 * Skills-as-source-of-truth: Full API docs live in
 *   cat-cafe-skills/using-mcp-callbacks/SKILL.md
 * Prompt injection is minimal: credentials + tool list + skill reference.
 * HTTP endpoints preserved as fallback only.
 */

export interface McpCallbackOptions {
  /**
   * Example unique handle to show in documentation snippets.
   * Must be routable (e.g. `@codex`, `@opus-45`), not a placeholder like `@catId`.
   */
  exampleHandle?: string;
  /**
   * Current cat id for choosing a non-self @mention example.
   * When present with teammates, we will prefer a teammate handle in examples.
   */
  currentCatId?: string;
  /**
   * Teammate cat ids that are safe to demonstrate in @mention examples.
   * Should NOT include the current cat id; if it does, it will be ignored.
   */
  teammates?: readonly string[];
}

/**
 * Check if a cat needs MCP prompt injection (no native MCP support).
 * Cats with mcpSupport=true (e.g. Claude variants) use --mcp-config natively;
 * all others need HTTP callback injection.
 */
export function needsMcpInjection(mcpSupport: boolean): boolean {
  return !mcpSupport;
}

function resolveExampleHandle(opts: McpCallbackOptions): string {
  return opts.exampleHandle
    ?? (() => {
      const teammate = opts.teammates?.find((id) => id && id !== opts.currentCatId);
      return teammate ? `@${teammate}` : '@opus';
    })();
}

/**
 * Build MCP callback instructions for prompt injection.
 * Minimal: @teammate rules + credentials + tool list + skill reference.
 * Full API docs are in the `using-mcp-callbacks` skill (loaded on demand).
 */
export function buildMcpCallbackInstructions(opts: McpCallbackOptions): string {
  const exampleHandle = resolveExampleHandle(opts);
  return `## 协作方式

### @队友（最常用！推荐方式）
想 @其他猫？**直接在你的回复文本里另起一行、行首写 \`@猫名\`**。
系统会自动检测并触发 A2A 协作，免费、永不过期。
同族多分身时用**唯一句柄**（例如 \`${exampleHandle}\`）避免歧义。
✅ 正确：回复末尾另起一行写 \`${exampleHandle} 请帮我 review\`
❌ 错误：用 curl 调 post-message 只是为了 @ 队友（token 会过期！）

### HTTP 回调工具（异步场景）
凭证: \`$CAT_CAFE_INVOCATION_ID\` + \`$CAT_CAFE_CALLBACK_TOKEN\`（环境变量）
可用工具: post-message / thread-context / pending-mentions / update-task / create-rich-block / search-evidence / reflect / retain-memory / request-permission
需要 curl 示例和完整用法，加载 \`using-mcp-callbacks\` skill。
Skill 不可用时，GET \`$CAT_CAFE_API_URL/api/callbacks/instructions\` 获取同等文档。
需要富消息块规范，加载 \`using-rich-blocks\` skill（fallback: GET \`$CAT_CAFE_API_URL/api/callbacks/rich-block-rules\`）。

注意: 只在需要异步协作时使用。普通回复直接输出即可。`;
}
