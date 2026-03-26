/**
 * F139: ReviewCommentsTaskSpec — detect new PR review comments.
 *
 * Gate: list tracked PRs → fetchComments per PR → filter by in-memory cursor
 *       → workItems for PRs with new comments.
 * Execute: log + commit cursor (cursor only advances on successful execute).
 *
 * Cursor is in-memory (Phase 1a); SQLite cursor persistence is Phase 2.
 */
import type { ExecuteContext, TaskSpec_P1 } from '../scheduler/types.js';
import type { IPrTrackingStore, PrTrackingEntry } from './PrTrackingStore.js';

export interface PrComment {
  id: number;
  body: string;
  createdAt: string;
}

export interface ReviewCommentsSignal {
  entry: PrTrackingEntry;
  newComments: PrComment[];
  /** Call after successful processing to advance cursor; skipped on failure → retry next tick */
  commitCursor: () => void;
}

export interface DeliverMessageInput {
  threadId: string;
  userId: string;
  catId: string;
  content: string;
  source: string;
}

export interface ReviewCommentsTaskSpecOptions {
  readonly prTrackingStore: IPrTrackingStore;
  /** Injectable comment fetcher — returns all comments for a PR (review + conversation) */
  readonly fetchComments: (repoFullName: string, prNumber: number) => Promise<PrComment[]>;
  /** Injectable message delivery — posts connector message to thread */
  readonly deliverMessage?: (input: DeliverMessageInput) => Promise<{ messageId: string; content: string }>;
  readonly log: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
  readonly pollIntervalMs?: number;
}

export function createReviewCommentsTaskSpec(opts: ReviewCommentsTaskSpecOptions): TaskSpec_P1<ReviewCommentsSignal> {
  // In-memory cursor: tracks highest seen comment ID per PR key
  const cursors = new Map<string, number>();

  return {
    id: 'review-comments',
    profile: 'poller',
    trigger: { type: 'interval', ms: opts.pollIntervalMs ?? 60_000 },
    admission: {
      async gate() {
        const entries = await opts.prTrackingStore.listAll();
        if (entries.length === 0) {
          return { run: false, reason: 'no tracked PRs' };
        }

        const withNew: { entry: PrTrackingEntry; newComments: PrComment[]; maxId: number; prKey: string }[] = [];
        for (const entry of entries) {
          try {
            const prKey = `${entry.repoFullName}#${entry.prNumber}`;
            const comments = await opts.fetchComments(entry.repoFullName, entry.prNumber);
            const cursor = cursors.get(prKey) ?? 0;
            const fresh = comments.filter((c) => c.id > cursor);

            if (fresh.length > 0) {
              const maxId = Math.max(...fresh.map((c) => c.id));
              withNew.push({ entry, newComments: fresh, maxId, prKey });
              // P2-1 fix: do NOT advance cursor here — wait for execute success
            }
          } catch {
            // fail-open: skip PRs where fetch fails
          }
        }

        if (withNew.length === 0) {
          return { run: false, reason: 'no new comments' };
        }

        return {
          run: true,
          workItems: withNew.map((w) => ({
            signal: {
              entry: w.entry,
              newComments: w.newComments,
              commitCursor: () => {
                cursors.set(w.prKey, w.maxId);
              },
            },
            subjectKey: `pr-${w.entry.repoFullName}#${w.entry.prNumber}`,
          })),
        };
      },
    },
    run: {
      overlap: 'skip',
      timeoutMs: 30_000,
      async execute(signal: ReviewCommentsSignal, subjectKey: string, ctx: ExecuteContext) {
        const { entry, newComments } = signal;
        if (opts.deliverMessage) {
          const targetCatId = ctx.assignedCatId ?? entry.catId;
          const preview = newComments
            .slice(0, 3)
            .map((c) => `> ${c.body.slice(0, 80)}`)
            .join('\n');
          const content = `💬 PR #${entry.prNumber} (${entry.repoFullName}): ${newComments.length} new comment(s)\n${preview}`;
          await opts.deliverMessage({
            threadId: entry.threadId,
            userId: entry.userId,
            catId: targetCatId,
            content,
            source: 'github_review_comments',
          });
        }
        opts.log.info(`[review-comments] ${subjectKey}: ${signal.newComments.length} new comment(s)`);
        // Advance cursor only after successful delivery + processing
        signal.commitCursor();
      },
    },
    state: { runLedger: 'sqlite' },
    outcome: { whenNoSignal: 'record' },
    enabled: () => true,
    actor: { role: 'repo-watcher', costTier: 'cheap' },
  };
}
