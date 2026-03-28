/**
 * F056 Phase A-1: WCAG AA Contrast Validation
 *
 * Checks text-on-background color pairs from the semantic token contract.
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text (18px+ or 14px bold).
 *
 * Usage: node scripts/check-color-contrast.mjs
 */

// --- sRGB relative luminance (WCAG 2.1 formula) ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function luminance([r, g, b]) {
  const linearize = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Token contract: resolved hex values for light and dark ---
const themes = {
  light: {
    'cafe-surface': '#fdf8f3',
    'cafe-surface-elevated': '#f5ede3',
    'cafe-surface-sunken': '#f0e8dd',
    'cafe-text': '#1e1e24',
    'cafe-text-secondary': '#666666',
    'cafe-text-muted': '#888888',
    'cafe-border': '#e0d5c7',
    'cafe-border-subtle': '#ebe3d9',
    'cafe-accent': '#ffab91',
    'cafe-accent-hover': '#ff9a7a',
    'cafe-crosspost': '#81d4fa',
    'cafe-interactive': '#85655a',
    'base-black': '#1e1e24',
    'cocreator-bg': '#fff5f2',
  },
  dark: {
    'cafe-surface': '#1c1917',
    'cafe-surface-elevated': '#292524',
    'cafe-surface-sunken': '#0c0a09',
    'cafe-text': '#faf9f7',
    'cafe-text-secondary': '#a8a29e',
    'cafe-text-muted': '#78716c',
    'cafe-border': '#44403c',
    'cafe-border-subtle': '#33302c',
    'cafe-accent': '#ffb899',
    'cafe-accent-hover': '#ffc5aa',
    'cafe-crosspost': '#64b5f6',
    'cafe-interactive': '#b0937a',
    'base-black': '#faf9f7',
    'cocreator-bg': '#292524',
  },
};

// Text-on-background pairs to validate
const pairs = [
  // Normal text (4.5:1 required)
  { fg: 'cafe-text', bg: 'cafe-surface', size: 'normal' },
  { fg: 'cafe-text', bg: 'cafe-surface-elevated', size: 'normal' },
  { fg: 'cafe-text-secondary', bg: 'cafe-surface', size: 'normal' },
  { fg: 'cafe-text-secondary', bg: 'cafe-surface-elevated', size: 'normal' },
  { fg: 'cafe-text-muted', bg: 'cafe-surface', size: 'large' },
  { fg: 'cafe-interactive', bg: 'cafe-surface', size: 'normal' },
  { fg: 'cafe-interactive', bg: 'cafe-surface-elevated', size: 'normal' },
  // Cocreator + base token combos (Phase D2 coverage)
  { fg: 'base-black', bg: 'cocreator-bg', size: 'normal' },
  { fg: 'cafe-text', bg: 'cocreator-bg', size: 'normal' },
  // Accent colors are used as backgrounds/badges, not body text — no WCAG text check needed
];

// --- Run checks ---
let failed = 0;
const threshold = { normal: 4.5, large: 3.0 };

console.log('# F056 Phase A-1: WCAG AA Contrast Report\n');

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`## ${themeName} mode\n`);
  console.log('| Foreground | Background | Ratio | Required | Result |');
  console.log('|------------|------------|-------|----------|--------|');

  for (const { fg, bg, size } of pairs) {
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    const required = threshold[size];
    const pass = ratio >= required;
    if (!pass) failed++;
    const icon = pass ? 'PASS' : 'FAIL';
    console.log(`| ${fg} | ${bg} | ${ratio.toFixed(2)}:1 | ${required}:1 (${size}) | ${icon} |`);
  }
  console.log('');
}

if (failed > 0) {
  console.log(`\n${failed} pair(s) FAILED WCAG AA contrast check.`);
  process.exit(1);
} else {
  console.log('\nAll pairs PASS WCAG AA contrast check.');
}
