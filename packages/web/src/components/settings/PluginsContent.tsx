'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

type ServiceStatus = 'healthy' | 'unhealthy' | 'not_configured';

interface ServiceState {
  id: string;
  name: string;
  description: string;
  endpoint: string | null;
  configured: boolean;
  status: ServiceStatus;
  features: string[];
  availableActions: [];
  error?: string | null;
}

function describeStatus(status: ServiceStatus): string {
  if (status === 'healthy') return '运行中';
  if (status === 'unhealthy') return '不可用';
  return '未配置';
}

function statusClass(status: ServiceStatus): string {
  if (status === 'healthy') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'unhealthy') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function PluginsContent() {
  const [services, setServices] = useState<ServiceState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

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
        setServices(Array.isArray(payload.services) ? (payload.services as ServiceState[]) : []);
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

  if (loading) return <p className="text-sm text-cafe-muted">加载中...</p>;
  if (error) return <p className="text-sm text-[var(--semantic-error-text)]">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <article key={service.id} className="rounded-xl border border-cafe bg-cafe-surface p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold text-cafe">{service.name}</h3>
                <p className="text-xs text-cafe-secondary">{service.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(service.status)}`}
              >
                {describeStatus(service.status)}
              </span>
            </div>

            <div className="space-y-1 text-xs text-cafe-secondary">
              <p className="truncate">Endpoint: {service.endpoint ? service.endpoint : '未设置'}</p>
              {service.error && <p className="text-rose-700">Error: {service.error}</p>}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {service.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-cafe bg-cafe-surface-elevated px-2 py-0.5 text-[11px] text-cafe-secondary"
                >
                  {feature}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
