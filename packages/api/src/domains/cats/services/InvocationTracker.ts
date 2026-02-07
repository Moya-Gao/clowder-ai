/**
 * Invocation Tracker
 * 追踪每个 thread 的活跃调用，支持取消
 *
 * 每个 thread 同一时刻最多一个活跃调用。
 * 新调用自动 abort 旧调用（防止并发冲突）。
 */

export class InvocationTracker {
  private active = new Map<string, AbortController>();

  /** Start a new invocation for a thread. Returns the AbortController. */
  start(threadId: string): AbortController {
    // Abort any existing invocation for this thread
    this.active.get(threadId)?.abort();
    const controller = new AbortController();
    this.active.set(threadId, controller);
    return controller;
  }

  /** Cancel an active invocation. Returns true if one was found and aborted. */
  cancel(threadId: string): boolean {
    const controller = this.active.get(threadId);
    if (!controller) return false;
    controller.abort();
    this.active.delete(threadId);
    return true;
  }

  /** Mark an invocation as complete (cleanup). Only removes if controller matches. */
  complete(threadId: string, controller?: AbortController): void {
    if (controller && this.active.get(threadId) !== controller) return;
    this.active.delete(threadId);
  }

  /** Whether a thread has an active invocation. */
  has(threadId: string): boolean {
    return this.active.has(threadId);
  }
}
