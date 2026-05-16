import { makeReport } from './core.mjs';
import { discoverLanguageServer, readMcpConfig } from './discovery.mjs';

const REDACTED = '[REDACTED]';

function redactSecretString(value) {
  return value
    .replace(/(--csrf_token(?:=|\s+))\S+/gi, `$1${REDACTED}`)
    .replace(/(ANTIGRAVITY_CSRF_TOKEN=)\S+/gi, `$1${REDACTED}`)
    .replace(/(x-codeium-csrf-token['":=\s]+)\S+/gi, `$1${REDACTED}`);
}

function redactDiagnostics(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => redactDiagnostics(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactDiagnostics(entryValue, entryKey)]),
    );
  }
  if (/csrf|token|secret/i.test(key)) return REDACTED;
  if (typeof value === 'string') return redactSecretString(value);
  return value;
}

export async function runReadonlySmoke(options) {
  const env = options.env === undefined ? process.env : options.env;
  if (options.dryRun) {
    return makeReport({
      ok: true,
      mode: 'readonly',
      stage: 'readonly_dry_run',
      diagnostics: { dryRun: true },
    });
  }

  const discovery = await discoverLanguageServer(env, options.discoveryDeps);
  if (!discovery.ok) {
    return makeReport({
      ok: false,
      mode: 'readonly',
      stage: discovery.stage,
      diagnostics: redactDiagnostics(discovery),
    });
  }

  const mcpConfig = readMcpConfig(env);
  const ok = mcpConfig.exists && mcpConfig.hasCatCafe;
  return makeReport({
    ok,
    mode: 'readonly',
    stage: ok ? 'readonly_complete' : 'mcp_config_missing_or_old',
    diagnostics: {
      ls: {
        source: discovery.source,
        pid: discovery.pid,
        port: discovery.conn.port,
        useTls: discovery.conn.useTls,
      },
      mcpConfig,
      agentKey: {
        status: mcpConfig.hasAgentKeyFile ? 'configured' : 'missing',
        boundary: 'agent-key expiration/rotation health remains owned by F178',
      },
    },
  });
}
