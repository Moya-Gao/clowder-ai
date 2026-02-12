/**
 * Frontend URL/origin resolution shared by screenshot export and CORS setup.
 */

export interface WarnLoggerLike {
  warn: (...args: unknown[]) => void;
}

const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:3001';
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

function normalizeConfiguredUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return rawUrl.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeConfiguredOrigin(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseFrontendPort(rawPort: string | undefined): number | null {
  const trimmed = rawPort?.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

export function resolveFrontendBaseUrl(
  env: NodeJS.ProcessEnv,
  logger?: WarnLoggerLike,
): string {
  const rawFrontendUrl = env['FRONTEND_URL']?.trim();
  if (rawFrontendUrl) {
    const normalizedUrl = normalizeConfiguredUrl(rawFrontendUrl);
    if (normalizedUrl) {
      return normalizedUrl;
    }
    logger?.warn(
      { frontendUrl: rawFrontendUrl },
      '[thread-export] Invalid FRONTEND_URL, fallback to FRONTEND_PORT/default',
    );
  }

  const rawFrontendPort = env['FRONTEND_PORT'];
  const frontendPort = parseFrontendPort(rawFrontendPort);
  if (frontendPort !== null) {
    return `http://localhost:${frontendPort}`;
  }

  if (rawFrontendPort?.trim()) {
    logger?.warn(
      { frontendPort: rawFrontendPort },
      '[thread-export] Invalid FRONTEND_PORT, fallback to localhost:3001',
    );
  }

  return DEFAULT_FRONTEND_BASE_URL;
}

export function resolveFrontendCorsOrigins(
  env: NodeJS.ProcessEnv,
  logger?: WarnLoggerLike,
): string[] {
  const origins = new Set<string>(DEFAULT_CORS_ORIGINS);

  const rawFrontendUrl = env['FRONTEND_URL']?.trim();
  if (rawFrontendUrl) {
    const normalizedOrigin = normalizeConfiguredOrigin(rawFrontendUrl);
    if (normalizedOrigin) {
      origins.add(normalizedOrigin);
    } else {
      logger?.warn(
        { frontendUrl: rawFrontendUrl },
        '[cors] Invalid FRONTEND_URL, ignored custom origin',
      );
    }
  }

  const rawFrontendPort = env['FRONTEND_PORT'];
  const frontendPort = parseFrontendPort(rawFrontendPort);
  if (frontendPort !== null) {
    origins.add(`http://localhost:${frontendPort}`);
  } else if (rawFrontendPort?.trim()) {
    logger?.warn(
      { frontendPort: rawFrontendPort },
      '[cors] Invalid FRONTEND_PORT, fallback to default origins',
    );
  }

  return [...origins];
}
