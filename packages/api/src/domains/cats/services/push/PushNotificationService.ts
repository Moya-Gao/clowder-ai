/**
 * Push Notification Service
 * 通过 Web Push 向铲屎官的所有设备推送通知
 *
 * Best-effort: 推送失败不影响主流程，410 Gone 自动清理过期订阅
 */

import webpush from 'web-push';
import type { IPushSubscriptionStore, PushSubscriptionRecord } from '../stores/ports/PushSubscriptionStore.js';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: {
    threadId?: string;
    url?: string;
    forceSystemNotification?: boolean;
    requiresDecision?: boolean;
  };
}

export interface PushNotificationServiceOptions {
  subscriptionStore: IPushSubscriptionStore;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export class PushNotificationService {
  private readonly store: IPushSubscriptionStore;

  constructor(opts: PushNotificationServiceOptions) {
    this.store = opts.subscriptionStore;
    webpush.setVapidDetails(opts.vapidSubject, opts.vapidPublicKey, opts.vapidPrivateKey);
  }

  /** Push to all subscribed devices (best-effort). */
  async notifyAll(payload: PushPayload): Promise<void> {
    const subs = await this.store.listAll();
    await this.sendToAll(subs, payload);
  }

  /** Push to a specific user's devices (best-effort). */
  async notifyUser(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.store.listByUser(userId);
    await this.sendToAll(subs, payload);
  }

  private async sendToAll(subs: PushSubscriptionRecord[], payload: PushPayload): Promise<void> {
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((sub) => this.sendOne(sub, body)),
    );

    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[push] Push delivery failed:', r.reason);
      }
    }
  }

  private async sendOne(sub: PushSubscriptionRecord, body: string): Promise<void> {
    const pushSub: webpush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: sub.keys,
    };
    try {
      await webpush.sendNotification(pushSub, body, { TTL: 60 * 60 }); // 1 hour TTL
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 410 Gone or 404 = subscription expired, auto-cleanup
      if (statusCode === 410 || statusCode === 404) {
        console.log(`[push] Removing expired subscription: ${sub.endpoint.slice(0, 60)}...`);
        await this.store.remove(sub.endpoint);
        return;
      }
      throw err;
    }
  }
}

/** Singleton — initialized by index.ts, null if VAPID keys not configured. */
let pushServiceInstance: PushNotificationService | null = null;

export function initPushNotificationService(opts: PushNotificationServiceOptions): PushNotificationService {
  pushServiceInstance = new PushNotificationService(opts);
  return pushServiceInstance;
}

export function getPushNotificationService(): PushNotificationService | null {
  return pushServiceInstance;
}
