import type { TranscriptEvent } from '../../../domains/cats/services/session/TranscriptReader.js';
import type { SkillLoadedEvent, ToolEvent } from '../../../domains/cats/services/tool-usage/event-log-types.js';
import { getCapabilityWakeupRules } from './capability-wakeup-rules.js';
import type {
  CapabilityWakeupSourceSelector,
  CapabilityWakeupTrialProvider,
} from './capability-wakeup-trial-provider.js';
import {
  buildCapabilityTrace,
  classifyCapabilityWakeupTrials,
  evaluateCapabilityWakeupTrace,
} from './eval-capability-wakeup-adapter.js';
import type { ClassifiedCapabilityWakeupTrial } from './eval-capability-wakeup-types.js';

/**
 * F192 Phase H 收尾 PR-2 — replay/reclassify provider impl (砚砚 R1 P1).
 *
 * Resolves a `CapabilityWakeupSourceSelector` to classified trials by:
 *   1. enumerating selector.sessionIds (REQUIRED non-empty — PR-2 narrowed; global window scan deferred)
 *   2. resolving each sessionId → SessionRecord (threadId + catId) via sessionStore
 *   3. reading transcript/tool/skill events via real existing ports
 *   4. buildCapabilityTrace → evaluateCapabilityWakeupTrace → classifyCapabilityWakeupTrials
 *   5. filter trial.timeSpan.startMs ∈ [windowStartMs, windowEndMs)
 *
 * Constructor fail-closed (砚砚 R1 Q5): missing port → throw. NEVER silent-empty
 * (would manufacture fake misses that look like real signal).
 */

/** Port: just `get(sessionId)` — production wires `SessionChainStore`. */
export interface SessionRecordReader {
  get(
    sessionId: string,
  ): Promise<{ threadId: string; catId: string } | null> | { threadId: string; catId: string } | null;
}

/** Port: paginated transcript reader — production wires `TranscriptReader`. */
export interface TranscriptEventReader {
  readEvents(
    sessionId: string,
    threadId: string,
    catId: string,
    cursor?: { eventNo: number },
    limit?: number,
  ): Promise<{ events: TranscriptEvent[]; nextCursor?: { eventNo: number }; total: number }>;
}

/** Port: thread-scoped tool event log — production wires `ToolEventLog`. */
export interface ToolEventReader {
  readByThread(threadId: string): Promise<ToolEvent[]>;
}

/** Port: session-scoped skill-load event log — production wires `SkillLoadEventLog`. */
export interface SkillLoadEventReader {
  readBySession(sessionId: string): Promise<SkillLoadedEvent[]>;
}

export interface CapabilityWakeupTrialProviderImplDeps {
  sessionStore: SessionRecordReader;
  transcriptReader: TranscriptEventReader;
  toolEventLog: ToolEventReader;
  skillLoadEventLog: SkillLoadEventReader;
  /** Override rules registry for tests; defaults to module-level static registry. */
  rulesRegistry?: typeof getCapabilityWakeupRules;
}

export class CapabilityWakeupTrialProviderImpl implements CapabilityWakeupTrialProvider {
  private readonly sessionStore: SessionRecordReader;
  private readonly transcriptReader: TranscriptEventReader;
  private readonly toolEventLog: ToolEventReader;
  private readonly skillLoadEventLog: SkillLoadEventReader;
  private readonly rulesRegistry: typeof getCapabilityWakeupRules;

  constructor(deps: CapabilityWakeupTrialProviderImplDeps) {
    if (!deps.sessionStore) throw new Error('CapabilityWakeupTrialProviderImpl: missing required port sessionStore');
    if (!deps.transcriptReader)
      throw new Error('CapabilityWakeupTrialProviderImpl: missing required port transcriptReader');
    if (!deps.toolEventLog) throw new Error('CapabilityWakeupTrialProviderImpl: missing required port toolEventLog');
    if (!deps.skillLoadEventLog)
      throw new Error('CapabilityWakeupTrialProviderImpl: missing required port skillLoadEventLog');
    this.sessionStore = deps.sessionStore;
    this.transcriptReader = deps.transcriptReader;
    this.toolEventLog = deps.toolEventLog;
    this.skillLoadEventLog = deps.skillLoadEventLog;
    this.rulesRegistry = deps.rulesRegistry ?? getCapabilityWakeupRules;
  }

  async resolve(selector: CapabilityWakeupSourceSelector): Promise<ClassifiedCapabilityWakeupTrial[]> {
    if (selector.kind !== 'capability-wakeup-trial-window') {
      throw new Error(
        `unsupported selector kind: ${selector.kind} (PR-2 only supports capability-wakeup-trial-window; trial-ids deferred to durable trial store PR)`,
      );
    }
    if (!selector.sessionIds || selector.sessionIds.length === 0) {
      throw new Error(
        'sessionIds is REQUIRED non-empty (PR-2 narrowed; global window scan needs userId/thread enumeration — deferred to future PR)',
      );
    }
    const rules = this.rulesRegistry({ capability: selector.capability, ruleIds: selector.ruleIds });
    if (rules.length === 0) return [];

    // cloud R7 P2 (PR-2): dedupe sessionIds before replay — duplicate sessionId
    // would otherwise replay the same transcript and append the same classified
    // trials repeatedly → inflated trial counts → biased verdict.
    const uniqueSessionIds = [...new Set(selector.sessionIds)];
    const allClassified: ClassifiedCapabilityWakeupTrial[] = [];
    for (const sessionId of uniqueSessionIds) {
      const session = await Promise.resolve(this.sessionStore.get(sessionId));
      if (!session) {
        throw new Error(`session_not_found: ${sessionId}`);
      }
      const transcriptEvents = await this.readAllTranscriptEvents(sessionId, session.threadId, session.catId);
      const toolEvents = await this.toolEventLog.readByThread(session.threadId);
      const skillLoadEvents = await this.skillLoadEventLog.readBySession(sessionId);

      const trace = buildCapabilityTrace({
        sessionId,
        threadId: session.threadId,
        catId: session.catId,
        transcriptEvents,
        toolEvents,
        skillLoadEvents,
      });

      const trials = evaluateCapabilityWakeupTrace(trace, rules);
      const classified = classifyCapabilityWakeupTrials(trace, trials);
      allClassified.push(...classified);
    }

    return allClassified.filter(
      (t) => t.timeSpan.startMs >= selector.windowStartMs && t.timeSpan.startMs < selector.windowEndMs,
    );
  }

  /** Paginate transcript reader until exhausted. Safety cap 100 pages = 50k events. */
  private async readAllTranscriptEvents(
    sessionId: string,
    threadId: string,
    catId: string,
  ): Promise<TranscriptEvent[]> {
    const all: TranscriptEvent[] = [];
    let cursor: { eventNo: number } | undefined;
    let pages = 0;
    const MAX_PAGES = 100;
    const PAGE_SIZE = 500;
    while (pages < MAX_PAGES) {
      const result = await this.transcriptReader.readEvents(sessionId, threadId, catId, cursor, PAGE_SIZE);
      all.push(...result.events);
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
      pages++;
    }
    return all;
  }
}
