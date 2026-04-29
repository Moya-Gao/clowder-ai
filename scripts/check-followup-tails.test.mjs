#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SCRIPT = new URL('./check-followup-tails.mjs', import.meta.url).pathname;

function run(stdin = '', env = {}) {
  try {
    const result = execFileSync('node', [SCRIPT, '--no-commits', '--stdin'], {
      input: stdin,
      encoding: 'utf-8',
      timeout: 5_000,
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout: result, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('check-followup-tails', () => {
  it('passes on clean text', () => {
    const { code } = run('This commit fixes the bug completely.');
    assert.equal(code, 0);
  });

  it('detects "follow-up" keyword', () => {
    const { code, stderr } = run('AC-A3 will be handled in a follow-up PR');
    assert.equal(code, 1);
    assert.match(stderr, /follow-up/i);
  });

  it('detects "followup" without hyphen', () => {
    const { code } = run('Added followup task for later');
    assert.equal(code, 1);
  });

  it('detects "deferred"', () => {
    const { code } = run('This AC is deferred to next sprint');
    assert.equal(code, 1);
  });

  it('detects "next phase"', () => {
    const { code } = run('Will complete in next phase');
    assert.equal(code, 1);
  });

  it('detects "留个尾巴"', () => {
    const { code } = run('这里留个尾巴下次再做');
    assert.equal(code, 1);
  });

  it('detects "先这样"', () => {
    const { code } = run('先这样吧后面再优化');
    assert.equal(code, 1);
  });

  it('detects "下次一定"', () => {
    const { code } = run('下次一定补上测试');
    assert.equal(code, 1);
  });

  it('detects "will address later"', () => {
    const { code } = run('Good point, will address later in a separate PR');
    assert.equal(code, 1);
  });

  it('detects "后续优化"', () => {
    const { code } = run('后续优化一下性能');
    assert.equal(code, 1);
  });

  it('detects "以后再"', () => {
    const { code } = run('这个以后再说吧');
    assert.equal(code, 1);
  });

  it('detects "回头再"', () => {
    const { code } = run('回头再处理这个问题');
    assert.equal(code, 1);
  });

  it('detects "next PR"', () => {
    const { code } = run('Will fix in next PR');
    assert.equal(code, 1);
  });

  it('detects "stub"', () => {
    const { code } = run('Created a stub spec for future work');
    assert.equal(code, 1);
  });

  it('detects "TD" as standalone keyword', () => {
    const { code } = run('Moved AC-5 to TD for later');
    assert.equal(code, 1);
  });

  it('does not false-positive on TDD', () => {
    const { code } = run('Added TDD tests for the feature');
    assert.equal(code, 0);
  });

  it('detects "out of scope"', () => {
    const { code } = run('This AC is out of scope for this PR');
    assert.equal(code, 1);
  });

  it('detects "MVP 先上"', () => {
    const { code } = run('MVP先上，后面再补');
    assert.equal(code, 1);
  });

  it('passes when keywords appear in legitimate context', () => {
    const { code } = run('The feature is complete. All ACs met with evidence.');
    assert.equal(code, 0);
  });

  it('detects from PR_BODY env var', () => {
    const { code } = run('', { PR_BODY: 'This PR defers AC-3 to follow-up' });
    assert.equal(code, 1);
  });

  it('detects from PR_BODY_FILE env var', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'tail-test-'));
    const bodyFile = join(tmpDir, 'pr-body.txt');
    writeFileSync(bodyFile, '下次一定补上');
    try {
      const { code } = run('', { PR_BODY_FILE: bodyFile });
      assert.equal(code, 1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('exempt commit does not suppress scanning of subsequent commits', () => {
    const { code, stderr } = run('docs(F177): update spec\nThis has a stub in it');
    assert.equal(code, 1);
    assert.match(stderr, /stub/i);
  });

  it('reports multiple hits', () => {
    const { code, stderr } = run('follow-up task\n先这样\n下次一定');
    assert.equal(code, 1);
    assert.match(stderr, /follow-up/i);
    assert.match(stderr, /先这样/);
    assert.match(stderr, /下次一定/);
  });
});
