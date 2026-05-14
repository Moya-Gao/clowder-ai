'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { settingsResourceCardClass } from '../SettingsResourceCard';

type ServiceStatus = 'healthy' | 'unhealthy' | 'not_configured';

interface ServiceState {
  id: string;
  name: string;
  description: string;
  category: 'voice' | 'memory' | 'audio';
  endpoint: string | null;
  configured: boolean;
  status: ServiceStatus;
  features: string[];
  availableActions: [];
  error?: string | null;
}

interface ServiceStatusPanelProps {
  filterFeatures?: string[];
  title?: string;
}

const STATUS_CONFIG: Record<ServiceStatus, { dot: string; label: string }> = {
  healthy: { dot: 'bg-conn-emerald-text', label: '运行中' },
  unhealthy: { dot: 'bg-conn-red-text', label: '不可用' },
  not_configured: { dot: 'bg-cafe-surface-sunken', label: '未配置' },
};

const ROW_CLASS = 'flex items-center gap-4 px-5 py-4';

function serviceMatchesFilter(service: ServiceState, filterFeatures?: string[]): boolean {
  if (!filterFeatures?.length) return true;
  return service.features.some((feature) => filterFeatures.includes(feature));
}

export function ServiceStatusPanel({ filterFeatures, title }: ServiceStatusPanelProps) {
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchServices() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/services');
        if (cancelled) return;
        if (!res.ok) {
          setServices([]);
          return;
        }
        const payload = (await res.json()) as { services?: unknown };
        if (cancelled) return;
        const list = Array.isArray(payload.services) ? (payload.services as ServiceState[]) : [];
        setServices(list.filter((service) => serviceMatchesFilter(service, filterFeatures)));
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchServices();
    return () => {
      cancelled = true;
    };
  }, [filterFeatures]);

  if (loading) return null;
  if (services.length === 0) return null;

  return (
    <div className="space-y-3">
      {title && <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cafe-muted">{title}</p>}
      {services.map((service) => {
        const cfg = STATUS_CONFIG[service.status] ?? STATUS_CONFIG.not_configured;

        return (
          <div key={service.id} className={settingsResourceCardClass}>
            <div className={ROW_CLASS}>
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-cafe">{service.name}</p>
                <p className="mt-0.5 truncate text-xs text-cafe-muted">
                  {service.category} · {cfg.label}
                  {service.endpoint ? ` · ${service.endpoint}` : ''}
                </p>
                {service.error && <p className="mt-0.5 truncate text-[11px] text-conn-red-text">{service.error}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
