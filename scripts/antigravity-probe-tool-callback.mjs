#!/usr/bin/env node
/**
 * F061 Phase 2c-R — Probe tool-result callback protocol against live Antigravity LS.
 *
 * Goal: Validate path B (StreamTerminalShellCommand) and path C (HandleCascadeUserInteraction
 * with `runCommand` oneof) as candidates for pushing RUN_COMMAND step result back to cascade.
 *
 * Usage: node scripts/antigravity-probe-tool-callback.mjs
 *
 * Discovers running LS from process, dumps structured probe results. NEVER touches
 * Redis 6399 (user sanctum). Does not mutate cascades unless `--live` flag is passed.
 */
import { execSync } from 'node:child_process';
import https from 'node:https';

function discover() {
  const psOutput = execSync('ps -eo pid,args 2>/dev/null | grep language_server | grep csrf_token | grep -v grep', {
    encoding: 'utf8',
  }).trim();
  if (!psOutput) throw new Error('No Antigravity LS found');

  const line = psOutput.split('\n')[0];
  const csrf = line.match(/--csrf_token\s+(\S+)/)?.[1];
  const extPort = Number(line.match(/--extension_server_port\s+(\d+)/)?.[1]);
  const pid = line.match(/^\s*(\d+)/)?.[1];

  const lsofOut = execSync(`lsof -a -iTCP -sTCP:LISTEN -P -n -p ${pid} 2>/dev/null | grep LISTEN`, {
    encoding: 'utf8',
  }).trim();
  const ports = lsofOut
    .split('\n')
    .map((l) => Number(l.match(/:(\d+)\s/)?.[1]))
    .filter(Boolean)
    .filter((p) => p !== extPort);

  return { pid, csrf, candidatePorts: ports };
}

async function probeUnary(conn, method, payload) {
  const body = JSON.stringify(payload ?? {});
  return new Promise((resolve) => {
    const req = https.request(
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
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 500) }));
      },
    );
    req.on('error', (err) => resolve({ error: String(err) }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });
    req.write(body);
    req.end();
  });
}

async function findLsPort({ csrf, candidatePorts }) {
  for (const port of candidatePorts) {
    const res = await probeUnary({ port, csrfToken: csrf }, 'GetUserStatus', {});
    if (res.status === 200) return port;
  }
  throw new Error(`No port responded OK to GetUserStatus (tried ${candidatePorts.join(',')})`);
}

async function main() {
  const args = process.argv.slice(2);
  const liveMutation = args.includes('--live');
  const targetCascadeId = args.find((a) => a.startsWith('--cascade='))?.slice('--cascade='.length);

  console.log('=== F061 Phase 2c-R Probe ===');
  console.log(`Live mutation: ${liveMutation}`);
  console.log(`Target cascade: ${targetCascadeId ?? '(none — discovery/probe only)'}`);

  const { pid, csrf, candidatePorts } = discover();
  console.log(`\nDiscovered LS: pid=${pid} csrf=${csrf.slice(0, 8)}... candidatePorts=${candidatePorts.join(',')}`);

  const port = await findLsPort({ csrf, candidatePorts });
  const conn = { port, csrfToken: csrf };
  console.log(`Active RPC port: ${port}\n`);

  // Probe 1: enumerate minimum-payload behavior of candidate methods
  const candidates = [
    'GetUserStatus',
    'HandleCascadeUserInteraction',
    'ResolveOutstandingSteps',
    'StreamTerminalShellCommand',
    'HandleStreamingCommand',
    'RunCommand',
    'SendActionToChatPanel',
    'SendStepsToBackground',
    'AcknowledgeCodeActionStep',
    'GetCascadeTrajectory',
    'CancelCascadeSteps',
  ];

  console.log('--- Probe 1: empty-payload call on each candidate ---');
  for (const m of candidates) {
    const res = await probeUnary(conn, m, {});
    console.log(
      `  ${m.padEnd(36)} → status=${res.status ?? 'ERR'}  ${(res.body ?? res.error ?? '').replace(/\n/g, ' ').slice(0, 140)}`,
    );
  }

  // Probe 2: HandleCascadeUserInteraction with runCommand oneof
  console.log('\n--- Probe 2: HandleCascadeUserInteraction { runCommand } (no cascadeId) ---');
  const p2 = await probeUnary(conn, 'HandleCascadeUserInteraction', {
    interaction: {
      runCommand: {
        confirm: true,
        submittedCommandLine: 'echo probe',
      },
    },
  });
  console.log(`  status=${p2.status}  body=${(p2.body ?? p2.error ?? '').slice(0, 300)}`);

  // Probe 3: same but with targetCascadeId (if provided)
  if (targetCascadeId && liveMutation) {
    console.log('\n--- Probe 3: HandleCascadeUserInteraction { runCommand } (with cascadeId, LIVE) ---');
    const traj = await probeUnary(conn, 'GetCascadeTrajectory', { cascadeId: targetCascadeId });
    if (traj.status !== 200) {
      console.log(`  Cannot fetch trajectory: ${traj.status} ${traj.body}`);
    } else {
      const parsed = JSON.parse(traj.body);
      const steps = parsed.trajectory?.steps ?? [];
      const lastRunCmd = [...steps].reverse().find((s) => s.type === 'CORTEX_STEP_TYPE_RUN_COMMAND');
      if (!lastRunCmd) {
        console.log('  No RUN_COMMAND step in trajectory to target');
      } else {
        const trajectoryId = parsed.trajectory?.trajectoryId;
        const stepIndex = steps.indexOf(lastRunCmd);
        console.log(`  Target: trajectoryId=${trajectoryId} stepIndex=${stepIndex} status=${lastRunCmd.status}`);
        const p3 = await probeUnary(conn, 'HandleCascadeUserInteraction', {
          cascadeId: targetCascadeId,
          interaction: {
            trajectoryId,
            stepIndex,
            runCommand: {
              confirm: true,
              submittedCommandLine: lastRunCmd.runCommand?.commandLine ?? 'echo probe',
            },
          },
        });
        console.log(`  status=${p3.status}  body=${(p3.body ?? p3.error ?? '').slice(0, 400)}`);
      }
    }
  } else {
    console.log('\n--- Probe 3 skipped (needs --live --cascade=<id>) ---');
  }

  // Probe 4: RunCommand unary (standalone — not tied to cascade)
  console.log('\n--- Probe 4: RunCommand (standalone unary) ---');
  const p4 = await probeUnary(conn, 'RunCommand', {
    command: 'echo',
    args: ['probe'],
    cwd: process.cwd(),
  });
  console.log(`  status=${p4.status}  body=${(p4.body ?? p4.error ?? '').slice(0, 400)}`);

  console.log('\n=== Probe complete ===');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
