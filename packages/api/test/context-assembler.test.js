/**
 * ContextAssembler Tests
 * 测试历史 context 组装和消息格式化
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/** Helper: create a mock StoredMessage */
function mockMsg(overrides) {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    threadId: 'thread-1',
    userId: 'user-1',
    catId: null,
    content: 'test message',
    mentions: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('formatMessage', () => {
  test('formats user message with 铲屎官', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msg = mockMsg({ content: '你好', timestamp: new Date('2026-02-07T14:02:00').getTime() });
    const result = formatMessage(msg);
    assert.ok(result.includes('14:02'));
    assert.ok(result.includes('铲屎官'));
    assert.ok(result.includes('你好'));
  });

  test('formats cat message with display name', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msg = mockMsg({ catId: 'opus', content: '喵', timestamp: new Date('2026-02-07T14:03:00').getTime() });
    const result = formatMessage(msg);
    assert.ok(result.includes('14:03'));
    assert.ok(result.includes('布偶猫'));
    assert.ok(result.includes('喵'));
  });

  test('formats codex cat message', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msg = mockMsg({ catId: 'codex', content: 'review done' });
    const result = formatMessage(msg);
    assert.ok(result.includes('缅因猫'));
  });

  test('formats gemini cat message', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msg = mockMsg({ catId: 'gemini', content: 'design ready' });
    const result = formatMessage(msg);
    assert.ok(result.includes('暹罗猫'));
  });

  test('truncates long content when truncate option set', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const longContent = 'A'.repeat(600);
    const msg = mockMsg({ content: longContent });
    const result = formatMessage(msg, { truncate: 100 });
    assert.ok(result.includes('A'.repeat(100) + '...'));
    assert.ok(!result.includes('A'.repeat(101)));
  });

  test('does not truncate when content is within limit', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msg = mockMsg({ content: 'short' });
    const result = formatMessage(msg, { truncate: 100 });
    assert.ok(result.includes('short'));
    assert.ok(!result.includes('...'));
  });

  test('does not truncate when no truncate option', async () => {
    const { formatMessage } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const longContent = 'B'.repeat(1000);
    const msg = mockMsg({ content: longContent });
    const result = formatMessage(msg);
    assert.ok(result.includes(longContent));
  });
});

describe('assembleContext', () => {
  test('returns empty for no messages', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const result = assembleContext([]);
    assert.equal(result.contextText, '');
    assert.equal(result.messageCount, 0);
  });

  test('formats single message', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const result = assembleContext([mockMsg({ content: '你好世界' })]);
    assert.ok(result.contextText.includes('[对话历史 - 最近 1 条]'));
    assert.ok(result.contextText.includes('铲屎官'));
    assert.ok(result.contextText.includes('你好世界'));
    assert.ok(result.contextText.endsWith('---'));
    assert.equal(result.messageCount, 1);
  });

  test('formats mixed user and cat messages', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msgs = [
      mockMsg({ catId: null, content: '@布偶 你好', timestamp: 1000 }),
      mockMsg({ catId: 'opus', content: '你好铲屎官', timestamp: 2000 }),
      mockMsg({ catId: 'codex', content: '我也在', timestamp: 3000 }),
    ];
    const result = assembleContext(msgs);
    assert.ok(result.contextText.includes('铲屎官'));
    assert.ok(result.contextText.includes('布偶猫'));
    assert.ok(result.contextText.includes('缅因猫'));
    assert.equal(result.messageCount, 3);
  });

  test('truncates to maxMessages', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msgs = Array.from({ length: 25 }, (_, i) =>
      mockMsg({ content: `msg-${i}`, timestamp: i * 1000 })
    );
    const result = assembleContext(msgs, { maxMessages: 5 });
    assert.equal(result.messageCount, 5);
    // Should include the last 5 (msg-20 through msg-24)
    assert.ok(result.contextText.includes('msg-24'));
    assert.ok(result.contextText.includes('msg-20'));
    assert.ok(!result.contextText.includes('msg-19'));
  });

  test('truncates long message content', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const longContent = 'X'.repeat(600);
    const msgs = [mockMsg({ content: longContent })];
    const result = assembleContext(msgs, { maxContentLength: 100 });
    assert.ok(result.contextText.includes('X'.repeat(100) + '...'));
    assert.ok(!result.contextText.includes('X'.repeat(101)));
  });

  test('includes user messages starting with "Error:" (no false-positive filtering)', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msgs = [
      mockMsg({ catId: null, content: 'Error: Cannot find module "foo"', timestamp: 1000 }),
      mockMsg({ catId: null, content: '正常消息', timestamp: 2000 }),
      mockMsg({ catId: 'opus', content: '猫猫回复', timestamp: 3000 }),
    ];
    const result = assembleContext(msgs);
    assert.equal(result.messageCount, 3);
    assert.ok(result.contextText.includes('Error: Cannot find module'));
    assert.ok(result.contextText.includes('正常消息'));
    assert.ok(result.contextText.includes('猫猫回复'));
  });

  test('uses default maxMessages=20 and maxContentLength=500', async () => {
    const { assembleContext } = await import(
      '../dist/domains/cats/services/ContextAssembler.js'
    );
    const msgs = Array.from({ length: 25 }, (_, i) =>
      mockMsg({ content: `m${i}`, timestamp: i * 1000 })
    );
    const result = assembleContext(msgs);
    assert.equal(result.messageCount, 20);
    assert.ok(result.contextText.includes('最近 20 条'));
  });
});
