#!/usr/bin/env node
/**
 * F203 Phase E — Claude Code / Codex CLI system-prompt audit tool.
 *
 * 铲屎官 2026-05-15："每个 claude code 大版本更新我们需要拆一次 cc 的系统
 * 提示词，比如他添加了新的功能性系统提示词我们得补"。
 *
 * 不语义解析全 prompt——只按**已知 section anchor**（来源
 * `docs/audits/cc-system-prompt-v2.1.143.md` §5 清单）从 `strings <binary>`
 * 输出里提取关键段，并 diff 上一版本归档：新增 anchor（尤其 functional：
 * 工具/safety/压缩/agent 模式）→ flag，提醒猫做 SOP（提案 L0 §2
 * carry-over 更新 PR）。脚本本身不改 L0（人/猫决策）。
 *
 * Exports (testable, no real binary needed):
 *   ANCHORS_CLAUDE / ANCHORS_CODEX  — ordered anchor specs
 *   extractSections(stringsOutput, anchors) → { identityLines, sections }
 *   diffSections(prevDocMarkdown, currentExtraction) → { added, removed, changed }
 *
 * CLI (Task 3 fleshes out): --cli claude|codex --emit|--diff <doc>|--check
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOC_PREFIX = { claude: 'cc-system-prompt-v', codex: 'codex-system-prompt-v' };
const CLI_LABEL = { claude: 'Claude Code', codex: 'Codex' };

/** codex launcher's platform/arch → rust target triple (mirrors codex.js). */
export function targetTriple(platform, arch) {
  const M = {
    linux: { x64: 'x86_64-unknown-linux-musl', arm64: 'aarch64-unknown-linux-musl' },
    android: { x64: 'x86_64-unknown-linux-musl', arm64: 'aarch64-unknown-linux-musl' },
    darwin: { x64: 'x86_64-apple-darwin', arm64: 'aarch64-apple-darwin' },
    win32: { x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' },
  };
  return M[platform]?.[arch] ?? null;
}

const CODEX_PLATFORM_PKG = {
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
};

/**
 * Resolve the platform package's install directory the way the real codex.js
 * launcher does — Node module resolution anchored at the launcher. This finds
 * hoisted/sibling installs (a valid npm/pnpm layout where
 * `@openai/codex-<plat>` lands in a parent `node_modules`, not under
 * `@openai/codex/node_modules`). Returns null when genuinely unresolvable
 * (caller then falls back to hardcoded candidates). Injectable for tests.
 */
function defaultResolvePlatformPkgDir(platformPkg, fromPath) {
  try {
    const req = createRequire(fromPath);
    return dirname(req.resolve(`${platformPkg}/package.json`));
  } catch {
    return null;
  }
}

/**
 * Ordered candidate paths for the codex **native** binary, given the node
 * launcher script path + target triple. Mirrors codex.js resolution:
 * Node-resolved platform package first (hoist-capable, == launcher), then the
 * hardcoded nested layout + launcher pkg's local vendor as fallback.
 * `which codex` is a node launcher (`#!/usr/bin/env node`) — `strings` on it
 * is useless; the real prompt strings live in this native binary.
 */
export function codexNativeBinaryCandidates(
  launcherPath,
  triple,
  resolvePlatformPkgDir = defaultResolvePlatformPkgDir,
) {
  const launcherDir = dirname(launcherPath); // <pkg>/bin
  const pkgRoot = dirname(launcherDir); // <pkg>
  const binName = triple.includes('windows') ? 'codex.exe' : 'codex';
  const platformPkg = CODEX_PLATFORM_PKG[triple];
  const out = [];
  const pushVendorCandidates = (vendorRoot) => {
    out.push(join(vendorRoot, triple, 'bin', binName));
    out.push(join(vendorRoot, triple, 'codex', binName));
  };
  if (platformPkg) {
    // Preferred: Node module resolution (what codex.js actually does) — finds
    // hoisted/sibling installs the hardcoded paths below would miss.
    const resolvedDir = resolvePlatformPkgDir(platformPkg, launcherPath);
    if (resolvedDir) {
      pushVendorCandidates(join(resolvedDir, 'vendor'));
    }
    // Fallback: the verified-working hardcoded nested layout.
    pushVendorCandidates(join(pkgRoot, 'node_modules', platformPkg, 'vendor'));
  }
  pushVendorCandidates(join(pkgRoot, 'vendor'));
  return out;
}

/** Extract a semver (x.y.z) from a CLI `--version` string. null if none. */
export function parseCliVersion(versionStr, _cli) {
  const m = String(versionStr).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

function cmpSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * Highest archived version for a cli from a list of doc filenames
 * (`cc-system-prompt-v{semver}.md` / `codex-system-prompt-v{semver}.md`).
 * Returns the version string or null when none archived yet.
 */
export function latestArchivedVersion(cli, filenames) {
  const prefix = DOC_PREFIX[cli] ?? DOC_PREFIX.claude;
  const re = new RegExp(`^${prefix.replace(/[.]/g, '\\.')}(\\d+\\.\\d+\\.\\d+)\\.md$`);
  const versions = [];
  for (const f of filenames) {
    const m = f.match(re);
    if (m) versions.push(m[1]);
  }
  if (versions.length === 0) return null;
  return versions.sort(cmpSemver).at(-1);
}

/**
 * Render an extraction as the archived-doc markdown (YAML frontmatter per
 * ADR-011 + identity lines + §5-style section list with functional markers).
 * functional anchors are the carry-over-to-L0-§2 surface.
 */
export function formatMarkdown(extraction, { cli, version }) {
  const label = CLI_LABEL[cli] ?? CLI_LABEL.claude;
  const today = new Date().toISOString().slice(0, 10);
  const fm = [
    '---',
    'feature_ids: [F203]',
    'topics: [system-prompt, cli-anatomy, phase-e-audit]',
    'doc_kind: audit',
    `created: ${today}`,
    '---',
    '',
  ];
  const body = [
    `# ${label} v${version} System Prompt 解剖（Phase E audit 自动产出）`,
    '',
    `> 提取来源：\`strings $(which ${cli})\` → audit-claude-code-system-prompt.mjs`,
    `> ${label} 版本：${version}`,
    '',
    '## 1. 身份行',
    '',
    '```',
    ...(extraction.identityLines.length ? extraction.identityLines : ['(none matched)']),
    '```',
    '',
    '## 5. section 全清单（anchor / functional）',
    '',
    ...(extraction.sections.length
      ? extraction.sections.map(
          (s) => `- ${s.id} — ${s.label}${s.functional ? ' · **functional**（必 carry-over L0 §2）' : ''}`,
        )
      : ['- (none matched — anchor 清单可能需更新，见 audit SOP)']),
    '',
    '> functional 段 = `--system-prompt-file` 替换式会替换掉的客观性/能力性',
    '> 指令，必须在 `system-prompt-l0.md` §2 carry-over。新增 functional anchor',
    '> → 按 `cat-cafe-skills/refs/cc-system-prompt-audit-sop.md` 提案 L0 更新 PR。',
    '',
  ];
  return fm.join('\n') + body.join('\n');
}

/**
 * Identity lines captured separately (not "sections"). Real
 * `strings $(which claude)` concatenates the identity sentence inside a
 * multi-thousand-char minified-JS blob, so match must be **sentence-bounded**:
 * non-greedy up to the first `.`, never crossing `"` (blob delimiter) or `\n`.
 */
export const IDENTITY_PATTERNS_CLAUDE = [/You are Claude Code[^"\n]*?\./, /You are a Claude agent[^"\n]*?\./];
export const IDENTITY_PATTERNS_CODEX = [/You are Codex[^"\n]*?\./, /You are a coding agent[^"\n]*?\./];

/**
 * Anchor spec: { id, label, pattern, functional }.
 * `functional` = 客观性/能力性指令（工具发现 / safety / 压缩感知 / agent
 * 模式）——`--system-prompt-file` 替换式会替换掉，**必须 carry-over 到
 * L0 §2**。非 functional（如 `doing-tasks` 的"糊弄哲学"）是我们刻意删的。
 */
export const ANCHORS_CLAUDE = [
  { id: 'doing-tasks', label: '# Doing tasks', pattern: /^#\s*Doing tasks\b/m, functional: false },
  {
    id: 'parallel-tools',
    label: 'parallel tool calls',
    pattern: /multiple tools in a single response/i,
    functional: true,
  },
  {
    id: 'destructive-safety',
    label: 'destructive op safety',
    pattern: /destructive operations?[^\n]*safer alternative|safer alternative[^\n]*destructive/i,
    functional: true,
  },
  {
    id: 'simple-system-prompt',
    label: 'simple_system_prompt mechanism',
    pattern: /CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT|simple_system_prompt/,
    functional: true,
  },
  { id: 'using-tools', label: '# Using your tools', pattern: /^#\s*Using your tools\b/m, functional: true },
];

/** Codex anchors (AC-E5). developer_instructions / base_instructions are the
 *  injection surfaces; sandbox / approval are functional. */
export const ANCHORS_CODEX = [
  {
    id: 'developer-instructions',
    label: 'developer_instructions',
    pattern: /developer_instructions/,
    functional: true,
  },
  { id: 'base-instructions', label: 'base_instructions', pattern: /base_instructions/, functional: true },
  { id: 'sandbox-policy', label: 'sandbox policy', pattern: /sandbox[_-]?(mode|policy)/i, functional: true },
  { id: 'approval-policy', label: 'approval policy', pattern: /approval[_-]?policy/i, functional: true },
];

/**
 * Extract identity lines + matched section anchors from `strings` output.
 * Only matched lines are returned — binary noise / minified js is dropped.
 */
export function extractSections(stringsOutput, anchors, identityPatterns = IDENTITY_PATTERNS_CLAUDE) {
  const lines = stringsOutput.split('\n');
  // A single `strings` line can be a giant minified blob containing ALL
  // identity variants concatenated (zC1=[N98,WL9,ZL9]). Collect every
  // sentence-bounded match across all patterns, dedupe (clean copy + the
  // in-blob copy collapse to one), preserve first-seen order.
  const identitySet = new Set();
  for (const line of lines) {
    for (const p of identityPatterns) {
      for (const m of line.matchAll(new RegExp(p.source, 'g'))) {
        identitySet.add(m[0]);
      }
    }
  }
  const identityLines = [...identitySet];
  const sections = [];
  for (const anchor of anchors) {
    const hit = lines.find((l) => anchor.pattern.test(l));
    if (hit !== undefined) {
      sections.push({
        id: anchor.id,
        label: anchor.label,
        matchedLine: hit,
        functional: anchor.functional,
      });
    }
  }
  return { identityLines, sections };
}

/**
 * Parse the previous version's archived doc (markdown) for its section-id
 * list, then diff against the current extraction.
 * Returns { added, removed, changed } (anchor-id level).
 *
 * The id list is `formatMarkdown`'s §5 lines: `- {id} — {label}[ · **functional**…]`.
 * The id token is followed by the em-dash separator ` — ` (formatMarkdown
 * always emits it) or bare end-of-line (the simplified test/hand docs). The
 * boundary lookahead `(?=\s+—|\s*$)` discriminates real anchor list items
 * from prose bullets: plain `\s*$` only matched bare `- id` (made every real
 * `--diff` false-alarm all anchors — Phase E P1), while a loose `(?:\s|$)`
 * over-matched prose like `- safety = 家规…` (spurious removed:[safety]).
 */
export function diffSections(prevDocMarkdown, currentExtraction) {
  const prevIds = new Set();
  for (const m of prevDocMarkdown.matchAll(/^-\s+([a-z][a-z0-9-]+)(?=\s+—|\s*$)/gm)) {
    prevIds.add(m[1]);
  }
  const curIds = currentExtraction.sections.map((s) => s.id);
  const curSet = new Set(curIds);
  const added = curIds.filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !curSet.has(id));
  // changed: reserved for snippet-level drift (Task 2 refinement); anchor-set
  // diff is the primary signal for "new functional instruction".
  return { added, removed, changed: [] };
}

// --- CLI ---
//   node scripts/audit-claude-code-system-prompt.mjs --cli claude --emit [--out p]
//   node scripts/audit-claude-code-system-prompt.mjs --cli codex  --diff docs/audits/codex-system-prompt-v0.130.0.md
//   node scripts/audit-claude-code-system-prompt.mjs --cli claude --check   (cron: version drift signal)

function isCliEntrypoint(metaUrl, argv1) {
  if (!argv1) return false;
  try {
    return fileURLToPath(metaUrl) === argv1;
  } catch {
    return false;
  }
}

/**
 * Resolve the real native binary to `strings`. claude = the `which claude`
 * Bun binary directly. codex = `which codex` is a node launcher script;
 * resolve its platform-package native binary (codexNativeBinaryCandidates).
 */
function resolveCliBinary(cli) {
  const onPath = execFileSync('which', [cli], { encoding: 'utf8' }).trim();
  if (cli !== 'codex') return onPath;
  // Node-native canonicalization — `readlink -f` is a GNU extension absent on
  // older BSD/macOS toolchains (would error before candidate probing).
  let real;
  try {
    real = realpathSync(onPath);
  } catch {
    real = onPath;
  }
  const triple = targetTriple(process.platform, process.arch);
  if (!triple) throw new Error(`codex: unsupported platform ${process.platform}/${process.arch}`);
  for (const cand of codexNativeBinaryCandidates(real, triple)) {
    if (existsSync(cand)) return cand;
  }
  throw new Error(`codex native binary not found (launcher=${real}, triple=${triple}). Reinstall @openai/codex.`);
}

function liveExtraction(cli) {
  const anchors = cli === 'codex' ? ANCHORS_CODEX : ANCHORS_CLAUDE;
  const identity = cli === 'codex' ? IDENTITY_PATTERNS_CODEX : IDENTITY_PATTERNS_CLAUDE;
  const bin = resolveCliBinary(cli);
  const strings = execFileSync('strings', [bin], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const version = parseCliVersion(execFileSync(cli, ['--version'], { encoding: 'utf8' }), cli) ?? '0.0.0';
  return { extraction: extractSections(strings, anchors, identity), version };
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  const args = process.argv.slice(2);
  const argOf = (k) => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : undefined);
  const cli = argOf('--cli') === 'codex' ? 'codex' : 'claude';

  if (args.includes('--check')) {
    // cron: live CLI version vs latest archived doc → exit 1 = drift (run SOP).
    const liveVer = parseCliVersion(execFileSync(cli, ['--version'], { encoding: 'utf8' }), cli);
    const auditDir = new URL('../docs/audits/', import.meta.url);
    const archived = latestArchivedVersion(cli, readdirSync(auditDir));
    const drift = liveVer !== archived;
    process.stdout.write(`${cli}: live=${liveVer} archived=${archived ?? '(none)'} drift=${drift}\n`);
    process.exit(drift ? 1 : 0);
  }

  const { extraction, version } = liveExtraction(cli);

  if (args.includes('--diff')) {
    const prev = readFileSync(argOf('--diff'), 'utf8');
    const d = diffSections(prev, extraction);
    const newFunctional = extraction.sections.filter((s) => d.added.includes(s.id) && s.functional);
    process.stdout.write(`${JSON.stringify(d, null, 2)}\n`);
    if (newFunctional.length > 0) {
      process.stderr.write(
        `❌ ${newFunctional.length} new FUNCTIONAL anchor(s): ${newFunctional
          .map((s) => s.id)
          .join(', ')} — 按 cc-system-prompt-audit-sop.md 提案 L0 §2 carry-over PR\n`,
      );
      process.exit(1);
    }
    process.exit(d.added.length > 0 || d.removed.length > 0 ? 1 : 0);
  }

  // default: --emit
  const md = formatMarkdown(extraction, { cli, version });
  const out = argOf('--out');
  if (out) {
    writeFileSync(out, md, 'utf8');
    process.stderr.write(`Wrote ${cli} v${version} audit → ${out}\n`);
  } else {
    process.stdout.write(md);
  }
}
