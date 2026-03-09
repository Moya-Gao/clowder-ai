import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CreatePaneOpts, PaneInfo } from './types.js';

const exec = promisify(execFile);

/**
 * Manages tmux servers: one tmux server per worktree.
 * Uses CLI mode (execFile per command) — simple, reliable, and the terminal endstate.
 */
export class TmuxGateway {
  private activeServers = new Set<string>();

  /** Socket name for a worktree */
  socketName(worktreeId: string): string {
    return `catcafe-${worktreeId}`;
  }

  /** Ensure a tmux server is running for this worktree */
  async ensureServer(worktreeId: string): Promise<string> {
    const sock = this.socketName(worktreeId);
    if (this.activeServers.has(worktreeId)) return sock;

    // Check if server already running
    try {
      await exec('tmux', ['-L', sock, 'list-sessions']);
      this.activeServers.add(worktreeId);
    } catch {
      // Server not running — will be created on first createPane
    }
    return sock;
  }

  /** Create a new pane (creates session if needed) */
  async createPane(worktreeId: string, opts: CreatePaneOpts = {}): Promise<string> {
    const sock = this.socketName(worktreeId);
    const shell = opts.shell ?? process.env["SHELL"] ?? "/bin/zsh";
    const cwd = opts.cwd ?? process.env["HOME"] ?? "/tmp";
    const cols = opts.cols ?? 80;
    const rows = opts.rows ?? 24;

    if (!this.activeServers.has(worktreeId)) {
      // Create new session (this starts the tmux server)
      await exec('tmux', ['-L', sock, 'new-session', '-d', '-x', String(cols), '-y', String(rows), '-c', cwd, shell]);
      this.activeServers.add(worktreeId);
    } else {
      // Add window to existing session
      await exec('tmux', ['-L', sock, 'new-window', '-c', cwd, shell]);
    }

    // Get the pane ID of the most recently created pane
    const { stdout } = await exec('tmux', ['-L', sock, 'display-message', '-p', '#{pane_id}']);
    return stdout.trim();
  }

  /** List all panes for a worktree */
  async listPanes(worktreeId: string): Promise<PaneInfo[]> {
    const sock = this.socketName(worktreeId);
    try {
      const { stdout } = await exec('tmux', [
        '-L',
        sock,
        'list-panes',
        '-a',
        '-F',
        '#{pane_id} #{pane_pid} #{pane_width} #{pane_height}',
      ]);
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(' ');
          return {
            paneId: parts[0] ?? '',
            panePid: Number(parts[1]),
            paneWidth: Number(parts[2]),
            paneHeight: Number(parts[3]),
          };
        });
    } catch {
      return []; // Server not running
    }
  }

  /** Resize a pane */
  async resizePane(worktreeId: string, paneId: string, cols: number, rows: number): Promise<void> {
    const sock = this.socketName(worktreeId);
    await exec('tmux', ['-L', sock, 'resize-pane', '-t', paneId, '-x', String(cols), '-y', String(rows)]);
  }

  /** Send keys (text + Enter) to a pane */
  async sendKeys(worktreeId: string, paneId: string, text: string): Promise<void> {
    const sock = this.socketName(worktreeId);
    await exec('tmux', ['-L', sock, 'send-keys', '-t', paneId, text, 'Enter']);
  }

  /** Capture pane content as text */
  async capturePane(worktreeId: string, paneId: string): Promise<string> {
    const sock = this.socketName(worktreeId);
    const { stdout } = await exec('tmux', ['-L', sock, 'capture-pane', '-t', paneId, '-p']);
    return stdout;
  }

  /** Create an agent pane with remain-on-exit (read-only set AFTER command starts) */
  async createAgentPane(worktreeId: string, opts: CreatePaneOpts = {}): Promise<string> {
    const paneId = await this.createPane(worktreeId, opts);
    const sock = this.socketName(worktreeId);
    // Preserve crash scene: pane stays visible after process exits
    await exec('tmux', ['-L', sock, 'set-option', '-t', paneId, 'remain-on-exit', 'on']);
    // NOTE: Do NOT set read-only here — select-pane -d blocks send-keys.
    // Callers should call setPaneReadOnly() AFTER the agent command is running.
    return paneId;
  }

  /** Execute a command in a pane via send-keys (fire-and-forget) */
  async execInPane(worktreeId: string, paneId: string, command: string): Promise<void> {
    const sock = this.socketName(worktreeId);
    // send-keys with literal flag to avoid tmux key interpretation
    await exec('tmux', ['-L', sock, 'send-keys', '-t', paneId, command, 'Enter']);
  }

  /** Toggle pane read-only mode */
  async setPaneReadOnly(worktreeId: string, paneId: string, readOnly: boolean): Promise<void> {
    const sock = this.socketName(worktreeId);
    // -d = disable input (read-only), -e = enable input
    await exec('tmux', ['-L', sock, 'select-pane', '-t', paneId, readOnly ? '-d' : '-e']);
  }

  /** Kill a specific pane */
  async killPane(worktreeId: string, paneId: string): Promise<void> {
    const sock = this.socketName(worktreeId);
    try {
      await exec('tmux', ['-L', sock, 'kill-pane', '-t', paneId]);
    } catch {
      // Pane already dead
    }
  }

  /** Kill the entire tmux server for a worktree */
  async destroyServer(worktreeId: string): Promise<void> {
    const sock = this.socketName(worktreeId);
    try {
      await exec('tmux', ['-L', sock, 'kill-server']);
    } catch {
      // Already dead
    }
    this.activeServers.delete(worktreeId);
  }
}
