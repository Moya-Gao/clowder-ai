import type { MessageContent } from '@cat-cafe/shared';

export function hasImageContentBlocks(
  contentBlocks: readonly MessageContent[] | undefined,
): boolean {
  return contentBlocks?.some((block) => block.type === 'image') ?? false;
}

