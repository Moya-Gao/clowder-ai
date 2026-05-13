import { maskUrlCredentials } from '../../config/env-registry.js';

export type ServiceStatus = 'healthy' | 'unhealthy' | 'not_configured';

export interface ServiceManifest {
  id: string;
  name: string;
  description: string;
  category: 'voice' | 'memory' | 'audio';
  features: string[];
  envVars: string[];
  endpointEnvVars: string[];
  portFallback?: {
    envVar: string;
    host: string;
  };
  defaultEndpoint: string | null;
  healthPath: '/health' | '/status';
}

export interface ServiceHealthResult {
  ok: boolean;
  status?: number;
  error?: string | null;
}

export interface ServiceState extends ServiceManifest {
  endpoint: string | null;
  configured: boolean;
  status: ServiceStatus;
  httpStatus: number | null;
  error: string | null;
  availableActions: [];
}

export const SERVICE_MANIFESTS: readonly ServiceManifest[] = [
  {
    id: 'whisper-stt',
    name: 'Whisper STT',
    description: 'Local speech-to-text endpoint',
    category: 'voice',
    features: ['voice-input', 'connector-stt'],
    envVars: ['WHISPER_URL', 'NEXT_PUBLIC_WHISPER_URL'],
    endpointEnvVars: ['WHISPER_URL', 'NEXT_PUBLIC_WHISPER_URL'],
    defaultEndpoint: 'http://localhost:9876',
    healthPath: '/health',
  },
  {
    id: 'mlx-tts',
    name: 'MLX TTS',
    description: 'Local text-to-speech endpoint',
    category: 'voice',
    features: ['voice-output', 'voice-companion'],
    envVars: ['TTS_URL'],
    endpointEnvVars: ['TTS_URL'],
    defaultEndpoint: 'http://localhost:9879',
    healthPath: '/health',
  },
  {
    id: 'embedding-model',
    name: 'Embedding Model',
    description: 'Semantic memory embedding endpoint',
    category: 'memory',
    features: ['memory-semantic-search'],
    envVars: ['EMBED_URL', 'EMBED_PORT'],
    endpointEnvVars: ['EMBED_URL'],
    portFallback: { envVar: 'EMBED_PORT', host: 'http://127.0.0.1' },
    defaultEndpoint: 'http://127.0.0.1:9880',
    healthPath: '/health',
  },
  {
    id: 'llm-postprocess',
    name: 'LLM Postprocess',
    description: 'Voice post-processing endpoint',
    category: 'voice',
    features: ['voice-postprocess'],
    envVars: ['NEXT_PUBLIC_LLM_POSTPROCESS_URL'],
    endpointEnvVars: ['NEXT_PUBLIC_LLM_POSTPROCESS_URL'],
    defaultEndpoint: 'http://localhost:9878',
    healthPath: '/health',
  },
  {
    id: 'audio-capture',
    name: 'Audio Capture',
    description: 'Meeting audio capture and transcript endpoint',
    category: 'audio',
    features: ['meeting-copilot', 'live-transcript'],
    envVars: ['AUDIO_SERVICE_URL'],
    endpointEnvVars: ['AUDIO_SERVICE_URL'],
    defaultEndpoint: 'http://127.0.0.1:9881',
    healthPath: '/status',
  },
];

export type FetchServiceHealth = (url: string, service: ServiceManifest) => Promise<ServiceHealthResult>;

export function getServiceManifest(id: string): ServiceManifest | null {
  for (const service of SERVICE_MANIFESTS) {
    if (service.id === id) return service;
  }
  return null;
}

export function resolveServiceEndpoint(service: ServiceManifest, env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of service.endpointEnvVars) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  if (service.portFallback) {
    const port = env[service.portFallback.envVar]?.trim();
    if (port) return `${service.portFallback.host.replace(/\/+$/, '')}:${port}`;
  }
  return service.defaultEndpoint;
}

export function maskServiceEndpoint(endpoint: string | null): string | null {
  return endpoint ? maskUrlCredentials(endpoint) : null;
}

export function resolveServiceHealthUrl(service: ServiceManifest, endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const basePath = url.pathname.replace(/\/+$/, '');
    url.pathname = basePath.endsWith(service.healthPath) ? basePath : `${basePath}${service.healthPath}`;
    url.hash = '';
    return url.toString();
  } catch {
    const baseEndpoint = endpoint.replace(/\/+$/, '');
    return baseEndpoint.endsWith(service.healthPath) ? baseEndpoint : `${baseEndpoint}${service.healthPath}`;
  }
}

export function resolveServiceEndpointMap(env: NodeJS.ProcessEnv = process.env): Record<string, string | null> {
  return Object.fromEntries(
    SERVICE_MANIFESTS.map((service) => [service.id, maskServiceEndpoint(resolveServiceEndpoint(service, env))]),
  );
}

export async function fetchServiceHealth(url: string): Promise<ServiceHealthResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Service health check failed',
    };
  }
}

export async function resolveServiceState(
  service: ServiceManifest,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchHealth?: FetchServiceHealth;
  } = {},
): Promise<ServiceState> {
  const endpoint = resolveServiceEndpoint(service, options.env);
  if (!endpoint) {
    return {
      ...service,
      endpoint: null,
      configured: false,
      status: 'not_configured',
      httpStatus: null,
      error: null,
      availableActions: [],
    };
  }

  const healthProbe = options.fetchHealth ? options.fetchHealth : fetchServiceHealth;
  const health = await healthProbe(resolveServiceHealthUrl(service, endpoint), service);
  return {
    ...service,
    endpoint: maskServiceEndpoint(endpoint),
    configured: true,
    status: health.ok ? 'healthy' : 'unhealthy',
    httpStatus: typeof health.status === 'number' ? health.status : null,
    error: typeof health.error === 'string' ? health.error : null,
    availableActions: [],
  };
}

export async function resolveServiceStates(options: {
  env?: NodeJS.ProcessEnv;
  fetchHealth?: FetchServiceHealth;
}): Promise<ServiceState[]> {
  return Promise.all(SERVICE_MANIFESTS.map((service) => resolveServiceState(service, options)));
}
