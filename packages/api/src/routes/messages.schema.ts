/**
 * Messages API Schemas
 * Zod schemas for message-related API validation.
 * Extracted from parse-multipart.ts for better organization.
 */

import { z } from 'zod';

/**
 * Schema for POST /api/messages request body.
 * Used for both JSON and multipart form data validation.
 */
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  userId: z.string().min(1).max(100).default('default-user'),
  mentions: z.array(z.enum(['opus', 'codex', 'gemini'])).optional(),
  threadId: z.string().min(1).max(100).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
