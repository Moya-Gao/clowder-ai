#!/usr/bin/env node
/**
 * Cat Café MCP Server
 * 为三只 AI 猫猫提供共享工具的 MCP Server
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initCatCafeDir } from './utils/path-validator.js';
import {
  postMessageInputSchema,
  getPendingMentionsInputSchema,
  ackMentionsInputSchema,
  getThreadContextInputSchema,
  listThreadsInputSchema,
  featIndexInputSchema,
  crossPostMessageInputSchema,
  listTasksInputSchema,
  updateTaskInputSchema,
  requestPermissionInputSchema,
  checkPermissionStatusInputSchema,
  handlePostMessage,
  handleGetPendingMentions,
  handleAckMentions,
  handleGetThreadContext,
  handleListThreads,
  handleFeatIndex,
  handleCrossPostMessage,
  handleListTasks,
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
  sessionChainTools,
  signalsTools,
  handleGetRichBlockRules,
  richBlockRulesInputSchema,
} from './tools/index.js';
import { createRichBlockInputSchema, handleCreateRichBlock, registerPrTrackingInputSchema, handleRegisterPrTracking } from './tools/callback-tools.js';
/**
 * 创建并配置 MCP Server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'cat-cafe-mcp',
    version: '0.1.0',
  });

  // 注册 MCP 回传工具 (三猫共享)
  server.tool(
    'cat_cafe_post_message',
    'Post a proactive async message to the Cat Café chat mid-task (e.g. progress updates, sharing results). To simply @mention another cat at the end of your response, use @猫名 in your reply text instead — it is free and never expires.',
    postMessageInputSchema,
    async (args: { content: string; threadId?: string | undefined; replyTo?: string | undefined; clientMessageId?: string | undefined }) => {
      const result = await handlePostMessage(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );
  server.tool(
    'cat_cafe_get_pending_mentions',
    'Get recent messages that @-mention you. Use this to check if anyone is trying to get your attention.',
    getPendingMentionsInputSchema,
    async (args: { includeAcked?: boolean | undefined }) => {
      const result = await handleGetPendingMentions(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_ack_mentions',
    'Acknowledge that you have processed mentions up to a specific message ID. Call this after processing mentions from get_pending_mentions to avoid seeing them again in future sessions.',
    ackMentionsInputSchema,
    async (args: { upToMessageId: string }) => {
      const result = await handleAckMentions(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_get_thread_context',
    'Get recent conversation messages for context. Use this to understand what has been discussed recently.',
    getThreadContextInputSchema,
    async (args) => {
      const result = await handleGetThreadContext(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_search_messages',
    "Search thread messages with optional catId/user and keyword filters. Supports cross-thread via threadId.",
    getThreadContextInputSchema,
    async (args) => {
      const result = await handleGetThreadContext(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_list_threads',
    'List recent thread summaries for discovery. Supports limit and activeSince filtering.',
    listThreadsInputSchema,
    async (args) => {
      const result = await handleListThreads(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_feat_index',
    'Search feature index entries by featId/query for cross-thread feature discovery.',
    featIndexInputSchema,
    async (args) => {
      const result = await handleFeatIndex(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_cross_post_message',
    'Post a message into a specific thread by threadId (cross-thread notification).',
    crossPostMessageInputSchema,
    async (args: { threadId: string; content: string; replyTo?: string | undefined; clientMessageId?: string | undefined }) => {
      const result = await handleCrossPostMessage(args);
      return { ...result } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
    }
  );

  server.tool(
    'cat_cafe_list_tasks',
    'List tasks with optional threadId/catId/status filters for global task discovery.',
    listTasksInputSchema,
    async (args: { threadId?: string | undefined; catId?: string | undefined; status?: 'todo' | 'doing' | 'blocked' | 'done' | undefined }) => {
      const result = await handleListTasks(args);
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

  server.tool(
    'cat_cafe_create_rich_block',
    'Create a rich block (card, diff, checklist, or media gallery) attached to the current message. The block will be rendered as an interactive component below the message text.',
    createRichBlockInputSchema,
    async (args: { block: string }) => {
      const result = await handleCreateRichBlock(args);
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

  // TD091: PR tracking registration via MCP callback
  server.tool(
    'cat_cafe_register_pr_tracking',
    'Register a PR for email review notification routing. Call this right after `gh pr create` so cloud review results route to your thread. Server resolves threadId automatically.',
    registerPrTrackingInputSchema,
    async (args: { repoFullName: string; prNumber: number; catId: string }) => {
      const result = await handleRegisterPrTracking(args);
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

  // Signal Hunter tools (F21 S5)
  for (const tool of signalsTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args as never);
        return {
          ...result,
        } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
      }
    );
  }

  // Session Chain tools (F24 Phase D + F98)
  for (const tool of sessionChainTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args as never);
        return {
          ...result,
        } as { content: Array<{ type: 'text'; text: string }>; isError?: boolean; [key: string]: unknown };
      }
    );
  }

  // Rich block rules tool (F-BLOAT progressive disclosure)
  server.tool(
    'cat_cafe_get_rich_block_rules',
    'Get the full rich block usage rules (card/diff/checklist/media_gallery/audio). Call this before creating your first rich block in a session.',
    richBlockRulesInputSchema,
    async (_args: Record<string, never>) => {
      const result = await handleGetRichBlockRules();
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
