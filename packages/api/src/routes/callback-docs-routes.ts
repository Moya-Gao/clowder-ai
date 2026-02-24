/**
 * Callback Documentation Routes
 * F-BLOAT: On-demand progressive disclosure endpoints for MCP callback API
 * reference and rich block usage rules.
 *
 * These endpoints are unauthenticated — they serve static documentation
 * that is safe to expose. Cats call these on their first turn to get
 * full API docs, instead of receiving them injected into every prompt.
 */

import type { FastifyPluginAsync } from 'fastify';
import { RICH_BLOCK_RULES } from '../domains/cats/services/context/rich-block-rules.js';
import { buildMcpCallbackInstructions } from '../domains/cats/services/agents/invocation/McpPromptInjector.js';

/**
 * Register documentation endpoints for progressive disclosure.
 * No auth required — these return static reference text.
 */
export const registerCallbackDocsRoutes: FastifyPluginAsync = async (app) => {
  // Rich block usage rules (progressive disclosure for both Claude MCP and Codex/Gemini HTTP)
  app.get('/api/callbacks/rich-block-rules', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return { rules: RICH_BLOCK_RULES };
  });

  // Full MCP callback API reference (progressive disclosure for Codex/Gemini)
  app.get('/api/callbacks/instructions', async (request, reply) => {
    const apiUrl = process.env['CAT_CAFE_API_URL']
      ?? `${request.protocol}://${request.headers.host ?? 'localhost:3002'}`;
    const instructions = buildMcpCallbackInstructions({
      apiUrl,
      exampleHandle: '@opus',
    });
    reply.header('cache-control', 'public, max-age=3600');
    return { instructions };
  });
};
