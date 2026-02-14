/**
 * Multipart Request Parser
 * 解析 multipart/form-data 请求，提取文本字段和图片文件。
 * 从 messages.ts 提取，降低文件复杂度。
 */

import type { Multipart, MultipartFile } from '@fastify/multipart';
import type { MessageContent, TextContent, ImageContent } from '@cat-cafe/shared';
import { saveUploadedImages, ImageUploadError } from './image-upload.js';
import { sendMessageSchema } from './messages.schema.js';

export type ParsedMultipart =
  | { content: string; userId?: string; threadId?: string; idempotencyKey?: string; contentBlocks: MessageContent[] }
  | { error: string };

/** Parse multipart request into validated message fields + contentBlocks */
export async function parseMultipart(
  request: { parts: () => AsyncIterableIterator<Multipart> },
  uploadDir: string,
): Promise<ParsedMultipart> {
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  for await (const part of request.parts()) {
    if (part.type === 'field' && typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    } else if (part.type === 'file') {
      // IMPORTANT: multipart file streams must be drained during iteration.
      // If we defer `toBuffer()` until after the loop, parser may block waiting
      // for this stream to be consumed and request hangs.
      const buffer = await part.toBuffer();
      files.push({
        ...part,
        toBuffer: async () => buffer,
      });
    }
  }

  const parseResult = sendMessageSchema.safeParse(fields);
  if (!parseResult.success) {
    return { error: 'Invalid form fields' };
  }

  const { content, userId, threadId, idempotencyKey } = parseResult.data;
  const blocks: MessageContent[] = [{ type: 'text', text: content } as TextContent];

  if (files.length > 0) {
    try {
      const saved = await saveUploadedImages(files, uploadDir);
      for (const img of saved) {
        blocks.push(img.content as ImageContent);
      }
    } catch (err) {
      if (err instanceof ImageUploadError) {
        return { error: err.message };
      }
      throw err;
    }
  }

  return {
    content,
    ...(userId ? { userId } : {}),
    ...(threadId ? { threadId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    contentBlocks: blocks,
  };
}
