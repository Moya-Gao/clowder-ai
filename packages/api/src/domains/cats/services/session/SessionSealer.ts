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

import type { CatId, SealResult, SessionStatus } from '@cat-cafe/shared';
import type { ISessionChainStore } from '../stores/ports/SessionChainStore.js';
import type { IThreadStore } from '../stores/ports/ThreadStore.js';
import { buildThreadMemory } from './buildThreadMemory.js';
import { generateHandoffDigest } from './HandoffDigestGenerator.js';
import { formatEventsChat, formatEventsHandoff } from './TranscriptFormatter.js';
import type { TranscriptReader } from './TranscriptReader.js';
import type { ExtractiveDigestV1, TranscriptWriter } from './TranscriptWriter.js';

export type SealReason = 'threshold' | 'manual' | 'error' | (string & {});

/**
 * F065 Phase C: Handoff digest configuration.
 * Injectable functions for testability and per-thread resolution.
 */
export interface HandoffConfig {
  getBootstrapDepth: (catId: string) => 'extractive' | 'generative';
  resolveProfile: (threadId: string, catId: string) => Promise<{ apiKey: string; baseUrl: string } | null>;
  fetchFn?: typeof fetch;
}

export interface ISessionSealer {
  /**
   * Request seal of a session. Idempotent: returns accepted=false if already sealing/sealed.
   * Fast path: only changes status + clears active pointer.
   */
  requestSeal(args: { sessionId: string; reason: SealReason }): Promise<SealResult>;

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
 * F065 Phase B: Optionally updates ThreadMemory on seal.
 * F065 Phase C: Optionally generates handoff digest via Haiku.
 */
export class SessionSealer implements ISessionSealer {
  constructor(
    private readonly store: ISessionChainStore,
    private readonly transcriptWriter?: TranscriptWriter,
    private readonly threadStore?: IThreadStore,
    private readonly transcriptReader?: TranscriptReader,
    private readonly getMaxPromptTokens?: (catId: CatId) => number,
    private readonly handoffConfig?: HandoffConfig,
  ) {}

  async requestSeal(args: { sessionId: string; reason: SealReason }): Promise<SealResult> {
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

    // F065 Phase B: Update thread memory after successful digest write
    if (this.threadStore && this.transcriptReader) {
      try {
        const digest = await this.transcriptReader.readDigest(record.id, record.threadId, record.catId);
        if (digest) {
          const existingMemory = await this.threadStore.getThreadMemory(record.threadId);
          // KD-5 dynamic cap: min(3000, floor(maxPromptTokens * 0.03)), floor 1200
          const maxPrompt = this.getMaxPromptTokens?.(record.catId as CatId) ?? 180000;
          const maxTokens = Math.max(1200, Math.min(3000, Math.floor(maxPrompt * 0.03)));
          const updated = buildThreadMemory(existingMemory, digest as unknown as ExtractiveDigestV1, maxTokens);
          await this.threadStore.updateThreadMemory(record.threadId, updated);
        }
      } catch {
        // best-effort: thread memory update failure doesn't prevent sealing
      }
    }

    // F065 Phase C: Generate handoff digest (best-effort, after ThreadMemory)
    if (this.handoffConfig && this.transcriptReader) {
      try {
        const depth = this.handoffConfig.getBootstrapDepth(record.catId);
        if (depth === 'generative') {
          const profile = await this.handoffConfig.resolveProfile(record.threadId, record.catId);
          if (profile?.apiKey) {
            const allEvents = await this.transcriptReader.readAllEvents(record.id, record.threadId, record.catId);
            if (allEvents.length > 0) {
              const handoffSummaries = formatEventsHandoff(allEvents);
              const chatMessages = formatEventsChat(allEvents);
              const extractive = await this.transcriptReader.readDigest(record.id, record.threadId, record.catId);

              const result = await generateHandoffDigest({
                handoffSummaries,
                extractiveDigest: extractive ?? {},
                recentMessages: chatMessages.slice(-8),
                apiKey: profile.apiKey,
                baseUrl: profile.baseUrl,
                ...(this.handoffConfig.fetchFn ? { fetchFn: this.handoffConfig.fetchFn } : {}),
              });

              if (result) {
                const sessionDir = this.transcriptReader.getSessionDir(record.threadId, record.catId, record.id);
                const { TranscriptWriter: TW } = await import('./TranscriptWriter.js');
                await TW.writeHandoffDigest(
                  sessionDir,
                  {
                    v: result.v,
                    model: result.model,
                    generatedAt: result.generatedAt,
                  },
                  result.body,
                );
              }
            }
          }
        }
      } catch {
        // best-effort: handoff digest failure doesn't prevent sealing
      }
    }

    await this.store.update(args.sessionId, {
      status: 'sealed',
      sealedAt: now,
      updatedAt: now,
    });
  }
}
