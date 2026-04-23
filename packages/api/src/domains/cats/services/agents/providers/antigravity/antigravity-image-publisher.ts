import { createHash } from 'node:crypto';
import { access, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import { ALLOWED_IMAGE_MIMES, type SupportedImageMime } from '../../../../../../utils/image-storage.js';
import { type PublishedGeneratedImage, publishGeneratedImage } from '../generated-image-publication.js';
import type { TrajectoryStep } from './AntigravityBridge.js';

const log = createModuleLogger('antigravity-image-publisher');

const EXT_TO_MIME: Record<string, SupportedImageMime> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export function extractAbsoluteImagePaths(text: string | undefined | null): string[] {
  if (!text) return [];
  const paths: string[] = [];
  for (const token of text.split(/[\s"'`()[\]{}<>,;]+/)) {
    if (token.startsWith('/') && /\.(?:png|jpe?g|gif|webp)$/i.test(token)) {
      paths.push(token);
    }
  }
  return [...new Set(paths)];
}

const IMAGE_GEN_TOOL_NAMES = new Set(['image_gen', 'generate_image', 'create_image']);

export function collectImagePathsFromSteps(steps: TrajectoryStep[]): string[] {
  const paths = new Set<string>();
  for (const step of steps) {
    const toolName = step.toolResult?.toolName ?? step.toolCall?.toolName ?? step.metadata?.toolCall?.name;
    if (toolName && IMAGE_GEN_TOOL_NAMES.has(toolName)) {
      for (const p of extractAbsoluteImagePaths(step.toolResult?.output)) paths.add(p);
    }
  }
  return [...paths];
}

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

export interface AntigravityImagePublishOptions {
  candidatePaths: string[];
  cascadeId: string;
  uploadDir?: string;
  maxAgeMs?: number;
}

export async function publishAntigravityImages(
  options: AntigravityImagePublishOptions,
): Promise<PublishedGeneratedImage[]> {
  const results: PublishedGeneratedImage[] = [];

  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cutoff = Date.now() - maxAgeMs;

  for (const filePath of options.candidatePaths) {
    if (filePath.includes('/uploads/')) continue;

    const ext = extname(filePath).toLowerCase();
    const mime = EXT_TO_MIME[ext];
    if (!mime || !ALLOWED_IMAGE_MIMES.has(mime)) continue;

    try {
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs < cutoff) continue;
    } catch {
      continue;
    }

    const pathHash = createHash('sha256').update(filePath).digest('hex').slice(0, 8);
    try {
      const published = await publishGeneratedImage({
        sourcePath: filePath,
        mimeType: mime,
        publicationKey: `antigravity-${options.cascadeId}-${pathHash}-${filePath.split('/').pop()}`,
        provider: 'antigravity',
        toolName: 'image_gen',
        uploadDir: options.uploadDir,
        title: 'antigravity:image_gen',
        alt: 'generated image',
      });
      if (published.isNew) results.push(published);
    } catch (err) {
      log.warn({ filePath, err }, 'Failed to publish antigravity generated image');
    }
  }

  return results;
}
