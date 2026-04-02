#!/usr/bin/env node
/**
 * F149 Phase A — Task 5: OQ-6 Concurrency Experiment
 *
 * Question: Can a single ACP process handle concurrent prompts
 *           across two different sessions?
 *
 * Design:
 *   1. Spawn one gemini --acp process
 *   2. Initialize + create session A and session B
 *   3. Send concurrent prompts: A gets "ALPHA", B gets "BRAVO"
 *   4. Observe:
 *      - Did both complete? (fulfilled vs rejected)
 *      - Were responses correct? (no cross-contamination)
 *      - Did they overlap in time? (concurrent) or sequence? (single-flight)
 *      - Any errors? (protocol rejection, merged responses)
 *
 * Verdict determines pool sizing strategy for Phase C.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

function log(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  console.log('[oq6] Spawning single gemini --acp process...');
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
  const pendingRequests = new Map();
  const notificationListeners = [];

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }

    const id = msg.id;
    const method = msg.method;

    if (id && pendingRequests.has(id) && !method) {
      const { resolve } = pendingRequests.get(id);
      pendingRequests.delete(id);
      resolve(msg);
    } else if (method && !id) {
      for (const listener of notificationListeners) listener(msg);
    } else if (method && id) {
      // Auto-approve permission requests
      if (method === 'session/request_permission') {
        const approval = {
          jsonrpc: '2.0',
          id,
          result: { optionId: msg.params?.options?.[0]?.optionId ?? 'allow_once' },
        };
        child.stdin.write(JSON.stringify(approval) + '\n');
      }
    }
  });

  let reqId = 0;
  function sendRequest(method, params, timeoutMs = 60_000) {
    const id = String(++reqId);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, id, params }) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);
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

  /** Collect session/update notifications for a specific session until prompt response */
  function promptWithCollect(sessionId, text, timeoutMs = 120_000) {
    const events = [];
    let firstChunkAt = null;

    return new Promise((resolve, reject) => {
      const listener = (notif) => {
        if (notif.params?.sessionId !== sessionId) return;
        if (!firstChunkAt && notif.params?.update?.sessionUpdate === 'agent_message_chunk') {
          firstChunkAt = performance.now();
        }
        events.push(notif);
      };
      notificationListeners.push(listener);

      const startAt = performance.now();
      sendRequest(
        'session/prompt',
        {
          sessionId,
          prompt: [{ type: 'text', text }],
        },
        timeoutMs,
      )
        .then((resp) => {
          const idx = notificationListeners.indexOf(listener);
          if (idx >= 0) notificationListeners.splice(idx, 1);

          const endAt = performance.now();
          const textChunks = events
            .filter((e) => e.params?.update?.sessionUpdate === 'agent_message_chunk')
            .map((e) => e.params?.update?.content?.text ?? '')
            .join('');

          resolve({
            sessionId,
            stopReason: resp.result?.stopReason,
            error: resp.error,
            textContent: textChunks,
            events: events.length,
            startAt,
            endAt,
            firstChunkAt,
            durationMs: endAt - startAt,
            firstChunkMs: firstChunkAt ? firstChunkAt - startAt : null,
          });
        })
        .catch((err) => {
          const idx = notificationListeners.indexOf(listener);
          if (idx >= 0) notificationListeners.splice(idx, 1);
          reject(err);
        });
    });
  }

  try {
    // --- Step 1: Initialize ---
    console.log('[oq6] Initializing...');
    const initResp = await sendRequest('initialize', { protocolVersion: 1 });
    const t1 = performance.now();
    console.log(`[oq6] Initialized in ${(t1 - t0).toFixed(0)}ms`);

    // --- Step 2: Create two sessions ---
    console.log('[oq6] Creating session A...');
    const sessA = await sendRequest('session/new', { cwd: process.cwd(), mcpServers: [] });
    const sessionIdA = sessA.result?.sessionId;
    console.log(`[oq6] Session A: ${sessionIdA}`);

    // Drain any init notifications from session A
    await new Promise((r) => setTimeout(r, 2000));

    console.log('[oq6] Creating session B...');
    const sessB = await sendRequest('session/new', { cwd: process.cwd(), mcpServers: [] });
    const sessionIdB = sessB.result?.sessionId;
    console.log(`[oq6] Session B: ${sessionIdB}`);

    if (!sessionIdA || !sessionIdB) {
      throw new Error(`Failed to create sessions: A=${sessionIdA}, B=${sessionIdB}`);
    }

    // Drain any init notifications from session B
    await new Promise((r) => setTimeout(r, 2000));

    // --- Step 3: Sequential baseline first ---
    console.log('\n[oq6] === SEQUENTIAL BASELINE ===');
    console.log('[oq6] Prompt A (sequential)...');
    const seqA = await promptWithCollect(sessionIdA, 'Reply with exactly one word: ALPHA');
    console.log(`[oq6] A done: "${seqA.textContent}" in ${seqA.durationMs.toFixed(0)}ms`);

    console.log('[oq6] Prompt B (sequential)...');
    const seqB = await promptWithCollect(sessionIdB, 'Reply with exactly one word: BRAVO');
    console.log(`[oq6] B done: "${seqB.textContent}" in ${seqB.durationMs.toFixed(0)}ms`);

    log('SEQUENTIAL RESULTS', {
      sessionA: { text: seqA.textContent, durationMs: seqA.durationMs.toFixed(0), stopReason: seqA.stopReason },
      sessionB: { text: seqB.textContent, durationMs: seqB.durationMs.toFixed(0), stopReason: seqB.stopReason },
    });

    // --- Step 4: CONCURRENT prompts (the real test!) ---
    console.log('\n[oq6] === CONCURRENT TEST ===');
    console.log('[oq6] Sending concurrent prompts to A and B...');

    const concurrentStart = performance.now();

    const [concA, concB] = await Promise.allSettled([
      promptWithCollect(sessionIdA, 'Reply with exactly one word: DELTA'),
      promptWithCollect(sessionIdB, 'Reply with exactly one word: ECHO'),
    ]);

    const concurrentEnd = performance.now();

    const resultA = concA.status === 'fulfilled' ? concA.value : { error: concA.reason?.message };
    const resultB = concB.status === 'fulfilled' ? concB.value : { error: concB.reason?.message };

    // --- Step 5: Analyze ---
    const bothCompleted = concA.status === 'fulfilled' && concB.status === 'fulfilled';
    const aCorrect = resultA.textContent?.includes('DELTA');
    const bCorrect = resultB.textContent?.includes('ECHO');
    const noCrossContamination = aCorrect && bCorrect;

    let overlapping = false;
    if (bothCompleted) {
      // Check if execution windows overlap
      overlapping = resultA.startAt < resultB.endAt && resultB.startAt < resultA.endAt;
    }

    let verdict;
    if (bothCompleted && noCrossContamination && overlapping) {
      verdict = 'MULTIPLEX';
    } else if (bothCompleted && noCrossContamination && !overlapping) {
      verdict = 'SINGLE_FLIGHT_QUEUED';
    } else if (!bothCompleted) {
      const failedSide = concA.status === 'rejected' ? 'A' : 'B';
      verdict = `SINGLE_FLIGHT_STRICT (${failedSide} rejected)`;
    } else {
      verdict = `SESSION_POISON (cross-contamination: A="${resultA.textContent}" B="${resultB.textContent}")`;
    }

    log('CONCURRENT RESULTS', {
      totalConcurrentMs: (concurrentEnd - concurrentStart).toFixed(0),
      sessionA: {
        status: concA.status,
        text: resultA.textContent ?? resultA.error,
        durationMs: resultA.durationMs?.toFixed(0),
        firstChunkMs: resultA.firstChunkMs?.toFixed(0),
        stopReason: resultA.stopReason,
      },
      sessionB: {
        status: concB.status,
        text: resultB.textContent ?? resultB.error,
        durationMs: resultB.durationMs?.toFixed(0),
        firstChunkMs: resultB.firstChunkMs?.toFixed(0),
        stopReason: resultB.stopReason,
      },
      analysis: {
        bothCompleted,
        noCrossContamination,
        overlapping,
        verdict,
      },
    });

    log('OQ-6 VERDICT', { verdict });
  } catch (err) {
    console.error('[oq6] Error:', err.message);
    if (stderr) console.error('[stderr tail]', stderr.slice(-500));
  } finally {
    console.log('\n[oq6] Cleaning up...');
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
      process.exit(0);
    }, 3000);
  }
}

main().catch(console.error);
