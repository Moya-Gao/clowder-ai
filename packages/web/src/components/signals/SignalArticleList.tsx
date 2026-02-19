import React from 'react';
import type { SignalArticle, SignalArticleStatus } from '@cat-cafe/shared';
import { SignalTierBadge } from './SignalTierBadge';

interface SignalArticleListProps {
  readonly items: readonly SignalArticle[];
  readonly selectedArticleId: string | null;
  readonly onSelect: (article: SignalArticle) => void;
  readonly onStatusChange: (articleId: string, status: SignalArticleStatus) => Promise<void>;
}

const statusClassMap: Record<SignalArticleStatus, string> = {
  inbox: 'text-owner-dark bg-owner-bg',
  read: 'text-gray-600 bg-gray-100',
  archived: 'text-gray-600 bg-gray-100',
  starred: 'text-amber-800 bg-amber-100',
};

function formatDate(input: string): string {
  const value = Date.parse(input);
  if (Number.isNaN(value)) {
    return input;
  }
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SignalArticleList({
  items,
  selectedArticleId,
  onSelect,
  onStatusChange,
}: SignalArticleListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        当前筛选条件下没有文章。
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((article) => {
        const selected = selectedArticleId === article.id;
        return (
          <li key={article.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(article)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(article);
                }
              }}
              className={[
                'w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors',
                selected ? 'border-owner-primary ring-1 ring-owner-primary/40' : 'border-gray-200 hover:border-owner-light',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SignalTierBadge tier={article.tier} />
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusClassMap[article.status]}`}>
                      {article.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-cafe-black">{article.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {article.source} · {formatDate(article.fetchedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onStatusChange(article.id, 'read');
                    }}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-codex-light hover:text-codex-dark"
                  >
                    已读
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onStatusChange(article.id, 'starred');
                    }}
                    className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                  >
                    收藏
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
