/**
 * PR Tracking Store
 * Maps (repoFullName + prNumber) → { catId, threadId, userId }
 * Used by GithubReviewWatcher to route review notifications to the correct cat/thread.
 *
 * BACKLOG #81
 */

export interface PrTrackingEntry {
  readonly repoFullName: string;
  readonly prNumber: number;
  readonly catId: string;
  readonly threadId: string;
  readonly userId: string;
  readonly registeredAt: number;
}

export type PrTrackingInput = Omit<PrTrackingEntry, 'registeredAt'>;

export interface IPrTrackingStore {
  /** Register a PR for tracking. Overwrites existing entry for same repo+pr. */
  register(input: PrTrackingInput): PrTrackingEntry | Promise<PrTrackingEntry>;

  /** Look up tracking info for a PR. */
  get(repoFullName: string, prNumber: number): PrTrackingEntry | null | Promise<PrTrackingEntry | null>;

  /** Remove tracking for a PR (e.g. after merge). */
  remove(repoFullName: string, prNumber: number): boolean | Promise<boolean>;

  /** List all tracked PRs (for debugging/admin). */
  listAll(): PrTrackingEntry[] | Promise<PrTrackingEntry[]>;
}

function makeKey(repoFullName: string, prNumber: number): string {
  return `${repoFullName}#${prNumber}`;
}

/**
 * In-memory implementation of PrTrackingStore.
 */
export class MemoryPrTrackingStore implements IPrTrackingStore {
  private readonly entries = new Map<string, PrTrackingEntry>();

  register(input: PrTrackingInput): PrTrackingEntry {
    const entry: PrTrackingEntry = {
      ...input,
      registeredAt: Date.now(),
    };
    this.entries.set(makeKey(input.repoFullName, input.prNumber), entry);
    return entry;
  }

  get(repoFullName: string, prNumber: number): PrTrackingEntry | null {
    return this.entries.get(makeKey(repoFullName, prNumber)) ?? null;
  }

  remove(repoFullName: string, prNumber: number): boolean {
    return this.entries.delete(makeKey(repoFullName, prNumber));
  }

  listAll(): PrTrackingEntry[] {
    return [...this.entries.values()].sort((a, b) => b.registeredAt - a.registeredAt);
  }
}
