/**
 * Leadership Projector (Phase D)
 *
 * Subscribes to ActivityEventBus and translates co-creator-relevant events
 * into leadership footfall via LeadershipService.awardXp().
 *
 * Straightforward mappings are handled here. Stateful/session-level sources
 * (tool_category_breadth, new_skill_first_use, feature_initiated) are wired in AC-D2.
 * Shadow sources (direction_confirmed, feedback_applied) are wired in AC-D3.
 */

import type { ActivityEvent, LeadershipFootfallSource } from '@cat-cafe/shared';
import { createModuleLogger } from '../../infrastructure/logger.js';
import type { ActivityEventBus } from './ActivityEventBus.js';

const log = createModuleLogger('leadership-projector');

interface LeadershipServiceLike {
  awardXp(source: LeadershipFootfallSource, multiplier?: number): void;
}

/** Minimum participants count to earn target_diversity bonus. */
const DIVERSITY_THRESHOLD = 3;

export class LeadershipProjector {
  constructor(
    private readonly bus: ActivityEventBus,
    private readonly leadershipService: LeadershipServiceLike,
  ) {
    this.bus.on(this.handleEvent);
    log.info('LeadershipProjector subscribed to ActivityEventBus');
  }

  private handleEvent = (event: ActivityEvent): void => {
    try {
      switch (event.type) {
        case 'multi_mention_dispatched':
          this.leadershipService.awardXp('multi_mention_dispatch');
          break;
        case 'multi_mention_completed':
          this.onMultiMention(event);
          break;
        case 'deep_collab_completed':
          this.leadershipService.awardXp('deep_collab_initiated');
          break;
        case 'task_completed':
          this.onTaskCompleted(event);
          break;
        case 'session_sealed':
          this.onSessionSealed(event);
          break;
        case 'tool_used':
          this.onToolUsed(event);
          break;
        // Shadow dimensions (AC-D3): recorded but not displayed in v1
        case 'review_submitted':
          this.leadershipService.awardXp('feedback_applied');
          break;
      }
    } catch (err: unknown) {
      log.warn({ err, type: event.type }, 'LeadershipProjector error');
    }
  };

  private onMultiMention(event: ActivityEvent): void {
    this.leadershipService.awardXp('multi_mention_success');
    // Diversity bonus when dispatching to 3+ different cats
    const participants = event.metadata.participants as string[] | undefined;
    if (participants && participants.length >= DIVERSITY_THRESHOLD) {
      this.leadershipService.awardXp('target_diversity');
    }
  }

  private onTaskCompleted(event: ActivityEvent): void {
    const clarifications = (event.metadata.clarificationCount as number) ?? -1;
    // 引导力: cat completed on first try (zero clarification rounds)
    if (clarifications === 0) {
      this.leadershipService.awardXp('one_shot_completion');
    }
    // 授权力: task finished without co-creator intervention
    const interventions = (event.metadata.interventionCount as number) ?? -1;
    if (interventions === 0) {
      this.leadershipService.awardXp('task_no_intervention');
    }
    // 决策力 (shadow): quick task completion implies good initial direction
    if (clarifications >= 0 && clarifications <= 1) {
      this.leadershipService.awardXp('direction_confirmed');
    }
  }

  private onSessionSealed(event: ActivityEvent): void {
    const clarifications = (event.metadata.clarificationCount as number) ?? -1;
    // 引导力: session with few clarification rounds (≤ 2)
    if (clarifications >= 0 && clarifications <= 2) {
      this.leadershipService.awardXp('low_clarification');
    }
  }

  private onToolUsed(event: ActivityEvent): void {
    const category = event.metadata.category as string | undefined;
    // 开拓力: using MCP/skill tools counts as boundary-pushing exploration
    if (category === 'mcp' || category === 'skill') {
      this.leadershipService.awardXp('tool_category_breadth');
    }
  }

  dispose(): void {
    this.bus.off(this.handleEvent);
  }
}
