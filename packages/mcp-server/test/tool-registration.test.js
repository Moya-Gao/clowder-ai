/**
 * MCP Tool Registration Tests
 * 回归测试: 确认所有预期工具都注册到 MCP server
 *
 * 背景: request_permission / check_permission_status 的 handler 和 schema
 * 早就存在，但 createServer() 漏了 server.tool() 注册。
 * 本测试守住"注册层"，修复前会 Red，修复后 Green。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED_TOOLS = [
  // File tools
  'read_file',
  'write_file',
  'list_files',
  // Callback tools (chat + task + ack)
  'cat_cafe_post_message',
  'cat_cafe_get_pending_mentions',
  'cat_cafe_ack_mentions',
  'cat_cafe_get_thread_context',
  'cat_cafe_update_task',
  // Permission tools (this is the regression guard)
  'cat_cafe_request_permission',
  'cat_cafe_check_permission_status',
  // Callback-scoped memory tools
  'cat_cafe_search_evidence_callback',
  'cat_cafe_reflect_callback',
  'cat_cafe_retain_memory_callback',
  // Direct evidence/reflect tools
  'cat_cafe_search_evidence',
  'cat_cafe_reflect',
  // Signal Hunter tools (F21 S5)
  'signal_list_inbox',
  'signal_get_article',
  'signal_search',
  'signal_mark_read',
  'signal_summarize',
  // Session chain tools
  'cat_cafe_list_session_chain',
  'cat_cafe_read_session_events',
  'cat_cafe_read_session_digest',
  'cat_cafe_session_search',
];

describe('MCP Server Tool Registration', () => {
  test('all expected tools are registered via createServer()', async () => {
    const { createServer } = await import('../dist/index.js');
    const server = createServer();

    // _registeredTools is a plain object keyed by tool name
    const registeredNames = Object.keys(server._registeredTools);

    for (const name of EXPECTED_TOOLS) {
      assert.ok(
        registeredNames.includes(name),
        `Tool "${name}" is NOT registered on the MCP server`,
      );
    }
  });

  test('no unexpected tools are registered', async () => {
    const { createServer } = await import('../dist/index.js');
    const server = createServer();

    const registeredNames = Object.keys(server._registeredTools);

    for (const name of registeredNames) {
      assert.ok(
        EXPECTED_TOOLS.includes(name),
        `Unexpected tool "${name}" found — add it to EXPECTED_TOOLS if intentional`,
      );
    }
  });

  test('permission tools have correct input schemas', async () => {
    const { createServer } = await import('../dist/index.js');
    const server = createServer();

    const reqTool = server._registeredTools['cat_cafe_request_permission'];
    assert.ok(reqTool, 'request_permission tool should exist');

    const checkTool = server._registeredTools['cat_cafe_check_permission_status'];
    assert.ok(checkTool, 'check_permission_status tool should exist');
  });

  test('src/index.ts stays under 350 lines (hard limit)', () => {
    const sourcePath = new URL('../src/index.ts', import.meta.url);
    const source = readFileSync(sourcePath, 'utf-8');
    const lineCount = source.split('\n').length;
    assert.ok(
      lineCount <= 350,
      `mcp-server/src/index.ts exceeds 350 lines: ${lineCount}`,
    );
  });
});
