'use client';

import type { RichBlock, RichInteractiveBlock } from '@/stores/chat-types';
import { AudioBlock } from './AudioBlock';
import { CardBlock } from './CardBlock';
import { ChecklistBlock } from './ChecklistBlock';
import { DiffBlock } from './DiffBlock';
import { InteractiveBlock } from './InteractiveBlock';
import { InteractiveBlockGroup } from './InteractiveBlockGroup';
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

/** Phase C: collect interactive blocks into groups by groupId */
function groupBlocks(blocks: RichBlock[]): Array<RichBlock | { grouped: true; groupId: string; blocks: RichInteractiveBlock[] }> {
  const result: Array<RichBlock | { grouped: true; groupId: string; blocks: RichInteractiveBlock[] }> = [];
  const groupMap = new Map<string, RichInteractiveBlock[]>();
  const groupOrder: string[] = [];

  for (const block of blocks) {
    if (block.kind === 'interactive' && block.groupId) {
      if (!groupMap.has(block.groupId)) {
        groupMap.set(block.groupId, []);
        groupOrder.push(block.groupId);
      }
      groupMap.get(block.groupId)!.push(block);
    } else {
      // Flush any pending group that appeared before this non-grouped block
      result.push(block);
    }
  }
  // Append groups in order of first appearance
  for (const gid of groupOrder) {
    result.push({ grouped: true, groupId: gid, blocks: groupMap.get(gid)! });
  }
  return result;
}

export function RichBlocks({ blocks, catId, messageId }: { blocks: RichBlock[]; catId?: string; messageId?: string }) {
  if (blocks.length === 0) return null;
  const items = groupBlocks(blocks);
  return (
    <div className="mt-2 space-y-2">
      {items.map((item) =>
        'grouped' in item ? (
          <InteractiveBlockGroup key={item.groupId} blocks={item.blocks} messageId={messageId} />
        ) : (
          <RichBlockRenderer key={item.id} block={item} catId={catId} messageId={messageId} />
        ),
      )}
    </div>
  );
}
