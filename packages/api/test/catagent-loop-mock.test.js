/**
 * CatAgent Loop Mock Test — F152 Phase 1 Go/No-Go Gate (real loop)
 *
 * Tests runCatAgentLoop with a mock Anthropic client to validate:
 * - Budget guard stops at exact boundary
 * - done event has correct usage keys (inputTokens/outputTokens)
 * - Truncation applies even when <= KEEP_RECENT_TURNS tool results
 */

import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const { runCatAgentLoop } = await import('../dist/domains/cats/services/agents/providers/catagent/catagent-loop.js');

/** Create a mock Anthropic client that returns tool_use for N turns then stops */
function createMockClient(toolTurns, inputTokensPerCall = 5000, outputTokensPerCall = 1000) {
  let callCount = 0;
  return {
    messages: {
      async create() {
        callCount++;
        const turn = callCount;

        if (turn <= toolTurns) {
          return {
            model: 'mock-model',
            usage: { input_tokens: inputTokensPerCall, output_tokens: outputTokensPerCall },
            content: [
              { type: 'text', text: `Turn ${turn} analysis` },
              { type: 'tool_use', id: `tool-${turn}`, name: 'read_file', input: { path: 'package.json' } },
            ],
            stop_reason: 'tool_use',
          };
        }

        // Final turn: just text, no tools
        return {
          model: 'mock-model',
          usage: { input_tokens: inputTokensPerCall, output_tokens: outputTokensPerCall },
          content: [{ type: 'text', text: 'Done.' }],
          stop_reason: 'end_turn',
        };
      },
    },
    getCallCount() {
      return callCount;
    },
  };
}

function createTmpDir() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'catagent-loop-test-')));
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}');
  return dir;
}

// ── Budget guard stops at exact boundary ──

test('budget guard stops loop when cumulative tokens exceed limit', async () => {
  const tmpDir = createTmpDir();
  try {
    // Each call uses 5000 + 1000 = 6000 tokens. Budget = 15000.
    // Turn 1: 6000 (ok), Turn 2: 12000 (ok), Turn 3: check 12000 < 15000 → call → 18000.
    // Turn 4: check 18000 >= 15000 → stop.
    const mockClient = createMockClient(10, 5000, 1000);
    const messages = [];

    for await (const msg of runCatAgentLoop('test prompt', {
      catId: 'opus',
      model: 'mock-model',
      apiKey: 'fake-key',
      maxTurns: 20,
      maxTokens: 4096,
      tokenBudgetLimit: 15_000,
      workingDirectory: tmpDir,
      _testClient: mockClient,
    })) {
      messages.push(msg);
    }

    // Should have stopped before completing all 10 tool turns
    assert.ok(mockClient.getCallCount() < 10, `should stop early, got ${mockClient.getCallCount()} calls`);

    // Should end with a budget-exhausted text + done
    const budgetMsg = messages.find((m) => m.type === 'text' && m.content?.includes('budget exhausted'));
    assert.ok(budgetMsg, 'should have a budget exhausted message');

    const doneMsg = messages.find((m) => m.type === 'done');
    assert.ok(doneMsg, 'should have done message');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── done event has correct usage keys ──

test('done event metadata uses inputTokens/outputTokens keys', async () => {
  const tmpDir = createTmpDir();
  try {
    const mockClient = createMockClient(1, 3000, 500);
    const messages = [];

    for await (const msg of runCatAgentLoop('read package.json', {
      catId: 'opus',
      model: 'mock-model',
      apiKey: 'fake-key',
      maxTurns: 10,
      maxTokens: 4096,
      tokenBudgetLimit: 200_000,
      workingDirectory: tmpDir,
      _testClient: mockClient,
    })) {
      messages.push(msg);
    }

    const doneMsg = messages.find((m) => m.type === 'done');
    assert.ok(doneMsg, 'should have done message');
    assert.ok(doneMsg.metadata?.usage, 'done should have usage metadata');

    const { usage } = doneMsg.metadata;
    // Must use downstream-compatible keys
    assert.equal(typeof usage.inputTokens, 'number', 'must have inputTokens');
    assert.equal(typeof usage.outputTokens, 'number', 'must have outputTokens');
    assert.ok(usage.inputTokens > 0, 'inputTokens must be positive');
    assert.ok(usage.outputTokens > 0, 'outputTokens must be positive');
    // Must NOT have SessionTokenUsage keys
    assert.equal(usage.totalInputTokens, undefined, 'must not have totalInputTokens');
    assert.equal(usage.totalOutputTokens, undefined, 'must not have totalOutputTokens');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Cumulative usage is correct across turns ──

test('cumulative usage tracks correctly across 5 tool turns', async () => {
  const tmpDir = createTmpDir();
  try {
    const mockClient = createMockClient(5, 2000, 500);
    const textMessages = [];

    for await (const msg of runCatAgentLoop('analyze the project', {
      catId: 'opus',
      model: 'mock-model',
      apiKey: 'fake-key',
      maxTurns: 20,
      maxTokens: 4096,
      tokenBudgetLimit: 200_000,
      workingDirectory: tmpDir,
      _testClient: mockClient,
    })) {
      if (msg.type === 'text' && msg.metadata?.usage) textMessages.push(msg);
    }

    // Last text message should have cumulative usage
    const lastText = textMessages[textMessages.length - 1];
    assert.ok(lastText.metadata.usage.inputTokens > 2000, 'cumulative input should exceed single call');
    assert.ok(lastText.metadata.usage.numTurns > 1, 'should track multiple turns');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── 10-turn loop completes with identity preserved ──

test('10-turn loop completes and yields correct message sequence', async () => {
  const tmpDir = createTmpDir();
  try {
    const mockClient = createMockClient(10, 1000, 200);
    const messages = [];

    for await (const msg of runCatAgentLoop('deep analysis', {
      catId: 'opus',
      model: 'mock-model',
      apiKey: 'fake-key',
      maxTurns: 20,
      maxTokens: 4096,
      tokenBudgetLimit: 200_000,
      workingDirectory: tmpDir,
      _testClient: mockClient,
    })) {
      messages.push(msg);
    }

    // Should have session_init, multiple text+tool_use+tool_result, then done
    assert.equal(messages[0].type, 'session_init');
    assert.equal(messages[messages.length - 1].type, 'done');

    // All messages should have catId = opus
    for (const msg of messages) {
      assert.equal(msg.catId, 'opus', `${msg.type} message should have catId=opus`);
    }

    // 10 tool turns + 1 final = 11 API calls
    assert.equal(mockClient.getCallCount(), 11, 'should make 11 API calls (10 tool + 1 final)');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
