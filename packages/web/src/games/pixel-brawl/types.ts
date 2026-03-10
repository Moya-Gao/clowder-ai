export type FighterId = 'opus46' | 'opus45' | 'codex' | 'gpt54';
export type FighterState = 'idle' | 'run' | 'jump' | 'attack' | 'hurt';
export type Facing = 'left' | 'right';
export type GameMode = 'pvai' | 'aivai';

export interface Fighter {
  id: FighterId;
  name: string;
  teamColor: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  facing: Facing;
  state: FighterState;
  attackCooldownMs: number;
  /** true while the current swing has already landed a hit */
  hitLanded: boolean;
}

export interface GameConfig {
  width: 640;
  height: 360;
  zoom: 2;
  seed: number;
  mode: GameMode;
}

export interface HitResult {
  attackerId: FighterId;
  defenderId: FighterId;
  damage: number;
  knockback: number;
}

export const TEAM_COLORS: Record<FighterId, string> = {
  opus46: '#2C57A6',
  opus45: '#79C9FF',
  codex: '#2FA56E',
  gpt54: '#D7AB43',
};

export const FIGHTER_NAMES: Record<FighterId, string> = {
  opus46: 'OPUS 4.6',
  opus45: 'OPUS 4.5',
  codex: 'CODEX',
  gpt54: 'GPT 5.4',
};

export const PALETTE = {
  ink: '#111318',
  slate: '#1E2430',
  steel: '#3A4658',
  bone: '#E8DFC7',
  danger: '#D84E3B',
  flash: '#F1E28A',
  dj: '#8D6BFF',
} as const;

export const GROUND_Y = 300;
export const ATTACK_DAMAGE = 10;
export const ATTACK_COOLDOWN_MS = 400;
export const ATTACK_RANGE = 60;
export const HURT_DURATION_MS = 300;
export const KNOCKBACK_FORCE = 120;
