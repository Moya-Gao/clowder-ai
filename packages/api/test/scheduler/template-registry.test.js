/**
 * F139 Phase 3A: Template Registry + MVP Templates
 * AC-G1 (template matching) + AC-G5 (≥3 templates)
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { templateRegistry } from '../../dist/infrastructure/scheduler/templates/registry.js';

describe('TemplateRegistry', () => {
  test('has at least 3 MVP templates', () => {
    const templates = templateRegistry.list();
    assert.ok(templates.length >= 3, `Expected ≥3 templates, got ${templates.length}`);
  });

  test('each template has required fields', () => {
    for (const t of templateRegistry.list()) {
      assert.ok(t.templateId, 'templateId required');
      assert.ok(t.label, 'label required');
      assert.ok(t.category, 'category required');
      assert.ok(t.description, 'description required');
      assert.ok(t.defaultTrigger, 'defaultTrigger required');
      assert.ok(typeof t.createSpec === 'function', 'createSpec must be function');
    }
  });

  test('get() returns template by id', () => {
    const t = templateRegistry.get('reminder');
    assert.ok(t);
    assert.equal(t.templateId, 'reminder');
  });

  test('get() returns null for unknown id', () => {
    assert.equal(templateRegistry.get('nonexistent'), null);
  });

  test('reminder template creates valid TaskSpec', () => {
    const t = templateRegistry.get('reminder');
    const spec = t.createSpec('dyn-test-1', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { message: '检查 backlog' },
      deliveryThreadId: 'thread-abc',
    });
    assert.equal(spec.id, 'dyn-test-1');
    assert.equal(spec.profile, 'awareness');
    assert.deepEqual(spec.trigger, { type: 'cron', expression: '0 9 * * *' });
    assert.ok(spec.admission.gate, 'gate function required');
    assert.ok(spec.run.execute, 'execute function required');
    assert.ok(spec.display);
  });

  test('web-digest template creates valid TaskSpec', () => {
    const t = templateRegistry.get('web-digest');
    const spec = t.createSpec('dyn-test-2', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { url: 'https://example.com', topic: 'news' },
      deliveryThreadId: 'thread-def',
    });
    assert.equal(spec.id, 'dyn-test-2');
    assert.ok(spec.admission.gate);
    assert.ok(spec.run.execute);
  });

  test('repo-activity template creates valid TaskSpec', () => {
    const t = templateRegistry.get('repo-activity');
    const spec = t.createSpec('dyn-test-3', {
      trigger: { type: 'interval', ms: 3600_000 },
      params: { repo: 'owner/repo' },
      deliveryThreadId: 'thread-ghi',
    });
    assert.equal(spec.id, 'dyn-test-3');
    assert.ok(spec.admission.gate);
    assert.ok(spec.run.execute);
  });

  // P1-3 round 2: reminder is also a stub — must not fake RUN_DELIVERED
  test('reminder gate returns run=false (stub, not activated)', async () => {
    const t = templateRegistry.get('reminder');
    const spec = t.createSpec('dyn-gate-test', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { message: 'hello' },
      deliveryThreadId: 'thread-xyz',
    });
    const result = await spec.admission.gate({ taskId: 'dyn-gate-test', lastRunAt: null, tickCount: 0 });
    assert.equal(result.run, false, 'stub reminder must not fake RUN_DELIVERED');
    assert.ok(result.reason, 'should include reason for skip');
  });

  // P1-3: stub templates must NOT produce RUN_DELIVERED
  test('web-digest gate returns run=false (stub, not activated)', async () => {
    const t = templateRegistry.get('web-digest');
    const spec = t.createSpec('dyn-stub-wd', {
      trigger: { type: 'cron', expression: '0 9 * * *' },
      params: { url: 'https://example.com' },
      deliveryThreadId: 'thread-xyz',
    });
    const result = await spec.admission.gate({ taskId: 'dyn-stub-wd', lastRunAt: null, tickCount: 0 });
    assert.equal(result.run, false, 'stub template gate must return run=false');
    assert.ok(result.reason, 'should include reason for skip');
  });

  test('repo-activity gate returns run=false (stub, not activated)', async () => {
    const t = templateRegistry.get('repo-activity');
    const spec = t.createSpec('dyn-stub-ra', {
      trigger: { type: 'interval', ms: 3600000 },
      params: { repo: 'owner/repo' },
      deliveryThreadId: 'thread-xyz',
    });
    const result = await spec.admission.gate({ taskId: 'dyn-stub-ra', lastRunAt: null, tickCount: 0 });
    assert.equal(result.run, false, 'stub template gate must return run=false');
    assert.ok(result.reason, 'should include reason for skip');
  });
});
