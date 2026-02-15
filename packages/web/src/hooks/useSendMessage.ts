'use client';

import { useCallback, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { useAgentMessages } from '@/hooks/useAgentMessages';
import { useChatCommands } from '@/hooks/useChatCommands';
import { apiFetch } from '@/utils/api-client';

export type UploadStatus = 'idle' | 'uploading' | 'failed';

/**
 * Hook for sending messages (text + optional images).
 * Handles both JSON and multipart form data modes.
 */
export function useSendMessage(activeThreadId?: string) {
  const { addMessage, addMessageToThread, setLoading } = useChatStore();
  const { resetRefs } = useAgentMessages();
  const { processCommand } = useChatCommands();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSend = useCallback(
    async (content: string, images?: File[], overrideThreadId?: string) => {
      // Route threadId is source of truth; store currentThreadId may lag during fast switches.
      // Zustand hook exposes a static `getState()` accessor; this is a vanilla read, not a React hook call.
      const activeThread = activeThreadId ?? useChatStore.getState().currentThreadId;
      const threadId = overrideThreadId ?? activeThread;
      const hasImages = Boolean(images && images.length > 0);
      resetRefs();
      setUploadError(null);
      setUploadStatus(hasImages ? 'uploading' : 'idle');

      // Check for commands first (pass target threadId for thread-scoped commands)
      const wasCommand = await processCommand(content, threadId);
      if (wasCommand) return;

      // Create user message
      const userMsg: ChatMessageData = {
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      };
      if (images && images.length > 0) {
        userMsg.contentBlocks = [
          { type: 'text' as const, text: content },
          ...images.map((img) => ({
            type: 'image' as const,
            url: URL.createObjectURL(img),
          })),
        ];
      }
      // Write optimistic message to the target thread (not always active thread)
      if (threadId !== activeThread) {
        addMessageToThread(threadId, userMsg);
      } else {
        addMessage(userMsg);
      }
      setLoading(true);

      try {
        if (images && images.length > 0) {
          // Multipart mode for images
          const formData = new FormData();
          formData.append('content', content);
          formData.append('threadId', threadId);
          for (const img of images) {
            formData.append('images', img);
          }
          const res = await apiFetch('/api/messages', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.detail ?? `Server error: ${res.status}`);
          }
        } else {
          // JSON mode
          const res = await apiFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              threadId,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.detail ?? `Server error: ${res.status}`);
          }
        }
        setUploadStatus('idle');
        setUploadError(null);
      } catch (err) {
        setLoading(false);
        const errorMessage = err instanceof Error ? err.message : 'Unknown';
        if (hasImages) {
          setUploadStatus('failed');
          setUploadError(errorMessage);
        } else {
          setUploadStatus('idle');
        }
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Failed to send message: ${errorMessage}`,
          timestamp: Date.now(),
        });
      }
    },
    [resetRefs, processCommand, addMessage, addMessageToThread, setLoading, activeThreadId]
  );

  return { handleSend, uploadStatus, uploadError };
}
