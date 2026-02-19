'use client';

import type { RichBlock } from '@/stores/chat-types';
import { CardBlock } from './CardBlock';
import { DiffBlock } from './DiffBlock';
import { ChecklistBlock } from './ChecklistBlock';
import { MediaGalleryBlock } from './MediaGalleryBlock';

function RichBlockRenderer({ block }: { block: RichBlock }) {
  switch (block.kind) {
    case 'card':
      return <CardBlock block={block} />;
    case 'diff':
      return <DiffBlock block={block} />;
    case 'checklist':
      return <ChecklistBlock block={block} />;
    case 'media_gallery':
      return <MediaGalleryBlock block={block} />;
    default:
      return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-400">
          未知富块类型: {(block as { kind: string }).kind}
        </div>
      );
  }
}

export function RichBlocks({ blocks }: { blocks: RichBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {blocks.map((block) => (
        <RichBlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
