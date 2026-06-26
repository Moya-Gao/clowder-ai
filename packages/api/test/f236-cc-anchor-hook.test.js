/**
 * F236 Phase C — Unit tests for cc PostToolUse anchor hook logic.
 *
 * Tests the exported functions from f236-anchor-posttool.mjs.
 * These are pure-logic tests — no actual cc process or hook protocol involved.
 *
 * Convention: node:test (project test runner).
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  appendDrillEvalEvent,
  appendEvalEvent,
  buildGlobReplacement,
  buildGrepAnchor,
  buildReadAnchor,
  buildReadReplacement,
  getTotalLines,
  isAnchorModeActive,
  isBoundedRead,
  parseGrepHitsPerFile,
  processHookEvent,
  resolveEvalFilePath,
  resolveModeFilePath,
  wrapForPostToolUse,
} from '../../../.claude/hooks/f236-anchor-posttool.mjs';

// ─── Test helpers ─────────────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), `f236-hook-test-${process.pid}`);

function makeModeFile(path, content = 'anchor') {
  const dir = path.substring(0, path.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, content);
}

function makeTestFile(name, content) {
  mkdirSync(TEST_DIR, { recursive: true });
  const p = join(TEST_DIR, name);
  writeFileSync(p, content);
  return p;
}

// ─── resolveModeFilePath ──────────────────────────────────────────────────

describe('resolveModeFilePath', () => {
  it('uses invocation ID when available', () => {
    const path = resolveModeFilePath({ CAT_CAFE_INVOCATION_ID: 'inv-123' });
    assert.strictEqual(path, '/tmp/cat-cafe-anchor-mode-inv-123');
  });

  it('falls back to CLAUDE_PROJECT_DIR', () => {
    const path = resolveModeFilePath({ CLAUDE_PROJECT_DIR: '/home/user/project' });
    assert.strictEqual(path, '/home/user/project/.f236-anchor-mode');
  });

  it('prefers invocation ID over project dir', () => {
    const path = resolveModeFilePath({
      CAT_CAFE_INVOCATION_ID: 'inv-456',
      CLAUDE_PROJECT_DIR: '/home/user/project',
    });
    assert.strictEqual(path, '/tmp/cat-cafe-anchor-mode-inv-456');
  });

  it('returns null when neither is set', () => {
    const path = resolveModeFilePath({});
    assert.strictEqual(path, null);
  });
});

// ─── isAnchorModeActive ───────────────────────────────────────────────────

describe('isAnchorModeActive', () => {
  const modePath = join(TEST_DIR, '.f236-anchor-mode');

  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('returns true when file contains "anchor"', () => {
    makeModeFile(modePath, 'anchor');
    assert.strictEqual(isAnchorModeActive(modePath), true);
  });

  it('returns true when file has trailing whitespace', () => {
    makeModeFile(modePath, 'anchor\n');
    assert.strictEqual(isAnchorModeActive(modePath), true);
  });

  it('returns false when file absent (fail-open)', () => {
    assert.strictEqual(isAnchorModeActive(join(TEST_DIR, 'nonexistent')), false);
  });

  it('returns false when file contains "full"', () => {
    makeModeFile(modePath, 'full');
    assert.strictEqual(isAnchorModeActive(modePath), false);
  });

  it('returns false when file is empty', () => {
    makeModeFile(modePath, '');
    assert.strictEqual(isAnchorModeActive(modePath), false);
  });

  it('returns false when path is null', () => {
    assert.strictEqual(isAnchorModeActive(null), false);
  });

  it('returns false for unexpected content', () => {
    makeModeFile(modePath, 'garbage');
    assert.strictEqual(isAnchorModeActive(modePath), false);
  });
});

// ─── isBoundedRead ────────────────────────────────────────────────────────

describe('isBoundedRead', () => {
  it('unbounded (no offset, no limit) → false', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts' }), false);
  });

  it('offset present → true', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts', offset: 5 }), true);
  });

  it('limit present → true', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts', limit: 50 }), true);
  });

  it('both present → true', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts', offset: 10, limit: 20 }), true);
  });

  it('null offset and limit → false (not bounded)', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts', offset: null, limit: null }), false);
  });

  it('offset = 0 → true (explicit zero is bounded)', () => {
    assert.strictEqual(isBoundedRead({ file_path: '/a.ts', offset: 0 }), true);
  });
});

// ─── getTotalLines ────────────────────────────────────────────────────────

describe('getTotalLines', () => {
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('uses tool_response.file.totalLines when available', () => {
    assert.strictEqual(getTotalLines({ file: { totalLines: 42 } }, null), 42);
  });

  it('falls back to disk when response totalLines is 0 (cache anomaly)', () => {
    const path = makeTestFile('fallback.txt', 'line1\nline2\nline3\n');
    assert.strictEqual(getTotalLines({ file: { totalLines: 0 } }, path), 3);
  });

  it('falls back to disk when file object is missing', () => {
    const path = makeTestFile('noresp.txt', 'a\nb\nc\n');
    assert.strictEqual(getTotalLines({}, path), 3);
  });

  it('returns 0 when no response and file not found', () => {
    assert.strictEqual(getTotalLines({}, '/nonexistent/file.txt'), 0);
  });

  it('handles file without trailing newline', () => {
    const path = makeTestFile('notailing.txt', 'a\nb\nc');
    assert.strictEqual(getTotalLines({}, path), 3);
  });
});

// ─── buildReadAnchor ──────────────────────────────────────────────────────

describe('buildReadAnchor', () => {
  it('produces locator format (no original content)', () => {
    const anchor = buildReadAnchor('/src/foo.ts', 120);
    assert.ok(anchor.includes('[F236-ANCHOR]'));
    assert.ok(anchor.includes('/src/foo.ts'));
    assert.ok(anchor.includes('120 lines'));
    assert.ok(anchor.includes('Drill: Read('));
    assert.ok(anchor.includes('offset=1'));
  });

  it('caps drill limit at 200 for large files', () => {
    const anchor = buildReadAnchor('/big.ts', 5000);
    assert.ok(anchor.includes('limit=200'));
  });

  it('uses actual line count for small files', () => {
    const anchor = buildReadAnchor('/small.ts', 30);
    assert.ok(anchor.includes('limit=30'));
  });

  it('contains ZERO lines from original file content (locator-not-synopsis invariant)', () => {
    // The anchor should only contain metadata, not any real code
    const anchor = buildReadAnchor('/src/foo.ts', 100);
    // Should NOT contain any plausible code content
    assert.ok(!anchor.includes('import'));
    assert.ok(!anchor.includes('function'));
    assert.ok(!anchor.includes('const'));
  });
});

// ─── buildReadReplacement ─────────────────────────────────────────────────

describe('buildReadReplacement', () => {
  it('preserves original shape', () => {
    const original = {
      type: 'text',
      file: {
        filePath: '/src/foo.ts',
        content: 'real content here',
        numLines: 120,
        startLine: 1,
        totalLines: 120,
      },
    };
    const result = buildReadReplacement(original, 'ANCHOR', 120);
    assert.ok(result.updatedToolOutput);
    assert.strictEqual(result.updatedToolOutput.type, 'text');
    assert.strictEqual(result.updatedToolOutput.file.filePath, '/src/foo.ts');
    assert.strictEqual(result.updatedToolOutput.file.content, 'ANCHOR');
    assert.strictEqual(result.updatedToolOutput.file.totalLines, 120);
    assert.strictEqual(result.updatedToolOutput.file.startLine, 1);
  });

  it('original content is NOT in replacement', () => {
    const result = buildReadReplacement(
      { type: 'text', file: { content: 'SECRET_CONTENT', totalLines: 10 } },
      'ANCHOR_LOCATOR',
      10,
    );
    assert.ok(!JSON.stringify(result).includes('SECRET_CONTENT'));
  });
});

// ─── parseGrepHitsPerFile ─────────────────────────────────────────────────

describe('parseGrepHitsPerFile', () => {
  it('counts lines per file', () => {
    const content = 'a.ts:10:function foo\na.ts:20:function bar\nb.ts:5:import';
    const result = parseGrepHitsPerFile(content, ['a.ts', 'b.ts']);
    assert.deepStrictEqual(result, [
      { file: 'a.ts', hits: 2 },
      { file: 'b.ts', hits: 1 },
    ]);
  });

  it('handles empty content', () => {
    const result = parseGrepHitsPerFile('', ['a.ts']);
    assert.deepStrictEqual(result, [{ file: 'a.ts', hits: 0 }]);
  });

  it('handles null content', () => {
    const result = parseGrepHitsPerFile(null, ['a.ts']);
    assert.deepStrictEqual(result, [{ file: 'a.ts', hits: 0 }]);
  });
});

// ─── buildGrepAnchor ──────────────────────────────────────────────────────

describe('buildGrepAnchor', () => {
  it('produces anchor with file counts', () => {
    const anchor = buildGrepAnchor(
      { pattern: 'function' },
      { numFiles: 2, numLines: 10, filenames: ['a.ts', 'b.ts'], content: 'a.ts:1:x\nb.ts:2:y' },
    );
    assert.ok(anchor.includes('[F236-ANCHOR]'));
    assert.ok(anchor.includes('2 files'));
    assert.ok(anchor.includes('10 matching lines'));
    assert.ok(anchor.includes('"function"'));
    assert.ok(anchor.includes('a.ts'));
    assert.ok(anchor.includes('Drill:'));
  });

  it('contains no original grep content lines', () => {
    const anchor = buildGrepAnchor(
      { pattern: 'secret' },
      { numFiles: 1, numLines: 1, filenames: ['a.ts'], content: 'a.ts:5:SECRET_LINE_CONTENT' },
    );
    assert.ok(!anchor.includes('SECRET_LINE_CONTENT'));
  });
});

// ─── buildGlobReplacement (P2 fix: filenames truncation) ─────────────────

describe('buildGlobReplacement', () => {
  it('passes through small filenames list unchanged', () => {
    const response = { filenames: ['/a.ts', '/b.ts', '/c.ts'], numFiles: 3 };
    const result = buildGlobReplacement(response, 'ANCHOR');
    assert.strictEqual(result.updatedToolOutput.filenames.length, 3);
    assert.deepStrictEqual(result.updatedToolOutput.filenames, ['/a.ts', '/b.ts', '/c.ts']);
    assert.strictEqual(result.updatedToolOutput.numFiles, 3);
    assert.strictEqual(result.updatedToolOutput.content, 'ANCHOR');
  });

  it('truncates filenames to max 10 entries', () => {
    const allFiles = Array.from({ length: 25 }, (_, i) => `/src/file-${i}.ts`);
    const response = { filenames: allFiles, numFiles: 25 };
    const result = buildGlobReplacement(response, 'ANCHOR');
    assert.strictEqual(result.updatedToolOutput.filenames.length, 10);
    assert.deepStrictEqual(result.updatedToolOutput.filenames, allFiles.slice(0, 10));
    // numFiles preserves the total count, NOT the truncated count
    assert.strictEqual(result.updatedToolOutput.numFiles, 25);
  });

  it('preserves numFiles from response even when filenames truncated', () => {
    const allFiles = Array.from({ length: 50 }, (_, i) => `/f${i}.ts`);
    const response = { filenames: allFiles, numFiles: 50 };
    const result = buildGlobReplacement(response, 'ANCHOR');
    assert.strictEqual(result.updatedToolOutput.numFiles, 50);
    assert.strictEqual(result.updatedToolOutput.filenames.length, 10);
  });

  it('handles exactly 10 filenames without truncation', () => {
    const allFiles = Array.from({ length: 10 }, (_, i) => `/src/f${i}.ts`);
    const response = { filenames: allFiles, numFiles: 10 };
    const result = buildGlobReplacement(response, 'ANCHOR');
    assert.strictEqual(result.updatedToolOutput.filenames.length, 10);
    assert.deepStrictEqual(result.updatedToolOutput.filenames, allFiles);
  });

  it('handles empty filenames', () => {
    const result = buildGlobReplacement({ filenames: [], numFiles: 0 }, 'ANCHOR');
    assert.deepStrictEqual(result.updatedToolOutput.filenames, []);
    assert.strictEqual(result.updatedToolOutput.numFiles, 0);
  });

  it('handles missing filenames (defaults to empty)', () => {
    const result = buildGlobReplacement({}, 'ANCHOR');
    assert.deepStrictEqual(result.updatedToolOutput.filenames, []);
    assert.strictEqual(result.updatedToolOutput.numFiles, 0);
  });
});

// ─── wrapForPostToolUse (P1 fix: hookSpecificOutput envelope) ────────────

describe('wrapForPostToolUse', () => {
  it('wraps valid internal result in cc PostToolUse envelope', () => {
    const internal = { updatedToolOutput: { content: 'ANCHOR', numFiles: 3 } };
    const wrapped = wrapForPostToolUse(internal);
    assert.ok(wrapped.hookSpecificOutput);
    assert.strictEqual(wrapped.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.deepStrictEqual(wrapped.hookSpecificOutput.updatedToolOutput, internal.updatedToolOutput);
  });

  it('returns null for null input', () => {
    assert.strictEqual(wrapForPostToolUse(null), null);
  });

  it('returns null for undefined input', () => {
    assert.strictEqual(wrapForPostToolUse(undefined), null);
  });

  it('returns null when input has no updatedToolOutput', () => {
    assert.strictEqual(wrapForPostToolUse({ other: 'data' }), null);
  });

  it('returns null when updatedToolOutput is null', () => {
    assert.strictEqual(wrapForPostToolUse({ updatedToolOutput: null }), null);
  });

  it('preserves complex nested tool output', () => {
    const internal = {
      updatedToolOutput: {
        type: 'text',
        file: { filePath: '/foo.ts', content: 'ANCHOR', numLines: 100, totalLines: 100 },
      },
    };
    const wrapped = wrapForPostToolUse(internal);
    assert.strictEqual(wrapped.hookSpecificOutput.updatedToolOutput.type, 'text');
    assert.strictEqual(wrapped.hookSpecificOutput.updatedToolOutput.file.filePath, '/foo.ts');
  });
});

// ─── processHookEvent (integration) ───────────────────────────────────────

describe('processHookEvent', () => {
  const invId = `test-${process.pid}`;
  const modePath = `/tmp/cat-cafe-anchor-mode-${invId}`;
  const env = { CAT_CAFE_INVOCATION_ID: invId };

  beforeEach(() => makeModeFile(modePath, 'anchor'));
  afterEach(() => {
    try {
      rmSync(modePath);
    } catch {
      /* ok */
    }
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('unbounded Read + anchor mode → produces anchor replacement', () => {
    const result = processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts' },
        tool_response: {
          type: 'text',
          file: { filePath: '/src/foo.ts', content: 'REAL_CODE', numLines: 50, startLine: 1, totalLines: 50 },
        },
      },
      env,
    );
    assert.ok(result, 'should produce replacement');
    assert.strictEqual(result.hookSpecificOutput.hookEventName, 'PostToolUse');
    const out = result.hookSpecificOutput.updatedToolOutput;
    assert.ok(out);
    assert.ok(out.file.content.includes('[F236-ANCHOR]'));
    assert.ok(!out.file.content.includes('REAL_CODE'));
    assert.strictEqual(out.file.totalLines, 50);
  });

  it('bounded Read + anchor mode → pass-through (null)', () => {
    const result = processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts', offset: 10, limit: 20 },
        tool_response: { type: 'text', file: { content: 'slice', totalLines: 50 } },
      },
      env,
    );
    assert.strictEqual(result, null);
  });

  it('unbounded Read + no mode file → pass-through (fail-open)', () => {
    rmSync(modePath, { force: true });
    const result = processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts' },
        tool_response: { type: 'text', file: { content: 'REAL_CODE', totalLines: 50 } },
      },
      env,
    );
    assert.strictEqual(result, null);
  });

  it('Grep + anchor mode → produces anchor replacement', () => {
    const result = processHookEvent(
      {
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO', path: '/src' },
        tool_response: {
          mode: 'content',
          numFiles: 3,
          numLines: 15,
          filenames: ['a.ts', 'b.ts', 'c.ts'],
          content: 'a.ts:1:TODO fix\nb.ts:5:TODO later',
        },
      },
      env,
    );
    assert.ok(result);
    const grepOut = result.hookSpecificOutput.updatedToolOutput;
    assert.ok(grepOut.content.includes('[F236-ANCHOR]'));
    assert.ok(!grepOut.content.includes('TODO fix'));
    assert.strictEqual(grepOut.numFiles, 3);
  });

  it('Glob + anchor mode → produces anchor replacement', () => {
    const result = processHookEvent(
      {
        tool_name: 'Glob',
        tool_input: { pattern: 'src/**/*.ts' },
        tool_response: {
          filenames: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
          numFiles: 3,
        },
      },
      env,
    );
    assert.ok(result);
    const globOut = result.hookSpecificOutput.updatedToolOutput;
    assert.ok(globOut.content.includes('[F236-ANCHOR]'));
    assert.ok(globOut.content.includes('3 files'));
  });

  it('non-Read/Grep/Glob tool → pass-through', () => {
    const result = processHookEvent(
      {
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        tool_response: { stdout: 'files' },
      },
      env,
    );
    assert.strictEqual(result, null);
  });

  it('Read with empty .file (cc cache anomaly) → fallback to disk stat', () => {
    const path = makeTestFile('cache-anomaly.txt', 'line1\nline2\nline3\n');
    const result = processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: path },
        tool_response: { type: 'text', file: { filePath: path, content: '', totalLines: 0 } },
      },
      env,
    );
    assert.ok(result);
    assert.ok(result.hookSpecificOutput.updatedToolOutput.file.content.includes('3 lines'));
  });

  it('anchor content never contains original file content (ADR-031 invariant)', () => {
    const result = processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/secrets.ts' },
        tool_response: {
          type: 'text',
          file: {
            filePath: '/src/secrets.ts',
            content: 'const API_KEY = "sk-12345"\nconst SECRET = "hunter2"',
            totalLines: 2,
          },
        },
      },
      env,
    );
    assert.ok(result);
    const outputStr = JSON.stringify(result);
    assert.ok(!outputStr.includes('sk-12345'));
    assert.ok(!outputStr.includes('hunter2'));
    assert.ok(!outputStr.includes('API_KEY'));
  });

  // ─── P2 fix: Glob shape validation guard ──────────────────────────────────

  it('Glob with missing filenames array → pass-through (shape guard)', () => {
    // Glob response without filenames = unrecognized shape → fail-open
    const result = processHookEvent(
      {
        tool_name: 'Glob',
        tool_input: { pattern: '*.ts' },
        tool_response: { results: [{ path: '/a.ts' }] }, // wrong shape
      },
      env,
    );
    assert.strictEqual(result, null, 'should pass through on unrecognized Glob shape');
  });

  it('Glob with non-array filenames → pass-through (shape guard)', () => {
    const result = processHookEvent(
      {
        tool_name: 'Glob',
        tool_input: { pattern: '*.ts' },
        tool_response: { filenames: 'not-an-array', numFiles: 1 },
      },
      env,
    );
    assert.strictEqual(result, null);
  });

  it('Glob with valid filenames array → produces anchor', () => {
    const result = processHookEvent(
      {
        tool_name: 'Glob',
        tool_input: { pattern: 'src/**/*.ts' },
        tool_response: { filenames: ['/src/a.ts', '/src/b.ts'], numFiles: 2 },
      },
      env,
    );
    assert.ok(result, 'should produce anchor for valid Glob shape');
    assert.ok(result.hookSpecificOutput.updatedToolOutput.content.includes('2 files matched'));
  });
});

// ─── P1 fix: Eval event file recording ────────────────────────────────────

describe('resolveEvalFilePath', () => {
  it('uses invocation ID when available', () => {
    const path = resolveEvalFilePath({ CAT_CAFE_INVOCATION_ID: 'inv-123' });
    assert.strictEqual(path, '/tmp/cat-cafe-anchor-eval-inv-123.jsonl');
  });

  it('falls back to project dir', () => {
    const path = resolveEvalFilePath({ CLAUDE_PROJECT_DIR: '/my/project' });
    assert.strictEqual(path, '/my/project/.f236-anchor-eval.jsonl');
  });

  it('returns null when neither env var set', () => {
    const path = resolveEvalFilePath({});
    assert.strictEqual(path, null);
  });
});

describe('appendEvalEvent — eval file recording', () => {
  const evalInvocationId = `eval-test-${process.pid}`;
  const evalPath = `/tmp/cat-cafe-anchor-eval-${evalInvocationId}.jsonl`;

  afterEach(() => {
    rmSync(evalPath, { force: true });
  });

  it('appends eval event with Track-2 compatible fields for Read anchor', () => {
    appendEvalEvent(
      { CAT_CAFE_INVOCATION_ID: evalInvocationId, CAT_CAFE_CAT_ID: 'opus' },
      { tool: 'Read', originalChars: 5000, returnedChars: 80, itemIds: ['file:/src/foo.ts'] },
    );
    assert.ok(existsSync(evalPath));
    const content = readFileSync(evalPath, 'utf-8').trim();
    const event = JSON.parse(content);
    assert.strictEqual(event.tool, 'cc-read');
    assert.deepStrictEqual(event.itemIds, ['file:/src/foo.ts']);
    assert.strictEqual(event.originalChars, 5000);
    assert.strictEqual(event.returnedChars, 80);
    assert.strictEqual(event.modeResolved, 'anchor');
    assert.strictEqual(event.modeSource, 'explicit');
    assert.strictEqual(event.catId, 'opus');
    assert.strictEqual(typeof event.ts, 'number');
  });

  it('appends multiple events as separate lines', () => {
    const evalEnv = { CAT_CAFE_INVOCATION_ID: evalInvocationId };
    appendEvalEvent(evalEnv, { tool: 'Read', originalChars: 1000, returnedChars: 50, itemIds: ['file:/a.ts'] });
    appendEvalEvent(evalEnv, {
      tool: 'Grep',
      originalChars: 3000,
      returnedChars: 100,
      itemIds: ['file:src/a.ts', 'file:src/b.ts'],
    });
    appendEvalEvent(evalEnv, {
      tool: 'Glob',
      originalChars: 500,
      returnedChars: 80,
      itemIds: ['file:c.ts', 'file:d.ts'],
    });
    const lines = readFileSync(evalPath, 'utf-8').trim().split('\n');
    assert.strictEqual(lines.length, 3);
    assert.strictEqual(JSON.parse(lines[0]).tool, 'cc-read');
    assert.strictEqual(JSON.parse(lines[1]).tool, 'cc-grep');
    assert.strictEqual(JSON.parse(lines[2]).tool, 'cc-glob');
  });

  it('does not create file when no invocation ID', () => {
    appendEvalEvent({}, { tool: 'Read', originalChars: 1000, returnedChars: 50, itemIds: ['file:/a.ts'] });
    assert.ok(!existsSync(evalPath));
  });

  it('omits catId when env var not set', () => {
    appendEvalEvent(
      { CAT_CAFE_INVOCATION_ID: evalInvocationId },
      { tool: 'Grep', originalChars: 3000, returnedChars: 100, itemIds: ['file:src/a.ts'] },
    );
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.strictEqual(event.catId, undefined);
    // modeResolved/modeSource are always present (anchor hook = always anchor/explicit)
    assert.strictEqual(event.modeResolved, 'anchor');
    assert.strictEqual(event.modeSource, 'explicit');
  });
});

describe('processHookEvent — eval file integration', () => {
  const evalInvocationId = `eval-int-${process.pid}`;
  const evalPath = `/tmp/cat-cafe-anchor-eval-${evalInvocationId}.jsonl`;
  const evalEnv = {
    CAT_CAFE_INVOCATION_ID: evalInvocationId,
    CLAUDE_PROJECT_DIR: join(tmpdir(), `f236-eval-int-test-${process.pid}`),
  };

  beforeEach(() => {
    mkdirSync(join(tmpdir(), `f236-eval-int-test-${process.pid}`), { recursive: true });
    writeFileSync(`/tmp/cat-cafe-anchor-mode-${evalInvocationId}`, 'anchor');
    rmSync(evalPath, { force: true });
  });

  afterEach(() => {
    rmSync(evalPath, { force: true });
    rmSync(`/tmp/cat-cafe-anchor-mode-${evalInvocationId}`, { force: true });
    rmSync(join(tmpdir(), `f236-eval-int-test-${process.pid}`), { recursive: true, force: true });
  });

  it('Read anchor writes eval event with Track-2 fields', () => {
    const envWithCat = { ...evalEnv, CAT_CAFE_CAT_ID: 'opus' };
    processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts' },
        tool_response: {
          type: 'text',
          file: { filePath: '/src/foo.ts', content: 'x'.repeat(5000), totalLines: 200 },
        },
      },
      envWithCat,
    );
    assert.ok(existsSync(evalPath), 'eval file should be created');
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.strictEqual(event.tool, 'cc-read');
    assert.deepStrictEqual(event.itemIds, ['file:/src/foo.ts']);
    assert.strictEqual(event.originalChars, 5000);
    assert.ok(event.returnedChars < 5000, 'anchor should be smaller than original');
    assert.strictEqual(event.modeResolved, 'anchor');
    assert.strictEqual(event.modeSource, 'explicit');
    assert.strictEqual(event.catId, 'opus');
  });

  it('cache anomaly records originalChars > 0 via disk stat fallback', () => {
    // Create a real file so statSync can measure it
    const realPath = join(tmpdir(), `f236-eval-int-test-${process.pid}`, 'cache-test.ts');
    const realContent = 'const x = 1;\nconst y = 2;\nconst z = 3;\n';
    writeFileSync(realPath, realContent);
    processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: realPath },
        // Simulate cache anomaly: empty content
        tool_response: { type: 'text', file: { filePath: realPath, content: '', totalLines: 0 } },
      },
      evalEnv,
    );
    assert.ok(existsSync(evalPath), 'eval file should be created');
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.ok(event.originalChars > 0, `originalChars should be > 0 from disk stat, got ${event.originalChars}`);
    assert.strictEqual(event.originalChars, realContent.length);
  });

  it('Grep anchor writes file-level itemIds (not pattern-level)', () => {
    processHookEvent(
      {
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO' },
        tool_response: {
          mode: 'content',
          numFiles: 2,
          filenames: ['src/a.ts', 'src/b.ts'],
          content: 'src/a.ts:1:TODO fix\nsrc/b.ts:5:TODO later',
          numLines: 2,
        },
      },
      evalEnv,
    );
    assert.ok(existsSync(evalPath), 'eval file should be created');
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.strictEqual(event.tool, 'cc-grep');
    assert.deepStrictEqual(event.itemIds, ['file:src/a.ts', 'file:src/b.ts']);
  });

  it('Glob anchor writes file-level itemIds (not pattern-level)', () => {
    processHookEvent(
      {
        tool_name: 'Glob',
        tool_input: { pattern: 'src/**/*.ts' },
        tool_response: { filenames: ['src/x.ts', 'src/y.ts', 'src/z.ts'], numFiles: 3 },
      },
      evalEnv,
    );
    assert.ok(existsSync(evalPath), 'eval file should be created');
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.strictEqual(event.tool, 'cc-glob');
    assert.deepStrictEqual(event.itemIds, ['file:src/x.ts', 'file:src/y.ts', 'file:src/z.ts']);
  });

  it('pass-through (no mode file) does NOT write eval event', () => {
    rmSync(`/tmp/cat-cafe-anchor-mode-${evalInvocationId}`, { force: true });
    processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts' },
        tool_response: {
          type: 'text',
          file: { filePath: '/src/foo.ts', content: 'content', totalLines: 1 },
        },
      },
      evalEnv,
    );
    assert.ok(!existsSync(evalPath), 'eval file should NOT be created on pass-through');
  });

  it('bounded Read in anchor mode emits drill event (not preview)', () => {
    processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts', offset: 10, limit: 50 },
        tool_response: {
          type: 'text',
          file: { filePath: '/src/foo.ts', content: 'drill content here', totalLines: 100 },
        },
      },
      evalEnv,
    );
    assert.ok(existsSync(evalPath), 'eval file should be created for drill');
    const event = JSON.parse(readFileSync(evalPath, 'utf-8').trim());
    assert.strictEqual(event.kind, 'drill');
    assert.strictEqual(event.tool, 'cc-read');
    assert.strictEqual(event.itemId, 'file:/src/foo.ts');
    assert.strictEqual(event.fullDrillChars, 'drill content here'.length);
  });

  it('bounded Read in full mode (no mode file) does NOT emit drill event', () => {
    rmSync(`/tmp/cat-cafe-anchor-mode-${evalInvocationId}`, { force: true });
    processHookEvent(
      {
        tool_name: 'Read',
        tool_input: { file_path: '/src/foo.ts', offset: 10, limit: 50 },
        tool_response: {
          type: 'text',
          file: { filePath: '/src/foo.ts', content: 'content', totalLines: 100 },
        },
      },
      evalEnv,
    );
    assert.ok(!existsSync(evalPath), 'eval file should NOT be created when not in anchor mode');
  });
});

// ─── appendDrillEvalEvent ────────────────────────────────────────────────

describe('appendDrillEvalEvent', () => {
  const drillInvocationId = `drill-test-${Date.now()}`;
  const drillEvalPath = `/tmp/cat-cafe-anchor-eval-${drillInvocationId}.jsonl`;
  const drillEnv = { CAT_CAFE_INVOCATION_ID: drillInvocationId, CAT_CAFE_CAT_ID: 'opus-test' };

  afterEach(() => {
    rmSync(drillEvalPath, { force: true });
  });

  it('writes a drill event with kind=drill', () => {
    appendDrillEvalEvent(drillEnv, {
      tool: 'Read',
      fullDrillChars: 2500,
      itemId: 'file:/src/foo.ts',
    });
    assert.ok(existsSync(drillEvalPath));
    const event = JSON.parse(readFileSync(drillEvalPath, 'utf-8').trim());
    assert.strictEqual(event.kind, 'drill');
    assert.strictEqual(event.tool, 'cc-read');
    assert.strictEqual(event.fullDrillChars, 2500);
    assert.strictEqual(event.itemId, 'file:/src/foo.ts');
    assert.strictEqual(event.catId, 'opus-test');
    assert.ok(typeof event.ts === 'number');
  });

  it('does not throw when no invocation ID', () => {
    // Should be a no-op, not throw
    appendDrillEvalEvent({}, { tool: 'Read', fullDrillChars: 100, itemId: 'file:/a.ts' });
  });
});
