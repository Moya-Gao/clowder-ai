'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PawIcon } from './icons/PawIcon';

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
    (msg: { type: string; catId: string; content?: string; error?: string; isFinal?: boolean }) => {
      if (msg.type === 'text' && msg.content) {
        const needNewMessage =
          !currentMessageRef.current ||
          currentMessageRef.current.catId !== msg.catId;

        if (needNewMessage) {
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
          appendToLastMessage(msg.content);
        }
      } else if (msg.type === 'done') {
        if (currentMessageRef.current) {
          setStreaming(currentMessageRef.current.id, false);
        }
        if (msg.isFinal) {
          setLoading(false);
        }
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (content: string) => {
      currentMessageRef.current = null;

      addMessage({
        id: `user-${Date.now()}`,
        type: 'user',
        content,
        timestamp: Date.now(),
      });

      setLoading(true);

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
      <header className="border-b border-owner-light px-5 py-3 bg-owner-bg flex items-center gap-2">
        <PawIcon className="w-6 h-6 text-owner-primary" />
        <div>
          <h1 className="text-lg font-bold text-cafe-black">Cat Cafe</h1>
          <p className="text-xs text-gray-500">三只 AI 猫猫的协作空间</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center mt-20">
            <PawIcon className="w-12 h-12 text-owner-light mx-auto mb-4" />
            <p className="text-lg text-gray-500 mb-1">欢迎来到 Cat Cafe!</p>
            <p className="text-sm text-gray-400">输入 @布偶 召唤布偶猫开始聊天</p>
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
