import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// Import the pattern builder logic inline (script is CLI, not a module)
const MAPPING = [
  ['bg-gray-100', 'bg-cafe-surface-elevated'],
  ['bg-gray-50', 'bg-cafe-surface-elevated'],
  ['bg-white', 'bg-cafe-surface'],
  ['text-gray-900', 'text-cafe'],
  ['text-gray-800', 'text-cafe'],
  ['text-gray-700', 'text-cafe-secondary'],
  ['text-gray-600', 'text-cafe-secondary'],
  ['text-gray-500', 'text-cafe-secondary'],
  ['text-gray-400', 'text-cafe-muted'],
  ['text-gray-300', 'text-cafe-muted'],
  ['border-gray-300', 'border-cafe'],
  ['border-gray-200', 'border-cafe'],
  ['border-gray-100', 'border-cafe-subtle'],
];

const MODIFIERS = ['', 'hover:', 'focus:', 'active:', 'group-hover:', 'focus-within:', 'focus-visible:', 'disabled:'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPatterns() {
  const patterns = [];
  for (const [src, target] of MAPPING) {
    for (const mod of MODIFIERS) {
      const full = `${mod}${src}`;
      const replacement = `${mod}${target}`;
      const regex = new RegExp(`(?<=[\\s"'\`])${escapeRegex(full)}(/\\d+)?(?=[\\s"'\`])`, 'g');
      patterns.push({ regex, replacement, source: full });
    }
  }
  return patterns;
}

function applyCodemod(input) {
  let content = input;
  for (const { regex, replacement } of buildPatterns()) {
    content = content.replace(regex, (match, opacity) => replacement + (opacity || ''));
  }
  return content;
}

describe('codemod-neutral-to-semantic', () => {
  it('replaces bg-white in className string', () => {
    const input = 'className="bg-white text-gray-900 p-4"';
    const expected = 'className="bg-cafe-surface text-cafe p-4"';
    assert.equal(applyCodemod(input), expected);
  });

  it('replaces text-gray-* variants', () => {
    const input = 'className="text-gray-400 text-gray-600 text-gray-700"';
    const expected = 'className="text-cafe-muted text-cafe-secondary text-cafe-secondary"';
    assert.equal(applyCodemod(input), expected);
  });

  it('replaces border neutrals', () => {
    const input = 'className="border-gray-200 border-gray-100"';
    const expected = 'className="border-cafe border-cafe-subtle"';
    assert.equal(applyCodemod(input), expected);
  });

  it('handles hover/focus modifiers', () => {
    const input = 'className="hover:bg-gray-50 focus:border-gray-200"';
    const expected = 'className="hover:bg-cafe-surface-elevated focus:border-cafe"';
    assert.equal(applyCodemod(input), expected);
  });

  it('preserves opacity suffix', () => {
    const input = 'className="text-gray-400/50 bg-white/80"';
    const expected = 'className="text-cafe-muted/50 bg-cafe-surface/80"';
    assert.equal(applyCodemod(input), expected);
  });

  it('does NOT replace text-white (not in mapping)', () => {
    const input = 'className="text-white bg-black"';
    assert.equal(applyCodemod(input), input);
  });

  it('does NOT replace text-gray-200 (not in mapping)', () => {
    const input = 'className="text-gray-200"';
    assert.equal(applyCodemod(input), input);
  });

  it('works inside cn() calls', () => {
    const input = `cn("bg-white", active && "text-gray-600")`;
    const expected = `cn("bg-cafe-surface", active && "text-cafe-secondary")`;
    assert.equal(applyCodemod(input), expected);
  });

  it('works inside template literals', () => {
    const input = '`bg-white ${active ? "text-gray-900" : "text-gray-400"}`';
    const expected = '`bg-cafe-surface ${active ? "text-cafe" : "text-cafe-muted"}`';
    assert.equal(applyCodemod(input), expected);
  });

  it('does not false-positive on partial matches', () => {
    // bg-white-space should NOT be touched (no word boundary after bg-white)
    const input = 'className="pre-bg-white-ish"';
    assert.equal(applyCodemod(input), input);
  });

  it('handles group-hover modifier', () => {
    const input = 'className="group-hover:bg-gray-50"';
    const expected = 'className="group-hover:bg-cafe-surface-elevated"';
    assert.equal(applyCodemod(input), expected);
  });
});
