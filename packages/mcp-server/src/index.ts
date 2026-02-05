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
} from './tools/index.js';

/**
 * 创建并配置 MCP Server
 */
function createServer(): McpServer {
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

// 运行主函数
main().catch((err) => {
  console.error('[cat-cafe] Fatal error:', err);
  process.exit(1);
});
