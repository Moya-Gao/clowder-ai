/**
 * Push Notification Routes — Web Push 订阅管理
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { IPushSubscriptionStore } from '../domains/cats/services/stores/ports/PushSubscriptionStore.js';
import type { PushNotificationService } from '../domains/cats/services/push/PushNotificationService.js';
import { AuditEventTypes, getEventAuditLog } from '../domains/cats/services/orchestration/EventAuditLog.js';

export interface PushRoutesOptions {
  pushSubscriptionStore: IPushSubscriptionStore;
  pushService: PushNotificationService | null;
  vapidPublicKey: string;
  auditLog?: {
    append(input: { type: string; threadId?: string; data: Record<string, unknown> }): Promise<unknown>;
  };
}

function resolveUserId(request: { headers: Record<string, string | string[] | undefined> }): string | null {
  const v = request.headers['x-cat-cafe-user'];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim().length > 0) return v[0].trim();
  const legacy = request.headers['x-user-id'];
  if (typeof legacy === 'string' && legacy.trim().length > 0) return legacy.trim();
  return null;
}

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const pushRoutes: FastifyPluginAsync<PushRoutesOptions> = async (app, opts) => {
  const { pushSubscriptionStore, pushService, vapidPublicKey } = opts;
  const auditLog = opts.auditLog ?? getEventAuditLog();

  function describeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.host}...${endpoint.slice(-12)}`;
    } catch {
      return `invalid...${endpoint.slice(-12)}`;
    }
  }

  async function appendPushAudit(
    request: { log: { warn: (obj: unknown, msg?: string) => void } },
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await auditLog.append({ type, data });
    } catch (err) {
      request.log.warn({ err, type }, 'push audit append failed');
    }
  }

  // GET /api/push/vapid-public-key — 前端获取 VAPID 公钥
  // enabled = pushService is fully configured (both VAPID keys present)
  app.get('/api/push/vapid-public-key', async () => {
    if (!vapidPublicKey || !pushService) {
      return { key: null, enabled: false };
    }
    return { key: vapidPublicKey, enabled: true };
  });

  // POST /api/push/subscribe — 注册推送订阅
  app.post('/api/push/subscribe', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }

    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid subscription', details: parsed.error.issues };
    }

    const { subscription, userAgent } = parsed.data;
    await pushSubscriptionStore.upsert({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userId,
      createdAt: Date.now(),
      ...(userAgent ? { userAgent } : {}),
    });
    await appendPushAudit(request, AuditEventTypes.PUSH_SUBSCRIPTION_UPSERTED, {
      userId,
      endpoint: describeEndpoint(subscription.endpoint),
      hasUserAgent: Boolean(userAgent),
    });

    return { status: 'ok' };
  });

  // DELETE /api/push/subscribe — 取消推送订阅
  app.delete('/api/push/subscribe', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }

    const parsed = unsubscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: 'Invalid request', details: parsed.error.issues };
    }

    const removed = await pushSubscriptionStore.removeForUser(userId, parsed.data.endpoint);
    if (!removed) {
      reply.status(404);
      return { error: 'Subscription not found or not owned by this user' };
    }
    await appendPushAudit(request, AuditEventTypes.PUSH_SUBSCRIPTION_REMOVED, {
      userId,
      endpoint: describeEndpoint(parsed.data.endpoint),
      removed,
    });
    return { status: 'ok', removed };
  });

  // POST /api/push/test — 调试用：给自己发测试推送
  app.post('/api/push/test', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }
    await appendPushAudit(request, AuditEventTypes.PUSH_TEST_REQUESTED, {
      userId,
      proxyConfigured: Boolean(
        process.env['HTTPS_PROXY']
          || process.env['https_proxy']
          || process.env['HTTP_PROXY']
          || process.env['http_proxy']
          || process.env['ALL_PROXY']
          || process.env['all_proxy'],
      ),
    });

    if (!pushService) {
      reply.status(503);
      await appendPushAudit(request, AuditEventTypes.PUSH_TEST_RESULT, {
        userId,
        ok: false,
        httpStatus: 503,
        error: 'push_not_configured',
      });
      return { error: 'Push not configured (missing VAPID keys)' };
    }

    const subscriptions = await pushSubscriptionStore.listByUser(userId);
    if (subscriptions.length === 0) {
      reply.status(409);
      await appendPushAudit(request, AuditEventTypes.PUSH_TEST_RESULT, {
        userId,
        ok: false,
        httpStatus: 409,
        error: 'no_active_subscription',
        subscriptions: 0,
      });
      return { error: 'No active push subscriptions for this user. Please enable push on this device first.' };
    }

    const delivery = await pushService.notifyUser(userId, {
      title: '🐱 猫猫测试推送',
      body: '如果你看到这条通知，说明推送配置成功了！',
      tag: 'push-test',
      data: { url: '/', forceSystemNotification: true },
    });

    if (delivery.delivered === 0) {
      reply.status(502);
      if (delivery.removed > 0 && delivery.failed === 0) {
        await appendPushAudit(request, AuditEventTypes.PUSH_TEST_RESULT, {
          userId,
          ok: false,
          httpStatus: 502,
          error: 'subscription_expired',
          delivery,
        });
        return {
          error: '该设备推送订阅已过期，请先关闭并重新开启推送后再试。',
          delivery,
        };
      }
      await appendPushAudit(request, AuditEventTypes.PUSH_TEST_RESULT, {
        userId,
        ok: false,
        httpStatus: 502,
        error: 'push_delivery_failed',
        delivery,
      });
      return {
        error: '系统通知投递失败，请检查 API 代理/网络后重试。',
        delivery,
      };
    }

    await appendPushAudit(request, AuditEventTypes.PUSH_TEST_RESULT, {
      userId,
      ok: true,
      httpStatus: 200,
      delivery,
    });

    return {
      status: 'ok',
      message: '系统通知已请求发送，请查看系统通知中心。',
      delivery,
    };
  });
};
