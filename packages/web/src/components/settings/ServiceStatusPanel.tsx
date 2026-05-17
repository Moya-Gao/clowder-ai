'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api-client';
import { HubIcon } from '../hub-icons';
import { SettingsResourceIconButton, settingsResourceCardClass } from '../SettingsResourceCard';
import { InstallPreviewModal } from './InstallPreviewModal';
import { adaptServiceState, type HomeServiceState, type ServiceUiState } from './service-ui-adapter';

const STATUS_DOT: Record<string, string> = {
  running: 'bg-conn-emerald-text',
  stopped: 'bg-cafe-surface-sunken',
  not_configured: 'bg-cafe-surface-sunken',
  error: 'bg-conn-red-text',
  installing: 'bg-conn-amber-text',
  starting: 'bg-conn-amber-text',
};

const ACTION_CONFIG: Record<string, { label: string; tone: string }> = {
  install: { label: 'Install', tone: 'bg-cafe-interactive text-white hover:opacity-90' },
  start: { label: 'Start', tone: 'bg-conn-emerald-bg text-conn-emerald-text hover:opacity-80' },
  stop: { label: 'Stop', tone: 'bg-conn-amber-bg text-conn-amber-text hover:opacity-80' },
};

const ROW_CLASS = 'flex items-center gap-4 px-5 py-4';
const LOG_POLL_MS = 2000;

interface ServiceStatusPanelProps {
  filterFeatures?: string[];
  title?: string;
}

function serviceMatchesFilter(service: HomeServiceState, filterFeatures?: string[]): boolean {
  if (!filterFeatures?.length) return true;
  return service.features.some((f) => filterFeatures.includes(f));
}

export function ServiceStatusPanel({ filterFeatures, title }: ServiceStatusPanelProps) {
  const [services, setServices] = useState<ServiceUiState[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [installTarget, setInstallTarget] = useState<ServiceUiState | null>(null);
  const [progress, setProgress] = useState<Map<string, string>>(new Map());
  const pollRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const fetchServices = useCallback(async () => {
    try {
      const res = await apiFetch('/api/services');
      if (!res.ok) {
        setServices([]);
        return;
      }
      const payload = (await res.json()) as { services?: unknown };
      const list = Array.isArray(payload.services) ? (payload.services as HomeServiceState[]) : [];
      setServices(list.filter((s) => serviceMatchesFilter(s, filterFeatures)).map(adaptServiceState));
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [filterFeatures]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const polls = pollRef.current;
    return () => {
      for (const interval of polls.values()) clearInterval(interval);
      polls.clear();
    };
  }, []);

  function startLogPoll(serviceId: string) {
    stopLogPoll(serviceId);
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/services/${serviceId}/logs`);
        if (!res.ok) return;
        const data = (await res.json()) as { lines?: string[] };
        const lastLine = data.lines?.filter(Boolean).pop();
        if (lastLine) setProgress((prev) => new Map(prev).set(serviceId, lastLine));
      } catch {
        /* ignore polling errors */
      }
    }, LOG_POLL_MS);
    pollRef.current.set(serviceId, interval);
  }

  function stopLogPoll(serviceId: string) {
    const existing = pollRef.current.get(serviceId);
    if (existing) {
      clearInterval(existing);
      pollRef.current.delete(serviceId);
    }
  }

  async function executeAction(serviceId: string, action: string, model?: string) {
    setActing((prev) => new Set(prev).add(serviceId));
    setActionError(null);
    if (action === 'install' || action === 'start') startLogPoll(serviceId);
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
      stopLogPoll(serviceId);
      setProgress((prev) => {
        const next = new Map(prev);
        next.delete(serviceId);
        return next;
      });
      setActing((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
    }
  }

  function handleAction(service: ServiceUiState, action: string) {
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
        const dotClass = STATUS_DOT[service.status] ?? STATUS_DOT.not_configured;
        const isBusy = acting.has(service.id);
        const error = actionError?.id === service.id ? actionError.message : null;
        const logLine = progress.get(service.id);

        return (
          <div key={service.id} className={settingsResourceCardClass}>
            <div className={ROW_CLASS}>
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-cafe">{service.name}</p>
                <p className="mt-0.5 truncate text-xs text-cafe-muted">
                  {service.category} · {service.statusLabel}
                  {service.endpoint ? ` · ${service.endpoint}` : ''}
                </p>
                {service.error && <p className="mt-0.5 truncate text-[11px] text-conn-red-text">{service.error}</p>}
                {error && <p className="mt-0.5 text-[11px] text-conn-red-text">{error}</p>}
                {logLine && <p className="mt-0.5 truncate font-mono text-[11px] text-cafe-muted">{logLine}</p>}
              </div>

              {service.availableActions.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  {service.availableActions
                    .filter((a) => a !== 'uninstall')
                    .map((action) => {
                      const acfg = ACTION_CONFIG[action];
                      if (!acfg) return null;
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
                  {service.availableActions.includes('uninstall') && (
                    <SettingsResourceIconButton
                      tone="danger"
                      disabled={isBusy}
                      onClick={() => void executeAction(service.id, 'uninstall')}
                      title="Uninstall"
                    >
                      <HubIcon name="trash" className="h-3.5 w-3.5" />
                    </SettingsResourceIconButton>
                  )}
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
