'use client';

import type { RichMediaGalleryBlock } from '@/stores/chat-types';

export function MediaGalleryBlock({ block }: { block: RichMediaGalleryBlock }) {
  const items = Array.isArray(block.items) ? block.items : [];
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      {block.title && (
        <div className="font-medium text-sm mb-2">{block.title}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, i) => (
          <figure key={i} className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.alt ?? ''}
              className="rounded w-full object-cover max-h-48"
            />
            {item.caption && (
              <figcaption className="text-xs text-gray-500 dark:text-gray-400">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
