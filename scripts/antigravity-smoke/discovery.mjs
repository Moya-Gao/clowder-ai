import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

function safeExecTrim(command) {
  const result = spawnSync(command, {
    encoding: 'utf8',
    shell: true,
    timeout: 5_000,
  });
  return result.status === 0 && typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function listLanguageServerProcesses() {
  const output = safeExecTrim('ps -eo pid,args 2>/dev/null | grep language_server | grep csrf_token | grep -v grep');
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      return match ? { pid: match[1], cmd: match[2] } : null;
    })
    .filter(Boolean);
}

function listListenPorts(pid) {
  const output = safeExecTrim(`lsof -a -iTCP -sTCP:LISTEN -P -n -p ${pid} 2>/dev/null | grep LISTEN`);
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => Number(line.match(/:(\d+)\s/)?.[1]))
    .filter((port) => Number.isFinite(port));
}

function probeRpc(conn, method, payload = {}) {
  const mod = conn.useTls ? https : http;
  const body = JSON.stringify(payload);
  return new Promise((resolveProbe) => {
    const req = mod.request(
      {
        host: '127.0.0.1',
        port: conn.port,
        path: `/exa.language_server_pb.LanguageServerService/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-codeium-csrf-token': conn.csrfToken,
        },
        rejectUnauthorized: false,
        timeout: 5_000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolveProbe({ ok: res.statusCode === 200, status: res.statusCode, body: data.slice(0, 1000) });
        });
      },
    );
    req.on('error', (err) => resolveProbe({ ok: false, error: String(err) }));
    req.on('timeout', () => {
      req.destroy();
      resolveProbe({ ok: false, error: 'timeout' });
    });
    req.write(body);
    req.end();
  });
}

async function probeEnvLanguageServer(env) {
  const envPort = Number(env.ANTIGRAVITY_PORT);
  const envCsrf = env.ANTIGRAVITY_CSRF_TOKEN;
  if (!Number.isFinite(envPort)) return undefined;
  if (!envCsrf) return undefined;

  const conn = { port: envPort, csrfToken: envCsrf, useTls: env.ANTIGRAVITY_TLS !== 'false' };
  const probe = await probeRpc(conn, 'GetUserStatus');
  return probe.ok ? { ok: true, conn, probe, source: 'env' } : { ok: false, stage: 'ls_unreachable', conn, probe };
}

async function probeProcessLanguageServer(proc) {
  const csrfToken = proc.cmd.match(/--csrf_token\s+(\S+)/)?.[1];
  if (!csrfToken) return undefined;

  const extensionPort = Number(proc.cmd.match(/--extension_server_port\s+(\d+)/)?.[1]);
  for (const port of listListenPorts(proc.pid)) {
    if (port === extensionPort) continue;
    for (const useTls of [true, false]) {
      const conn = { port, csrfToken, useTls };
      const probe = await probeRpc(conn, 'GetUserStatus');
      if (probe.ok) return { ok: true, conn, probe, source: 'process', pid: proc.pid };
    }
  }
  return undefined;
}

export async function discoverLanguageServer(
  env,
  {
    probeEnvLanguageServer: probeEnv = probeEnvLanguageServer,
    listLanguageServerProcesses: listProcesses = listLanguageServerProcesses,
    probeProcessLanguageServer: probeProcess = probeProcessLanguageServer,
  } = {},
) {
  const envResult = await probeEnv(env);
  if (envResult?.ok) return envResult;

  const processes = listProcesses();
  if (processes.length === 0) {
    return envResult ? { ...envResult, processes } : { ok: false, stage: 'antigravity_not_started', processes };
  }

  for (const proc of processes) {
    const processResult = await probeProcess(proc);
    if (processResult) return processResult;
  }

  return envResult ? { ...envResult, processes } : { ok: false, stage: 'ls_unreachable', processes };
}

export function readMcpConfig(env) {
  const configPath = resolve(
    env.ANTIGRAVITY_MCP_CONFIG_PATH === undefined
      ? join(homedir(), '.gemini', 'antigravity', 'mcp_config.json')
      : env.ANTIGRAVITY_MCP_CONFIG_PATH,
  );
  if (!existsSync(configPath)) return { path: configPath, exists: false, hasCatCafe: false, hasAgentKeyFile: false };
  const raw = readFileSync(configPath, 'utf8');
  return {
    path: configPath,
    exists: true,
    hasCatCafe: /cat[-_]cafe/i.test(raw),
    hasAgentKeyFile: /CAT_CAFE_AGENT_KEY_FILE(S)?/.test(raw),
  };
}
