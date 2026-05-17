'use client';

/**
 * Push Notification Settings Panel
 * 推送通知设置 — CatCafeHub "通知" tab
 *
 * A-1 convergence: added 5-type preference toggles (client-only localStorage)
 * + collapsed diagnostics section.
 */

import { useCallback, useEffect, useState } from 'react';
import { PushServiceConfig } from '@/components/settings/PushServiceConfig';
import { usePushNotify } from '@/hooks/usePushNotify';
import { useToastStore } from '@/stores/toastStore';

const STORAGE_KEY = 'cat-cafe-notify-prefs';

type NotifyTypeId = 'reply' | 'permission' | 'mention' | 'schedule' | 'signal';

const NOTIFY_TYPES: { id: NotifyTypeId; label: string; desc: string; defaultOn: boolean }[] = [
  { id: 'reply', label: '猫猫消息', desc: 'AI 回复和主动消息', defaultOn: true },
  { id: 'permission', label: '权限请求', desc: '猫猫需要授权时通知', defaultOn: true },
  { id: 'mention', label: '@提及', desc: '协作成员提及你时', defaultOn: true },
  { id: 'schedule', label: '定时任务', desc: '定时任务执行结果', defaultOn: true },
  { id: 'signal', label: '信号更新', desc: '新信号入站提醒', defaultOn: false },
];

function loadPrefs(): Record<NotifyTypeId, boolean> {
  const defaults = Object.fromEntries(NOTIFY_TYPES.map((t) => [t.id, t.defaultOn])) as Record<NotifyTypeId, boolean>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

const REPAIR_HINTS: Record<string, string> = {
  push_vapid_key_missing: '服务端未配置 VAPID 公钥，请先补齐推送密钥环境变量。',
  push_not_configured: 'Push 服务未启用，请确认后端已加载推送服务配置。',
  push_subscription_missing: '当前设备未订阅，点击"开启"并允许系统通知。',
  push_last_delivery_failed: '最近一次系统通知投递失败，请查看网络/代理后重试。',
};

function describePermission(permission: NotificationPermission | 'unsupported'): string {
  if (permission === 'granted') return '已授权';
  if (permission === 'denied') return '已拒绝';
  if (permission === 'default') return '未选择';
  return '不支持';
}

function describeDelivery(status: 'ok' | 'error' | 'not_attempted', lastError: string | null): string {
  if (status === 'ok') return '正常';
  if (status === 'error') return `失败${lastError ? ` (${lastError})` : ''}`;
  return '未测试';
}

export function PushSettingsPanel() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    environmentHint,
    lastError,
    status,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotify();
  const addToast = useToastStore((s) => s.addToast);
  const [isTesting, setIsTesting] = useState(false);
  const [lastTestSummary, setLastTestSummary] = useState<{
    attempted: number;
    delivered: number;
    failed: number;
    removed: number;
  } | null>(null);
  const [lastTestMessage, setLastTestMessage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<NotifyTypeId, boolean>>(loadPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const togglePref = useCallback((id: NotifyTypeId) => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setPrefsSaved(true);
    const timer = setTimeout(() => setPrefsSaved(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const result = await sendTest();
      setLastTestSummary(result.deliverySummary ?? null);
      setLastTestMessage(result.message);
      const summary = result.deliverySummary
        ? `（成功 ${result.deliverySummary.delivered} / 失败 ${result.deliverySummary.failed} / 清理 ${result.deliverySummary.removed}）`
        : '';
      addToast({
        type: result.ok ? 'success' : 'error',
        title: result.ok ? '系统通知已请求发送' : '系统通知发送失败',
        message: `${result.message}${summary}`,
        duration: result.ok ? 3000 : 5000,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-cafe">推送通知</h3>
        <div className="rounded-xl border border-conn-amber-ring bg-conn-amber-bg px-4 py-4 space-y-2">
          <p className="text-sm text-conn-amber-text font-medium">{environmentHint ?? '当前浏览器不支持推送通知。'}</p>
          <p className="text-xs text-conn-amber-text">
            iPhone 用户请将 Cat Café 添加到主屏幕后再开启推送（Safari 普通标签页不支持 Web Push）。
          </p>
        </div>
      </div>
    );
  }

  const mappedHints = (status?.errorHints ?? [])
    .map((hint) => REPAIR_HINTS[hint] ?? null)
    .filter((hint): hint is string => Boolean(hint));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-cafe">推送通知</h3>
        <p className="text-sm text-cafe-secondary">
          开启后，猫猫回复、权限请求等会推送到系统通知栏（即使不在 Cat Café 页面）。
        </p>
      </div>

      {/* Subscription toggle */}
      <div className="console-list-card rounded-2xl p-4 shadow-[0_4px_16px_rgba(43,33,26,0.05)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-cafe">{isSubscribed ? '浏览器推送已开启' : '浏览器推送已关闭'}</p>
            <p className="text-xs text-cafe-secondary mt-0.5">
              {isSubscribed ? '猫猫消息会推送到系统通知栏' : '点击开启接收猫猫推送'}
            </p>
          </div>
          <button
            type="button"
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isSubscribed
                ? 'bg-[var(--console-pill-bg)] text-cafe-secondary hover:opacity-80'
                : 'bg-cafe-accent text-[var(--cafe-surface)] hover:bg-cafe-accent-hover'
            } disabled:opacity-50`}
          >
            {isLoading ? '处理中...' : isSubscribed ? '关闭' : '开启'}
          </button>
        </div>
        {isSubscribed && (
          <div className="mt-3 pt-3 border-t border-[var(--console-border-soft)]">
            <button
              type="button"
              onClick={() => {
                void handleSendTest();
              }}
              disabled={isTesting || isLoading}
              className="text-xs text-cafe-interactive hover:text-cafe-accent transition-colors"
            >
              {isTesting ? '发送中...' : '发送测试通知'}
            </button>
          </div>
        )}
      </div>

      {/* Notification preferences */}
      <div className="console-list-card rounded-2xl shadow-[0_4px_16px_rgba(43,33,26,0.05)] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cafe-muted">Preferences</p>
            <p className="text-sm font-semibold text-cafe mt-1">通知偏好</p>
          </div>
          {prefsSaved && <span className="text-[11px] text-conn-emerald-text font-medium">已保存</span>}
        </div>
        <p className="px-4 pb-2 text-[11px] text-cafe-secondary">
          选择需要接收的通知类别。当前仅在客户端生效，不影响后端投递。
        </p>
        <div className="divide-y divide-[var(--console-border-soft)]">
          {NOTIFY_TYPES.map((type) => (
            <label
              key={type.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--console-hover-bg)] transition-colors"
            >
              <input
                type="checkbox"
                checked={prefs[type.id]}
                onChange={() => togglePref(type.id)}
                className="h-4 w-4 rounded border-cafe-accent text-cafe-accent focus:ring-cafe-accent"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-cafe">{type.label}</span>
                <span className="ml-2 text-xs text-cafe-muted">{type.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Errors and hints (always visible) */}
      {environmentHint && (
        <div className="bg-conn-amber-bg border border-conn-amber-ring rounded-lg px-4 py-3">
          <p className="text-xs text-conn-amber-text">{environmentHint}</p>
        </div>
      )}
      {lastError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <p className="text-xs text-rose-700">{lastError}</p>
        </div>
      )}
      {mappedHints.length > 0 && (
        <div className="rounded-xl border border-conn-amber-ring bg-conn-amber-bg px-4 py-3">
          <div className="text-sm font-medium text-conn-amber-text">修复建议</div>
          <ul className="mt-2 space-y-1 text-xs text-conn-amber-text list-disc pl-4">
            {mappedHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      {lastTestSummary && (
        <div className="console-list-card rounded-2xl p-4 shadow-[0_4px_16px_rgba(43,33,26,0.05)] text-xs space-y-1">
          <div className="text-sm font-medium text-cafe">最近测试</div>
          {lastTestMessage && <p className="text-cafe-secondary">{lastTestMessage}</p>}
          <p className="text-cafe-secondary">
            尝试 {lastTestSummary.attempted} · 成功 {lastTestSummary.delivered} · 失败 {lastTestSummary.failed} · 清理{' '}
            {lastTestSummary.removed}
          </p>
        </div>
      )}

      {/* VAPID config — visible when not configured, otherwise inside diagnostics */}
      {!status?.capability.vapidPublicKeyConfigured && <PushServiceConfig />}

      {/* Diagnostics (collapsed by default) */}
      <div className="console-list-card rounded-2xl shadow-[0_4px_16px_rgba(43,33,26,0.05)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDiagnostics((v) => !v)}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[var(--console-hover-bg)]"
        >
          <span
            className="text-[11px] text-cafe-muted transition-transform"
            style={{ transform: showDiagnostics ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            ▾
          </span>
          <span className="text-[13px] font-semibold text-cafe">诊断信息</span>
          <span className="console-pill rounded-full px-2 py-0.5 text-[10px] font-semibold text-cafe-muted">
            {status?.subscription.count ?? 0} 设备
          </span>
        </button>
        {showDiagnostics && (
          <div className="px-4 pb-4 space-y-4">
            {/* Capability matrix */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-3 py-2">
                <div className="text-cafe-muted">权限</div>
                <div
                  className={`font-semibold ${permission === 'granted' ? 'text-conn-emerald-text' : permission === 'denied' ? 'text-conn-red-text' : 'text-conn-amber-text'}`}
                >
                  {describePermission(permission)}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-3 py-2">
                <div className="text-cafe-muted">推送服务</div>
                <div
                  className={`font-semibold ${status?.capability.enabled ? 'text-conn-emerald-text' : 'text-conn-amber-text'}`}
                >
                  {status?.capability.enabled ? '已启用' : '未启用'}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-3 py-2">
                <div className="text-cafe-muted">设备</div>
                <div
                  className={`font-semibold ${status?.subscription.count ? 'text-conn-emerald-text' : 'text-conn-amber-text'}`}
                >
                  {status?.subscription.count ?? 0} 台
                </div>
              </div>
              <div className="rounded-lg border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] px-3 py-2">
                <div className="text-cafe-muted">VAPID</div>
                <div
                  className={`font-semibold ${status?.capability.vapidPublicKeyConfigured ? 'text-conn-emerald-text' : 'text-conn-amber-text'}`}
                >
                  {status?.capability.vapidPublicKeyConfigured ? '已配置' : '未配置'}
                </div>
              </div>
            </div>

            {/* Device list */}
            {status?.subscription.targets && status.subscription.targets.length > 0 && (
              <div>
                <div className="text-xs font-medium text-cafe mb-1.5">已绑定设备</div>
                <ul className="space-y-1 text-xs text-cafe-secondary">
                  {status.subscription.targets.slice(0, 5).map((target) => (
                    <li
                      key={`${target.endpoint}-${target.createdAt}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="font-medium">{target.uaFamily.toUpperCase()}</span>
                      <span className="truncate text-cafe-muted">{target.endpoint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Delivery summary */}
            {status && (
              <div className="text-xs text-cafe-secondary">
                最近投递：
                {describeDelivery(status.delivery.lastResult ?? 'not_attempted', status.delivery.lastError ?? null)}
              </div>
            )}

            {/* VAPID config (also accessible here when already configured) */}
            {status?.capability.vapidPublicKeyConfigured && <PushServiceConfig />}

            {/* PWA guidance */}
            <p className="text-[11px] text-cafe-muted">
              iPhone/iPad：PWA Web Push 需先&ldquo;添加到主屏幕&rdquo;再开启通知（Safari 普通标签页不支持）。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
