import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_BY_EXT: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const LOCAL_ASSET_RE = /\b(src|href)\s*=\s*(['"])(file:\/\/[^'"]+)\2/gi;

function fileUrlToDataUrl(fileUrl: string): string | null {
  const filePath = fileURLToPath(fileUrl);
  const mime = MIME_BY_EXT[extname(filePath).toLowerCase()];
  if (!mime) return null;
  const content = readFileSync(filePath);
  return `data:${mime};base64,${content.toString('base64')}`;
}

export function inlineLocalAssetUrls(html: string): string {
  return html.replace(LOCAL_ASSET_RE, (match, attr, quote, fileUrl) => {
    const dataUrl = fileUrlToDataUrl(fileUrl);
    if (!dataUrl) return match;
    return `${attr}=${quote}${dataUrl}${quote}`;
  });
}
