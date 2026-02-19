import React from 'react';
import type { SignalArticleStatus } from '@cat-cafe/shared';
import type { SignalArticleDetail } from '@/utils/signals-api';
import { SignalTierBadge } from './SignalTierBadge';

interface SignalArticleDetailProps {
  readonly article: SignalArticleDetail | null;
  readonly isLoading: boolean;
  readonly onStatusChange: (articleId: string, status: SignalArticleStatus) => Promise<void>;
}

function formatDate(input: string): string {
  const value = Date.parse(input);
  if (Number.isNaN(value)) {
    return input;
  }
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SignalArticleDetail({ article, isLoading, onStatusChange }: SignalArticleDetailProps) {
  if (isLoading) {
    return (
      <aside className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
        正在加载文章详情...
      </aside>
    );
  }

  if (!article) {
    return (
      <aside className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        选择一篇文章查看详情。
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SignalTierBadge tier={article.tier} />
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{article.status}</span>
      </div>
      <h2 className="mt-2 text-lg font-semibold text-cafe-black">{article.title}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {article.source} · {formatDate(article.fetchedAt)}
      </p>
      <p className="mt-2 break-all text-xs text-gray-500">{article.url}</p>
      {article.summary && (
        <section className="mt-4 rounded-lg border border-owner-light bg-owner-bg p-3">
          <h3 className="text-xs font-semibold text-owner-dark">AI 摘要</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-cafe-black">{article.summary}</p>
        </section>
      )}
      <section className="mt-4">
        <h3 className="text-xs font-semibold text-gray-600">正文</h3>
        <p className="mt-1 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-sm text-cafe-black">
          {article.content || '（无正文）'}
        </p>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'inbox')}
          className="rounded-md border border-owner-light px-3 py-1.5 text-xs text-owner-dark hover:bg-owner-bg"
        >
          设为 Inbox
        </button>
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'read')}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          标记已读
        </button>
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'starred')}
          className="rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
        >
          收藏
        </button>
      </div>
    </aside>
  );
}
