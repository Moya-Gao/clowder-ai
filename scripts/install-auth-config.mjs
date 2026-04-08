#!/usr/bin/env node

/**
 * F340: Auth config installer — writes directly to global accounts + credentials.
 *
 * Storage:
 *   ~/.cat-cafe/accounts.json    — account metadata (authType, baseUrl, models, displayName)
 *   ~/.cat-cafe/credentials.json — API keys / tokens
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// F340: protocol removed — builtins derive protocol from well-known ID at runtime.
const BUILTIN_ACCOUNT_SPECS = [
  {
    id: 'claude',
    displayName: 'Claude',
    client: 'anthropic',
    models: ['claude-opus-4-6[1m]', 'claude-sonnet-4-6', 'claude-opus-4-5-20251101'],
  },
  { id: 'codex', displayName: 'Codex', client: 'openai', models: ['gpt-5.3-codex', 'gpt-5.4', 'gpt-5.3-codex-spark'] },
  { id: 'gemini', displayName: 'Gemini', client: 'google', models: ['gemini-3.1-pro-preview', 'gemini-2.5-pro'] },
  { id: 'dare', displayName: 'Dare', client: 'dare', models: ['z-ai/glm-4.7'] },
  { id: 'opencode', displayName: 'OpenCode', client: 'opencode', models: ['claude-opus-4-6', 'claude-sonnet-4-5'] },
];

const CONFIG_SUBDIR = '.cat-cafe';

function usage() {
  console.error(`Usage:
  node scripts/install-auth-config.mjs env-apply --env-file FILE [--set KEY=VALUE]... [--delete KEY]...
  node scripts/install-auth-config.mjs client-auth set --project-dir DIR --client CLIENT --mode oauth|api_key [--display-name NAME] [--api-key KEY] [--base-url URL]
    API key can also be passed via _INSTALLER_API_KEY env var (preferred for security).
  node scripts/install-auth-config.mjs client-auth remove --project-dir DIR --client CLIENT [--force true]
  node scripts/install-auth-config.mjs claude-profile set --project-dir DIR [--api-key KEY] [--base-url URL] [--model MODEL]
  node scripts/install-auth-config.mjs claude-profile remove --project-dir DIR [--force true]`);
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) usage();
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(next);
    index += 1;
  }
  return { positionals, values };
}

function getRequired(values, key) {
  const value = values.get(key)?.[0];
  if (!value) usage();
  return value;
}

function getOptional(values, key, fallback = '') {
  return values.get(key)?.[0] ?? fallback;
}

// ── Env file helpers (unchanged) ──

function envQuote(value) {
  const stringValue = String(value).replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  if (!stringValue.includes("'")) return `'${stringValue}'`;
  return `"${stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`;
}

function applyEnvChanges(envFile, setPairs, deleteKeys) {
  const existing = existsSync(envFile)
    ? readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .filter((line, index, lines) => !(index === lines.length - 1 && line === ''))
    : [];
  const setMap = new Map();
  for (const pair of setPairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) usage();
    setMap.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const deleteSet = new Set(deleteKeys);
  const filtered = existing.filter((line) => {
    const separator = line.indexOf('=');
    if (separator === -1) return true;
    const key = line.slice(0, separator);
    return !deleteSet.has(key) && !setMap.has(key);
  });
  for (const [key, value] of setMap.entries()) filtered.push(`${key}=${envQuote(value)}`);
  writeFileSync(envFile, filtered.length > 0 ? `${filtered.join('\n')}\n` : '', 'utf8');
}

// ── Global file helpers ──

function resolveGlobalRoot() {
  const envRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
  if (envRoot) return path.resolve(envRoot);
  return homedir();
}

function globalDir() {
  return path.join(resolveGlobalRoot(), CONFIG_SUBDIR);
}

function writeFileAtomic(filePath, content, mode) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, 'utf-8');
  try {
    renameSync(tempPath, filePath);
    if (mode) chmodSync(filePath, mode);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonSafe(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readAccounts() {
  const file = path.join(globalDir(), 'accounts.json');
  const raw = readJson(file, {}); // throws on corrupt → fail fast
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
}

function writeAccounts(accounts) {
  mkdirSync(globalDir(), { recursive: true });
  writeFileAtomic(path.join(globalDir(), 'accounts.json'), `${JSON.stringify(accounts, null, 2)}\n`);
}

function readCredentials() {
  const file = path.join(globalDir(), 'credentials.json');
  const raw = readJson(file, {});
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
}

function writeCredentials(creds) {
  mkdirSync(globalDir(), { recursive: true });
  writeFileAtomic(path.join(globalDir(), 'credentials.json'), `${JSON.stringify(creds, null, 2)}\n`, 0o600);
}

// ── Normalization helpers ──

function normalizeClient(rawClient) {
  const trimmed = rawClient?.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'anthropic' || trimmed === 'claude') return 'anthropic';
  if (trimmed === 'openai' || trimmed === 'codex') return 'openai';
  if (trimmed === 'google' || trimmed === 'gemini') return 'google';
  if (trimmed === 'dare') return 'dare';
  if (trimmed === 'opencode') return 'opencode';
  return null;
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
}

function normalizeModels(models) {
  if (!Array.isArray(models)) return undefined;
  return Array.from(new Set(models.map((v) => String(v).trim()).filter((v) => v.length > 0)));
}

function builtinAccountIdForClient(client) {
  const spec = BUILTIN_ACCOUNT_SPECS.find((s) => s.client === client);
  if (!spec) throw new Error(`Unsupported client "${client}"`);
  return spec.id;
}

// ── Legacy migration (v2/v3 provider-profiles → accounts+credentials) ──

function migrateLegacyProfiles(projectDir) {
  const profileDir = projectDir ? path.join(projectDir, CONFIG_SUBDIR) : globalDir();
  const metaFile = path.join(profileDir, 'provider-profiles.json');
  if (!existsSync(metaFile)) return;
  const meta = readJson(metaFile, null); // throws on corrupt — intentional (fail fast)
  const providers = meta?.providers ?? meta?.profiles ?? [];
  if (!Array.isArray(providers) || providers.length === 0) return;

  const accounts = readAccounts();
  const mergedIds = new Set();
  for (const p of providers) {
    const id = String(p.id ?? '').trim();
    if (!id || id in accounts) continue;
    // F340: protocol not migrated — derived at runtime from well-known account IDs.
    accounts[id] = {
      authType: p.authType ?? 'oauth',
      ...(p.displayName ? { displayName: String(p.displayName) } : {}),
      ...(p.baseUrl ? { baseUrl: String(p.baseUrl).replace(/\/+$/, '') } : {}),
      ...(Array.isArray(p.models) ? { models: p.models.map(String) } : {}),
    };
    mergedIds.add(id);
  }
  writeAccounts(accounts);

  // Migrate secrets — only for IDs that were actually merged (skip collisions)
  const secretsFile = path.join(profileDir, 'provider-profiles.secrets.local.json');
  if (existsSync(secretsFile)) {
    const secretsMeta = readJsonSafe(secretsFile, {});
    const profileSecrets = secretsMeta?.profiles ?? {};
    const creds = readCredentials();
    for (const [id, secret] of Object.entries(profileSecrets)) {
      if (mergedIds.has(id) && !(id in creds) && secret?.apiKey) creds[id] = { apiKey: String(secret.apiKey) };
    }
    writeCredentials(creds);
  }
}

// ── Commands ──

function setClientAuth(client, mode, options) {
  const accountRef =
    options.profileId || (mode === 'api_key' ? `installer-${client}` : builtinAccountIdForClient(client));
  const accounts = readAccounts();

  if (mode === 'oauth') {
    // F340: protocol not persisted on new accounts — derived from well-known ID at runtime.
    accounts[accountRef] = {
      authType: 'oauth',
      displayName: BUILTIN_ACCOUNT_SPECS.find((s) => s.client === client)?.displayName ?? accountRef,
    };
    // Warn about stale installer account that the resolver will prefer (has API key).
    // We intentionally do NOT auto-delete it here: installer accounts are global,
    // and we cannot safely enumerate all projects to check for bindings.
    // Callers (install.sh) should run `client-auth remove --force` first.
    const installerRef = `installer-${client}`;
    if (installerRef !== accountRef && accounts[installerRef]) {
      console.error(
        `[install-auth-config] warning: ${installerRef} still exists with API key — ` +
          `resolver may prefer it over OAuth. Run "client-auth remove --client ${client} --force true" to clean up.`,
      );
    }
  } else {
    const normalizedBaseUrl = normalizeBaseUrl(options.baseUrl);
    const normalizedModels = normalizeModels(options.models);
    accounts[accountRef] = {
      authType: 'api_key',
      ...(options.displayName ? { displayName: options.displayName } : {}),
      ...(normalizedBaseUrl ? { baseUrl: normalizedBaseUrl } : {}),
      ...(normalizedModels ? { models: normalizedModels } : {}),
    };
    const creds = readCredentials();
    creds[accountRef] = { apiKey: options.apiKey };
    writeCredentials(creds);
  }

  writeAccounts(accounts);
}

/** Scan a catalog file for variants bound to the given accountRef. */
function findBoundCats(catalogFile, profileId) {
  if (!existsSync(catalogFile)) return [];
  const catalog = readJsonSafe(catalogFile, null);
  return (catalog?.breeds ?? [])
    .flatMap((breed) =>
      (breed?.variants ?? [])
        .filter((v) => v?.accountRef?.trim?.() === profileId)
        .map((v) => v?.catId?.trim?.() || breed?.catId?.trim?.() || breed?.id?.trim?.() || profileId),
    )
    .filter((v) => typeof v === 'string' && v.length > 0);
}

function removeClientAuth(client, profileId, projectDir, { force = false } = {}) {
  // Step 1: Check the passed project for bindings — block if still in use.
  if (projectDir) {
    const bound = findBoundCats(path.join(projectDir, CONFIG_SUBDIR, 'cat-catalog.json'), profileId);
    if (bound.length > 0) {
      throw new Error(`Cannot remove ${profileId}; still referenced by runtime cats: ${bound.join(', ')}`);
    }
  }

  // Step 2: If the account doesn't exist, removal is already a no-op.
  const accounts = readAccounts();
  const creds = readCredentials();
  if (!(profileId in accounts) && !(profileId in creds)) return;

  // Step 3: Without --force, refuse to modify global state. Accounts and
  // credentials are shared across all projects; we cannot enumerate all
  // projects to verify no external references exist. See gpt52 R5–R8.
  if (!force) {
    throw new Error(
      `${profileId}: accounts and credentials are global (shared across projects). ` +
        `Pass --force to confirm deletion of global account + credentials for ${profileId}.`,
    );
  }

  // Step 4: --force: delete credentials + account metadata.
  if (profileId in creds) {
    delete creds[profileId];
    writeCredentials(creds);
  }

  if (profileId in accounts) {
    delete accounts[profileId];
    writeAccounts(accounts);
  }
}

// ── CLI entry point ──

try {
  const { positionals, values } = parseArgs(process.argv.slice(2));

  if (positionals[0] === 'env-apply') {
    applyEnvChanges(getRequired(values, 'env-file'), values.get('set') ?? [], values.get('delete') ?? []);
    process.exit(0);
  }

  if (positionals[0] === 'client-auth' && positionals[1] === 'set') {
    const client = normalizeClient(getRequired(values, 'client'));
    if (!client) {
      console.error('Error: unsupported client');
      process.exit(1);
    }
    // Migrate legacy files before applying
    const projDir = getOptional(values, 'project-dir', '');
    if (projDir) migrateLegacyProfiles(projDir);
    migrateLegacyProfiles(null);
    const mode = getRequired(values, 'mode');
    if (mode === 'oauth') {
      setClientAuth(client, 'oauth', {});
      process.exit(0);
    }
    if (mode !== 'api_key') usage();
    const apiKey = getOptional(values, 'api-key', '') || process.env._INSTALLER_API_KEY || '';
    if (!apiKey) {
      console.error('Error: API key required via --api-key or _INSTALLER_API_KEY env var');
      process.exit(1);
    }
    const displayName = getOptional(values, 'display-name', `Installer ${client} API Key`);
    const modelArg = getOptional(values, 'model', '');
    setClientAuth(client, 'api_key', {
      displayName,
      apiKey,
      baseUrl: getOptional(values, 'base-url', ''),
      ...(modelArg ? { models: [modelArg] } : {}),
    });
    process.exit(0);
  }

  if (positionals[0] === 'client-auth' && positionals[1] === 'remove') {
    const client = normalizeClient(getRequired(values, 'client'));
    if (!client) {
      console.error('Error: unsupported client');
      process.exit(1);
    }
    const projectDir = getRequired(values, 'project-dir');
    // Migrate legacy files before removal so accounts/credentials are in global store
    if (projectDir) migrateLegacyProfiles(projectDir);
    migrateLegacyProfiles(null);
    const force = values.get('force')?.[0] === 'true';
    removeClientAuth(client, `installer-${client}`, projectDir, { force });
    process.exit(0);
  }

  if (positionals[0] === 'claude-profile' && positionals[1] === 'set') {
    const projectDir = getOptional(values, 'project-dir', '');
    // Migrate legacy files before applying new setting
    if (projectDir) migrateLegacyProfiles(projectDir);
    migrateLegacyProfiles(null);
    const apiKey = getOptional(values, 'api-key', '') || process.env._INSTALLER_API_KEY || '';
    if (!apiKey) {
      console.error('Error: API key required via --api-key or _INSTALLER_API_KEY env var');
      process.exit(1);
    }
    const modelArg = getOptional(values, 'model', '').trim();
    setClientAuth('anthropic', 'api_key', {
      profileId: 'installer-managed',
      displayName: 'Installer API Key',
      apiKey,
      baseUrl: getOptional(values, 'base-url', 'https://api.anthropic.com'),
      ...(modelArg ? { models: [modelArg] } : {}),
    });
    process.exit(0);
  }

  if (positionals[0] === 'claude-profile' && positionals[1] === 'remove') {
    const projectDir = getRequired(values, 'project-dir');
    if (projectDir) migrateLegacyProfiles(projectDir);
    migrateLegacyProfiles(null);
    const forceRemove = values.get('force')?.[0] === 'true';
    removeClientAuth('anthropic', 'installer-managed', projectDir, { force: forceRemove });
    process.exit(0);
  }

  usage();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
