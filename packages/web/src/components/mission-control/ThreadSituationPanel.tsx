'use client';

import Link from 'next/link';
import type { BacklogItem, CatId } from '@cat-cafe/shared';

interface ThreadSituationSummary {
  id: string;
  title?: string;
  lastActiveAt: number;
  participants: CatId[];
  backlogItemId?: string;
}

interface ThreadSituationPanelProps {
  dispatchedItems: BacklogItem[];
  loading: boolean;
  threadsByBacklogId: Record<string, ThreadSituationSummary>;
}

function formatLastActive(lastActiveAt: number): string {
  const delta = Date.now() - lastActiveAt;
  if (delta < 60_000) return `${Math.max(1, Math.floor(delta / 1_000))} 秒前`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return `${Math.floor(delta / 86_400_000)} 天前`;
}

export function ThreadSituationPanel({
  dispatchedItems,
  loading,
  threadsByBacklogId,
}: ThreadSituationPanelProps) {
  return (
    <section
      className="min-h-0 rounded-2xl border border-[#E7DAC7] bg-[#FFFDF8] p-3"
      data-testid="mc-thread-situation"
    >
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-[#2C2118]">线程态势</h2>
        <p className="text-[11px] text-[#7B6956]">Dispatched 项的执行面状态一览</p>
      </div>

      {dispatchedItems.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#DDCCB5] px-2 py-2 text-[11px] text-[#8B7864]">
          暂无执行中的 backlog 项
        </p>
      )}

      {dispatchedItems.length > 0 && loading && (
        <p className="rounded-lg border border-dashed border-[#DDCCB5] px-2 py-2 text-[11px] text-[#8B7864]">
          加载线程态势中...
        </p>
      )}

      <div className="space-y-2">
        {dispatchedItems.map((item) => {
          const thread = threadsByBacklogId[item.id];
          if (!thread) {
            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#EADFCF] bg-[#FFF9F0] px-2.5 py-2"
                data-testid={`mc-thread-situation-item-${item.id}`}
              >
                <p className="text-xs font-semibold text-[#4B3A2A]">{item.title}</p>
                <p className="mt-1 text-[11px] text-[#8B7864]">
                  暂无可关联 thread（可能刚派发，稍后刷新可见）
                </p>
              </article>
            );
          }

          return (
            <article
              key={item.id}
              className="rounded-xl border border-[#EADFCF] bg-[#FFF9F0] px-2.5 py-2"
              data-testid={`mc-thread-situation-item-${item.id}`}
            >
              <p className="text-xs font-semibold text-[#4B3A2A]">{item.title}</p>
              <p className="mt-1 text-[11px] text-[#6E5A46]">
                Thread：{thread.title || thread.id}
              </p>
              <p className="text-[11px] text-[#6E5A46]">
                最近活跃：{formatLastActive(thread.lastActiveAt)}
              </p>
              <p className="text-[11px] text-[#6E5A46]">
                参与猫：{thread.participants.length > 0 ? thread.participants.join(', ') : '暂无'}
              </p>
              <Link
                href={`/thread/${thread.id}`}
                className="mt-1 inline-flex text-[11px] font-medium text-[#245EA8] underline-offset-2 hover:underline"
                data-testid={`mc-thread-situation-link-${item.id}`}
              >
                打开 thread
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
