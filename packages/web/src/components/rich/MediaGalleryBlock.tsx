'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RichMediaGalleryBlock } from '@/stores/chat-types';

async function copyImageToClipboard(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`not an image: ${blob.type}`);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await copyImageToClipboard(url);
      } catch {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // Clipboard API denied entirely — silently fail
          return;
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [url],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      title={copied ? 'Copied!' : 'Copy image'}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Lightbox({ url, alt, caption, onClose }: { url: string; alt: string; caption?: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled via useEffect
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, not interactive */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: container prevents backdrop close */}
      <div
        className="relative group max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black/70 hover:bg-black/90 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg z-10"
          title="Close"
        >
          &times;
        </button>
        {/* biome-ignore lint/performance/noImgElement: data URIs from MCP cannot use next/image */}
        <img src={url} alt={alt} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        {caption && <p className="mt-2 text-sm text-white/80">{caption}</p>}
        <CopyButton url={url} />
      </div>
    </div>
  );
}

export function MediaGalleryBlock({ block }: { block: RichMediaGalleryBlock }) {
  const items = Array.isArray(block.items) ? block.items : [];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        {block.title && <div className="font-medium text-sm mb-2">{block.title}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery items have no stable id
            <figure key={i} className="relative group space-y-1">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block w-full rounded focus:outline-2 focus:outline-blue-400"
                aria-label={`Enlarge ${item.alt ?? 'image'}`}
              >
                {/* biome-ignore lint/performance/noImgElement: data URIs from MCP cannot use next/image */}
                <img
                  src={item.url}
                  alt={item.alt ?? ''}
                  className="rounded w-full object-cover max-h-48 cursor-pointer hover:opacity-90 transition-opacity"
                />
              </button>
              <CopyButton url={item.url} />
              {item.caption && (
                <figcaption className="text-xs text-gray-500 dark:text-gray-400">{item.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
      {lightboxIndex !== null && items[lightboxIndex] && (
        <Lightbox
          url={items[lightboxIndex].url}
          alt={items[lightboxIndex].alt ?? ''}
          caption={items[lightboxIndex].caption}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
