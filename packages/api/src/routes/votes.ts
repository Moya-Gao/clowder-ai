/**
 * F079: Vote Routes
 * 投票系统 API: 发起/投票/查询/关闭
 *
 * POST   /api/threads/:threadId/vote/start — 发起投票
 * POST   /api/threads/:threadId/vote       — 投票
 * GET    /api/threads/:threadId/vote       — 查询当前投票
 * DELETE /api/threads/:threadId/vote       — 关闭投票
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { VotingStateV1 } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { SocketManager } from '../infrastructure/websocket/index.js';

export interface VoteRoutesOptions {
  threadStore: IThreadStore;
  socketManager: SocketManager;
}

const startVoteSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(100)).min(2).max(20),
  anonymous: z.boolean().optional().default(false),
  timeoutSec: z.number().int().min(10).max(600).optional().default(120),
});

const castVoteSchema = z.object({
  option: z.string().min(1).max(100),
});

function resolveUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const header = request.headers['x-cat-cafe-user'];
  return (Array.isArray(header) ? header[0] : header) ?? 'anonymous';
}

export const voteRoutes: FastifyPluginAsync<VoteRoutesOptions> = async (app, opts) => {
  const { threadStore, socketManager } = opts;

  // POST /api/threads/:threadId/vote/start — start a vote
  app.post<{ Params: { threadId: string } }>(
    '/api/threads/:threadId/vote/start',
    async (request, reply) => {
      const { threadId } = request.params;
      const userId = resolveUserId(request);
      const thread = await threadStore.get(threadId);
      if (!thread) {
        reply.status(404);
        return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
      }
      if (thread.createdBy !== userId) {
        reply.status(403);
        return { error: '无权操作此对话的投票', code: 'FORBIDDEN' };
      }

      const existing = await threadStore.getVotingState(threadId);
      if (existing && existing.status === 'active') {
        reply.status(409);
        return { error: '已有活跃投票', code: 'VOTE_ALREADY_ACTIVE' };
      }

      const parseResult = startVoteSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request', details: parseResult.error.issues };
      }

      const { question, options, anonymous, timeoutSec } = parseResult.data;

      const votingState: VotingStateV1 = {
        v: 1,
        question,
        options,
        votes: {},
        anonymous,
        deadline: Date.now() + timeoutSec * 1000,
        createdBy: userId,
        status: 'active',
      };

      await threadStore.updateVotingState(threadId, votingState);

      socketManager.broadcastToRoom(`thread:${threadId}`, 'vote_started', {
        threadId,
        votingState,
      });

      reply.status(201);
      return votingState;
    },
  );

  // POST /api/threads/:threadId/vote — cast a vote
  app.post<{ Params: { threadId: string } }>(
    '/api/threads/:threadId/vote',
    async (request, reply) => {
      const { threadId } = request.params;
      const userId = resolveUserId(request);
      const thread = await threadStore.get(threadId);
      if (!thread) {
        reply.status(404);
        return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
      }

      const votingState = await threadStore.getVotingState(threadId);
      if (!votingState || votingState.status !== 'active') {
        reply.status(404);
        return { error: '当前没有活跃投票', code: 'NO_ACTIVE_VOTE' };
      }

      // Check deadline
      if (Date.now() > votingState.deadline) {
        reply.status(410);
        return { error: '投票已超时', code: 'VOTE_EXPIRED' };
      }

      const parseResult = castVoteSchema.safeParse(request.body);
      if (!parseResult.success) {
        reply.status(400);
        return { error: 'Invalid request', details: parseResult.error.issues };
      }

      const { option } = parseResult.data;
      if (!votingState.options.includes(option)) {
        reply.status(400);
        return { error: '无效选项', code: 'INVALID_OPTION' };
      }

      votingState.votes[userId] = option;
      await threadStore.updateVotingState(threadId, votingState);

      const voteCount = Object.keys(votingState.votes).length;

      if (votingState.anonymous) {
        // Anonymous: broadcast aggregate only, no identity
        socketManager.broadcastToRoom(`thread:${threadId}`, 'vote_cast', {
          threadId,
          voteCount,
        });
        return { ...votingState, votes: {}, voteCount };
      }

      socketManager.broadcastToRoom(`thread:${threadId}`, 'vote_cast', {
        threadId,
        userId,
        option,
      });
      return votingState;
    },
  );

  // GET /api/threads/:threadId/vote — get current vote
  app.get<{ Params: { threadId: string } }>(
    '/api/threads/:threadId/vote',
    async (request, reply) => {
      const { threadId } = request.params;
      const thread = await threadStore.get(threadId);
      if (!thread) {
        reply.status(404);
        return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
      }

      const vote = await threadStore.getVotingState(threadId);
      if (vote && vote.anonymous) {
        // Strip voter identities, only show counts
        return { vote: { ...vote, votes: {}, voteCount: Object.keys(vote.votes).length } };
      }
      return { vote };
    },
  );

  // DELETE /api/threads/:threadId/vote — close vote
  app.delete<{ Params: { threadId: string } }>(
    '/api/threads/:threadId/vote',
    async (request, reply) => {
      const { threadId } = request.params;
      const userId = resolveUserId(request);
      const thread = await threadStore.get(threadId);
      if (!thread) {
        reply.status(404);
        return { error: '对话不存在', code: 'THREAD_NOT_FOUND' };
      }
      if (thread.createdBy !== userId) {
        reply.status(403);
        return { error: '无权操作此对话的投票', code: 'FORBIDDEN' };
      }

      const votingState = await threadStore.getVotingState(threadId);
      if (!votingState || votingState.status !== 'active') {
        reply.status(404);
        return { error: '当前没有活跃投票', code: 'NO_ACTIVE_VOTE' };
      }

      const result = { ...votingState, status: 'closed' as const };
      await threadStore.updateVotingState(threadId, null);

      // Build tally for rich block
      const tally: Record<string, number> = {};
      for (const opt of result.options) tally[opt] = 0;
      for (const v of Object.values(result.votes)) tally[v] = (tally[v] ?? 0) + 1;

      const totalVotes = Object.values(result.votes).length;
      const fields = result.options.map((opt) => ({
        label: opt,
        value: `${tally[opt] ?? 0} 票 (${totalVotes > 0 ? Math.round(((tally[opt] ?? 0) / totalVotes) * 100) : 0}%)`,
      }));

      // Anonymous: strip voter identities from result, add tally for frontend
      const publicResult = result.anonymous
        ? { ...result, votes: {} as Record<string, string>, tally }
        : { ...result, tally };

      const richBlock = {
        id: `vote-${Date.now()}`,
        kind: 'card' as const,
        v: 1 as const,
        title: `📊 投票结果: ${result.question}`,
        bodyMarkdown: result.anonymous
          ? `匿名投票 · ${totalVotes} 票`
          : `实名投票 · ${totalVotes} 票`,
        tone: 'info' as const,
        fields,
      };

      socketManager.broadcastToRoom(`thread:${threadId}`, 'vote_closed', {
        threadId,
        result: publicResult,
        richBlock,
      });

      return { result: publicResult, richBlock };
    },
  );
};
