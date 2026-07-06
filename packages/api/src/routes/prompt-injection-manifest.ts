/**
 * Prompt Injection Manifest Route — F237 Phase 2
 *
 * GET /api/prompt-injection/manifest — aggregate 46 hook.yaml manifests
 * into the ManifestSegment[] shape the Console frontend expects.
 *
 * Replaces the old monolithic assets/prompt-injection-manifest.yaml
 * with live scanning via HookRegistry.
 */

import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HookManifest } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';
import { getTemplateFileInfo } from '../domains/cats/services/context/prompt-template-loader.js';
import { HookRegistry } from '../domains/prompt-hooks/HookRegistry.js';
import { resolveUserId } from '../utils/request-identity.js';

// ---------------------------------------------------------------------------
// Project root resolution (same pattern as other routes)
// ---------------------------------------------------------------------------

function findProjectRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(`${dir}/pnpm-workspace.yaml`)) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Prefix → category / consumer mapping
// ---------------------------------------------------------------------------

interface CategoryInfo {
  category: string;
  consumer: string;
  sourceType: string;
}

const PREFIX_MAP: Record<string, CategoryInfo> = {
  L: { category: 'l0-native', consumer: 'l0-compiler', sourceType: 'template' },
  S: { category: 'system-prompt', consumer: 'system-prompt-builder', sourceType: 'template' },
  D: { category: 'dynamic-per-turn', consumer: 'turn-context-builder', sourceType: 'template' },
  R: { category: 'route-assembly', consumer: 'route-assembler', sourceType: 'template' },
  B: { category: 'bootcamp', consumer: 'bootcamp-hook', sourceType: 'template' },
  C: { category: 'callback', consumer: 'mcp-callback', sourceType: 'template' },
  N: { category: 'navigation', consumer: 'navigation-builder', sourceType: 'template' },
};

function getCategoryInfo(id: string): CategoryInfo {
  const prefix = id.replace(/\d+$/, '');
  return PREFIX_MAP[prefix] ?? { category: 'unknown', consumer: 'unknown', sourceType: 'template' };
}

// ---------------------------------------------------------------------------
// HookManifest → ManifestSegment mapping
// ---------------------------------------------------------------------------

interface ManifestSegment {
  id: string;
  name: string;
  category: string;
  lifecycleStage: string;
  source: string;
  sourceType: string;
  trigger: string;
  purpose: string;
  userExplanation: string;
  priority: string;
  safetyTier: string;
  transparencyTier: string;
  governanceTier: string;
  allowLocalOverride: boolean;
  disableable: boolean;
  consumer: string;
  relatedFeature: string | null;
}

function toManifestSegment(hook: HookManifest): ManifestSegment {
  const info = getCategoryInfo(hook.id);
  const fileInfo = getTemplateFileInfo(hook.id);

  return {
    id: hook.id,
    name: hook.name,
    category: info.category,
    lifecycleStage: hook.stage,
    source: hook.template,
    sourceType: info.sourceType,
    trigger: hook.resolver ? 'conditional' : 'always',
    purpose: hook.userExplanation ?? hook.name,
    userExplanation: hook.userExplanation ?? hook.name,
    priority: `${hook.stage}:${hook.order}`,
    safetyTier: hook.safetyTier,
    transparencyTier: hook.transparencyTier,
    governanceTier: hook.governanceTier,
    allowLocalOverride: fileInfo ? !!fileInfo.local : false,
    disableable: hook.disableable,
    consumer: info.consumer,
    relatedFeature: null,
  };
}

// ---------------------------------------------------------------------------
// Registry singleton (lazy init, scan once per process)
// ---------------------------------------------------------------------------

let cachedSegments: ManifestSegment[] | null = null;

function getManifestSegments(): ManifestSegment[] {
  if (cachedSegments) return cachedSegments;

  const root = findProjectRoot();
  const hooksDir = `${root}/assets/prompt-hooks`;
  const templatesDir = `${root}/assets/prompt-templates`;
  const registry = new HookRegistry(hooksDir, templatesDir);
  const hooks = registry.scan();

  cachedSegments = hooks.map(toManifestSegment).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return cachedSegments;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const promptInjectionManifestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/prompt-injection/manifest', async (request, reply) => {
    if (!resolveUserId(request)) {
      reply.status(401);
      return { error: 'Authentication required' };
    }

    try {
      const segments = getManifestSegments();
      return {
        schemaVersion: '2.0.0',
        segments,
        totalActive: segments.length,
        totalLegacy: 0,
      };
    } catch (e) {
      reply.status(500);
      return { error: `Failed to build manifest: ${e instanceof Error ? e.message : String(e)}` };
    }
  });
};
