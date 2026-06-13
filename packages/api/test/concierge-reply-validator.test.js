/**
 * ConciergeReplyValidator tests (F229 KD-17)
 *
 * Scans duty cat reply text for [跳过去 R{n}] and [原地看 R{n}] markers.
 * Looks up HandleMap → validates anchor → returns CardBlock actions to inject.
 * Fail-closed: unknown handle → no action (no error).
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('extractConciergeActions', () => {
  let extractConciergeActions;
  let MemoryConciergeHandleMapStore;

  beforeEach(async () => {
    const validatorMod = await import('../dist/domains/concierge/concierge-reply-validator.js');
    extractConciergeActions = validatorMod.extractConciergeActions;
    const storeMod = await import('../dist/domains/concierge/ConciergeHandleMapStore.js');
    MemoryConciergeHandleMapStore = storeMod.MemoryConciergeHandleMapStore;
  });

  it('extracts teleport action from [跳过去 R1]', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 'thread_abc', messageId: 'msg_123', title: 'F229 讨论', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions('你可以看看 [跳过去 R1] 里的讨论', 'thread_c', store);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].action, 'concierge_teleport');
    assert.equal(actions[0].payload.threadId, 'thread_abc');
    assert.equal(actions[0].payload.messageId, 'msg_123');
    assert.equal(actions[0].label, '跳过去：F229 讨论');
  });

  it('extracts peek action from [原地看 R1]', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 'thread_abc', messageId: 'msg_456', title: '记忆搜索', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions('看看这里 [原地看 R1]', 'thread_c', store);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].action, 'concierge_peek');
    assert.equal(actions[0].payload.threadId, 'thread_abc');
    assert.equal(actions[0].payload.messageId, 'msg_456');
    assert.equal(actions[0].label, '原地看：记忆搜索');
  });

  it('extracts both teleport and peek from the same reply', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 't1', messageId: 'm1', title: 'Topic A', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions('你可以 [跳过去 R1] 或者 [原地看 R1]', 'thread_c', store);
    assert.equal(actions.length, 2);
    assert.equal(actions[0].action, 'concierge_teleport');
    assert.equal(actions[1].action, 'concierge_peek');
  });

  it('extracts multiple R-handles from a single reply', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 't1', title: 'Topic A', type: 'thread' } },
      { label: 'R2', anchor: { threadId: 't2', messageId: 'm2', title: 'Topic B', type: 'thread' } },
      { label: 'R3', anchor: { threadId: 't3', messageId: 'm3', title: 'Topic C', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions(
      'R1 讨论了 A [跳过去 R1]，R2 是 B [跳过去 R2]，R3 见 [原地看 R3]',
      'thread_c',
      store,
    );
    assert.equal(actions.length, 3);
    assert.equal(actions[0].payload.threadId, 't1');
    assert.equal(actions[1].payload.threadId, 't2');
    assert.equal(actions[2].payload.threadId, 't3');
  });

  it('fail-closed: unknown R-handle produces no action', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [{ label: 'R1', anchor: { threadId: 't1', title: 'Known', type: 'thread' } }]);

    const actions = await extractConciergeActions('[跳过去 R99] 不存在的 handle', 'thread_c', store);
    assert.equal(actions.length, 0, 'unknown handle should produce no actions');
  });

  it('no markers → empty actions', async () => {
    const store = new MemoryConciergeHandleMapStore();
    const actions = await extractConciergeActions('纯文本回复，没有任何标记', 'thread_c', store);
    assert.deepStrictEqual(actions, []);
  });

  it('deduplicates: same R-handle + same action type → single action', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [{ label: 'R1', anchor: { threadId: 't1', title: 'Dup', type: 'thread' } }]);

    const actions = await extractConciergeActions('[跳过去 R1] 再来一次 [跳过去 R1]', 'thread_c', store);
    assert.equal(actions.length, 1, 'duplicate should be deduplicated');
  });

  // P1-3 fix: concierge_peek without messageId → no-op button on frontend (CardBlock.tsx:189 returns early)
  // Fail-closed: skip peek action when anchor has no messageId
  it('skips peek action when anchor has no messageId (fail-closed)', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 't_thread_only', title: 'Thread Level', type: 'thread' } },
    ]);

    // [原地看 R1] on a handle without messageId → should produce 0 actions
    const actions = await extractConciergeActions('[原地看 R1]', 'thread_c', store);
    assert.equal(actions.length, 0, 'peek without messageId must be skipped (fail-closed)');
  });

  // P1-3: mixed markers — teleport works without messageId, peek does NOT
  it('allows teleport but skips peek on same thread-only handle', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 't_thread_only', title: 'Thread Level', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions('[跳过去 R1] 或者 [原地看 R1]', 'thread_c', store);
    assert.equal(actions.length, 1, 'only teleport should survive');
    assert.equal(actions[0].action, 'concierge_teleport');
  });

  // Cloud P1: non-thread anchors (feature/doc) can't be teleported to —
  // frontend only navigates to real threadIds. Fail-closed: skip teleport for non-thread types.
  it('skips teleport for non-thread anchor types (fail-closed)', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 'feature:F229', title: 'F229 前台猫', type: 'feature' } },
      { label: 'R2', anchor: { threadId: 'docs/decisions/ADR-030.md', title: 'ADR-030', type: 'doc' } },
    ]);

    const actions = await extractConciergeActions('[跳过去 R1] 和 [跳过去 R2]', 'thread_c', store);
    assert.equal(actions.length, 0, 'non-thread anchors must not produce teleport actions');
  });

  it('handles anchor without messageId (thread-level teleport)', async () => {
    const store = new MemoryConciergeHandleMapStore();
    await store.setHandles('thread_c', [
      { label: 'R1', anchor: { threadId: 't_no_msg', title: 'Thread Only', type: 'thread' } },
    ]);

    const actions = await extractConciergeActions('[跳过去 R1]', 'thread_c', store);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].payload.threadId, 't_no_msg');
    assert.strictEqual(actions[0].payload.messageId, undefined);
  });
});
