import { describe, expect, it } from 'vitest';
import {
  shouldForceSystemNotification,
  shouldShowSystemNotification,
  type PushNotificationPayload,
} from '@/utils/push-notification-policy';

describe('push notification policy', () => {
  it('always shows when no focused client', () => {
    const payload: PushNotificationPayload = { tag: 'cat-reply-thread-1' };
    expect(shouldShowSystemNotification(payload, false)).toBe(true);
  });

  it('forces system notification for test push', () => {
    const payload: PushNotificationPayload = { tag: 'push-test' };
    expect(shouldForceSystemNotification(payload)).toBe(true);
    expect(shouldShowSystemNotification(payload, true)).toBe(true);
  });

  it('forces system notification for auth request', () => {
    const payload: PushNotificationPayload = { tag: 'auth-req-123' };
    expect(shouldForceSystemNotification(payload)).toBe(true);
  });

  it('forces system notification for decision tag', () => {
    const payload: PushNotificationPayload = { tag: 'cat-decision-thread-1' };
    expect(shouldForceSystemNotification(payload)).toBe(true);
  });

  it('forces system notification for decision-like content', () => {
    const payload: PushNotificationPayload = {
      tag: 'cat-reply-thread-1',
      title: '猫猫需要你决策',
      body: '请确认是否允许合入',
    };
    expect(shouldForceSystemNotification(payload)).toBe(true);
  });

  it('does not force generic reply when focused', () => {
    const payload: PushNotificationPayload = {
      tag: 'cat-reply-thread-1',
      title: '猫猫回复了',
      body: '这里是普通回复',
    };
    expect(shouldForceSystemNotification(payload)).toBe(false);
    expect(shouldShowSystemNotification(payload, true)).toBe(false);
  });

  it('respects explicit force flag in payload data', () => {
    const payload: PushNotificationPayload = {
      tag: 'cat-reply-thread-1',
      data: { forceSystemNotification: true },
    };
    expect(shouldForceSystemNotification(payload)).toBe(true);
  });
});
