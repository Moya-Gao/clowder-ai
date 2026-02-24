/**
 * MCP Prompt Injector
 * 给没有原生 MCP 支持的猫 (Codex/Gemini) 注入 HTTP callback 指令。
 * Claude 通过 --mcp-config 原生支持 MCP，不需要注入。
 *
 * F-BLOAT: Split into full (first turn) and short (resume) forms.
 * - Full: complete curl examples for all endpoints (~3100 chars)
 * - Short: @teammate rules + tool list + credential refs (~400 chars)
 *
 * Full API reference also served on-demand via GET /api/callbacks/instructions
 */

export interface McpCallbackOptions {
  apiUrl: string;
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
 * F-BLOAT: Short-form MCP callback instructions for resume turns.
 * Only @teammate rules + tool list + credential reference.
 * Full API docs available via GET /api/callbacks/instructions.
 */
export function buildMcpCallbackInstructionsShort(opts: McpCallbackOptions): string {
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
完整 API 文档: \`curl ${opts.apiUrl}/api/callbacks/instructions\`

注意: 只在需要异步协作时使用。普通回复直接输出即可。`;
}

/**
 * Full-form MCP callback instructions (first turn of session).
 * Includes complete curl examples for all endpoints.
 */
export function buildMcpCallbackInstructions(opts: McpCallbackOptions): string {
  const exampleHandle = resolveExampleHandle(opts);
  return `## 协作方式

### @队友（最常用！推荐方式）
想 @其他猫？**直接在你的回复文本里另起一行、行首写 \`@猫名\`**。
系统会自动检测并触发 A2A 协作，免费、永不过期。
同族多分身时：默认 \`@显示名\`，其它用**唯一句柄**（例如 \`${exampleHandle}\`）。
同名队友并存时，请使用**唯一句柄**（例如 \`${exampleHandle}\`）避免歧义。
✅ 正确：回复末尾另起一行写 \`${exampleHandle} 请帮我 review\`
❌ 错误：用 curl 调 post-message 只是为了 @ 队友（token 会过期！）

### HTTP 回调工具（异步/高级场景）
以下 curl 命令用于**任务中途主动汇报进度、创建富消息块、更新任务状态、请求权限**等需要 MCP 语义的场景。
⚠️ 凭证有生命周期限制（约 10 分钟），简单 @队友请用上面的文本方式。

凭证已通过环境变量提供: \`$CAT_CAFE_INVOCATION_ID\` 和 \`$CAT_CAFE_CALLBACK_TOKEN\`。

### 发送异步消息（任务中途汇报进度时用）
\`\`\`bash
MSG='你的消息'
curl -sS -X POST ${opts.apiUrl}/api/callbacks/post-message \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    --arg c "$MSG" \\
    '{invocationId:$i,callbackToken:$t,content:$c}')"
\`\`\`
用 \`jq\` 构建 JSON 可避免引号转义错误。**不要手动拼 JSON 字符串！**

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
curl -sS -X POST ${opts.apiUrl}/api/callbacks/update-task \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    --arg tid "任务ID" --arg s "doing" \\
    '{invocationId:$i,callbackToken:$t,taskId:$tid,status:$s}')"
\`\`\`

### 检索项目证据（Hindsight Recall）
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/search-evidence?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&q=你的查询&limit=5&budget=mid&tags=project:cat-cafe"
\`\`\`

### 项目反思（Hindsight Reflect）
\`\`\`bash
curl -sS -X POST ${opts.apiUrl}/api/callbacks/reflect \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    --arg q "你的反思问题" \\
    '{invocationId:$i,callbackToken:$t,query:$q}')"
\`\`\`

### 沉淀长期记忆（Hindsight Retain）
\`\`\`bash
curl -sS -X POST ${opts.apiUrl}/api/callbacks/retain-memory \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    --arg c "可长期复用的结论" \\
    '{invocationId:$i,callbackToken:$t,content:$c,tags:["project:cat-cafe"],metadata:{confidence:"high"}}')"
\`\`\`

### 请求权限（执行危险操作前必须调用）
\`\`\`bash
curl -sS -X POST ${opts.apiUrl}/api/callbacks/request-permission \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    --arg a "git_commit" --arg r "提交 bug 修复" \\
    '{invocationId:$i,callbackToken:$t,action:$a,reason:$r}')"
\`\`\`
返回 \`{"status":"granted"}\` / \`{"status":"denied"}\` / \`{"status":"pending","requestId":"..."}\`。
如果返回 pending，用 requestId 轮询查询状态。

### 查询权限审批状态
\`\`\`bash
curl "${opts.apiUrl}/api/callbacks/permission-status?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&requestId=请求ID"
\`\`\`

### 创建富消息块
\`\`\`bash
curl -sS -X POST ${opts.apiUrl}/api/callbacks/create-rich-block \\
  -H 'Content-Type: application/json' \\
  -d "$(jq -nc \\
    --arg i "$CAT_CAFE_INVOCATION_ID" \\
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \\
    '{invocationId:$i,callbackToken:$t,block:{id:"b1",kind:"card",v:1,title:"标题",bodyMarkdown:"内容",tone:"info"}}')"
\`\`\`
⚠️ 字段名是 "kind"（不是 "type"！），必须有 "v": 1。
支持: card / diff / checklist / media_gallery / audio。
富消息块完整规范: \`curl ${opts.apiUrl}/api/callbacks/rich-block-rules\`
当 HTTP 回调不可用时，可在回复中嵌入 cc_rich 文本备选。

注意: 只在需要异步协作时使用这些工具。普通回复直接输出即可。`;
}
