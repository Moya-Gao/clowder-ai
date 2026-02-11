'use client';

import { useState } from 'react';
import { apiFetch } from '@/utils/api-client';

export function ExportImageButton({ threadId }: { threadId: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/threads/${threadId}/export-image`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string; message?: string };
        throw new Error(errorData.message || errorData.error || '导出失败');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${threadId}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
      title="导出对话为长图"
    >
      <span>{loading ? '📸' : '📸'}</span>
      <span>{loading ? '导出中...' : '导出长图'}</span>
    </button>
  );
}
