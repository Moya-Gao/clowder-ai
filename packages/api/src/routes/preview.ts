import type { FastifyPluginAsync } from 'fastify';
import { AuditEventTypes, getEventAuditLog } from '../domains/cats/services/index.js';
import type { PortDiscoveryService } from '../domains/preview/port-discovery.js';
import { validatePort } from '../domains/preview/port-validator.js';

interface PreviewRouteOpts {
  portDiscovery: PortDiscoveryService;
  gatewayPort: number;
  runtimePorts?: number[];
}

export const previewRoutes: FastifyPluginAsync<PreviewRouteOpts> = async (app, opts) => {
  const { portDiscovery, gatewayPort, runtimePorts } = opts;
  const auditLog = getEventAuditLog();

  app.get('/api/preview/status', async () => {
    return { available: true, gatewayPort };
  });

  app.post<{ Body: { port: number; host?: string } }>('/api/preview/validate-port', async (req) => {
    const { port, host } = req.body;
    const result = validatePort(port, { host, gatewaySelfPort: gatewayPort, runtimePorts });
    // Audit: log preview open attempt
    if (result.allowed) {
      auditLog
        .append({
          type: AuditEventTypes.BROWSER_PREVIEW_OPEN,
          data: { port, host: host ?? 'localhost', gatewayPort },
        })
        .catch(() => {});
    }
    return result;
  });

  app.get<{ Querystring: { worktreeId?: string } }>('/api/preview/discovered', async (req) => {
    return portDiscovery.getDiscoveredPorts(req.query.worktreeId);
  });

  // P1-3: Consolidated audit endpoints for preview lifecycle
  app.post<{ Body: { port: number; host?: string; threadId?: string } }>('/api/preview/open', async (req) => {
    const { port, host, threadId } = req.body;
    const result = validatePort(port, { host, gatewaySelfPort: gatewayPort, runtimePorts });
    if (result.allowed) {
      auditLog
        .append({
          type: AuditEventTypes.BROWSER_PREVIEW_OPEN,
          threadId,
          data: { port, host: host ?? 'localhost', gatewayPort },
        })
        .catch(() => {});
    }
    return {
      ...result,
      gatewayUrl: result.allowed ? `http://localhost:${gatewayPort}/?__preview_port=${port}` : undefined,
    };
  });

  app.post<{ Body: { port: number; threadId?: string } }>('/api/preview/close', async (req) => {
    const { port, threadId } = req.body;
    auditLog
      .append({
        type: AuditEventTypes.BROWSER_PREVIEW_CLOSE,
        threadId,
        data: { port },
      })
      .catch(() => {});
    return { ok: true };
  });

  app.post<{ Body: { port: number; url: string; threadId?: string } }>('/api/preview/navigate', async (req) => {
    const { port, url, threadId } = req.body;
    auditLog
      .append({
        type: AuditEventTypes.BROWSER_PREVIEW_NAVIGATE,
        threadId,
        data: { port, url },
      })
      .catch(() => {});
    return { ok: true };
  });
};
