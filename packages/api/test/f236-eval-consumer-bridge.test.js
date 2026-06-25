/**
 * F236 Phase E — Unit + integration tests for eval consumer bridge.
 *
 * Tests the AnchorEvalBridgeConsumer pure transform and the end-to-end
 * bridge pipeline: TranscriptTailer → evalEntriesToPreviewEvents() → recordAnchorPreviewEvent().
 *
 * Convention: node:test (project test runner).
 */

import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  evalEntriesToPreviewEvents,
  resolveEvalJsonlPath,
} from '../dist/domains/cats/services/agents/providers/AnchorEvalBridgeConsumer.js';
import { TranscriptTailer } from '../dist/domains/cats/services/agents/providers/TranscriptTailer.js';
import {
  getAnchorEventSnapshot,
  recordAnchorPreviewEvent,
  resetAnchorEventLogForTest,
} from '../dist/routes/anchor-event-log.js';

// ─── Unit: evalEntriesToPreviewEvents ─────────────────────────────

describe('evalEntriesToPreviewEvents', () => {
  it('transforms a valid eval entry to AnchorPreviewEventInput', () => {
    const entries = [
      {
        tool: 'cc-read',
        itemIds: ['/src/foo.ts'],
        originalChars: 5000,
        returnedChars: 200,
        modeResolved: 'anchor',
        modeSource: 'explicit',
        catId: 'opus',
        ts: 1719300000000,
      },
    ];

    const result = evalEntriesToPreviewEvents(entries);
    assert.equal(result.length, 1);
    assert.deepStrictEqual(result[0], {
      tool: 'cc-read',
      itemIds: ['/src/foo.ts'],
      originalChars: 5000,
      returnedChars: 200,
      modeResolved: 'anchor',
      modeSource: 'explicit',
      catId: 'opus',
    });
  });

  it('skips non-object entries', () => {
    const entries = [null, undefined, 'string', 42, true];
    assert.deepStrictEqual(evalEntriesToPreviewEvents(entries), []);
  });

  it('skips entries without required tool field', () => {
    const entries = [{ itemIds: ['/src/foo.ts'], originalChars: 100, returnedChars: 50 }];
    assert.deepStrictEqual(evalEntriesToPreviewEvents(entries), []);
  });

  it('skips entries with non-string tool', () => {
    const entries = [{ tool: 42, itemIds: ['/src/foo.ts'], originalChars: 100, returnedChars: 50 }];
    assert.deepStrictEqual(evalEntriesToPreviewEvents(entries), []);
  });

  it('skips entries with unrecognized tool name (defense-in-depth)', () => {
    const entries = [
      { tool: 'unknown-tool', itemIds: ['/src/foo.ts'], originalChars: 100, returnedChars: 50 },
      { tool: 'Bash', itemIds: ['/src/bar.ts'], originalChars: 200, returnedChars: 100 },
      { tool: 'cc-read', itemIds: ['/src/ok.ts'], originalChars: 300, returnedChars: 150 },
    ];
    const result = evalEntriesToPreviewEvents(entries);
    assert.equal(result.length, 1, 'only valid AnchorPreviewTool entries should pass');
    assert.equal(result[0].tool, 'cc-read');
  });

  it('skips entries without itemIds array', () => {
    const entries = [{ tool: 'cc-read', originalChars: 100, returnedChars: 50 }];
    assert.deepStrictEqual(evalEntriesToPreviewEvents(entries), []);
  });

  it('defaults numeric fields to 0 when missing', () => {
    const entries = [{ tool: 'cc-grep', itemIds: ['/src/bar.ts'] }];
    const result = evalEntriesToPreviewEvents(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0].originalChars, 0);
    assert.equal(result[0].returnedChars, 0);
  });

  it('handles multiple valid entries', () => {
    const entries = [
      { tool: 'cc-read', itemIds: ['/a.ts'], originalChars: 1000, returnedChars: 100 },
      { tool: 'cc-grep', itemIds: ['/b.ts', '/c.ts'], originalChars: 2000, returnedChars: 300 },
      { tool: 'cc-glob', itemIds: ['/d.ts'], originalChars: 500, returnedChars: 80 },
    ];
    const result = evalEntriesToPreviewEvents(entries);
    assert.equal(result.length, 3);
    assert.deepStrictEqual(
      result.map((e) => e.tool),
      ['cc-read', 'cc-grep', 'cc-glob'],
    );
  });

  it('does not include ts field in output', () => {
    const entries = [{ tool: 'cc-read', itemIds: ['/a.ts'], originalChars: 100, returnedChars: 50, ts: 12345 }];
    const result = evalEntriesToPreviewEvents(entries);
    assert.equal('ts' in result[0], false);
  });

  it('omits optional fields when absent in input', () => {
    const entries = [{ tool: 'cc-read', itemIds: ['/a.ts'], originalChars: 100, returnedChars: 50 }];
    const result = evalEntriesToPreviewEvents(entries);
    assert.equal('modeResolved' in result[0], false);
    assert.equal('modeSource' in result[0], false);
    assert.equal('catId' in result[0], false);
  });

  it('returns empty array for empty input', () => {
    assert.deepStrictEqual(evalEntriesToPreviewEvents([]), []);
  });
});

// ─── Unit: resolveEvalJsonlPath ───────────────────────────────────

describe('resolveEvalJsonlPath', () => {
  it('returns /tmp path with invocation ID', () => {
    assert.equal(resolveEvalJsonlPath('abc123'), '/tmp/cat-cafe-anchor-eval-abc123.jsonl');
  });

  it('returns null for undefined invocation ID', () => {
    assert.equal(resolveEvalJsonlPath(undefined), null);
  });

  it('returns null for empty string invocation ID', () => {
    assert.equal(resolveEvalJsonlPath(''), null);
  });
});

// ─── Integration: TranscriptTailer → consumer → recordAnchorPreviewEvent ────

describe('eval bridge integration (tailer → consumer → recordAnchorPreviewEvent)', () => {
  let tmpDir;
  let evalPath;

  beforeEach(() => {
    resetAnchorEventLogForTest();
    tmpDir = mkdtempSync(join(tmpdir(), 'f236-eval-bridge-'));
    evalPath = join(tmpDir, 'anchor-eval.jsonl');
  });

  afterEach(() => {
    resetAnchorEventLogForTest();
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('ingests eval events from jsonl file via tailer + consumer', async () => {
    const event1 = JSON.stringify({
      tool: 'cc-read',
      itemIds: ['/src/foo.ts'],
      originalChars: 5000,
      returnedChars: 200,
      modeResolved: 'anchor',
      modeSource: 'explicit',
      catId: 'opus',
      ts: Date.now(),
    });
    const event2 = JSON.stringify({
      tool: 'cc-grep',
      itemIds: ['/src/bar.ts', '/src/baz.ts'],
      originalChars: 3000,
      returnedChars: 150,
      modeResolved: 'anchor',
      modeSource: 'explicit',
      catId: 'opus',
      ts: Date.now(),
    });
    writeFileSync(evalPath, `${event1}\n${event2}\n`);

    // Tail + transform + record (the bridge pipeline)
    const tailer = new TranscriptTailer(evalPath);
    const rawEntries = await tailer.readNew();
    const previewInputs = evalEntriesToPreviewEvents(rawEntries);

    assert.equal(previewInputs.length, 2);

    // Feed into the anchor event log
    for (const input of previewInputs) {
      recordAnchorPreviewEvent(input);
    }

    // Verify they show up in the snapshot
    const snapshot = getAnchorEventSnapshot();
    assert.equal(snapshot.previewEvents.length, 2);
    assert.equal(snapshot.previewEvents[0].tool, 'cc-read');
    assert.deepStrictEqual(snapshot.previewEvents[0].itemIds, ['/src/foo.ts']);
    assert.equal(snapshot.previewEvents[1].tool, 'cc-grep');
    assert.deepStrictEqual(snapshot.previewEvents[1].itemIds, ['/src/bar.ts', '/src/baz.ts']);
  });

  it('incremental tailing does not re-ingest old events', async () => {
    const event1 = JSON.stringify({
      tool: 'cc-read',
      itemIds: ['/a.ts'],
      originalChars: 1000,
      returnedChars: 100,
      ts: Date.now(),
    });
    writeFileSync(evalPath, `${event1}\n`);

    const tailer = new TranscriptTailer(evalPath);

    // First read
    const batch1 = await tailer.readNew();
    assert.equal(batch1.length, 1);

    // Append second event
    const event2 = JSON.stringify({
      tool: 'cc-grep',
      itemIds: ['/b.ts'],
      originalChars: 2000,
      returnedChars: 200,
      ts: Date.now(),
    });
    appendFileSync(evalPath, `${event2}\n`);

    // Second read — only new events
    const batch2 = await tailer.readNew();
    assert.equal(batch2.length, 1);

    const inputs = evalEntriesToPreviewEvents(batch2);
    assert.equal(inputs.length, 1);
    assert.equal(inputs[0].tool, 'cc-grep');
  });

  it('handles non-existent eval file gracefully', async () => {
    const tailer = new TranscriptTailer(join(tmpDir, 'nonexistent.jsonl'));
    const entries = await tailer.readNew();
    assert.deepStrictEqual(entries, []);
  });

  it('skips malformed JSON lines without crashing', async () => {
    writeFileSync(
      evalPath,
      '{"tool":"cc-read","itemIds":["/a.ts"],"originalChars":100,"returnedChars":50}\n{broken json\n{"tool":"cc-grep","itemIds":["/b.ts"],"originalChars":200,"returnedChars":80}\n',
    );

    const tailer = new TranscriptTailer(evalPath);
    const entries = await tailer.readNew();
    // TranscriptTailer skips malformed JSON lines
    assert.equal(entries.length, 2);

    const inputs = evalEntriesToPreviewEvents(entries);
    assert.equal(inputs.length, 2);
    assert.equal(inputs[0].tool, 'cc-read');
    assert.equal(inputs[1].tool, 'cc-grep');
  });
});
