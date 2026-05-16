'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { settingsResourceCardClass } from '../SettingsResourceCard';
import { InstallPreviewModal } from './InstallPreviewModal';

type ServiceStatus = 'healthy' | 'unhealthy' | 'not_configured';
type ServiceAction = 'install' | 'start' | 'stop' | 'uninstall';

interface ModelOption {
  name: string;
  size: string;
  autoDownload: boolean;
  isDefault?: boolean;
  description?: string;
}

interface ServicePrerequisites {
  runtime?: string;
  packages?: string[];
  models?: ModelOption[];
  estimatedMinutes?: number;
}

interface ServiceState {
  id: string;
  name: string;
  description: string;
  category: 'voice' | 'memory' | 'audio';
  endpoint: string | null;
  configured: boolean;
  status: ServiceStatus;
  features: string[];
  availableActions: ServiceAction[];
  prerequisites?: ServicePrerequisites;
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

const ACTION_CONFIG: Record<ServiceAction, { label: string; tone: string }> = {
  install: { label: 'Install', tone: 'bg-cafe-interactive text-white hover:opacity-90' },
  start: { label: 'Start', tone: 'bg-conn-emerald-bg text-conn-emerald-text hover:opacity-80' },
  stop: { label: 'Stop', tone: 'bg-conn-amber-bg text-conn-amber-text hover:opacity-80' },
  uninstall: { label: 'Uninstall', tone: 'bg-rose-100 text-rose-700 hover:opacity-80' },
};

const ROW_CLASS = 'flex items-center gap-4 px-5 py-4';

function serviceMatchesFilter(service: ServiceState, filterFeatures?: string[]): boolean {
  if (!filterFeatures?.length) return true;
  return service.features.some((feature) => filterFeatures.includes(feature));
}

export function ServiceStatusPanel({ filterFeatures, title }: ServiceStatusPanelProps) {
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [installTarget, setInstallTarget] = useState<ServiceState | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/services');
      if (!res.ok) {
        setServices([]);
        return;
      }
      const payload = (await res.json()) as { services?: unknown };
      const list = Array.isArray(payload.services) ? (payload.services as ServiceState[]) : [];
      setServices(list.filter((service) => serviceMatchesFilter(service, filterFeatures)));
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [filterFeatures]);

  useEffect(() => {
    let cancelled = false;
    void fetchServices().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [fetchServices]);

  async function executeAction(serviceId: string, action: ServiceAction, model?: string) {
    setActionInProgress(serviceId);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/services/${serviceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'install' && model ? JSON.stringify({ model }) : '{}',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setActionError({ id: serviceId, message: data.error ?? `${action} failed` });
      }
      await fetchServices();
    } catch {
      setActionError({ id: serviceId, message: `${action} request failed` });
    } finally {
      setActionInProgress(null);
    }
  }

  function handleAction(service: ServiceState, action: ServiceAction) {
    if (action === 'install' && service.prerequisites?.models?.length) {
      setInstallTarget(service);
      return;
    }
    void executeAction(service.id, action);
  }

  if (loading) return null;
  if (services.length === 0) return null;

  return (
    <div className="space-y-3">
      {title && <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cafe-muted">{title}</p>}
      {services.map((service) => {
        const cfg = STATUS_CONFIG[service.status] ?? STATUS_CONFIG.not_configured;
        const isBusy = actionInProgress === service.id;
        const error = actionError?.id === service.id ? actionError.message : null;

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
                {error && <p className="mt-0.5 text-[11px] text-conn-red-text">{error}</p>}
              </div>
              {service.availableActions.length > 0 && (
                <div className="flex shrink-0 gap-2">
                  {service.availableActions.map((action) => {
                    const acfg = ACTION_CONFIG[action];
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAction(service, action)}
                        className={`rounded-[10px] px-3 py-1.5 text-[11px] font-bold transition-colors ${acfg.tone} disabled:opacity-50`}
                      >
                        {isBusy ? '...' : acfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {installTarget?.prerequisites && (
        <InstallPreviewModal
          serviceName={installTarget.name}
          prerequisites={installTarget.prerequisites}
          onConfirm={(model) => {
            const id = installTarget.id;
            setInstallTarget(null);
            void executeAction(id, 'install', model);
          }}
          onCancel={() => setInstallTarget(null)}
        />
      )}
    </div>
  );
}
