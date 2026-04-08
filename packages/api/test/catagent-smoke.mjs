#!/usr/bin/env node
/**
 * CatAgent Smoke Test — F152
 *
 * Standalone script to validate the CatAgent agent loop end-to-end.
 * Calls the real Anthropic API — requires credentials.
 *
 * Usage:
 *   # Uses account resolver (credentials.json):
 *   node packages/api/test/catagent-smoke.mjs
 *
 *   # Or with explicit API key:
 *   CATAGENT_ANTHROPIC_API_KEY=sk-... node packages/api/test/catagent-smoke.mjs
 */

// Must run from project root so account-resolver can find credentials
const { CatAgentService } = await import('../dist/domains/cats/services/agents/providers/catagent/CatAgentService.js');

const service = new CatAgentService({ catId: 'opus' });

const prompt = `请读取当前目录下的 package.json 文件，告诉我这个项目叫什么名字、版本号是多少。用一句话回答。`;

console.log('═══ CatAgent Smoke Test ═══');
console.log(`Prompt: ${prompt}`);
console.log('───────────────────────────');

let messageCount = 0;
let toolCallCount = 0;
let finalText = '';

for await (const msg of service.invoke(prompt, {
  workingDirectory: process.cwd(),
})) {
  messageCount++;
  switch (msg.type) {
    case 'session_init':
      console.log(`[session] ${msg.sessionId}`);
      break;
    case 'text':
      console.log(`[text] ${msg.content?.slice(0, 200)}`);
      finalText = msg.content ?? '';
      if (msg.metadata?.usage) {
        const u = msg.metadata.usage;
        console.log(`  tokens: in=${u.inputTokens} out=${u.outputTokens}`);
      }
      break;
    case 'tool_use':
      toolCallCount++;
      console.log(`[tool] ${msg.toolName}(${JSON.stringify(msg.toolInput).slice(0, 100)})`);
      break;
    case 'tool_result':
      console.log(`[result] ${msg.content?.slice(0, 100)}...`);
      break;
    case 'error':
      console.error(`[ERROR] ${msg.error}`);
      process.exit(1);
      break;
    case 'done':
      console.log('[done]');
      break;
    default:
      console.log(`[${msg.type}] ${msg.content?.slice(0, 80) ?? ''}`);
  }
}

console.log('───────────────────────────');
console.log(`Messages: ${messageCount} | Tool calls: ${toolCallCount}`);
console.log(`Final answer: ${finalText.slice(0, 200)}`);

// Basic assertions
if (messageCount < 3) {
  console.error('FAIL: expected at least 3 messages (session_init + text + done)');
  process.exit(1);
}
if (toolCallCount < 1) {
  console.error('FAIL: expected at least 1 tool call (read_file)');
  process.exit(1);
}
console.log('═══ PASS ═══');
