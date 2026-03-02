/**
 * Push Notification Service
 * 通过 Web Push 向铲屎官的所有设备推送通知
 *
 * Best-effort: 推送失败不影响主流程，410 Gone 自动清理过期订阅
 */

import webpush from 'web-push';
import type { IPushSubscriptionStore, PushSubscriptionRecord } from '../stores/ports/PushSubscriptionStore.js';

const DEFAULT_WEB_PUSH_TIMEOUT_MS = 10_000;

function asNonEmptyString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isHttpProxyUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function resolveWebPushProxy(): string | undefined {
  const candidates = [
    process.env['HTTPS_PROXY'],
    process.env['https_proxy'],
    process.env['HTTP_PROXY'],
    process.env['http_proxy'],
    process.env['ALL_PROXY'],
    process.env['all_proxy'],
  ];

  for (const candidate of candidates) {
    const proxy = asNonEmptyString(candidate);
    if (!proxy) continue;
    if (isHttpProxyUrl(proxy)) return proxy;
  }
  return undefined;
}

function resolveWebPushTimeoutMs(): number {
  const raw = asNonEmptyString(process.env['WEB_PUSH_TIMEOUT_MS']);
  if (!raw) return DEFAULT_WEB_PUSH_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WEB_PUSH_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

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
  private readonly proxy: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts: PushNotificationServiceOptions) {
    this.store = opts.subscriptionStore;
    this.proxy = resolveWebPushProxy();
    this.timeoutMs = resolveWebPushTimeoutMs();
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
    const sendOptions: webpush.RequestOptions = {
      TTL: 60 * 60, // 1 hour TTL
      timeout: this.timeoutMs,
    };
    if (this.proxy) {
      sendOptions.proxy = this.proxy;
    }
    try {
      await webpush.sendNotification(pushSub, body, sendOptions);
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
