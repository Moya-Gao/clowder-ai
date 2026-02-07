/**
 * Commands API Routes
 * POST /api/commands/extract-tasks - Extract tasks from conversation
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IMessageStore } from '../domains/cats/services/MessageStore.js';
import type { ITaskStore } from '../domains/cats/services/TaskStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';
import type { AgentService } from '../domains/cats/services/types.js';
import { extractTasks, toCreateTaskInputs } from '../domains/cats/services/TaskExtractor.js';

export interface CommandsRoutesOptions {
  messageStore: IMessageStore;
  taskStore: ITaskStore;
  socketManager: SocketManager;
  /** Opus service for LLM-powered extraction */
  opusService: AgentService;
}

const extractTasksSchema = z.object({
  threadId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  /** Number of recent messages to analyze (default: 50) */
  messageCount: z.number().int().min(1).max(200).optional(),
});

export const commandsRoutes: FastifyPluginAsync<CommandsRoutesOptions> = async (app, opts) => {
  // POST /api/commands/extract-tasks
  app.post('/api/commands/extract-tasks', async (request, reply) => {
    const parseResult = extractTasksSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400);
      return { error: 'Invalid request body', details: parseResult.error.issues };
    }

    const { threadId, userId, messageCount } = parseResult.data;

    // Get thread history
    const messages = await opts.messageStore.getByThread(threadId, messageCount ?? 50, userId);

    if (messages.length === 0) {
      return { tasks: [], degraded: false, count: 0 };
    }

    // Extract tasks using LLM
    const result = await extractTasks(messages, opts.opusService, {
      threadId,
      userId,
      maxMessages: messageCount ?? 50,
    });

    // Convert to CreateTaskInput and store
    const inputs = toCreateTaskInputs(result.tasks, threadId, 'user');
    const createdTasks = [];

    for (const input of inputs) {
      const task = await opts.taskStore.create(input);
      createdTasks.push(task);

      // Broadcast task_created
      opts.socketManager.broadcastToRoom(`thread:${threadId}`, 'task_created', task);
    }

    return {
      tasks: createdTasks,
      degraded: result.degraded,
      ...(result.reason ? { reason: result.reason } : {}),
      count: createdTasks.length,
    };
  });
};
