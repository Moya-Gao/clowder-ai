#!/usr/bin/env node
/**
 * Cat Café MCP Server
 * 为三只 AI 猫猫提供共享工具的 MCP Server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initCatCafeDir } from './utils/path-validator.js';
import {
  readFileInputSchema,
  writeFileInputSchema,
  listFilesInputSchema,
  handleReadFile,
  handleWriteFile,
  handleListFiles,
  postMessageInputSchema,
  getPendingMentionsInputSchema,
  getThreadContextInputSchema,
  updateTaskInputSchema,
  requestPermissionInputSchema,
  checkPermissionStatusInputSchema,
  handlePostMessage,
  handleGetPendingMentions,
  handleGetThreadContext,
  handleUpdateTask,
  handleRequestPermission,
  handleCheckPermissionStatus,
  callbackEvidenceSearchInputSchema,
  callbackReflectInputSchema,
  callbackRetainMemoryInputSchema,
  handleCallbackSearchEvidence,
  handleCallbackReflect,
  handleCallbackRetainMemory,
  searchEvidenceInputSchema,
  handleSearchEvidence,
  reflectInputSchema,
  handleReflect,
  listSessionChainInputSchema,
  readSessionEventsInputSchema,
  readSessionDigestInputSchema,
  sessionSearchInputSchema,
  handleListSessionChain,
  handleReadSessionEvents,
  handleReadSessionDigest,
  handleSessionSearch,
} from './tools/index.js';

/**
 * 创建并配置 MCP Server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'cat-cafe-mcp',
    version: '0.1.0',
  });

  // 注册 read_file 工具
  server.tool(
    'read_file',
    'Read the contents of a file. Only files within allowed directories can be read.',
    readFileInputSchema,
    async (args: { path: string }) => {
      const result = await handleReadFile(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // 注册 write_file 工具
  server.tool(
    'write_file',
    'Write content to a file. Creates parent directories if needed.',
    writeFileInputSchema,
    async (args: { path: string; content: string }) => {
      const result = await handleWriteFile(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // 注册 list_files 工具
  server.tool(
    'list_files',
    'List files in a directory. Only directories within allowed paths can be listed.',
    listFilesInputSchema,
    async (args: { path: string; recursive?: boolean }) => {
      const result = await handleListFiles(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // 注册 MCP 回传工具 (三猫共享)
  server.tool(
    'cat_cafe_post_message',
    'Post a message to the Cat Café chat. Use this to share results, respond to other cats, or communicate with the user.',
    postMessageInputSchema,
    async (args: { content: string; replyTo?: string | undefined }) => {
      const result = await handlePostMessage(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_get_pending_mentions',
    'Get recent messages that @-mention you. Use this to check if anyone is trying to get your attention.',
    getPendingMentionsInputSchema,
    async (_args: Record<string, never>) => {
      const result = await handleGetPendingMentions(_args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_get_thread_context',
    'Get recent conversation messages for context. Use this to understand what has been discussed recently.',
    getThreadContextInputSchema,
    async (args: { limit?: number }) => {
      const result = await handleGetThreadContext(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_update_task',
    'Update the status of a task you own. Use this to mark tasks as doing/blocked/done.',
    updateTaskInputSchema,
    async (args: { taskId: string; status?: string | undefined; why?: string | undefined }) => {
      const result = await handleUpdateTask(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // 权限请求工具 (猫猫向铲屎官发起审批)
  server.tool(
    'cat_cafe_request_permission',
    'Request permission from the user before performing a sensitive action (e.g. git_commit, file_delete). Returns granted/denied immediately if a rule exists, or pending with a requestId if the user needs to approve.',
    requestPermissionInputSchema,
    async (args: { action: string; reason: string; context?: string | undefined }) => {
      const result = await handleRequestPermission(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_check_permission_status',
    'Check the status of a previously submitted permission request. Use the requestId returned from request_permission.',
    checkPermissionStatusInputSchema,
    async (args: { requestId: string }) => {
      const result = await handleCheckPermissionStatus(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // Callback-scoped evidence/reflect/retain tools (invocation token required)
  server.tool(
    'cat_cafe_search_evidence_callback',
    'Search project evidence through invocation-scoped callback auth.',
    callbackEvidenceSearchInputSchema,
    async (args: {
      query: string;
      limit?: number | undefined;
      budget?: 'low' | 'mid' | 'high' | undefined;
      tags?: string | undefined;
      tagsMatch?: 'any' | 'all' | 'any_strict' | 'all_strict' | undefined;
    }) => {
      const result = await handleCallbackSearchEvidence(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_reflect_callback',
    'Run project reflection through invocation-scoped callback auth.',
    callbackReflectInputSchema,
    async (args: { query: string }) => {
      const result = await handleCallbackReflect(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_retain_memory_callback',
    'Retain durable memory through invocation-scoped callback auth.',
    callbackRetainMemoryInputSchema,
    async (args: { content: string; tags?: string[] | undefined; metadata?: Record<string, string> | undefined }) => {
      const result = await handleCallbackRetainMemory(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // Evidence search tool
  server.tool(
    'cat_cafe_search_evidence',
    'Search project knowledge base for decisions, discussions, phase history, and other evidence. Uses Hindsight Recall with local docs fallback.',
    searchEvidenceInputSchema,
    async (args: { query: string; limit?: number | undefined; budget?: string | undefined; tags?: string | undefined }) => {
      const result = await handleSearchEvidence(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // Reflect tool (Hindsight LLM reflection)
  server.tool(
    'cat_cafe_reflect',
    'Ask a reflective question about the project. Uses Hindsight LLM reflection to synthesize insights from stored project knowledge.',
    reflectInputSchema,
    async (args: { query: string }) => {
      const result = await handleReflect(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  // Session Chain tools (F24 Phase D)
  server.tool(
    'cat_cafe_list_session_chain',
    'List session chain for a thread. Shows session IDs, sequence numbers, status, and context health for each cat.',
    listSessionChainInputSchema,
    async (args: { threadId: string; catId?: string | undefined; limit?: number | undefined }) => {
      const result = await handleListSessionChain(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_read_session_events',
    'Read events from a sealed session transcript. Supports pagination via cursor. Use to review what happened in a previous session.',
    readSessionEventsInputSchema,
    async (args: { sessionId: string; cursor?: number | undefined; limit?: number | undefined }) => {
      const result = await handleReadSessionEvents(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_read_session_digest',
    'Read the extractive digest of a sealed session. Contains tool names, files touched, errors, and timing info. Use this first before reading full events.',
    readSessionDigestInputSchema,
    async (args: { sessionId: string }) => {
      const result = await handleReadSessionDigest(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_session_search',
    'Search across session transcripts and digests. Use to find specific events, decisions, or file changes from previous sessions.',
    sessionSearchInputSchema,
    async (args: { threadId: string; query: string; cats?: string | undefined; limit?: number | undefined; scope?: string | undefined }) => {
      const result = await handleSessionSearch(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  return server;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 初始化 Cat Café 目录结构
  initCatCafeDir();

  // 创建 server
  const server = createServer();

  // 创建 STDIO transport
  const transport = new StdioServerTransport();

  console.error('[cat-cafe] MCP Server starting...');

  // 连接 transport
  await server.connect(transport);

  console.error('[cat-cafe] MCP Server running on stdio');
}

// 仅作为入口运行时启动 (import 时跳过，避免测试阻塞在 stdio)
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isEntryPoint = process.argv[1]
  && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isEntryPoint) {
  main().catch((err) => {
    console.error('[cat-cafe] Fatal error:', err);
    process.exit(1);
  });
}
