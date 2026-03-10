import type { GameState } from './game-state';
import type { FighterId } from './types';
import { ATTACK_RANGE } from './types';

export type AiAction = 'idle' | 'move_left' | 'move_right' | 'attack';

interface Rng {
  random(): number;
  pick<T>(arr: readonly T[]): T;
}

export class AiController {
  constructor(
    private fighterId: FighterId,
    private rng: Rng,
  ) {}

  decide(gs: GameState): AiAction {
    const me = gs.getFighter(this.fighterId);
    const opp = gs.getOpponent(this.fighterId);
    const dist = Math.abs(me.x - opp.x);

    // In attack range → high chance to attack
    if (dist <= ATTACK_RANGE && me.attackCooldownMs <= 0) {
      return this.rng.random() < 0.7 ? 'attack' : 'idle';
    }

    // Out of range → move toward opponent
    if (dist > ATTACK_RANGE) {
      const moveDir = opp.x > me.x ? 'move_right' : 'move_left';
      // 80% approach, 10% other dir, 10% idle
      const roll = this.rng.random();
      if (roll < 0.8) return moveDir;
      if (roll < 0.9) return moveDir === 'move_right' ? 'move_left' : 'move_right';
      return 'idle';
    }

    return this.rng.pick(['idle', 'attack', 'move_left', 'move_right'] as const);
  }
}
