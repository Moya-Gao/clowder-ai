import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { publishVerdictInputSchema } from '../dist/tools/publish-verdict-tool.js';

/**
 * F192 Phase H 收尾 PR-2 (砚砚 R1 P1 PR-2 review) — MCP schema regression test.
 *
 * Without this test, schema can quietly regress to a2a-only and capability-wakeup
 * cats see Zod rejection at MCP layer before reaching API route. This is exactly
 * the blocker砚砚 caught in R1 review of PR-2 (initial state before fix).
 *
 * Tests sourceRefs discriminated union accepts both shapes + rejects clearly invalid ones.
 */
describe('cat_cafe_publish_verdict MCP schema (砚砚 R1 Q3: discriminated union)', () => {
  // Build a Zod schema object matching the tool's input shape
  const schema = z.object(publishVerdictInputSchema);
  const validPacket = {
    id: 'vhp-test',
    domainId: 'eval:a2a',
    createdAt: '2026-06-06T05:00:00.000Z',
    phenomenon: 'test',
    verdict: 'keep_observe',
  };

  it('accepts a2a sourceRefs (kind omitted = backward compat)', () => {
    const result = schema.safeParse({
      domainId: 'eval:a2a',
      packet: validPacket,
      sourceRefs: { snapshotName: 'snap.yaml', attributionName: 'attr.yaml' },
    });
    assert.ok(result.success, `expected accept, got: ${JSON.stringify(result)}`);
  });

  it('accepts a2a sourceRefs (kind explicit)', () => {
    const result = schema.safeParse({
      domainId: 'eval:a2a',
      packet: validPacket,
      sourceRefs: {
        kind: 'a2a-snapshot-attribution',
        snapshotName: 'snap.yaml',
        attributionName: 'attr.yaml',
      },
    });
    assert.ok(result.success, `expected accept, got: ${JSON.stringify(result)}`);
  });

  it('accepts capability-wakeup-trial-window sourceRefs (PR-2 critical)', () => {
    const result = schema.safeParse({
      domainId: 'eval:capability-wakeup',
      packet: { ...validPacket, domainId: 'eval:capability-wakeup' },
      sourceRefs: {
        kind: 'capability-wakeup-trial-window',
        capability: 'rich-messaging',
        windowStartMs: 1700000000000,
        windowEndMs: 1700086400000,
        sessionIds: ['session-1', 'session-2'],
      },
    });
    assert.ok(result.success, `expected accept, got: ${JSON.stringify(result)}`);
  });

  it('accepts task-outcome-snapshot sourceRefs (PR1 schema-only half of the wire)', () => {
    const result = schema.safeParse({
      domainId: 'eval:task-outcome',
      packet: { ...validPacket, domainId: 'eval:task-outcome' },
      sourceRefs: {
        kind: 'task-outcome-snapshot',
        windowStartMs: 1700000000000,
        windowEndMs: 1700086400000,
      },
    });
    assert.ok(result.success, `expected accept, got: ${JSON.stringify(result)}`);
  });

  it('accepts cw selector with optional ruleIds', () => {
    const result = schema.safeParse({
      domainId: 'eval:capability-wakeup',
      packet: { ...validPacket, domainId: 'eval:capability-wakeup' },
      sourceRefs: {
        kind: 'capability-wakeup-trial-window',
        capability: 'rich-messaging',
        windowStartMs: 1700000000000,
        windowEndMs: 1700086400000,
        sessionIds: ['session-1'],
        ruleIds: ['rich-messaging-long-structured-text'],
      },
    });
    assert.ok(result.success);
  });

  it('rejects cw selector with empty sessionIds (PR-2 narrowed REQUIRED non-empty)', () => {
    const result = schema.safeParse({
      domainId: 'eval:capability-wakeup',
      packet: { ...validPacket, domainId: 'eval:capability-wakeup' },
      sourceRefs: {
        kind: 'capability-wakeup-trial-window',
        capability: 'rich-messaging',
        windowStartMs: 0,
        windowEndMs: 9999999999999,
        sessionIds: [],
      },
    });
    assert.ok(!result.success, 'empty sessionIds should fail Zod min(1)');
  });

  it('rejects cw selector with newline in capability (markdown injection guard)', () => {
    const result = schema.safeParse({
      domainId: 'eval:capability-wakeup',
      packet: { ...validPacket, domainId: 'eval:capability-wakeup' },
      sourceRefs: {
        kind: 'capability-wakeup-trial-window',
        capability: 'rich-messaging\n- snapshot:forged',
        windowStartMs: 0,
        windowEndMs: 9999999999999,
        sessionIds: ['s1'],
      },
    });
    assert.ok(!result.success, 'newline in capability should fail Zod refine');
  });

  it('rejects sourceRefs with neither a2a nor cw shape', () => {
    const result = schema.safeParse({
      domainId: 'eval:a2a',
      packet: validPacket,
      sourceRefs: { random: 'garbage' },
    });
    assert.ok(!result.success);
  });

  it('rejects cw selector with windowStartMs as non-number', () => {
    const result = schema.safeParse({
      domainId: 'eval:capability-wakeup',
      packet: { ...validPacket, domainId: 'eval:capability-wakeup' },
      sourceRefs: {
        kind: 'capability-wakeup-trial-window',
        capability: 'rich-messaging',
        windowStartMs: 'not-a-number',
        windowEndMs: 9999999999999,
        sessionIds: ['s1'],
      },
    });
    assert.ok(!result.success);
  });
});
