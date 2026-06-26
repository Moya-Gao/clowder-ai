// check-sync-public-delta-gate-fs.mjs — F251 Task 4a filesystem + path classification helpers.
//
// Extracted from check-sync-public-delta-gate-cli.mjs per AGENTS.md root code-quality redline
// (`文件 200 警告/350 硬上限`). Helpers are independently testable and don't touch git/network.
//
// Three concerns share this module because they're all pure path/IO with no orchestration logic:
//   1. Candidate tree walk (listFsPaths + IGNORED_WALK_DIRS) — defensive skip of install/build dirs
//   2. Target-owned root matching (normalizeRoot/isPathUnderRoot/isTargetOwnedPath) — yaml glob hygiene
//   3. Binary detection (BINARY_EXTENSIONS + NUL-byte sniff) — INV-5 fail-closed for binary deltas

import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

// Install/build/cache directories that should NEVER appear in a public sync candidate tree.
// Defensive: even when caller passes a pristine FILTERED_DIR, if any of these leak in (e.g. operator
// misconfigures or future bash regression points filtered-dir at VALIDATION_TARGET_DIR again), the
// gate must not enumerate them as candidate public bytes.
export const IGNORED_WALK_DIRS = new Set([
  '.git',
  'node_modules',
  '.pnpm',
  '.pnpm-store',
  'dist',
  'build',
  '.turbo',
  '.next',
  '.cache',
  '.parcel-cache',
  '.vite',
  '.svelte-kit',
  'coverage',
  '.nyc_output',
]);

// Defensive stat: pnpm symlink trees can introduce cycles that blow up readdirSync if we
// follow them. `throwIfNoEntry: false` returns undefined for missing nodes; the try/catch
// guards against ELOOP / EACCES on dangling symlinks. Returns null = skip this entry.
function safeStat(full) {
  try {
    return statSync(full, { throwIfNoEntry: false }) ?? null;
  } catch {
    return null;
  }
}

export function listFsPaths(rootDir) {
  const root = resolve(rootDir);
  const out = new Set();
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      // Skip install/build/cache directories even if caller forgets to pass a pristine tree.
      if (IGNORED_WALK_DIRS.has(entry)) {
        continue;
      }
      const full = join(dir, entry);
      const st = safeStat(full);
      if (!st) {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        out.add(relative(root, full));
      }
    }
  }
  walk(root);
  return out;
}

export function normalizeRoot(root) {
  // sync-manifest.yaml lists target_owned_files with mixed trailing-slash conventions
  // (e.g. ".github/ISSUE_TEMPLATE/" vs "docs/community" vs "/.gitignore"). Without
  // normalization, `docs/community/foo.md`.startsWith(`docs/community//`) is false and
  // every file inside a trailing-slash root false-blocks. Strip leading and trailing
  // slashes once so the prefix comparison is canonical regardless of input form.
  return root.replace(/^\/+|\/+$/g, '');
}

export function isPathUnderRoot(path, root) {
  const r = normalizeRoot(root);
  if (r.length === 0) return false;
  if (path === r) return true;
  return path.startsWith(`${r}/`);
}

export function isTargetOwnedPath(path, targetOwnedRoots) {
  for (const root of targetOwnedRoots) {
    if (isPathUnderRoot(path, root)) {
      return true;
    }
  }
  return false;
}

// Plan acceptance matrix anchor (`docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
// line 460): `.sync-provenance.json differs | PASS as provenance`. Without flagging this in the
// classifier call the gate fails closed on legitimate provenance churn — sync-to-opensource.sh
// writes a fresh `.sync-provenance.json` into FILTERED_DIR every run (line 1911), so by definition
// the 3-way blob hashes diverge between target HEAD and the candidate export.
//
// V1 minimal allowlist per spec OQ-1 (`docs/features/F251-public-delta-preservation-gate.md`).
// Future hardening (governance hash files, generated allowlists) can extend this set when their
// path conventions are settled. Path equality only — no glob — so future additions are explicit.
export const GENERATED_OR_PROVENANCE_PATHS = new Set(['.sync-provenance.json']);

export function isGeneratedOrProvenancePath(path) {
  return GENERATED_OR_PROVENANCE_PATHS.has(path);
}

// Known-binary file extensions. Plan KD-1/INV-5 says binary deltas must fail-closed
// for V1; without this signal the classifier's binary-block branch was unreachable
// from sync runs and binary assets (images, fonts, archives) could pass through
// source-only-pass on blob-hash equality alone.
export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.tif',
  '.svgz',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
  '.7z',
  '.tar',
  '.rar',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.mov',
  '.wav',
  '.ogg',
  '.webm',
  '.avi',
  '.mkv',
  '.flv',
  '.so',
  '.dylib',
  '.dll',
  '.exe',
  '.wasm',
  '.dat',
  '.bin',
  '.class',
  '.pyc',
  '.psd',
  '.ai',
  '.sketch',
  '.fig',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
]);

// Read first BINARY_SNIFF_BYTES of the file and look for a NUL byte — git's own
// heuristic for binary detection. Fallback if extension is ambiguous.
export const BINARY_SNIFF_BYTES = 8192;

export function hasNullByte(filePath) {
  let fd;
  try {
    fd = openSync(filePath, 'r');
  } catch {
    return false;
  }
  try {
    const buf = Buffer.alloc(BINARY_SNIFF_BYTES);
    const bytesRead = readSync(fd, buf, 0, BINARY_SNIFF_BYTES, 0);
    for (let i = 0; i < bytesRead; i += 1) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    try {
      closeSync(fd);
    } catch {
      // ignore
    }
  }
}

export function isBinaryPath(path, oursFsPath) {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase())) {
    return true;
  }
  // Fall back to content sniff only if the candidate exists on disk.
  if (oursFsPath && existsSync(oursFsPath)) {
    return hasNullByte(oursFsPath);
  }
  return false;
}
