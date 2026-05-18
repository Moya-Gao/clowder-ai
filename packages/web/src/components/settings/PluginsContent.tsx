'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { HubIcon } from '../hub-icons';
import {
  settingsResourceAvatarClass,
  settingsResourceCardClass,
  settingsResourceRowClass,
} from '../SettingsResourceCard';
import { GithubConfigPanel } from './GithubConfigPanel';
import {
  adaptServiceState,
  adaptServiceToPlugin,
  type HomeServiceState,
  type PluginUiItem,
  type PluginUiStatus,
} from './service-ui-adapter';

const BADGE_CLASS: Record<PluginUiStatus, string> = {
  active: 'bg-conn-emerald-bg text-conn-emerald-text',
  configured: 'bg-conn-amber-bg text-conn-amber-text',
  available: 'bg-cafe-surface-sunken text-cafe-muted',
};

export function PluginsContent() {
  const [plugins, setPlugins] = useState<PluginUiItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cancellation guard pattern
    async function fetchServices() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch('/api/services');
        if (cancelled) return;
        if (!res.ok) {
          setError(`服务清单加载失败 (${res.status})`);
          return;
        }
        const payload = (await res.json()) as { services?: unknown };
        if (cancelled) return;
        const list = Array.isArray(payload.services) ? (payload.services as HomeServiceState[]) : [];
        setPlugins(list.map((s) => adaptServiceToPlugin(adaptServiceState(s))));
      } catch {
        if (!cancelled) setError('服务清单加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchServices();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <article className={settingsResourceCardClass}>
        <button
          type="button"
          className={`${settingsResourceRowClass} w-full text-left`}
          onClick={() => setExpandedId(expandedId === 'github' ? null : 'github')}
        >
          <div className={settingsResourceAvatarClass} style={{ backgroundColor: '#24292e' }}>
            <HubIcon name="key" className="h-5 w-5 text-[var(--cafe-surface)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cafe">GitHub</p>
            <p className="mt-0.5 text-xs text-cafe-secondary">PR 追踪、Review 投递、CI/CD 监控与 Token 配置</p>
            <p className="mt-0.5 text-xs text-cafe-muted">内置插件</p>
          </div>
          <span className="shrink-0 rounded-xl bg-conn-emerald-bg px-2.5 py-0.5 text-xs font-bold text-conn-emerald-text">
            可配置
          </span>
        </button>
        {expandedId === 'github' && <GithubConfigPanel />}
      </article>

      {loading ? (
        <p className="text-sm text-cafe-muted">加载中...</p>
      ) : error ? (
        <p className="text-sm text-[var(--semantic-error-text)]">{error}</p>
      ) : (
        plugins.map((plugin) => (
          <article key={plugin.id} className={settingsResourceCardClass}>
            <div className={settingsResourceRowClass}>
              <div className={settingsResourceAvatarClass}>{plugin.name.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cafe">{plugin.name}</p>
                <p className="mt-0.5 text-xs text-cafe-secondary">{plugin.description}</p>
                <p className="mt-0.5 text-xs text-cafe-muted">扩展服务</p>
              </div>
              <span className={`shrink-0 rounded-xl px-2.5 py-0.5 text-xs font-bold ${BADGE_CLASS[plugin.status]}`}>
                {plugin.statusLabel}
              </span>
            </div>
            {plugin.features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {plugin.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-[var(--console-hover-bg)] px-2 py-0.5 text-[10px] font-semibold text-cafe-secondary"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
            {plugin.error && <p className="px-4 pb-3 text-xs text-conn-red-text">{plugin.error}</p>}
          </article>
        ))
      )}
    </div>
  );
}
