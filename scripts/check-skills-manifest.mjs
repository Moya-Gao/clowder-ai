#!/usr/bin/env node

import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const requireFromApi = createRequire(new URL('../packages/api/package.json', import.meta.url));
const { parse: parseYaml } = requireFromApi('yaml');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDir, '..');
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : defaultRepoRoot;

const manifestPath = join(repoRoot, 'cat-cafe-skills', 'manifest.yaml');
const skillsRoot = join(repoRoot, 'cat-cafe-skills');
const catConfigPath = join(repoRoot, 'cat-config.json');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  const raw = readFileSync(manifestPath, 'utf-8');
  const parsed = parseYaml(raw) ?? {};
  if (!parsed.skills || typeof parsed.skills !== 'object') {
    throw new Error('manifest.yaml missing top-level "skills" map');
  }
  return parsed;
}

function loadRosterHandles() {
  if (!existsSync(catConfigPath)) {
    throw new Error(`cat-config.json not found: ${catConfigPath}`);
  }
  const raw = readFileSync(catConfigPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed.roster || typeof parsed.roster !== 'object') {
    throw new Error('cat-config.json missing "roster" object');
  }

  return Object.keys(parsed.roster)
    .map((id) => `@${id}`)
    .sort((a, b) => b.length - a.length);
}

function lintManifestStructure(skillsMap) {
  const errors = [];
  const skillNames = Object.keys(skillsMap);

  for (const skillName of skillNames) {
    const entry = skillsMap[skillName];
    if (!entry || typeof entry !== 'object') {
      errors.push(`[manifest] skills.${skillName} must be an object`);
      continue;
    }

    const triggers = asArray(entry.triggers);
    if (triggers.length === 0) {
      errors.push(`[manifest] skills.${skillName}.triggers must be a non-empty array`);
    }

    const notFor = asArray(entry.not_for);
    if (notFor.length === 0) {
      errors.push(`[manifest] skills.${skillName}.not_for must be a non-empty array`);
    }

    const output = asString(entry.output).trim();
    if (!output) {
      errors.push(`[manifest] skills.${skillName}.output must be a non-empty string`);
    }

    if (!Array.isArray(entry.next)) {
      errors.push(`[manifest] skills.${skillName}.next must be an array (can be empty)`);
      continue;
    }

    for (const target of entry.next) {
      const targetName = asString(target).trim();
      if (!targetName) {
        errors.push(`[manifest] skills.${skillName}.next contains non-string target`);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(skillsMap, targetName)) {
        errors.push(`[manifest] skills.${skillName}.next -> "${targetName}" does not exist`);
      }
    }

    const skillDocPath = join(skillsRoot, skillName, 'SKILL.md');
    if (!existsSync(skillDocPath)) {
      errors.push(`[manifest] skills.${skillName} has no matching SKILL.md at ${relative(repoRoot, skillDocPath)}`);
    }
  }

  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const skillDocPath = join(skillsRoot, skillName, 'SKILL.md');
    if (!existsSync(skillDocPath)) continue;
    if (Object.prototype.hasOwnProperty.call(skillsMap, skillName)) continue;
    errors.push(
      `[manifest] filesystem skill "${skillName}" has SKILL.md but is missing in manifest.yaml`,
    );
  }

  return errors;
}

function lintHardcodedHandles(skillsMap, handles) {
  const errors = [];

  for (const skillName of Object.keys(skillsMap)) {
    const skillDocPath = join(skillsRoot, skillName, 'SKILL.md');
    if (!existsSync(skillDocPath)) continue;

    const text = readFileSync(skillDocPath, 'utf-8');
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (line.includes('@猫名') || line.includes('@显示名')) continue;

      for (const handle of handles) {
        const re = new RegExp(`(^|[^A-Za-z0-9_.-])${escapeRegExp(handle)}(?![A-Za-z0-9_.-])`);
        if (!re.test(line)) continue;

        const relPath = relative(repoRoot, skillDocPath);
        errors.push(
          `[hardcoded-handle] ${relPath}:${index + 1} contains ${handle} — use role/roster reference instead`,
        );
      }
    }
  }

  return errors;
}

function lintManifest() {
  const parsed = loadManifest();
  const skillsMap = parsed.skills;
  const handles = loadRosterHandles();

  const errors = [
    ...lintManifestStructure(skillsMap),
    ...lintHardcodedHandles(skillsMap, handles),
  ];

  return {
    skillCount: Object.keys(skillsMap).length,
    errorCount: errors.length,
    errors,
  };
}

try {
  const result = lintManifest();
  if (result.errorCount > 0) {
    console.error(`FAIL check-skills-manifest: ${result.errorCount} issue(s) found`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`PASS check-skills-manifest: ${result.skillCount} skills validated`);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL check-skills-manifest: ${message}`);
  process.exit(1);
}
