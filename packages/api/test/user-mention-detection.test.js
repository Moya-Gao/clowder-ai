import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectUserMention } from '../dist/routes/user-mention.js';

describe('detectUserMention', () => {
  it('detects @铲屎官 at line start', () => {
    assert.equal(detectUserMention('请看这个\n@铲屎官\n帮忙确认'), true);
  });

  it('detects @user at line start', () => {
    assert.equal(detectUserMention('@user 请帮忙看看'), true);
  });

  it('ignores @铲屎官 in middle of line', () => {
    assert.equal(detectUserMention('告诉@铲屎官这件事'), false);
  });

  it('ignores @user inside code block', () => {
    assert.equal(detectUserMention('```\n@user\n```'), false);
  });

  it('returns false for no mention', () => {
    assert.equal(detectUserMention('普通消息没有 mention'), false);
  });

  it('handles leading whitespace before @user', () => {
    assert.equal(detectUserMention('  @铲屎官 看看'), true);
  });

  it('returns false for empty string', () => {
    assert.equal(detectUserMention(''), false);
  });

  it('detects @user case-insensitively', () => {
    assert.equal(detectUserMention('@User 请看'), true);
    assert.equal(detectUserMention('@USER 请看'), true);
  });

  it('handles multiple code blocks correctly', () => {
    assert.equal(detectUserMention('```js\n@user\n```\n普通文本\n```\n@铲屎官\n```'), false);
  });

  it('detects @铲屎官 after code block', () => {
    assert.equal(detectUserMention('```\ncode\n```\n@铲屎官 看看'), true);
  });

  it('OQ-1: rejects @user123 (token boundary)', () => {
    assert.equal(detectUserMention('@user123 not a real mention'), false);
  });

  it('OQ-1: rejects @username', () => {
    assert.equal(detectUserMention('@username please check'), false);
  });

  it('OQ-1: accepts @user followed by CJK punctuation', () => {
    assert.equal(detectUserMention('@user，请看'), true);
  });

  it('OQ-1: accepts @user at end of line', () => {
    assert.equal(detectUserMention('@user'), true);
  });

  it('OQ-1: accepts @铲屎官 followed by space', () => {
    assert.equal(detectUserMention('@铲屎官 检查一下'), true);
  });

  it('R2-P2: accepts @user followed by CJK text (no space)', () => {
    assert.equal(detectUserMention('@user请看'), true);
  });

  it('R2-P2: accepts @铲屎官 followed by CJK text (no space)', () => {
    assert.equal(detectUserMention('@铲屎官请看'), true);
  });

  it('R2-P2: still rejects @user followed by ASCII letter', () => {
    assert.equal(detectUserMention('@userfoo'), false);
  });

  // F067 owner-config: configured mention patterns
  it('detects configured owner @landy at line start', () => {
    assert.equal(detectUserMention('@landy 请看'), true);
    assert.equal(detectUserMention('@Landy 请看'), true);
  });

  it('detects configured owner @lysander at line start', () => {
    assert.equal(detectUserMention('@lysander 帮忙确认'), true);
  });

  it('detects configured owner @l.s. at line start', () => {
    assert.equal(detectUserMention('@l.s. 看看'), true);
  });

  it('rejects @landy continuation (e.g. @landyFoo)', () => {
    assert.equal(detectUserMention('@landyFoo not a mention'), false);
  });

  it('accepts @landy followed by CJK text', () => {
    assert.equal(detectUserMention('@landy请看'), true);
  });
});
