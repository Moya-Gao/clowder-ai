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
  | { content: string; userId: string; threadId?: string; contentBlocks: MessageContent[] }
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
      files.push(part);
    }
  }

  const parseResult = sendMessageSchema.safeParse(fields);
  if (!parseResult.success) {
    return { error: 'Invalid form fields' };
  }

  const { content, userId, threadId } = parseResult.data;
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

  return { content, userId, ...(threadId ? { threadId } : {}), contentBlocks: blocks };
}
