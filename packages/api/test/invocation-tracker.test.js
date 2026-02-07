/**
 * InvocationTracker Tests
 * userId 鉴权 + 基本调用追踪
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { InvocationTracker } = await import(
  '../dist/domains/cats/services/InvocationTracker.js'
);

describe('InvocationTracker userId auth', () => {
  test('start records userId and getUserId returns it', () => {
    const tracker = new InvocationTracker();
    tracker.start('thread-1', 'alice');
    assert.equal(tracker.getUserId('thread-1'), 'alice');
  });

  test('cancel with matching userId succeeds', () => {
    const tracker = new InvocationTracker();
    tracker.start('thread-1', 'alice');
    const result = tracker.cancel('thread-1', 'alice');
    assert.equal(result, true);
    assert.equal(tracker.has('thread-1'), false);
  });

  test('cancel with mismatched userId is rejected', () => {
    const tracker = new InvocationTracker();
    tracker.start('thread-1', 'alice');
    const result = tracker.cancel('thread-1', 'bob');
    assert.equal(result, false);
    // Invocation should still be active
    assert.equal(tracker.has('thread-1'), true);
    assert.equal(tracker.getUserId('thread-1'), 'alice');
  });

  test('cancel without requestUserId allows cancel (backward compat)', () => {
    const tracker = new InvocationTracker();
    tracker.start('thread-1', 'alice');
    const result = tracker.cancel('thread-1');
    assert.equal(result, true);
    assert.equal(tracker.has('thread-1'), false);
  });
});
