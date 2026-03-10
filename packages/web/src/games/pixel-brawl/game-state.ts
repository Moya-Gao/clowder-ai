import {
  type Fighter,
  type FighterId,
  type HitResult,
  TEAM_COLORS,
  FIGHTER_NAMES,
  GROUND_Y,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  KNOCKBACK_FORCE,
} from './types';

function createFighter(
  id: FighterId,
  x: number,
  facing: 'left' | 'right',
): Fighter {
  return {
    id,
    name: FIGHTER_NAMES[id],
    teamColor: TEAM_COLORS[id],
    hp: 100,
    maxHp: 100,
    x,
    y: GROUND_Y,
    facing,
    state: 'idle',
    attackCooldownMs: 0,
    hitLanded: false,
  };
}

export class GameState {
  p1: Fighter;
  p2: Fighter;

  constructor(p1Id: FighterId, p2Id: FighterId) {
    this.p1 = createFighter(p1Id, 160, 'right');
    this.p2 = createFighter(p2Id, 480, 'left');
  }

  getFighter(id: FighterId): Fighter {
    return this.p1.id === id ? this.p1 : this.p2;
  }

  getOpponent(id: FighterId): Fighter {
    return this.p1.id === id ? this.p2 : this.p1;
  }

  applyDamage(targetId: FighterId, damage: number): void {
    const target = this.getFighter(targetId);
    target.hp = Math.max(0, target.hp - damage);
  }

  isOver(): boolean {
    return this.p1.hp <= 0 || this.p2.hp <= 0;
  }

  winner(): FighterId | null {
    if (this.p1.hp <= 0) return this.p2.id;
    if (this.p2.hp <= 0) return this.p1.id;
    return null;
  }

  checkHit(attackerId: FighterId): HitResult | null {
    const attacker = this.getFighter(attackerId);
    const defender = this.getOpponent(attackerId);

    if (attacker.state !== 'attack') return null;
    if (attacker.hitLanded) return null;

    const distance = Math.abs(attacker.x - defender.x);
    if (distance > ATTACK_RANGE) return null;

    return {
      attackerId,
      defenderId: defender.id,
      damage: ATTACK_DAMAGE,
      knockback: KNOCKBACK_FORCE,
    };
  }

  /** Mark current swing as having landed — prevents multi-hit */
  consumeHit(attackerId: FighterId): void {
    this.getFighter(attackerId).hitLanded = true;
  }

  /** Reset swing flag for a new attack */
  resetSwing(attackerId: FighterId): void {
    this.getFighter(attackerId).hitLanded = false;
  }
}
