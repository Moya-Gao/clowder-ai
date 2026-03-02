'use client';

/**
 * usePushNotify — 管理 Web Push 订阅状态
 *
 * - 检查浏览器/PWA 是否支持推送
 * - 管理订阅 (subscribe/unsubscribe)
 * - 从后端获取 VAPID 公钥
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/utils/api-client';

/** Convert base64url VAPID key to Uint8Array for pushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export interface UsePushNotifyReturn {
  /** Browser supports Web Push + SW is available */
  isSupported: boolean;
  /** Currently subscribed to push notifications */
  isSubscribed: boolean;
  /** Loading state during subscribe/unsubscribe */
  isLoading: boolean;
  /** Subscribe to push notifications (triggers permission prompt) */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Send a test push to verify it works */
  sendTest: () => Promise<{ ok: boolean; message: string }>;
}

export function usePushNotify(): UsePushNotifyReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);

  // Check support + current subscription on mount
  useEffect(() => {
    const check = async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      setIsSupported(true);

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(sub !== null);
      } catch {
        // SW not yet active or push not available
      }
    };
    void check();
  }, []);

  const fetchVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;
    try {
      const res = await apiFetch('/api/push/vapid-public-key');
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.enabled || !data.key) return null;
      vapidKeyRef.current = data.key as string;
      return data.key as string;
    } catch {
      return null;
    }
  }, []);

  const subscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        console.warn('[push] VAPID key not available — push disabled on server');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const subJson = sub.toJSON();
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          },
          userAgent: navigator.userAgent,
        }),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('[push] Subscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchVapidKey]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiFetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    try {
      const res = await apiFetch('/api/push/test', { method: 'POST' });

      let serverMessage: string | null = null;
      try {
        const payload = (await res.json()) as { message?: unknown; error?: unknown };
        if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
          serverMessage = payload.message;
        } else if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
          serverMessage = payload.error;
        }
      } catch {
        // response body may be empty/non-json
      }

      if (!res.ok) {
        return {
          ok: false,
          message: serverMessage ?? `请求失败（HTTP ${res.status}）`,
        };
      }

      return {
        ok: true,
        message: serverMessage ?? '测试推送已发送',
      };
    } catch (err) {
      console.error('[push] Test push failed:', err);
      return {
        ok: false,
        message: '网络异常，测试通知发送失败',
      };
    }
  }, []);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe, sendTest };
}
