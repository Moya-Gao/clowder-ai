import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { loadCatConfig, getDefaultVariant, toFlatConfigs, findBreedByMention } =
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

    it('rejects invalid catId (not opus/codex/gemini)', () => {
      const bad = validConfig();
      bad.breeds[0].catId = 'foobar';
      const path = writeTempConfig(bad);
      assert.throws(() => loadCatConfig(path), /Invalid cat config/);
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
});
