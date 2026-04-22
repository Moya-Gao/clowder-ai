import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

const SCRIPT = resolve(process.cwd(), 'scripts/check-skills-manifest.mjs');

function writeBaseFixture(root) {
  const skillsDir = join(root, 'cat-cafe-skills');
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(join(skillsDir, 'skill-a'), { recursive: true });
  mkdirSync(join(skillsDir, 'skill-b'), { recursive: true });

  writeFileSync(
    join(root, 'cat-config.json'),
    JSON.stringify(
      {
        version: 1,
        roster: {
          codex: { family: 'maine-coon', roles: ['peer-reviewer'], lead: true, available: true, evaluation: 'test' },
          gpt52: { family: 'maine-coon', roles: ['peer-reviewer'], lead: false, available: true, evaluation: 'test' },
        },
        breeds: {
          0: { nickname: '宪宪', displayName: '布偶猫' },
          1: { nickname: '砚砚', displayName: '缅因猫' },
        },
      },
      null,
      2,
    ),
    'utf-8',
  );

  writeFileSync(
    join(skillsDir, 'manifest.yaml'),
    [
      'skills:',
      '  skill-a:',
      '    triggers: ["do a"]',
      '    not_for: ["skip a"]',
      '    output: "done a"',
      '    next: ["skill-b"]',
      '  skill-b:',
      '    triggers: ["do b"]',
      '    not_for: ["skip b"]',
      '    output: "done b"',
      '    next: []',
      '',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(join(skillsDir, 'skill-a', 'SKILL.md'), '# skill-a\n\nno hardcoded handles\n', 'utf-8');
  writeFileSync(join(skillsDir, 'skill-b', 'SKILL.md'), '# skill-b\n\nno hardcoded handles\n', 'utf-8');
}

function runChecker(root) {
  return execFileSync('node', [SCRIPT, root], { encoding: 'utf-8' });
}

function runCheckerDetailed(root, env = {}) {
  return spawnSync('node', [SCRIPT, root], { encoding: 'utf-8', env: { ...process.env, ...env } });
}

describe('check-skills-manifest.mjs', () => {
  let sandboxRoot;

  beforeEach(() => {
    sandboxRoot = mkdtempSync(join(tmpdir(), 'cc-skill-manifest-'));
    writeBaseFixture(sandboxRoot);
  });

  afterEach(() => {
    rmSync(sandboxRoot, { recursive: true, force: true });
  });

  it('passes for a valid manifest and skills set', () => {
    const output = runChecker(sandboxRoot);
    assert.match(output, /PASS/i);
  });

  it('fails when a skill is missing output', () => {
    const manifestPath = join(sandboxRoot, 'cat-cafe-skills', 'manifest.yaml');
    const broken = [
      'skills:',
      '  skill-a:',
      '    triggers: ["do a"]',
      '    not_for: ["skip a"]',
      '    next: ["skill-b"]',
      '  skill-b:',
      '    triggers: ["do b"]',
      '    not_for: ["skip b"]',
      '    output: "done b"',
      '    next: []',
      '',
    ].join('\n');
    writeFileSync(manifestPath, broken, 'utf-8');

    assert.throws(() => runChecker(sandboxRoot), /output|failed|error/i);
  });

  it('fails when next points to a missing skill', () => {
    const manifestPath = join(sandboxRoot, 'cat-cafe-skills', 'manifest.yaml');
    const broken = [
      'skills:',
      '  skill-a:',
      '    triggers: ["do a"]',
      '    not_for: ["skip a"]',
      '    output: "done a"',
      '    next: ["skill-z"]',
      '',
    ].join('\n');
    writeFileSync(manifestPath, broken, 'utf-8');

    assert.throws(() => runChecker(sandboxRoot), /next|missing|failed|error/i);
  });

  it('fails when SKILL.md contains hardcoded cat handle', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    writeFileSync(skillPath, '# skill-a\n\n请 @codex review\n', 'utf-8');

    assert.throws(() => runChecker(sandboxRoot), /hardcoded|@codex|failed|error/i);
  });

  it('fails when SKILL.md contains hardcoded cat nickname', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    writeFileSync(skillPath, '# skill-a\n\n砚砚：布局审查 + Export Truth Gate\n', 'utf-8');

    assert.throws(() => runChecker(sandboxRoot), /hardcoded|砚砚|failed|error/i);
  });

  it('allows cat nickname on exempted lines (signatures, attributions)', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    const content = [
      '# skill-a',
      '',
      '> 来源：2026-04-04 砚砚提议',
      '签名表见 refs/commit-signatures.md。示例：宪宪/Opus-46',
      '[宪宪/Opus-46🐾]',
      '',
    ].join('\n');
    writeFileSync(skillPath, content, 'utf-8');

    const output = runChecker(sandboxRoot);
    assert.match(output, /PASS/i);
  });

  it('allows handle inside code fence', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    const content = ['# skill-a', '', '```bash', 'gh pr comment 123 --body "@codex review"', '```', ''].join('\n');
    writeFileSync(skillPath, content, 'utf-8');

    const output = runChecker(sandboxRoot);
    assert.match(output, /PASS/i);
  });

  it('allows handle inside backtick-quoted content', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    const content = ['# skill-a', '', '只发 `@codex review` 一行', ''].join('\n');
    writeFileSync(skillPath, content, 'utf-8');

    const output = runChecker(sandboxRoot);
    assert.match(output, /PASS/i);
  });

  it('allows nickname inside double-quoted content', () => {
    const skillPath = join(sandboxRoot, 'cat-cafe-skills', 'skill-a', 'SKILL.md');
    const content = ['# skill-a', '', '叙述性提及用名字（"砚砚已完成 X"而非"@codex 已完成 X"）', ''].join('\n');
    writeFileSync(skillPath, content, 'utf-8');

    const output = runChecker(sandboxRoot);
    assert.match(output, /PASS/i);
  });

  it('fails when filesystem has SKILL.md that is missing from manifest', () => {
    const extraSkillDir = join(sandboxRoot, 'cat-cafe-skills', 'skill-z');
    mkdirSync(extraSkillDir, { recursive: true });
    writeFileSync(
      join(extraSkillDir, 'SKILL.md'),
      '# skill-z\n\nthis skill is intentionally not registered in manifest\n',
      'utf-8',
    );

    assert.throws(() => runChecker(sandboxRoot), /manifest|skill-z|failed|error/i);
  });

  it('warns when requires_mcp dependency is missing but does not fail manifest validation', () => {
    const manifestPath = join(sandboxRoot, 'cat-cafe-skills', 'manifest.yaml');
    const updated = [
      'skills:',
      '  skill-a:',
      '    triggers: ["do a"]',
      '    not_for: ["skip a"]',
      '    output: "done a"',
      '    next: ["skill-b"]',
      '    requires_mcp: ["pencil"]',
      '  skill-b:',
      '    triggers: ["do b"]',
      '    not_for: ["skip b"]',
      '    output: "done b"',
      '    next: []',
      '',
    ].join('\n');
    writeFileSync(manifestPath, updated, 'utf-8');

    const result = runCheckerDetailed(sandboxRoot);
    assert.equal(result.status, 0, `checker should not fail on missing MCP dependency: ${result.stderr}`);
    assert.match(result.stdout, /WARN/i);
    assert.match(result.stdout, /skill-a/i);
    assert.match(result.stdout, /pencil/i);
  });

  it('stays clean when requires_mcp dependency is ready', () => {
    const fakeBin = join(sandboxRoot, 'fake-pencil-bin');
    writeFileSync(fakeBin, '#!/bin/sh\nexit 0\n', 'utf-8');

    const manifestPath = join(sandboxRoot, 'cat-cafe-skills', 'manifest.yaml');
    const updated = [
      'skills:',
      '  skill-a:',
      '    triggers: ["do a"]',
      '    not_for: ["skip a"]',
      '    output: "done a"',
      '    next: ["skill-b"]',
      '    requires_mcp: ["pencil"]',
      '  skill-b:',
      '    triggers: ["do b"]',
      '    not_for: ["skip b"]',
      '    output: "done b"',
      '    next: []',
      '',
    ].join('\n');
    writeFileSync(manifestPath, updated, 'utf-8');

    mkdirSync(join(sandboxRoot, '.cat-cafe'), { recursive: true });
    writeFileSync(
      join(sandboxRoot, '.cat-cafe', 'capabilities.json'),
      JSON.stringify(
        {
          version: 1,
          capabilities: [
            {
              id: 'pencil',
              type: 'mcp',
              enabled: true,
              source: 'external',
              mcpServer: {
                resolver: 'pencil',
                command: '',
                args: [],
              },
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    );

    const result = runCheckerDetailed(sandboxRoot, { PENCIL_MCP_BIN: fakeBin, PENCIL_MCP_APP: 'vscode' });
    assert.equal(result.status, 0, `checker should pass when MCP dependency is ready: ${result.stderr}`);
    assert.doesNotMatch(result.stdout, /WARN/i);
  });
});
