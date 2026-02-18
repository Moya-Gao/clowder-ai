import './helpers/setup-cat-registry.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { loadCatConfig, getDefaultVariant, toFlatConfigs, findBreedByMention, isSessionChainEnabled, _resetCachedConfig } =
  await import('../dist/config/cat-config-loader.js');

/** Create a temp JSON file with given content, return path */
function writeTempConfig(data) {
  const dir = mkdtempSync(join(tmpdir(), 'cat-config-'));
  const path = join(dir, 'cat-config.json');
  writeFileSync(path, JSON.stringify(data));
  return path;
}

/** Minimal valid config for testing */
function validConfig() {
  return {
    version: 1,
    breeds: [
      {
        id: 'ragdoll',
        catId: 'opus',
        name: '布偶猫',
        displayName: '布偶猫',
        avatar: '/avatars/opus.png',
        color: { primary: '#9B7EBD', secondary: '#E8DFF5' },
        mentionPatterns: ['@opus', '@布偶猫'],
        roleDescription: '主架构师',
        defaultVariantId: 'opus-default',
        variants: [
          {
            id: 'opus-default',
            provider: 'anthropic',
            defaultModel: 'claude-sonnet-4-5-20250929',
            mcpSupport: true,
            cli: { command: 'claude', outputFormat: 'stream-json' },
            personality: '温柔',
          },
        ],
      },
    ],
  };
}

describe('cat-config-loader', () => {
  describe('loadCatConfig', () => {
    it('loads valid JSON successfully', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      assert.equal(config.version, 1);
      assert.equal(config.breeds.length, 1);
      assert.equal(config.breeds[0].id, 'ragdoll');
    });

    it('loads default project cat-config.json when no path/env provided', () => {
      const saved = process.env.CAT_CONFIG_PATH;
      delete process.env.CAT_CONFIG_PATH;
      try {
        const config = loadCatConfig();
        assert.equal(config.version, 1);
        assert.ok(config.breeds.length >= 1);
      } finally {
        if (saved === undefined) {
          delete process.env.CAT_CONFIG_PATH;
        } else {
          process.env.CAT_CONFIG_PATH = saved;
        }
      }
    });

    it('rejects invalid JSON (missing required field)', () => {
      const bad = validConfig();
      delete bad.breeds[0].roleDescription;
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /Invalid cat config/);
    });

    it('rejects wrong version', () => {
      const bad = { ...validConfig(), version: 2 };
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /Invalid cat config/);
    });

    it('throws clear error when file not found', () => {
      assert.throws(
        () => loadCatConfig('/nonexistent/cat-config.json'),
        /Failed to read cat config/,
      );
    });

    it('rejects empty variants array', () => {
      const bad = validConfig();
      bad.breeds[0].variants = [];
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /Invalid cat config/);
    });

    it('rejects invalid defaultVariantId reference', () => {
      const bad = validConfig();
      bad.breeds[0].defaultVariantId = 'nonexistent-variant';
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /defaultVariantId.*not found/);
    });

    it('rejects invalid provider', () => {
      const bad = validConfig();
      bad.breeds[0].variants[0].provider = 'invalid-provider';
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /Invalid cat config/);
    });

    it('accepts arbitrary catId (F32-a: any non-empty string is valid)', () => {
      // F32-a: catId is no longer restricted to opus/codex/gemini
      const custom = validConfig();
      custom.breeds[0].catId = 'foobar';
      const path = writeTempConfig(custom);
      const config = loadCatConfig(path);
      assert.equal(config.breeds[0].catId, 'foobar');
    });
  });

  describe('getDefaultVariant', () => {
    it('returns the default variant', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      const variant = getDefaultVariant(config.breeds[0]);
      assert.equal(variant.id, 'opus-default');
      assert.equal(variant.provider, 'anthropic');
    });
  });

  describe('toFlatConfigs', () => {
    it('produces Record matching CatConfig shape', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      const flat = toFlatConfigs(config);

      assert.ok(flat['opus']);
      assert.equal(flat['opus'].displayName, '布偶猫');
      assert.equal(flat['opus'].provider, 'anthropic');
      assert.equal(flat['opus'].mcpSupport, true);
      assert.deepEqual(flat['opus'].mentionPatterns, ['@opus', '@布偶猫']);
      assert.equal(flat['opus'].personality, '温柔');
    });

    it('handles multiple breeds', () => {
      const cfg = validConfig();
      cfg.breeds.push({
        id: 'maine-coon',
        catId: 'codex',
        name: '缅因猫',
        displayName: '缅因猫',
        avatar: '/avatars/codex.png',
        color: { primary: '#5B8C5A', secondary: '#D4E6D3' },
        mentionPatterns: ['@codex', '@缅因猫'],
        roleDescription: '代码审查专家',
        defaultVariantId: 'codex-default',
        variants: [
          {
            id: 'codex-default',
            provider: 'openai',
            defaultModel: 'codex',
            mcpSupport: false,
            cli: { command: 'codex', outputFormat: 'json' },
            personality: '严谨认真',
          },
        ],
      });
      const path = writeTempConfig(cfg);
      const config = loadCatConfig(path);
      const flat = toFlatConfigs(config);

      assert.ok(flat['opus']);
      assert.ok(flat['codex']);
      assert.equal(flat['codex'].provider, 'openai');
    });
  });

  describe('findBreedByMention', () => {
    it('finds breed by mention pattern', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      const result = findBreedByMention(config, '你好 @布偶猫 帮我看看');
      assert.ok(result);
      assert.equal(result.breed.id, 'ragdoll');
    });

    it('is case-insensitive', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      const result = findBreedByMention(config, 'Hello @OPUS');
      assert.ok(result);
      assert.equal(result.breed.id, 'ragdoll');
    });

    it('returns undefined when no match', () => {
      const path = writeTempConfig(validConfig());
      const config = loadCatConfig(path);
      const result = findBreedByMention(config, '你好世界');
      assert.equal(result, undefined);
    });
  });

  describe('isSessionChainEnabled', () => {
    it('returns true by default (no features field)', () => {
      const config = loadCatConfig(writeTempConfig(validConfig()));
      assert.equal(isSessionChainEnabled('opus', config), true);
    });

    it('returns true when features.sessionChain is true', () => {
      const cfg = validConfig();
      cfg.breeds[0].features = { sessionChain: true };
      const config = loadCatConfig(writeTempConfig(cfg));
      assert.equal(isSessionChainEnabled('opus', config), true);
    });

    it('returns false when features.sessionChain is explicitly false', () => {
      const cfg = validConfig();
      cfg.breeds[0].features = { sessionChain: false };
      const config = loadCatConfig(writeTempConfig(cfg));
      assert.equal(isSessionChainEnabled('opus', config), false);
    });

    it('returns true for unknown catId (not in config)', () => {
      const config = loadCatConfig(writeTempConfig(validConfig()));
      assert.equal(isSessionChainEnabled('unknown-cat', config), true);
    });

    it('loads project config for gemini (sessionChain: false in cat-config.json)', () => {
      // Uses the actual project cat-config.json
      const config = loadCatConfig();
      assert.equal(isSessionChainEnabled('gemini', config), false);
      assert.equal(isSessionChainEnabled('opus', config), true);
      assert.equal(isSessionChainEnabled('codex', config), true);
    });

    it('accepts features with empty object (all defaults)', () => {
      const cfg = validConfig();
      cfg.breeds[0].features = {};
      const config = loadCatConfig(writeTempConfig(cfg));
      assert.equal(isSessionChainEnabled('opus', config), true);
    });

    it('Cloud P1: gracefully returns true when config file is missing (no throw)', () => {
      const saved = process.env.CAT_CONFIG_PATH;
      process.env.CAT_CONFIG_PATH = '/tmp/nonexistent-cat-config-12345.json';
      _resetCachedConfig();
      try {
        // Should NOT throw — should fallback to default (true)
        const result = isSessionChainEnabled('codex');
        assert.equal(result, true, 'should return true (default) when config is unreadable');
      } finally {
        if (saved === undefined) {
          delete process.env.CAT_CONFIG_PATH;
        } else {
          process.env.CAT_CONFIG_PATH = saved;
        }
        _resetCachedConfig();
      }
    });
  });
});
