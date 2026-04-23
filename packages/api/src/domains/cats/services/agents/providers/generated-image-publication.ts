import { createHash } from 'node:crypto';
import type { RichMediaGalleryBlock } from '@cat-cafe/shared';
import { getDefaultUploadDir } from '../../../../../utils/upload-paths.js';
import {
  copyImageFileToUploadDir,
  sanitizeFilenameStem,
  type SavedImageAsset,
  type SupportedImageMime,
} from '../../../../../utils/image-storage.js';

export interface GeneratedImagePublicationInput {
  sourcePath: string;
  mimeType: SupportedImageMime;
  publicationKey: string;
  provider: 'codex' | 'antigravity' | 'skill';
  toolName: string;
  prompt?: string;
  uploadDir?: string;
  title?: string;
  alt?: string;
}

export interface GeneratedImagePublicationProvenance {
  provider: string;
  toolName: string;
  prompt?: string;
  originalPath: string;
  publishedPath: string;
  publicationKey: string;
}

export interface PublishedGeneratedImage extends SavedImageAsset {
  mimeType: string;
  originalPath: string;
  publicationKey: string;
  richBlock: RichMediaGalleryBlock;
  provenance: GeneratedImagePublicationProvenance;
}

export async function publishGeneratedImage(
  input: GeneratedImagePublicationInput,
): Promise<PublishedGeneratedImage> {
  const resolvedUploadDir = getDefaultUploadDir(input.uploadDir ?? process.env.UPLOAD_DIR);
  const publicationStem = buildPublicationStem(input.publicationKey);
  const stored = await copyImageFileToUploadDir({
    sourcePath: input.sourcePath,
    mimeType: input.mimeType,
    uploadDir: resolvedUploadDir,
    filenameStem: publicationStem,
    onExists: 'reuse',
  });

  return {
    ...stored,
    mimeType: input.mimeType,
    originalPath: input.sourcePath,
    publicationKey: input.publicationKey,
    richBlock: {
      id: `generated-image-${publicationStem}`,
      kind: 'media_gallery',
      v: 1,
      ...(input.title ? { title: input.title } : {}),
      items: [{ url: stored.urlPath, ...(input.alt ? { alt: input.alt } : {}) }],
    },
    provenance: {
      provider: input.provider,
      toolName: input.toolName,
      ...(input.prompt ? { prompt: input.prompt } : {}),
      originalPath: input.sourcePath,
      publishedPath: stored.urlPath,
      publicationKey: input.publicationKey,
    },
  };
}

function buildPublicationStem(publicationKey: string): string {
  const sanitized = sanitizeFilenameStem(publicationKey);
  const stableSuffix = createHash('sha256').update(publicationKey).digest('hex').slice(0, 8);
  return sanitizeFilenameStem(`${sanitized}-${stableSuffix}`);
}
