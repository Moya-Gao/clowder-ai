/**
 * AgentPaneRegistry — tracks which invocations are running in tmux panes.
 * In-memory store; used by terminal routes to let frontend discover agent panes.
 */

export type AgentPaneStatus = 'running' | 'done' | 'crashed';

export interface AgentPaneInfo {
	invocationId: string;
	worktreeId: string;
	paneId: string;
	status: AgentPaneStatus;
	exitCode?: number | null;
	signal?: string | null;
	startedAt: number;
}

export class AgentPaneRegistry {
	private panes = new Map<string, AgentPaneInfo>();

	register(invocationId: string, worktreeId: string, paneId: string): void {
		this.panes.set(invocationId, {
			invocationId,
			worktreeId,
			paneId,
			status: 'running',
			startedAt: Date.now(),
		});
	}

	getByInvocation(invocationId: string): AgentPaneInfo | undefined {
		return this.panes.get(invocationId);
	}

	listByWorktree(worktreeId: string): AgentPaneInfo[] {
		return Array.from(this.panes.values()).filter((p) => p.worktreeId === worktreeId);
	}

	markDone(invocationId: string, exitCode: number | null): void {
		const p = this.panes.get(invocationId);
		if (p) {
			p.status = 'done';
			p.exitCode = exitCode;
		}
	}

	markCrashed(invocationId: string, signal: string | null): void {
		const p = this.panes.get(invocationId);
		if (p) {
			p.status = 'crashed';
			p.signal = signal;
		}
	}

	remove(invocationId: string): void {
		this.panes.delete(invocationId);
	}
}
