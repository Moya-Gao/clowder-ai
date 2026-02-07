/**
 * Invocation Tracker
 * 追踪每个 thread 的活跃调用，支持取消 + userId 鉴权
 *
 * 每个 thread 同一时刻最多一个活跃调用。
 * 新调用自动 abort 旧调用（防止并发冲突）。
 */

interface ActiveInvocation {
  controller: AbortController;
  userId: string;
}

export class InvocationTracker {
  private active = new Map<string, ActiveInvocation>();

  /** Start a new invocation for a thread. Returns the AbortController. */
  start(threadId: string, userId: string = 'unknown'): AbortController {
    // Abort any existing invocation for this thread
    this.active.get(threadId)?.controller.abort();
    const controller = new AbortController();
    this.active.set(threadId, { controller, userId });
    return controller;
  }

  /**
   * Cancel an active invocation. Returns true if one was found and aborted.
   * If requestUserId is provided, only cancels if it matches the invocation owner.
   */
  cancel(threadId: string, requestUserId?: string): boolean {
    const inv = this.active.get(threadId);
    if (!inv) return false;
    if (requestUserId && inv.userId !== requestUserId) return false;
    inv.controller.abort();
    this.active.delete(threadId);
    return true;
  }

  /** Get the userId who started the invocation. */
  getUserId(threadId: string): string | null {
    return this.active.get(threadId)?.userId ?? null;
  }

  /** Mark an invocation as complete (cleanup). Only removes if controller matches. */
  complete(threadId: string, controller?: AbortController): void {
    const inv = this.active.get(threadId);
    if (!inv) return;
    if (controller && inv.controller !== controller) return;
    this.active.delete(threadId);
  }

  /** Whether a thread has an active invocation. */
  has(threadId: string): boolean {
    return this.active.has(threadId);
  }
}
