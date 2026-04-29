import { homedir } from 'node:os';
import type { FastifyPluginAsync } from 'fastify';
import { getAgentHookStatus, syncAgentHooks } from '../agent-hooks/index.js';
import { findMonorepoRoot } from '../utils/monorepo-root.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface AgentHooksRouteOptions {
  projectRoot?: string;
  targetRoot?: string;
}

function resolveOptions(options: AgentHooksRouteOptions) {
  return {
    projectRoot: options.projectRoot ?? findMonorepoRoot(process.cwd()),
    targetRoot: options.targetRoot ?? homedir(),
  };
}

export const agentHooksRoutes: FastifyPluginAsync<AgentHooksRouteOptions> = async (app, options) => {
  app.get('/api/agent-hooks/status', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }

    return getAgentHookStatus(resolveOptions(options));
  });

  app.post('/api/agent-hooks/sync', async (request, reply) => {
    const userId = resolveHeaderUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }

    return syncAgentHooks(resolveOptions(options));
  });
};
