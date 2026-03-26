/**
 * F139: ConflictCheckTaskSpec — detect PR merge conflicts via injectable check.
 *
 * Gate: list tracked PRs → checkMergeable per PR → filter CONFLICTING → workItems.
 * Execute: log notification (notification routing deferred to wiring phase).
 */
import type { TaskSpec_P1 } from '../scheduler/types.js';
import type { IPrTrackingStore, PrTrackingEntry } from './PrTrackingStore.js';

export interface ConflictCheckTaskSpecOptions {
  readonly prTrackingStore: IPrTrackingStore;
  /** Injectable merge-state checker — returns GitHub mergeStateStatus string */
  readonly checkMergeable: (repoFullName: string, prNumber: number) => Promise<string>;
  readonly log: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
  readonly pollIntervalMs?: number;
}

interface ConflictSignal {
  entry: PrTrackingEntry;
  mergeState: string;
}

export function createConflictCheckTaskSpec(opts: ConflictCheckTaskSpecOptions): TaskSpec_P1<ConflictSignal> {
  return {
    id: 'conflict-check',
    profile: 'poller',
    trigger: { type: 'interval', ms: opts.pollIntervalMs ?? 5 * 60 * 1000 },
    admission: {
      async gate() {
        const entries = await opts.prTrackingStore.listAll();
        if (entries.length === 0) {
          return { run: false, reason: 'no tracked PRs' };
        }

        const conflicting: { entry: PrTrackingEntry; mergeState: string }[] = [];
        for (const entry of entries) {
          try {
            const state = await opts.checkMergeable(entry.repoFullName, entry.prNumber);
            if (state === 'CONFLICTING') {
              conflicting.push({ entry, mergeState: state });
            }
          } catch {
            // fail-open: skip PRs where check fails
          }
        }

        if (conflicting.length === 0) {
          return { run: false, reason: 'no conflicting PRs' };
        }

        return {
          run: true,
          workItems: conflicting.map((c) => ({
            signal: c,
            subjectKey: `pr-${c.entry.repoFullName}#${c.entry.prNumber}`,
          })),
        };
      },
    },
    run: {
      overlap: 'skip',
      timeoutMs: 30_000,
      async execute(signal: ConflictSignal, subjectKey: string) {
        opts.log.info(`[conflict-check] ${subjectKey}: merge state = ${signal.mergeState}`);
      },
    },
    state: { runLedger: 'sqlite' },
    outcome: { whenNoSignal: 'record' },
    enabled: () => true,
  };
}
