/**
 * SessionSealer — F24 Phase B+C
 * Manages session lifecycle transitions: active → sealing → sealed.
 *
 * Two methods:
 * - requestSeal(): fast path — CAS status change + clear active pointer
 * - finalize(): slow path — transcript JSONL flush + digest + mark sealed
 *
 * Invoke pipeline is responsible for detecting thresholds and calling requestSeal().
 * SessionSealer is responsible for the lifecycle state machine.
 */

import type { SessionStatus, SealResult } from '@cat-cafe/shared';
import type { ISessionChainStore } from '../stores/ports/SessionChainStore.js';
import type { TranscriptWriter } from './TranscriptWriter.js';

export type SealReason = 'threshold' | 'manual' | 'error' | (string & {});

export interface ISessionSealer {
  /**
   * Request seal of a session. Idempotent: returns accepted=false if already sealing/sealed.
   * Fast path: only changes status + clears active pointer.
   */
  requestSeal(args: {
    sessionId: string;
    reason: SealReason;
  }): Promise<SealResult>;

  /**
   * Finalize a sealing session: write transcript, generate digest, mark sealed.
   * Phase B stub: just transitions sealing → sealed.
   * Phase C will add transcript + digest logic.
   */
  finalize(args: { sessionId: string }): Promise<void>;
}

/**
 * In-memory SessionSealer implementation.
 * Uses ISessionChainStore for all state mutations.
 * Optionally uses TranscriptWriter for Phase C transcript flush.
 */
export class SessionSealer implements ISessionSealer {
  constructor(
    private readonly store: ISessionChainStore,
    private readonly transcriptWriter?: TranscriptWriter,
  ) {}

  async requestSeal(args: {
    sessionId: string;
    reason: SealReason;
  }): Promise<SealResult> {
    const record = await this.store.get(args.sessionId);
    if (!record) {
      return { accepted: false, status: 'sealed' };
    }

    // CAS: only active sessions can be sealed
    // Snapshot status before mutation (memory store returns live reference)
    const currentStatus: SessionStatus = record.status;
    if (currentStatus !== 'active') {
      return { accepted: false, status: currentStatus };
    }

    // Transition active → sealing
    const now = Date.now();
    const updated = await this.store.update(args.sessionId, {
      status: 'sealing',
      sealReason: args.reason,
      updatedAt: now,
    });

    if (!updated || updated.status !== 'sealing') {
      // Race condition: another caller got there first
      return { accepted: false, status: updated?.status ?? 'sealed' };
    }

    return {
      accepted: true,
      status: 'sealing',
      sessionId: args.sessionId,
    };
  }

  async finalize(args: { sessionId: string }): Promise<void> {
    const record = await this.store.get(args.sessionId);
    if (!record) return;

    // Only finalize sessions in sealing state
    if (record.status !== 'sealing') return;

    const now = Date.now();

    // Phase C: Flush transcript + index + extractive digest
    if (this.transcriptWriter) {
      try {
        await this.transcriptWriter.flush(
          {
            sessionId: record.id,
            threadId: record.threadId,
            catId: record.catId,
            cliSessionId: record.cliSessionId,
            seq: record.seq,
          },
          { createdAt: record.createdAt, sealedAt: now },
        );
      } catch {
        // best-effort: transcript flush failure doesn't prevent sealing
      }
    }

    await this.store.update(args.sessionId, {
      status: 'sealed',
      sealedAt: now,
      updatedAt: now,
    });
  }
}
