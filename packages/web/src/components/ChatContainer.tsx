'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function ChatContainer() {
  const { messages, isLoading, addMessage, appendToLastMessage, setLoading } =
    useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const handleAgentMessage = useCallback(
    (msg: { type: string; catId: string; content?: string; error?: string }) => {
      if (msg.type === 'text' && msg.content) {
        if (!currentMessageIdRef.current) {
          // First text chunk - create new message
          const id = `msg-${Date.now()}`;
          currentMessageIdRef.current = id;
          addMessage({
            id,
            type: 'assistant',
            catId: msg.catId,
            content: msg.content,
            timestamp: Date.now(),
            isStreaming: true,
          });
        } else {
          // Append to existing message
          appendToLastMessage(msg.content);
        }
      } else if (msg.type === 'done') {
        currentMessageIdRef.current = null;
        setLoading(false);
      } else if (msg.type === 'error') {
        currentMessageIdRef.current = null;
        setLoading(false);
        addMessage({
          id: `err-${Date.now()}`,
          type: 'system',
          content: `Error: ${msg.error ?? msg.content ?? 'Unknown error'}`,
          timestamp: Date.now(),
        });
      }
    },
    [addMessage, appendToLastMessage, setLoading]
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
