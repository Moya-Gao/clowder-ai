import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildEvalCatInvocation } from '../../dist/infrastructure/harness-eval/eval-cat-invocation.js';

/**
 * F192 Phase H AC-H4: eval cat DOMAIN_INSTRUCTIONS upgraded to point cats to
 * `cat_cafe_publish_verdict` MCP tool (replaces abandoned PR #2091 'git push'
 * 教学 which violated §5 rule #2). Tests assert all 5 domain instructions
 * carry the publish-verdict directive + 9-field packet schema reference + NOT
 * contain abandoned git-push anti-pattern.
 */
const TEST_DOMAIN_BASE = {
  displayName: 'Test Domain',
  systemThreadId: 'thread_test',
  evalCat: { catId: 'codex', handle: '@codex', model: 'gpt-5.5' },
  frequency: /** @type {const} */ ('daily'),
  threadPolicy: {
    role: /** @type {const} */ ('working-home'),
    stateSot: /** @type {const} */ ('registry'),
    allowedContent: /** @type {const} */ (['longitudinal-analysis', 'verdict-discussion', 'handoff-drafts']),
  },
  legacyScheduledTaskIds: [],
  handoffTargetResolver: {
    featureId: 'F167',
    ownerCatId: 'opus-47',
    threadLookup: /** @type {const} */ ('feature-thread'),
  },
  sla: { acknowledgeHours: 24, reevalWithinHours: 72 },
  fixtures: [],
};

const SOURCE_ADAPTER_FOR = {
  'eval:a2a': 'f167-runtime-eval',
  'eval:memory': 'f200-f188-memory-eval',
  'eval:sop': 'sop-trace-eval',
  'eval:capability-wakeup': 'capability-wakeup-eval',
  'eval:task-outcome': 'task-outcome-eval',
};

describe('Phase H AC-H4: eval cat instructions point to publish_verdict MCP tool', () => {
  // 砚砚 R2 P1 cloud: eval:a2a only has wired generator in v1 — instructions
  // for other domains do NOT mention MCP tool (would cause cat → 501 loop).
  it('eval:a2a instruction references cat_cafe_publish_verdict MCP tool', () => {
    const packet = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    assert.match(packet.instructions, /cat_cafe_publish_verdict/);
    assert.match(packet.instructions, /VerdictHandoffPacket/);
  });

  it('eval:a2a instruction lists all 11 always-required packet fields (砚砚 R1 P2 #1)', () => {
    // 11 always-required + 1 conditional (governance for delete_sunset) = 12 total
    const requiredFields = [
      'id',
      'domainId',
      'createdAt',
      'phenomenon',
      'harnessUnderEval',
      'evidencePacket',
      'dailyTrend',
      'rootCauseHypothesis',
      'verdict',
      'ownerAsk',
      'acceptanceReevalPlan',
      'counterarguments',
    ];
    const packet = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    for (const field of requiredFields) {
      assert.match(packet.instructions, new RegExp(`\\*\\*${field}\\*\\*`), `must list ${field} as required`);
    }
  });

  it('eval:a2a instruction explicitly forbids abandoned git-push anti-pattern (§5 rule #2)', () => {
    const packet = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    assert.match(packet.instructions, /DO NOT.*git push/i, 'must forbid git push');
    assert.match(packet.instructions, /Use the MCP tool/, 'must redirect to MCP tool');
  });

  it('instructions mention branch + commit + PR shape (so cat understands tool side-effects)', () => {
    const packet = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    assert.match(packet.instructions, /verdict\/auto\/\{domainSlug\}\/\{verdictId\}/, 'branch name pattern');
    assert.match(packet.instructions, /commit SHA \+ PR URL/, 'response shape');
  });

  it('instructions reference sourceRefs (砚砚 R1 P1 #2 + R2 P2: tool NEVER 造 evidence + basenames only)', () => {
    const packet = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    assert.match(packet.instructions, /sourceRefs/, 'instructions must mention sourceRefs');
    assert.match(packet.instructions, /snapshotName/, 'instructions must list snapshotName (basename, not path)');
    assert.match(packet.instructions, /attributionName/, 'instructions must list attributionName (basename, not path)');
    assert.match(packet.instructions, /BASENAMES|basenames/i, 'must emphasize basename-only');
    assert.match(packet.instructions, /NOT fabricate|will not fabricate|tool will NOT/i, 'forbid fabrication');
  });

  // 砚砚 R2 P1 cloud: only eval:a2a (wired generator) gets publish instructions
  // Other domains keep base instructions until their generators land.
  it('only eval:a2a instructions append publish-verdict directive (砚砚 R2 P1 cloud)', () => {
    const a2a = buildEvalCatInvocation({
      domain: { ...TEST_DOMAIN_BASE, domainId: 'eval:a2a', sourceAdapter: 'f167-runtime-eval' },
      trendRefs: [],
      verdictRefs: [],
      legacyCleanup: { status: 'not_checked' },
    });
    assert.match(a2a.instructions, /cat_cafe_publish_verdict/, 'eval:a2a must have publish path');

    for (const domainId of ['eval:memory', 'eval:sop', 'eval:capability-wakeup', 'eval:task-outcome']) {
      const packet = buildEvalCatInvocation({
        domain: { ...TEST_DOMAIN_BASE, domainId, sourceAdapter: SOURCE_ADAPTER_FOR[domainId] },
        trendRefs: [],
        verdictRefs: [],
        legacyCleanup: { status: 'not_checked' },
      });
      assert.doesNotMatch(
        packet.instructions,
        /cat_cafe_publish_verdict/,
        `${domainId} must NOT have publish path (handler would 501; cat would loop)`,
      );
    }
  });
});
