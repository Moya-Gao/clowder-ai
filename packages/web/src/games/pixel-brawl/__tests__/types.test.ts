import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  TEAM_COLORS,
  FIGHTER_NAMES,
  FIGHTER_STATS,
  ALL_FIGHTER_IDS,
} from '../types';

describe('types', () => {
  it('every FighterId has a skill, color, name, and stats', () => {
    for (const id of ALL_FIGHTER_IDS) {
      expect(TEAM_COLORS[id]).toBeDefined();
      expect(FIGHTER_NAMES[id]).toBeDefined();
      expect(FIGHTER_STATS[id]).toBeDefined();
      expect(SKILLS[FIGHTER_STATS[id].skillId]).toBeDefined();
    }
  });

  it('all skills have positive cooldown and non-negative damage', () => {
    for (const [, skill] of Object.entries(SKILLS)) {
      expect(skill.cooldownMs).toBeGreaterThan(0);
      expect(skill.durationMs).toBeGreaterThanOrEqual(0);
      expect(skill.damage).toBeGreaterThanOrEqual(0);
    }
  });

  it('ALL_FIGHTER_IDS has exactly 4 entries', () => {
    expect(ALL_FIGHTER_IDS).toHaveLength(4);
  });
});
