import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');

function read(relativePath) {
  const path = resolve(root, relativePath);
  assert.equal(existsSync(path), true, `missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function includesAll(text, needles, label) {
  for (const needle of needles) {
    assert.ok(text.includes(needle), `${label} missing ${needle}`);
  }
}

describe('F218 source hygiene shared-layer wiring', () => {
  it('wires spec, skill, research template, lifecycle teaching, and eval fixture', () => {
    const spec = read('docs/features/F218-evidence-provenance-source-hygiene.md');
    includesAll(spec, ['AC-A6', 'AC-A7', 'Zero per-family divergence', '软+硬+eval'], 'F218 spec');

    const skill = read('cat-cafe-skills/source-audit/SKILL.md');
    includesAll(
      skill,
      [
        '一手 or 二手',
        '利益冲突',
        'Peer-reviewed',
        '时效性',
        '体感校验',
        '`use`',
        '`use-with-caveat`',
        '`reject`',
        '`escalate-to-deep-research`',
        'Provenance',
      ],
      'source-audit skill',
    );

    const manifest = read('cat-cafe-skills/manifest.yaml');
    includesAll(manifest, ['source-audit:', 'provenance', 'deep-research'], 'skills manifest');

    const researchTemplate = read('cat-cafe-skills/refs/research-prompt-template.md');
    includesAll(
      researchTemplate,
      ['Primary Source Trace', 'Conflict of Interest', 'Temporal Applicability', 'Object Applicability'],
      'research prompt template',
    );

    const lifecycle = read('cat-cafe-skills/feat-lifecycle/SKILL.md');
    includesAll(lifecycle, ['软+硬+eval', 'ADR-031', 'Soft', 'Hard', 'Eval'], 'feat-lifecycle Eval Contract');

    const domain = read('docs/harness-feedback/eval-domains/eval-capability-wakeup.yaml');
    includesAll(domain, ['source-hygiene-memu-echo-chamber', 'F218'], 'capability wakeup eval domain');

    const fixture = read('docs/harness-feedback/fixtures/source-hygiene-memu-echo-chamber.md');
    includesAll(fixture, ['MemU', '65%', '2%', 'reject', 'source-audit'], 'MemU fixture');
  });
});
