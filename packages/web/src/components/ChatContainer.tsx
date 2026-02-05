'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function ChatContainer() {
  const {
    messages,
    isLoading,
    addMessage,
    appendToLastMessage,
    setStreaming,
    setLoading,
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<{ id: string; catId: string } | null>(null);

  const handleAgentMessage = useCallback(
    (msg: { type: string; catId: string; content?: string; error?: string }) => {
      if (msg.type === 'text' && msg.content) {
        // Check if we need to create a new message (first chunk or different cat)
        const needNewMessage =
          !currentMessageRef.current ||
          currentMessageRef.current.catId !== msg.catId;

        if (needNewMessage) {
          // Create new message for this cat
          const id = `msg-${Date.now()}-${msg.catId}`;
          currentMessageRef.current = { id, catId: msg.catId };
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            timestamp: Date.now(),
            isStreaming: true,
          });
        } else {
          // Append to existing message from same cat
          appendToLastMessage(msg.content);
        }
      } else if (msg.type === 'done') {
        // Mark current message as not streaming, but don't reset
        // (multi-cat may have more cats coming)
        // Reset only happens when all cats are done (when we get final done)
        if (currentMessageRef.current) {
          setStreaming(currentMessageRef.current.id, false);
        }
        // Note: setLoading(false) is called for each cat's done message
        // This is fine since the last cat's done will be the final state
        setLoading(false);
      } else if (msg.type === 'error') {
        currentMessageRef.current = null;
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          catId: msg.catId,
          content: `Error: ${msg.error ?? 'Unknown error'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, appendToLastMessage, setStreaming, setLoading]
  );

  useSocket(handleAgentMessage);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (content: string) => {
      // Add user message
      addMessage({
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      });

      setLoading(true);

      // Send to API
      try {
        await fetch(`${API_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      } catch (err) {
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, setLoading]
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-gray-200 p-4 bg-white">
        <h1 className="text-xl font-bold text-opus-primary">Cat Cafe</h1>
        <p className="text-sm text-gray-500">三只 AI 猫猫的协作空间</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg mb-2">欢迎来到 Cat Cafe!</p>
            <p>输入 @布偶 召唤布偶猫开始聊天</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
