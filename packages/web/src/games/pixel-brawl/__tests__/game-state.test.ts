import { describe, it, expect } from 'vitest';
import { GameState } from '../game-state';

describe('GameState', () => {
  it('creates two fighters with full HP', () => {
    const gs = new GameState('opus46', 'codex');
    expect(gs.p1.hp).toBe(100);
    expect(gs.p2.hp).toBe(100);
    expect(gs.p1.id).toBe('opus46');
    expect(gs.p2.id).toBe('codex');
  });

  it('p1 starts facing right, p2 facing left', () => {
    const gs = new GameState('opus46', 'codex');
    expect(gs.p1.facing).toBe('right');
    expect(gs.p2.facing).toBe('left');
  });

  it('applyDamage reduces HP and clamps to 0', () => {
    const gs = new GameState('opus46', 'codex');
    gs.applyDamage('codex', 30);
    expect(gs.p2.hp).toBe(70);
    gs.applyDamage('codex', 80);
    expect(gs.p2.hp).toBe(0);
  });

  it('isOver returns true when any fighter HP reaches 0', () => {
    const gs = new GameState('opus46', 'codex');
    expect(gs.isOver()).toBe(false);
    gs.applyDamage('opus46', 100);
    expect(gs.isOver()).toBe(true);
  });

  it('winner returns the fighter with HP > 0', () => {
    const gs = new GameState('opus46', 'codex');
    gs.applyDamage('codex', 100);
    expect(gs.winner()).toBe('opus46');
  });

  it('checkHit returns HitResult when in range and attacking', () => {
    const gs = new GameState('opus46', 'codex');
    gs.p1.x = 100;
    gs.p2.x = 140; // within ATTACK_RANGE (60)
    gs.p1.state = 'attack';
    const hit = gs.checkHit('opus46');
    expect(hit).not.toBeNull();
    expect(hit!.damage).toBe(10);
  });

  it('checkHit returns null when out of range', () => {
    const gs = new GameState('opus46', 'codex');
    gs.p1.x = 100;
    gs.p2.x = 300; // way out of range
    gs.p1.state = 'attack';
    expect(gs.checkHit('opus46')).toBeNull();
  });

  it('P1-1: checkHit only hits once per attack swing', () => {
    const gs = new GameState('opus46', 'codex');
    gs.p1.x = 100;
    gs.p2.x = 140; // within range
    gs.p1.state = 'attack';

    // First check hits
    const hit1 = gs.checkHit('opus46');
    expect(hit1).not.toBeNull();

    // Consume the hit
    gs.consumeHit('opus46');

    // Second check on same swing should NOT hit
    const hit2 = gs.checkHit('opus46');
    expect(hit2).toBeNull();
  });

  it('P1-1: new attack after cooldown can hit again', () => {
    const gs = new GameState('opus46', 'codex');
    gs.p1.x = 100;
    gs.p2.x = 140;
    gs.p1.state = 'attack';

    gs.checkHit('opus46');
    gs.consumeHit('opus46');
    expect(gs.checkHit('opus46')).toBeNull();

    // Simulate new attack swing
    gs.p1.state = 'idle';
    gs.p1.state = 'attack';
    gs.resetSwing('opus46');
    const hit = gs.checkHit('opus46');
    expect(hit).not.toBeNull();
  });
});
