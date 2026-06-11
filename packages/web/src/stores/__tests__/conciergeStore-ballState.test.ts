/**
 * F229 PR-A2: projectBallState 投影函数表驱动测试
 *
 * 验证 INV-1（全序唯一）/ INV-2（零存储，see conciergeStore-lifecycle.test）/ INV-4（纯函数）
 * micro-spec §1: 任意 inputs 恰好一个输出，含全部相邻优先级冲突对
 */
import { describe, expect, it } from 'vitest';
import { type ConciergeInputs, projectBallState } from '../conciergeStore';

const BASE: ConciergeInputs = {
  enabled: true,
  muted: false,
  invocationStatus: 'idle',
  pendingConfirmationCount: 0,
  pendingRelayCount: 0,
  unseenResultCount: 0,
  panelOpen: false,
  inputFocused: false,
};

function inp(overrides: Partial<ConciergeInputs>): ConciergeInputs {
  return { ...BASE, ...overrides };
}

describe('projectBallState — INV-1 全序唯一', () => {
  // --- hidden cases ---
  it('disabled → hidden', () => {
    expect(projectBallState(inp({ enabled: false }))).toBe('hidden');
  });
  it('muted → hidden', () => {
    expect(projectBallState(inp({ muted: true }))).toBe('hidden');
  });
  it('disabled + muted → hidden (not some other state)', () => {
    expect(projectBallState(inp({ enabled: false, muted: true }))).toBe('hidden');
  });

  // --- error (priority 1 among visible states) ---
  it('error invocation → error', () => {
    expect(projectBallState(inp({ invocationStatus: 'error' }))).toBe('error');
  });
  it('error wins over needs-confirmation', () => {
    expect(projectBallState(inp({ invocationStatus: 'error', pendingConfirmationCount: 1 }))).toBe('error');
  });
  it('error wins over thinking (in_progress)', () => {
    expect(projectBallState(inp({ invocationStatus: 'error', pendingConfirmationCount: 0 }))).toBe('error');
  });

  // --- needs-confirmation (priority 2) ---
  it('pendingConfirmationCount > 0 → needs-confirmation', () => {
    expect(projectBallState(inp({ pendingConfirmationCount: 1 }))).toBe('needs-confirmation');
  });
  it('needs-confirmation wins over thinking', () => {
    expect(projectBallState(inp({ pendingConfirmationCount: 2, invocationStatus: 'pending' }))).toBe(
      'needs-confirmation',
    );
  });

  // --- thinking (priority 3) ---
  it('pending → thinking', () => {
    expect(projectBallState(inp({ invocationStatus: 'pending' }))).toBe('thinking');
  });
  it('in_progress → thinking', () => {
    expect(projectBallState(inp({ invocationStatus: 'in_progress' }))).toBe('thinking');
  });
  it('thinking wins over handoff', () => {
    expect(projectBallState(inp({ invocationStatus: 'pending', pendingRelayCount: 1 }))).toBe('thinking');
  });

  // --- handoff (priority 4) ---
  it('pendingRelayCount > 0 → handoff', () => {
    expect(projectBallState(inp({ pendingRelayCount: 1 }))).toBe('handoff');
  });

  // --- listening (priority 5) ---
  it('panelOpen + inputFocused → listening', () => {
    expect(projectBallState(inp({ panelOpen: true, inputFocused: true }))).toBe('listening');
  });
  it('panelOpen but not focused → NOT listening', () => {
    expect(projectBallState(inp({ panelOpen: true, inputFocused: false }))).not.toBe('listening');
  });

  // --- found (priority 6) ---
  it('unseenResultCount > 0 → found', () => {
    expect(projectBallState(inp({ unseenResultCount: 3 }))).toBe('found');
  });

  // --- idle (default) ---
  it('all zeros → idle', () => {
    expect(projectBallState(BASE)).toBe('idle');
  });

  // --- INV-4: pure function — same inputs → same output ---
  it('same inputs called twice return identical output (INV-4 pure)', () => {
    const inputs = inp({ unseenResultCount: 2 });
    expect(projectBallState(inputs)).toBe(projectBallState(inputs));
  });
});

describe('projectBallState — 清除规则状态转移', () => {
  it('found → idle when unseenResultCount cleared to 0', () => {
    expect(projectBallState(inp({ unseenResultCount: 0 }))).toBe('idle');
  });

  it('error → idle when invocationStatus resets to idle', () => {
    expect(projectBallState(inp({ invocationStatus: 'idle' }))).toBe('idle');
  });

  it('handoff → found transition: pendingRelayCount=0 and unseenResultCount=1', () => {
    // relay回执到达 → pendingRelayCount-1, unseenResultCount+1
    expect(projectBallState(inp({ pendingRelayCount: 0, unseenResultCount: 1 }))).toBe('found');
  });
});
