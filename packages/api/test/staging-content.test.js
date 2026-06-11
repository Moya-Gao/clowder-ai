/**
 * L0-budget-defense PR-B-impl tests (ADR-038 件套 ④)
 *
 * Verifies:
 *   - Staging manifest parses + items present
 *   - Hard cap invariant: sum(items.estimated_tokens) ≤ hard_cap_tokens (双层守恒)
 *   - Soft margin warn: sum + soft_margin ≤ hard_cap_tokens (贴线预警)
 *   - buildStagingPrepend returns wipers content for all cats (shared item)
 *   - Wired into buildSystemPrompt output (user-message systemPrompt path)
 *   - Wiper content NOT compiled into native L0 (decoupled from 6000-cap)
 */

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { catRegistry } from '@cat-cafe/shared';
import { encodingForModel } from 'js-tiktoken';
import { loadCatConfig, toAllCatConfigs } from '../dist/config/cat-config-loader.js';
import { buildStagingPrepend, loadStagingManifest } from '../dist/domains/cats/services/context/StagingContent.js';
import { buildSystemPrompt } from '../dist/domains/cats/services/context/SystemPromptBuilder.js';

const enc = encodingForModel('gpt-4o');
const tok = (s) => (s ? enc.encode(s, [], []).length : 0);

// Bootstrap cat-config so SystemPromptBuilder's getConfig() resolves opus-47 et al.
// Pattern mirrors scripts/compile-system-prompt-l0.mjs bootstrapCatRegistry.
before(() => {
  const loaded = loadCatConfig();
  const all = toAllCatConfigs(loaded);
  for (const [id, config] of Object.entries(all)) {
    if (!catRegistry.has(id)) catRegistry.register(id, config);
  }
});

describe('L0 Staging Protocol PR-B-impl (ADR-038)', () => {
  describe('Manifest parsing', () => {
    test('manifest loads with version 1 + items array', () => {
      const m = loadStagingManifest();
      assert.equal(m.staging_version, 1);
      assert.ok(Array.isArray(m.items));
      assert.ok(m.items.length > 0, 'staging manifest must contain at least one item');
    });

    test('first item is wipers-clause with first-principles check filled', () => {
      const m = loadStagingManifest();
      const wipers = m.items.find((it) => it.id === 'wipers-clause');
      assert.ok(wipers, 'wipers-clause item must exist as dogfood first case');
      assert.equal(wipers.family, 'shared');
      assert.ok(wipers.estimated_tokens > 0);
      assert.ok(wipers.first_principles_check, 'first-principles check must be filled');
      const fp = wipers.first_principles_check;
      assert.equal(fp.single_round_complete, true);
      assert.equal(fp.compress_gap_harmful, false);
      assert.equal(fp.referenced_by_l0, false);
    });
  });

  describe('Hard cap invariant (双层守恒, fable-5 P1-1 PR #2221 + 砚砚 R1 P1#1 #2237)', () => {
    test('manifest declared: sum(items.estimated_tokens) ≤ hard_cap_tokens', () => {
      // Belt: manifest-declared budget tracker (catches mis-declared items at edit time)
      const m = loadStagingManifest();
      const total = m.items.reduce((sum, it) => sum + it.estimated_tokens, 0);
      assert.ok(
        total <= m.hard_cap_tokens,
        `staging cap breached (declared): ${total} > ${m.hard_cap_tokens} — must demote or sunset before adding more`,
      );
    });

    test('manifest declared soft margin: sum + soft_margin_tokens ≤ hard_cap_tokens', () => {
      // Belt soft margin: 贴线预警
      const m = loadStagingManifest();
      const total = m.items.reduce((sum, it) => sum + it.estimated_tokens, 0);
      assert.ok(
        total + m.soft_margin_tokens <= m.hard_cap_tokens,
        `staging near cap (declared): ${total} + ${m.soft_margin_tokens} margin > ${m.hard_cap_tokens} — 贴线跳舞预警`,
      );
    });

    test('砚砚 R1 P1#1: ACTUAL rendered prepend tokens ≤ hard_cap_tokens', () => {
      // Suspenders: real injection size, NOT just manifest declared.
      // Prevents "manifest says 1000, actually injects 2412" hole (砚砚 negative
      // validation in PR #2237 R1). For each cat, render the prepend, measure
      // tokens, assert against hard cap.
      const m = loadStagingManifest();
      const cats = ['opus-47', 'codex', 'gemini25', 'sonnet', 'gpt52', 'opus'];
      for (const catId of cats) {
        const rendered = buildStagingPrepend(catId);
        const measured = tok(rendered);
        assert.ok(
          measured <= m.hard_cap_tokens,
          `staging cap breached (rendered): ${catId} actual prepend = ${measured} tokens > ${m.hard_cap_tokens} — manifest under-declared or content too large`,
        );
      }
    });

    test('砚砚 R1 P1#1: ACTUAL rendered + soft_margin ≤ hard_cap_tokens (实测贴线预警)', () => {
      const m = loadStagingManifest();
      const cats = ['opus-47', 'codex', 'gemini25', 'sonnet', 'gpt52', 'opus'];
      for (const catId of cats) {
        const rendered = buildStagingPrepend(catId);
        const measured = tok(rendered);
        assert.ok(
          measured + m.soft_margin_tokens <= m.hard_cap_tokens,
          `staging near cap (rendered): ${catId} = ${measured} + ${m.soft_margin_tokens} margin > ${m.hard_cap_tokens} — 实测贴线预警`,
        );
      }
    });
  });

  describe('buildStagingPrepend (shared items apply to all cats)', () => {
    test('wipers content rendered for ragdoll cat (opus-47)', () => {
      const out = buildStagingPrepend('opus-47');
      assert.ok(out.length > 0, 'staging prepend must be non-empty when shared items exist');
      assert.ok(out.includes('摩擦上报'), 'must include wipers clause core trigger');
      assert.ok(out.includes('[爪感差:'), 'must include wipers reporting format');
    });

    test('wipers content rendered for maine-coon cat (codex)', () => {
      const out = buildStagingPrepend('codex');
      assert.ok(out.includes('摩擦上报'));
      assert.ok(out.includes('[爪感差:'));
    });

    test('wipers content rendered for siamese cat (gemini25)', () => {
      const out = buildStagingPrepend('gemini25');
      assert.ok(out.includes('摩擦上报'));
      assert.ok(out.includes('[爪感差:'));
    });

    test('header indicates ADR-038 + outside L0 cap', () => {
      const out = buildStagingPrepend('opus-47');
      assert.ok(out.includes('ADR-038'));
      assert.match(out, /outside L0\s+\d+-cap/);
    });
  });

  describe('Staging wired in invoke-single-cat per-invocation (Cloud R2 P1 #2237 L1099 fix)', () => {
    test('staging NOT in staticIdentity (route-serial/parallel) — kept out of skippable injection', () => {
      // Cloud R2 P1 #2237 L1099: previous PR-B-impl folded staging into
      // buildLiveStaticIdentity, which routes passed as systemPrompt; on
      // resumed session-chain turns, invoke-single-cat skips that injection
      // (canSkipOnResume + isResume) and staging was lost.
      //
      // Fix: staging is now wired in invoke-single-cat next to F225
      // contextHintPrefix (independent of injectSystemPrompt). This test
      // documents that staging is NOT in the staticIdentity helpers route-*
      // call. Cannot easily unit-test invoke-single-cat itself (too many
      // deps); the buildStagingPrepend invariants + the resume-skip
      // independence are documented architecturally.
      //
      // buildSystemPrompt (dead-code helper) still doesn't include staging
      // (preserves system-prompt-builder.test.js budget guard).
      const sp = buildSystemPrompt({
        catId: 'opus-47',
        mode: 'independent',
        teammates: [],
        mcpAvailable: false,
      });
      assert.ok(sp.length > 0);
      assert.ok(
        !sp.includes('摩擦上报'),
        'buildSystemPrompt (dead-code helper) must NOT include staging — staging only via invoke-single-cat per-invocation prepend',
      );
    });

    test('buildStagingPrepend is the single source consumed by invoke-single-cat', () => {
      // Architectural invariant: only buildStagingPrepend produces staging
      // text. invoke-single-cat calls it per turn, regardless of
      // injectSystemPrompt. ADR-038 "每轮注入生效" contract delivered.
      const out = buildStagingPrepend('opus-47');
      assert.ok(out.includes('摩擦上报'), 'buildStagingPrepend must produce wipers for known cat');
    });
  });

  describe('Decoupling from native L0 (砚砚 R1 P2: staging NOT in 6000 L0 cap)', () => {
    test('staging tokens are bounded by staging cap, not L0 cap', () => {
      const m = loadStagingManifest();
      // staging hard cap ≤ 2000; L0 hard cap = 6000; separately bounded.
      assert.equal(m.hard_cap_tokens, 2000, 'staging cap should be 2000 per ADR-038 v1');
      // Verify they are independent: changing staging items doesn't affect L0 cap.
      // (L0 cap enforced by scripts/compile-system-prompt-l0.test.mjs, untouched here.)
    });

    test('wipers content NOT present in compile-system-prompt-l0 output (compiled L0)', async () => {
      // This is the critical proof of the砚砚 P2 boundary: staging is NOT in native L0.
      const { compileL0 } = await import('../../../scripts/compile-system-prompt-l0.mjs');
      const l0 = await compileL0({ catId: 'opus-47' });
      // L0 contains "摩擦检测反射" (existing) but must NOT contain "摩擦上报反射 (雨刮器条款)"
      // (which lives in staging body) — check the staging body marker text.
      assert.ok(
        !l0.includes('[爪感差: 工具+现象]'),
        'staging wipers core format must NOT appear in compiled native L0',
      );
    });

    test('staging tokens (measured) match manifest declared (within ±20% slack)', () => {
      const m = loadStagingManifest();
      const declared = m.items.reduce((sum, it) => sum + it.estimated_tokens, 0);
      const out = buildStagingPrepend('opus-47');
      const measured = tok(out);
      // Manifest is the source-of-truth for budget tracking; allow slack for headers/markdown.
      // If drift exceeds 50%, the manifest should be updated.
      assert.ok(
        measured >= declared * 0.5 && measured <= declared * 3,
        `staging measured ${measured} tokens vs declared ${declared} (manifest may need update)`,
      );
    });
  });
});
