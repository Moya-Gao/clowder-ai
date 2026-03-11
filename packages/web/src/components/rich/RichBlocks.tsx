'use client';

import type { RichBlock } from '@/stores/chat-types';
import { AudioBlock } from './AudioBlock';
import { CardBlock } from './CardBlock';
import { ChecklistBlock } from './ChecklistBlock';
import { DiffBlock } from './DiffBlock';
import { InteractiveBlock } from './InteractiveBlock';
import { MediaGalleryBlock } from './MediaGalleryBlock';

function RichBlockRenderer({ block, catId, messageId }: { block: RichBlock; catId?: string; messageId?: string }) {
  switch (block.kind) {
    case 'card':
      return <CardBlock block={block} />;
    case 'diff':
      return <DiffBlock block={block} />;
    case 'checklist':
      return <ChecklistBlock block={block} />;
    case 'media_gallery':
      return <MediaGalleryBlock block={block} />;
    case 'audio':
      return <AudioBlock block={block} catId={catId} />;
    case 'interactive':
      return <InteractiveBlock block={block} messageId={messageId} />;
    default:
      return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-400">
          未知富块类型: {(block as { kind: string }).kind}
        </div>
      );
  }
}

export function RichBlocks({ blocks, catId, messageId }: { blocks: RichBlock[]; catId?: string; messageId?: string }) {
  if (blocks.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {blocks.map((block) => (
        <RichBlockRenderer key={block.id} block={block} catId={catId} messageId={messageId} />
      ))}
    </div>
  );
}
