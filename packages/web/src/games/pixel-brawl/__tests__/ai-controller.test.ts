import { describe, it, expect } from 'vitest';
import { AiController } from '../ai-controller';
import { GameState } from '../game-state';
import { createRng } from '../rng';

describe('AiController', () => {
  it('deterministic: same seed produces same action sequence', () => {
    const gs1 = new GameState('opus46', 'codex');
    const gs2 = new GameState('opus46', 'codex');
    const ai1 = new AiController('codex', createRng(42));
    const ai2 = new AiController('codex', createRng(42));

    const actions1 = Array.from({ length: 20 }, () => ai1.decide(gs1));
    const actions2 = Array.from({ length: 20 }, () => ai2.decide(gs2));
    expect(actions1).toEqual(actions2);
  });

  it('returns a valid action', () => {
    const gs = new GameState('opus46', 'codex');
    const ai = new AiController('codex', createRng(1));
    const action = ai.decide(gs);
    expect(['idle', 'move_left', 'move_right', 'attack']).toContain(action);
  });

  it('prefers attack when in range', () => {
    const gs = new GameState('opus46', 'codex');
    gs.p1.x = 200;
    gs.p2.x = 230; // close range
    const ai = new AiController('codex', createRng(1));
    // Run 50 decisions — at least some should be 'attack'
    const actions = Array.from({ length: 50 }, () => ai.decide(gs));
    expect(actions.filter((a) => a === 'attack').length).toBeGreaterThan(10);
  });
});
