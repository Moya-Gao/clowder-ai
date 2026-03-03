import { describe, expect, it } from 'vitest';
import {
  PUSH_TEST_NOTIFICATION_TAG,
  resetPushTestNotification,
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
    const payload: PushNotificationPayload = { tag: PUSH_TEST_NOTIFICATION_TAG };
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

  it('closes previous push-test notifications before showing a new one', async () => {
    const closed: string[] = [];
    const registry = {
      getNotifications: async () => [
        { close: () => closed.push('n1') },
        { close: () => closed.push('n2') },
      ],
    };

    await resetPushTestNotification(registry, PUSH_TEST_NOTIFICATION_TAG);
    expect(closed).toEqual(['n1', 'n2']);
  });

  it('does not close notifications for non push-test tags', async () => {
    const closed: string[] = [];
    const registry = {
      getNotifications: async () => [
        { close: () => closed.push('n1') },
      ],
    };

    await resetPushTestNotification(registry, 'cat-reply-thread-1');
    expect(closed).toEqual([]);
  });

  it('does not throw when notification lookup fails', async () => {
    const registry = {
      getNotifications: async () => {
        throw new Error('unsupported');
      },
    };

    await expect(
      resetPushTestNotification(registry, PUSH_TEST_NOTIFICATION_TAG),
    ).resolves.toBeUndefined();
  });
});
