import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { handlePublishVerdict } from '../../dist/infrastructure/harness-eval/publish-verdict/publish-verdict.js';
import { setupHarnessFeedback } from './eval-manual-trigger-fixtures.js';
import { buildPacket } from './publish-verdict-fixtures.js';

/**
 * F192 Phase H — Verdict Publishing Pipeline (砚砚 R0 Path B narrowed).
 * AC-H1: packet schema validation.
 * AC-H2: branch + commit + push + auto-PR pipeline (exec + generator injected).
 * AC-H7 partial: domain↔packet cross-check + eval:a2a-only v1.
 */
describe('handlePublishVerdict', () => {
  /** @type {string} fixture harness-feedback root with 5 domains registered */
  let root;

  before(() => {
    root = setupHarnessFeedback();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // AC-H1: packet validation
  describe('AC-H1 — packet validation', () => {
    it('returns 400 invalid_packet when packet missing required fields', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: '/tmp/phase-h-test' },
        { packet: { id: 'incomplete' }, domain: 'eval:a2a', catId: 'codex' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.equal(result.error, 'invalid_packet');
    });

    it('returns 400 invalid_packet for non-object inputs', async () => {
      for (const bad of [null, 'str', 42, []]) {
        const result = await handlePublishVerdict(
          { harnessFeedbackRoot: '/tmp/phase-h-test' },
          { packet: bad, domain: 'eval:a2a', catId: 'codex' },
        );
        assert.ok('error' in result, `${JSON.stringify(bad)} should reject`);
        assert.equal(result.status, 400);
      }
    });

    it('returns 400 when delete_sunset lacks CVO accept gate', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: '/tmp/phase-h-test' },
        { packet: buildPacket({ verdict: 'delete_sunset' }), domain: 'eval:a2a', catId: 'codex' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.match(result.detail, /CVO|cvoAcceptRequired/i);
    });
  });

  // AC-H7 partial: domain cross-check + v1 generator allowlist
  describe('AC-H7 — domain validation', () => {
    it('returns 400 domain_mismatch when input.domain ≠ packet.domainId', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: '/tmp/phase-h-test' },
        { packet: buildPacket({ domainId: 'eval:a2a' }), domain: 'eval:memory', catId: 'codex' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.equal(result.error, 'domain_mismatch');
    });

    it('returns 501 unsupported_generator for non-a2a domains in v1', async () => {
      for (const domain of ['eval:memory', 'eval:sop', 'eval:capability-wakeup', 'eval:task-outcome']) {
        const result = await handlePublishVerdict(
          { harnessFeedbackRoot: '/tmp/phase-h-test' },
          { packet: buildPacket({ domainId: domain }), domain, catId: 'codex' },
        );
        assert.ok('error' in result, `${domain} should be unsupported`);
        assert.equal(result.status, 501, `${domain} → 501`);
        assert.equal(result.error, 'unsupported_generator');
      }
    });
  });

  // AC-H3: callback auth + domain allowlist
  describe('AC-H3 — auth + domain allowlist', () => {
    it('returns 401 unauthenticated when catId not provided', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        { packet: buildPacket({ domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: '' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 401);
      assert.equal(result.error, 'unauthenticated');
    });

    it('returns 403 not_allowed when catId is not the registered eval cat for this domain', async () => {
      // eval:a2a registered cat is 'codex'; 'opus-47' is eval:memory's cat
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        { packet: buildPacket({ domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'opus-47' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 403);
      assert.equal(result.error, 'not_allowed');
      assert.match(result.detail, /opus-47/);
      assert.match(result.detail, /codex/);
    });

    it('passes auth when catId matches the registered eval cat for this domain', async () => {
      // Reach H3 with valid catId + sourceRefs; fails later at AC-H2 generator (not injected) = 500
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        {
          packet: buildPacket({ domainId: 'eval:a2a' }),
          domain: 'eval:a2a',
          catId: 'codex',
          sourceRefs: { snapshotName: 'snap.yaml', attributionName: 'attr.yaml' },
        },
      );
      assert.ok('error' in result, 'should fail at later AC, not at auth');
      assert.equal(result.status, 500); // generator_failed because no mock generator injected
      assert.equal(result.error, 'generator_failed');
    });

    // 砚砚 R6 P1 + cloud R6 P1: respect OQ-20 Redis evalCat override (symmetric
    // with handleTriggerNow — overridden cat receives invocation AND can publish).
    it('allows override cat to publish when OQ-20 Redis override is set (砚砚 R6 P1)', async () => {
      // Mock Redis returning override → 'opus-47' for eval:a2a (static is 'codex')
      const mockRedis = {
        get: async (key) => {
          if (key === 'eval-domain:eval:a2a:evalCat-override') {
            return JSON.stringify({ catId: 'opus-47', handle: '@opus47', model: 'opus-4.7' });
          }
          return null;
        },
      };
      // Override cat 'opus-47' should now PASS auth (would have been 403 before fix)
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root, redis: mockRedis },
        {
          packet: buildPacket({ domainId: 'eval:a2a' }),
          domain: 'eval:a2a',
          catId: 'opus-47',
          sourceRefs: { snapshotName: 'snap.yaml', attributionName: 'attr.yaml' },
        },
      );
      assert.ok('error' in result, 'should fail at later AC (generator), not at auth');
      assert.notEqual(result.error, 'not_allowed', 'override cat must NOT be rejected by auth');
      assert.equal(result.status, 500); // generator_failed
      assert.equal(result.error, 'generator_failed');
    });

    it('rejects static cat with 403 when override is set to different cat (砚砚 R6 P1)', async () => {
      const mockRedis = {
        get: async (key) => {
          if (key === 'eval-domain:eval:a2a:evalCat-override') {
            return JSON.stringify({ catId: 'opus-47', handle: '@opus47', model: 'opus-4.7' });
          }
          return null;
        },
      };
      // Static 'codex' should now FAIL because override redirected to 'opus-47'
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root, redis: mockRedis },
        {
          packet: buildPacket({ domainId: 'eval:a2a' }),
          domain: 'eval:a2a',
          catId: 'codex',
          sourceRefs: { snapshotName: 'snap.yaml', attributionName: 'attr.yaml' },
        },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 403);
      assert.equal(result.error, 'not_allowed');
      assert.match(result.detail, /opus-47.*override|override.*opus-47/);
    });

    it('falls back to static cat when Redis read fails (degradation)', async () => {
      const flakyRedis = {
        get: async () => {
          throw new Error('redis connection lost');
        },
      };
      // Static 'codex' should PASS auth (Redis failed silently, fallback OK)
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root, redis: flakyRedis },
        {
          packet: buildPacket({ domainId: 'eval:a2a' }),
          domain: 'eval:a2a',
          catId: 'codex',
          sourceRefs: { snapshotName: 'snap.yaml', attributionName: 'attr.yaml' },
        },
      );
      assert.ok('error' in result);
      assert.notEqual(result.error, 'not_allowed', 'static cat must still pass when Redis errors');
      assert.equal(result.error, 'generator_failed');
    });

    // 砚砚 R1 P1 #2: eval:a2a requires sourceRefs, tool NEVER 造 evidence
    it('returns 400 missing_evidence_refs when eval:a2a publish lacks sourceRefs', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        {
          packet: buildPacket({ domainId: 'eval:a2a' }),
          domain: 'eval:a2a',
          catId: 'codex',
          sourceRefs: {}, // empty - cat forgot to provide evidence sources
        },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.equal(result.error, 'missing_evidence_refs');
      assert.match(result.detail, /snapshotName|attributionName|fabricate/i);
    });

    // 砚砚 R3 P2 cloud: type-check sourceRefs.* before basename() — non-string
    // truthy values (number, object, array) must return 400 controlled error,
    // not crash basename() with TypeError → 500
    it('returns 400 invalid_source_ref for non-string truthy sourceRefs.* (number/object/array)', async () => {
      for (const bad of [42, true, { name: 'x' }, ['x']]) {
        for (const field of ['snapshotName', 'attributionName']) {
          const sourceRefs = { snapshotName: 'ok.yaml', attributionName: 'ok.yaml' };
          sourceRefs[field] = bad;
          const result = await handlePublishVerdict(
            { harnessFeedbackRoot: root },
            { packet: buildPacket({ domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'codex', sourceRefs },
          );
          assert.ok('error' in result, `${field}=${JSON.stringify(bad)} should reject`);
          assert.equal(result.status, 400, `must be 400 not 500`);
          assert.equal(result.error, 'invalid_source_ref');
          assert.match(result.detail, /must be strings/);
        }
      }
    });

    // 砚砚 R2 P2 cloud: sourceRefs must be basenames; path-traversal rejected with allowlist
    it('returns 400 invalid_source_ref for path-traversal in snapshotName/attributionName', async () => {
      for (const bad of ['../etc/passwd', '/etc/passwd', 'subdir/foo', '..', '.', '']) {
        for (const field of ['snapshotName', 'attributionName']) {
          const sourceRefs = { snapshotName: 'ok.yaml', attributionName: 'ok.yaml' };
          sourceRefs[field] = bad;
          const result = await handlePublishVerdict(
            { harnessFeedbackRoot: root },
            { packet: buildPacket({ domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'codex', sourceRefs },
          );
          assert.ok('error' in result, `${field}='${bad}' should reject`);
          // empty string '' is caught by missing_evidence_refs (presence check) — both are 400
          assert.equal(result.status, 400, `${field}='${bad}' must be 400`);
          if (bad !== '') {
            assert.equal(result.error, 'invalid_source_ref', `${field}='${bad}' → invalid_source_ref`);
            assert.match(result.detail, new RegExp(field), `error must call out ${field}`);
          }
        }
      }
    });
  });

  // AC-H8: idempotency + length + slug (复用 generate-now 模式)
  describe('AC-H8 — packet.id validation + idempotency', () => {
    it('returns 400 invalid_packet_id when id exceeds 128 chars', async () => {
      const big = 'a'.repeat(129);
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        { packet: buildPacket({ id: big, domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'codex' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.equal(result.error, 'invalid_packet_id');
      assert.match(result.detail, /128/);
    });

    it('returns 400 invalid_packet_id for slug violations (uppercase, underscore, etc.)', async () => {
      for (const bad of ['Test-Foo', 'test_foo', '-leading', 'foo.bar', 'foo bar', 'foo/bar']) {
        const result = await handlePublishVerdict(
          { harnessFeedbackRoot: root },
          { packet: buildPacket({ id: bad, domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'codex' },
        );
        assert.ok('error' in result, `'${bad}' should be rejected`);
        assert.equal(result.status, 400, `'${bad}' → 400`);
        assert.equal(result.error, 'invalid_packet_id');
      }
    });

    it('returns 400 invalid_packet when phenomenon exceeds 2048 chars', async () => {
      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        {
          packet: buildPacket({ id: 'ok-id', domainId: 'eval:a2a', phenomenon: 'x'.repeat(2049) }),
          domain: 'eval:a2a',
          catId: 'codex',
        },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 400);
      assert.match(result.detail, /phenomenon.*2048/);
    });

    it('returns 409 verdict_already_exists when verdict file already exists for this id', async () => {
      const { mkdirSync, writeFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const dupId = 'dup-verdict-test';
      mkdirSync(resolve(root, 'verdicts'), { recursive: true });
      writeFileSync(resolve(root, 'verdicts', `${dupId}.md`), '# Existing verdict\n');

      const result = await handlePublishVerdict(
        { harnessFeedbackRoot: root },
        { packet: buildPacket({ id: dupId, domainId: 'eval:a2a' }), domain: 'eval:a2a', catId: 'codex' },
      );
      assert.ok('error' in result);
      assert.equal(result.status, 409);
      assert.equal(result.error, 'verdict_already_exists');
      assert.match(result.detail, /data integrity|forbidden/i);
    });
  });

  // AC-H2 + 砚砚 R1 P1 #1: pipeline mechanics via GitPublisher abstraction
});
