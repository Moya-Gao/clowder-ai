/**
 * F082: Git Health Panel — parser unit tests
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const { parseGitLog, parseGitStatus, parseGitShow } = await import('../dist/routes/workspace-git.js');

describe('parseGitLog', () => {
  test('parses NUL-delimited git log output', () => {
    const stdout = [
      'abc123def456abc123def456abc123def456abc12345\x00Alice\x002026-03-07T10:00:00+08:00\x00feat: add thing',
      'def456abc123def456abc123def456abc123def45678\x00Bob\x002026-03-06T09:00:00+08:00\x00fix: bug',
    ].join('\n');
    const commits = parseGitLog(stdout);
    assert.equal(commits.length, 2);
    assert.equal(commits[0].hash, 'abc123def456abc123def456abc123def456abc12345');
    assert.equal(commits[0].short, 'abc123de');
    assert.equal(commits[0].author, 'Alice');
    assert.ok(commits[0].date.startsWith('2026-03-07'));
    assert.equal(commits[0].subject, 'feat: add thing');
    assert.equal(commits[1].author, 'Bob');
  });

  test('returns empty array for empty output', () => {
    assert.deepEqual(parseGitLog(''), []);
    assert.deepEqual(parseGitLog('  \n  '), []);
  });

  test('handles subject containing NUL-like chars gracefully', () => {
    const stdout = 'a'.repeat(40) + '\x00Author\x002026-01-01T00:00:00Z\x00subject with special chars: 你好';
    const commits = parseGitLog(stdout);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].subject, 'subject with special chars: 你好');
  });
});

describe('parseGitStatus', () => {
  test('categorizes staged/unstaged/untracked', () => {
    const mockOutput = ['M  staged-file.ts', ' M unstaged-file.ts', '?? new-file.ts', 'A  added-file.ts', 'MM both-file.ts'].join('\n');
    const result = parseGitStatus(mockOutput);
    assert.equal(result.staged.length, 3, 'M, A, MM are staged');
    assert.equal(result.unstaged.length, 2, 'M (unstaged) and MM');
    assert.equal(result.untracked.length, 1);
    assert.equal(result.untracked[0].path, 'new-file.ts');
  });

  test('returns empty categories for clean repo', () => {
    const result = parseGitStatus('');
    assert.deepEqual(result, { staged: [], unstaged: [], untracked: [] });
  });

  test('handles deleted files', () => {
    const result = parseGitStatus('D  deleted.ts');
    assert.equal(result.staged.length, 1);
    assert.equal(result.staged[0].status, 'D');
  });
});

describe('parseGitShow', () => {
  test('extracts changed files from --stat output', () => {
    const mockStat = [' src/foo.ts | 12 +++---', ' src/bar.ts |  3 +++', ' 2 files changed, 9 insertions(+), 6 deletions(-)'].join('\n');
    const files = parseGitShow(mockStat);
    assert.equal(files.length, 2);
    assert.equal(files[0].path, 'src/foo.ts');
    assert.equal(files[0].summary, '12 +++---');
    assert.equal(files[1].path, 'src/bar.ts');
  });

  test('returns empty for no stat lines', () => {
    assert.deepEqual(parseGitShow('just a commit message'), []);
    assert.deepEqual(parseGitShow(''), []);
  });
});
