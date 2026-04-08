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

/** Composite rgba(r,g,b,a) over a hex background → resolved hex */
function resolveRgba(r, g, b, a, bgHex) {
  const [br, bg, bb] = hexToRgb(bgHex).map((c) => c * 255);
  const rr = Math.round(a * r + (1 - a) * br);
  const rg = Math.round(a * g + (1 - a) * bg);
  const rb = Math.round(a * b + (1 - a) * bb);
  return `#${rr.toString(16).padStart(2, '0')}${rg.toString(16).padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`;
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
    // Connector text-on-bubble pairs (light defaults)
    'conn-slate-text': '#334155',
    'conn-slate-bubble-bg': '#f8fafc',
    'conn-gray-text': '#1f2937',
    'conn-gray-bubble-bg': '#f9fafb',
    'conn-amber-text': '#b45309',
    'conn-amber-bubble-bg': '#fffbeb',
    'conn-purple-text': '#7e22ce',
    'conn-purple-bubble-bg': '#faf5ff',
    'conn-emerald-text': '#047857',
    'conn-emerald-bubble-bg': '#ecfdf5',
    'conn-blue-text': '#1d4ed8',
    'conn-blue-bubble-bg': '#eff6ff',
    'conn-sky-text': '#0369a1',
    'conn-sky-bubble-bg': '#f0f9ff',
    'conn-cyan-text': '#0e7490',
    'conn-cyan-bubble-bg': '#ecfeff',
    'conn-red-text': '#b91c1c',
    'conn-red-bubble-bg': '#fef2f2',
    'conn-indigo-text': '#4338ca',
    'conn-indigo-bubble-bg': '#eef2ff',
    'conn-violet-text': '#6d28d9',
    'conn-violet-bubble-bg': '#f5f3ff',
    'conn-green-text': '#15803d',
    'conn-green-bubble-bg': '#f0fdf4',
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
    // Connector text-on-bubble pairs (dark — bubble-bg resolved from rgba over #1c1917)
    'conn-slate-text': '#cbd5e1',
    'conn-slate-bubble-bg': resolveRgba(30, 41, 59, 0.35, '#1c1917'),
    'conn-gray-text': '#d1d5db',
    'conn-gray-bubble-bg': resolveRgba(31, 41, 55, 0.35, '#1c1917'),
    'conn-amber-text': '#fcd34d',
    'conn-amber-bubble-bg': resolveRgba(120, 53, 15, 0.35, '#1c1917'),
    'conn-purple-text': '#d8b4fe',
    'conn-purple-bubble-bg': resolveRgba(88, 28, 135, 0.35, '#1c1917'),
    'conn-emerald-text': '#6ee7b7',
    'conn-emerald-bubble-bg': resolveRgba(6, 78, 59, 0.35, '#1c1917'),
    'conn-blue-text': '#93c5fd',
    'conn-blue-bubble-bg': resolveRgba(30, 58, 138, 0.35, '#1c1917'),
    'conn-sky-text': '#7dd3fc',
    'conn-sky-bubble-bg': resolveRgba(7, 89, 133, 0.35, '#1c1917'),
    'conn-cyan-text': '#67e8f9',
    'conn-cyan-bubble-bg': resolveRgba(21, 94, 117, 0.35, '#1c1917'),
    'conn-red-text': '#fca5a5',
    'conn-red-bubble-bg': resolveRgba(127, 29, 29, 0.35, '#1c1917'),
    'conn-indigo-text': '#a5b4fc',
    'conn-indigo-bubble-bg': resolveRgba(49, 46, 129, 0.35, '#1c1917'),
    'conn-violet-text': '#c4b5fd',
    'conn-violet-bubble-bg': resolveRgba(76, 29, 149, 0.35, '#1c1917'),
    'conn-green-text': '#86efac',
    'conn-green-bubble-bg': resolveRgba(20, 83, 45, 0.35, '#1c1917'),
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
  // Connector text-on-bubble pairs (intake clowder-ai#372)
  { fg: 'conn-slate-text', bg: 'conn-slate-bubble-bg', size: 'normal' },
  { fg: 'conn-gray-text', bg: 'conn-gray-bubble-bg', size: 'normal' },
  { fg: 'conn-amber-text', bg: 'conn-amber-bubble-bg', size: 'normal' },
  { fg: 'conn-purple-text', bg: 'conn-purple-bubble-bg', size: 'normal' },
  { fg: 'conn-emerald-text', bg: 'conn-emerald-bubble-bg', size: 'normal' },
  { fg: 'conn-blue-text', bg: 'conn-blue-bubble-bg', size: 'normal' },
  { fg: 'conn-sky-text', bg: 'conn-sky-bubble-bg', size: 'normal' },
  { fg: 'conn-cyan-text', bg: 'conn-cyan-bubble-bg', size: 'normal' },
  { fg: 'conn-red-text', bg: 'conn-red-bubble-bg', size: 'normal' },
  { fg: 'conn-indigo-text', bg: 'conn-indigo-bubble-bg', size: 'normal' },
  { fg: 'conn-violet-text', bg: 'conn-violet-bubble-bg', size: 'normal' },
  { fg: 'conn-green-text', bg: 'conn-green-bubble-bg', size: 'normal' },
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
