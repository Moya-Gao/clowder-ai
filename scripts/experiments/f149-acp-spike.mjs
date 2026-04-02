#!/usr/bin/env node
/**
 * F149 Phase A — Task 1: ACP Protocol Spike (iteration 3 — correct method names)
 *
 * ACP Protocol (from @agentclientprotocol/sdk v1):
 *
 * Client → Agent REQUESTS (have id, expect response):
 *   initialize          { protocolVersion: 1 }
 *   session/new         { cwd: string, mcpServers: McpServer[] }
 *   session/load        { sessionId, cwd, mcpServers }
 *   session/prompt      { sessionId, prompt: ContentBlock[] }
 *
 * Agent → Client NOTIFICATIONS (no id):
 *   session/update      { sessionId, update: { sessionUpdate: "agent_message_chunk"|..., content: ... } }
 *
 * Agent → Client REQUESTS:
 *   session/request_permission  { ... }
 *   fs/read_text_file, fs/write_text_file, terminal/*
 *
 * Prompt completes when the original session/prompt request returns:
 *   { id: "N", result: { stopReason: "end_turn"|"cancelled"|... } }
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

function log(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  console.log('[spike] Spawning gemini --acp ...');
  const t0 = performance.now();

  const child = spawn('gemini', ['--acp'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const rl = createInterface({ input: child.stdout });

  // Two channels: responses (keyed by id) and notifications (stream)
  const pendingRequests = new Map(); // id → { resolve, reject }
  const notificationQueue = [];
  let notificationResolve = null;

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (msg.id && pendingRequests.has(msg.id)) {
      // Response to a request we sent
      const { resolve } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      resolve(msg);
    } else if (msg.method) {
      // Notification or request FROM agent (session/update, session/request_permission, etc.)
      console.log(
        `[notification] ${msg.method} ${JSON.stringify(msg.params?.update?.sessionUpdate ?? '').slice(0, 80)}`,
      );

      // For permission requests, auto-approve (yolo mode for spike)
      if (msg.method === 'session/request_permission' && msg.id) {
        const approval = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { optionId: msg.params?.options?.[0]?.optionId ?? 'allow_once' },
        };
        child.stdin.write(JSON.stringify(approval) + '\n');
        console.log(`[auto-approve] permission request ${msg.id}`);
      }

      if (notificationResolve) {
        const r = notificationResolve;
        notificationResolve = null;
        r(msg);
      } else {
        notificationQueue.push(msg);
      }
    }
  });

  let reqId = 0;

  function sendRequest(method, params) {
    const id = String(++reqId);
    const msg = { jsonrpc: '2.0', method, id, params };
    console.log(`\n[req ${id}] ${method}`);
    child.stdin.write(JSON.stringify(msg) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
      }, 60_000);
      pendingRequests.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  function waitNotification(timeoutMs = 10_000) {
    if (notificationQueue.length > 0) return Promise.resolve(notificationQueue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        notificationResolve = null;
        reject(new Error('notification timeout'));
      }, timeoutMs);
      notificationResolve = (v) => {
        clearTimeout(timer);
        resolve(v);
      };
    });
  }

  async function collectNotificationsUntilQuiet(quietMs = 8000) {
    const events = [];
    while (true) {
      try {
        events.push(await waitNotification(quietMs));
      } catch {
        break;
      }
    }
    return events;
  }

  try {
    // --- Step 1: initialize ---
    const t1 = performance.now();
    const initResp = await sendRequest('initialize', { protocolVersion: 1 });
    const t2 = performance.now();
    log('INITIALIZE', {
      timing: `${(t2 - t1).toFixed(0)}ms (since spawn: ${(t2 - t0).toFixed(0)}ms)`,
      protocolVersion: initResp.result?.protocolVersion,
      agentInfo: initResp.result?.agentInfo,
      capabilities: initResp.result?.agentCapabilities,
    });

    // --- Step 2: session/new ---
    const t3 = performance.now();
    const sessionResp = await sendRequest('session/new', {
      cwd: process.cwd(),
      mcpServers: [], // Use Gemini's own .gemini/settings.json MCP config
    });
    const t4 = performance.now();
    log('SESSION/NEW', {
      timing: `${(t4 - t3).toFixed(0)}ms`,
      sessionId: sessionResp.result?.sessionId,
      modes: sessionResp.result?.modes,
      models: sessionResp.result?.models?.currentModelId,
    });

    // Drain any initial notifications (available_commands_update etc.)
    const initNotifs = await collectNotificationsUntilQuiet(3000);
    if (initNotifs.length > 0) {
      console.log(`[spike] Drained ${initNotifs.length} init notifications`);
    }

    const sessionId = sessionResp.result?.sessionId;
    if (!sessionId) {
      throw new Error('No sessionId from session/new');
    }

    // --- Step 3: session/prompt ---
    const t5 = performance.now();
    // Send prompt request (async — response comes after streaming)
    const promptPromise = sendRequest('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly one word: PONG' }],
    });

    // Collect streaming notifications while waiting for prompt response
    let firstChunkAt = null;
    const streamEvents = [];

    // Race: collect notifications until the prompt response arrives
    const promptResult = await new Promise((resolve, reject) => {
      promptPromise.then(resolve).catch(reject);

      // Keep collecting notifications
      const poll = async () => {
        while (true) {
          try {
            const notif = await waitNotification(30_000);
            if (!firstChunkAt && notif.params?.update?.sessionUpdate === 'agent_message_chunk') {
              firstChunkAt = performance.now();
            }
            streamEvents.push(notif);
          } catch {
            break;
          }
        }
      };
      poll(); // Fire and forget — promptPromise will resolve first
    });
    const t6 = performance.now();

    log('SESSION/PROMPT RESULT', {
      timing: `${(t6 - t5).toFixed(0)}ms`,
      firstChunkMs: firstChunkAt ? `${(firstChunkAt - t5).toFixed(0)}ms` : 'N/A',
      stopReason: promptResult.result?.stopReason,
      streamEvents: streamEvents.length,
      textChunks: streamEvents
        .filter((e) => e.params?.update?.sessionUpdate === 'agent_message_chunk')
        .map((e) => e.params?.update?.content?.text ?? '')
        .join(''),
    });

    // --- Step 4: Second prompt (warm path) ---
    const t7 = performance.now();
    const prompt2Promise = sendRequest('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: 'Reply with exactly one word: WARM' }],
    });
    const stream2Events = [];
    let firstChunk2At = null;
    const prompt2Result = await new Promise((resolve, reject) => {
      prompt2Promise.then(resolve).catch(reject);
      const poll = async () => {
        while (true) {
          try {
            const notif = await waitNotification(30_000);
            if (!firstChunk2At && notif.params?.update?.sessionUpdate === 'agent_message_chunk') {
              firstChunk2At = performance.now();
            }
            stream2Events.push(notif);
          } catch {
            break;
          }
        }
      };
      poll();
    });
    const t8 = performance.now();

    log('WARM PROMPT RESULT', {
      timing: `${(t8 - t7).toFixed(0)}ms`,
      firstChunkMs: firstChunk2At ? `${(firstChunk2At - t7).toFixed(0)}ms` : 'N/A',
      stopReason: prompt2Result.result?.stopReason,
      textChunks: stream2Events
        .filter((e) => e.params?.update?.sessionUpdate === 'agent_message_chunk')
        .map((e) => e.params?.update?.content?.text ?? '')
        .join(''),
    });

    // --- Summary ---
    log('TIMING SUMMARY', {
      coldSpawnToReady: `${(t2 - t0).toFixed(0)}ms`,
      initializeMs: `${(t2 - t1).toFixed(0)}ms`,
      newSessionMs: `${(t4 - t3).toFixed(0)}ms`,
      firstPromptTotalMs: `${(t6 - t5).toFixed(0)}ms`,
      firstPromptFirstChunkMs: firstChunkAt ? `${(firstChunkAt - t5).toFixed(0)}ms` : 'N/A',
      warmPromptTotalMs: `${(t8 - t7).toFixed(0)}ms`,
      warmPromptFirstChunkMs: firstChunk2At ? `${(firstChunk2At - t7).toFixed(0)}ms` : 'N/A',
    });
  } catch (err) {
    console.error('[spike] Error:', err.message);
    if (stderr) console.error('[stderr tail]', stderr.slice(-800));
  } finally {
    console.log('\n[spike] Cleaning up...');
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      process.exit(0);
    }, 3000);
  }
}

main().catch(console.error);
