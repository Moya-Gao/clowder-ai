import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import * as pty from 'node-pty';
import type { TmuxGateway } from '../domains/terminal/tmux-gateway.js';
import { getWorktreeRoot } from '../domains/workspace/workspace-security.js';
import { resolveUserId } from '../utils/request-identity.js';

interface TerminalRouteOpts {
  tmuxGateway: TmuxGateway;
}

interface ActiveSession {
  id: string;
  pty: pty.IPty;
  worktreeId: string;
  paneId: string;
}

export const terminalRoutes: FastifyPluginAsync<TerminalRouteOpts> = async (app, opts) => {
  const { tmuxGateway } = opts;
  const sessions = new Map<string, ActiveSession>();

  // --- Auth gate: all terminal routes require identity ---
  app.addHook('preHandler', async (req, reply) => {
    const userId = resolveUserId(req);
    if (!userId) {
      reply.status(401);
      return reply.send({ error: 'Identity required (X-Cat-Cafe-User header or userId query)' });
    }
  });

  // POST /api/terminal/sessions — create a new terminal session
  app.post<{
    Body: { worktreeId: string; cols?: number; rows?: number };
  }>('/api/terminal/sessions', async (req, reply) => {
    const { worktreeId, cols = 80, rows = 24 } = req.body;

    // P2-2: validate worktreeId is non-empty
    if (!worktreeId) {
      reply.status(400);
      return reply.send({ error: 'worktreeId is required' });
    }

    // P2-2: resolve worktreeId → filesystem root for cwd
    let cwd: string;
    try {
      cwd = await getWorktreeRoot(worktreeId);
    } catch {
      reply.status(404);
      return reply.send({ error: `Worktree not found: ${worktreeId}` });
    }

    const id = randomUUID();

    // Ensure tmux server + create pane
    await tmuxGateway.ensureServer(worktreeId);
    const paneId = await tmuxGateway.createPane(worktreeId, { cols, rows, cwd });

    // P1-1: Spawn PTY that attaches to the tmux pane (not independent shell)
    // `tmux attach` connects this PTY's I/O to the actual tmux pane
    const sock = tmuxGateway.socketName(worktreeId);
    const ptyProcess = pty.spawn('tmux', ['-L', sock, 'attach', '-t', paneId], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });

    sessions.set(id, { id, pty: ptyProcess, worktreeId, paneId });

    return { sessionId: id, paneId };
  });

  // GET /api/terminal/sessions/:sessionId/ws — WebSocket attach
  app.get<{
    Params: { sessionId: string };
  }>('/api/terminal/sessions/:sessionId/ws', { websocket: true }, (socket, req) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      socket.close(4004, 'Session not found');
      return;
    }

    const { pty: ptyProcess } = session;

    // PTY output → WebSocket
    const dataHandler = ptyProcess.onData((data) => {
      if (socket.readyState === 1) {
        socket.send(data);
      }
    });

    // WebSocket input → PTY
    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const msg = Buffer.isBuffer(raw) ? raw.toString() : String(raw);
      try {
        const parsed = JSON.parse(msg) as { type: string; data?: string; cols?: number; rows?: number };
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
        } else if (parsed.type === 'input' && typeof parsed.data === 'string') {
          ptyProcess.write(parsed.data);
        }
      } catch {
        // Not JSON — treat as raw input
        ptyProcess.write(msg);
      }
    });

    // Cleanup on WS disconnect
    socket.on('close', () => {
      dataHandler.dispose();
    });

    // PTY exit → close WS + cleanup
    ptyProcess.onExit(() => {
      socket.close(1000, 'PTY exited');
      sessions.delete(sessionId);
    });
  });

  // DELETE /api/terminal/sessions/:sessionId — kill session
  app.delete<{
    Params: { sessionId: string };
  }>('/api/terminal/sessions/:sessionId', async (req, reply) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    // P2-1: Kill PTY + tmux pane + check if server should be cleaned up
    session.pty.kill();
    await tmuxGateway.killPane(session.worktreeId, session.paneId);
    sessions.delete(sessionId);

    // If no more sessions for this worktree, destroy the tmux server
    const hasRemaining = [...sessions.values()].some((s) => s.worktreeId === session.worktreeId);
    if (!hasRemaining) {
      await tmuxGateway.destroyServer(session.worktreeId);
    }

    return { ok: true };
  });

  // GET /api/terminal/sessions — list active sessions
  app.get('/api/terminal/sessions', async () => {
    return [...sessions.values()].map((s) => ({
      id: s.id,
      worktreeId: s.worktreeId,
      paneId: s.paneId,
    }));
  });
};
