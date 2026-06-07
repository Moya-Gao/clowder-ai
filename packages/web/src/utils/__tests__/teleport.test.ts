import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetPendingTeleportForTest,
  consumePendingTeleport,
  planTeleport,
  resolvePendingTeleport,
  setPendingTeleport,
} from '../teleport';

describe('planTeleport', () => {
  beforeEach(() => __resetPendingTeleportForTest());

  it('same thread → scrollNow, no navigation, no pending recorded', () => {
    const plan = planTeleport({ threadId: 'thread_a', messageId: 'm1', currentThreadId: 'thread_a' });
    expect(plan).toEqual({ scrollNow: 'm1', navigateTo: null });
    // same-thread records no pending
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBeNull();
  });

  it('different thread → navigateTo + records pending for that thread', () => {
    const plan = planTeleport({ threadId: 'thread_b', messageId: 'm2', currentThreadId: 'thread_a' });
    expect(plan).toEqual({ scrollNow: null, navigateTo: 'thread_b' });
    expect(resolvePendingTeleport('thread_b', ['m2'], { authoritative: true })).toBe('m2');
  });

  it('null currentThreadId (cold load) → treated as cross-thread navigation', () => {
    const plan = planTeleport({ threadId: 'thread_b', messageId: 'm2', currentThreadId: null });
    expect(plan).toEqual({ scrollNow: null, navigateTo: 'thread_b' });
  });
});

describe('pending teleport', () => {
  beforeEach(() => __resetPendingTeleportForTest());

  it('consume returns the target for the matching thread, then clears it (one-shot)', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    expect(consumePendingTeleport('thread_a')).toEqual({ threadId: 'thread_a', messageId: 'm1' });
    expect(consumePendingTeleport('thread_a')).toBeNull();
  });

  it('consume returns null on thread mismatch, and the pending survives', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    expect(consumePendingTeleport('thread_b')).toBeNull();
    expect(consumePendingTeleport('thread_a')).not.toBeNull();
  });

  it('set overwrites any prior pending (latest teleport wins)', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    setPendingTeleport({ threadId: 'thread_c', messageId: 'm2' });
    expect(consumePendingTeleport('thread_a')).toBeNull();
    expect(consumePendingTeleport('thread_c')).toEqual({ threadId: 'thread_c', messageId: 'm2' });
  });

  it('consume returns null when nothing is pending', () => {
    expect(consumePendingTeleport('thread_a')).toBeNull();
  });
});

describe('resolvePendingTeleport', () => {
  beforeEach(() => __resetPendingTeleportForTest());

  it('returns null when there is no pending target for the thread', () => {
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBeNull();
  });

  it('consumes on a hit, regardless of the authoritative flag', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: false })).toBe('m1');
    // consumed → no re-scroll on later renders
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBeNull();
  });

  it('tentative (stale IDB) miss KEEPS pending so a fresh page can still resolve', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    expect(resolvePendingTeleport('thread_a', ['m-other'], { authoritative: false })).toBeNull();
    // fresh authoritative page contains the target → resolves
    expect(resolvePendingTeleport('thread_a', ['m1', 'm-other'], { authoritative: true })).toBe('m1');
  });

  it('authoritative miss consumes pending (real paged-out, no infinite retry)', () => {
    setPendingTeleport({ threadId: 'thread_a', messageId: 'missing' });
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBeNull();
    // proven consumed: re-setting a matching pending resolves again
    setPendingTeleport({ threadId: 'thread_a', messageId: 'm1' });
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBe('m1');
  });

  it('does not consume a pending target meant for a different thread', () => {
    setPendingTeleport({ threadId: 'thread_other', messageId: 'm1' });
    expect(resolvePendingTeleport('thread_a', ['m1'], { authoritative: true })).toBeNull();
    expect(resolvePendingTeleport('thread_other', ['m1'], { authoritative: true })).toBe('m1');
  });
});
