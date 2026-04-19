'use client';

import { useCallback, useEffect, useState } from 'react';

interface CommunityIssueItem {
  id: string;
  repo: string;
  issueNumber: number;
  issueType: string;
  title: string;
  state: string;
  replyState: string;
  consensusState?: string;
  assignedThreadId: string | null;
  updatedAt: number;
}

interface PrBoardItem {
  taskId: string;
  threadId: string;
  title: string;
  status: string;
  group: string;
  updatedAt: number;
}

interface BoardData {
  repo: string;
  issues: CommunityIssueItem[];
  prItems: PrBoardItem[];
}

const ISSUE_SECTIONS = [
  { key: 'unreplied', label: '未回复' },
  { key: 'discussing', label: '讨论中' },
  { key: 'pending-decision', label: '待决策' },
  { key: 'accepted', label: '已接受' },
  { key: 'declined', label: '已拒绝' },
  { key: 'closed', label: '已关闭' },
] as const;

const PR_SECTIONS = [
  { key: 'in-review', label: '审核中' },
  { key: 're-review-needed', label: '需重审' },
  { key: 'has-conflict', label: '有冲突' },
  { key: 'completed', label: '已完成' },
] as const;

const ISSUE_STATE_COLORS: Record<string, string> = {
  unreplied: 'text-cafe-accent',
  discussing: 'text-cafe-crosspost',
  'pending-decision': 'text-amber-600',
  accepted: 'text-green-600',
  declined: 'text-cafe-muted',
  closed: 'text-gray-400',
};

const PR_GROUP_COLORS: Record<string, string> = {
  'in-review': 'text-cafe-crosspost',
  're-review-needed': 'text-amber-600',
  'has-conflict': 'text-cafe-accent',
  completed: 'text-green-600',
};

const TYPE_ICONS: Record<string, JSX.Element> = {
  bug: (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  ),
  feature: (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  enhancement: (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18M3 12h18" />
    </svg>
  ),
  question: (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
};

const PR_ICON = (
  <svg
    className="w-3 h-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 012 2v7M6 9v12" />
  </svg>
);

const SYNC_ICON = (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16" />
  </svg>
);

const AUTO_REFRESH_MS = 5 * 60 * 1000;

function SectionHeader({
  label,
  count,
  color,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  color: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-cafe-surface-elevated/50 transition-colors"
    >
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
      <span className="text-[10px] text-cafe-muted bg-cafe-surface-elevated rounded-full px-1.5 py-0.5">{count}</span>
      <span className="ml-auto text-[10px] text-cafe-muted">{collapsed ? '▸' : '▾'}</span>
    </button>
  );
}

function IssueRow({ item }: { item: CommunityIssueItem }) {
  const color = ISSUE_STATE_COLORS[item.state] ?? 'text-cafe-muted';
  const icon = TYPE_ICONS[item.issueType] ?? TYPE_ICONS.question;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-cafe-surface-elevated/30 cursor-pointer text-xs">
      <span className={color}>{icon}</span>
      <span className="text-cafe-muted text-[10px]">#{item.issueNumber}</span>
      <span className="truncate flex-1 text-cafe-secondary">{item.title}</span>
      {item.replyState === 'unreplied' && (
        <span className="text-[9px] text-cafe-accent bg-cafe-accent/10 px-1 rounded">未回复</span>
      )}
    </div>
  );
}

function PrRow({ item }: { item: PrBoardItem }) {
  const color = PR_GROUP_COLORS[item.group] ?? 'text-cafe-muted';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-cafe-surface-elevated/30 cursor-pointer text-xs">
      <span className={color}>{PR_ICON}</span>
      <span className="truncate flex-1 text-cafe-secondary">{item.title}</span>
      <span className="text-[10px] text-cafe-muted">{item.status}</span>
    </div>
  );
}

export function CommunityPanel() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState('zts212653/clowder-ai');
  const [collapsedIssues, setCollapsedIssues] = useState<Record<string, boolean>>({
    accepted: true,
    declined: true,
  });
  const [collapsedPrs, setCollapsedPrs] = useState<Record<string, boolean>>({
    completed: true,
  });

  const fetchBoard = useCallback(async () => {
    if (!repo) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/community-board?repo=${encodeURIComponent(repo)}`);
      if (res.ok) {
        setBoard(await res.json());
      }
    } catch {
      /* network error — keep stale data */
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    fetchBoard();
    const timer = setInterval(fetchBoard, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchBoard]);

  const issuesByState = (state: string) => board?.issues.filter((i) => i.state === state) ?? [];

  const prsByGroup = (group: string) => board?.prItems.filter((p) => p.group === group) ?? [];

  const totalIssues = board?.issues.length ?? 0;
  const totalPrs = board?.prItems.length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cocreator-light/40">
        <input
          type="text"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/repo"
          className="flex-1 text-xs bg-cafe-surface rounded px-2 py-1 border border-cocreator-light/30 text-cafe-secondary"
        />
        <button
          type="button"
          onClick={fetchBoard}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-cocreator-dark/60 hover:text-cocreator-dark transition-colors disabled:opacity-50"
          title="手动同步"
        >
          <span className={loading ? 'animate-spin' : ''}>{SYNC_ICON}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-cafe-muted border-b border-cocreator-light/20">
        <span>Issues: {totalIssues}</span>
        <span>PRs: {totalPrs}</span>
        {loading && <span className="text-cafe-crosspost">同步中...</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!board && !loading ? (
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <h3 className="text-sm font-semibold text-cafe-secondary mb-1">社区管理看板</h3>
            <p className="text-xs text-cafe-muted leading-relaxed">
              输入仓库地址后点击同步，查看社区 issue 和 PR 状态。
            </p>
          </div>
        ) : (
          <>
            {/* Issues */}
            <div className="border-b border-cocreator-light/20">
              <div className="px-3 py-1.5 text-[10px] font-bold text-cafe-muted uppercase tracking-wider">Issues</div>
              {ISSUE_SECTIONS.map((sec) => {
                const items = issuesByState(sec.key);
                const isCollapsed = collapsedIssues[sec.key] ?? false;
                return (
                  <div key={sec.key}>
                    <SectionHeader
                      label={sec.label}
                      count={items.length}
                      color={ISSUE_STATE_COLORS[sec.key] ?? 'text-cafe-muted'}
                      collapsed={isCollapsed}
                      onToggle={() => setCollapsedIssues((p) => ({ ...p, [sec.key]: !p[sec.key] }))}
                    />
                    {!isCollapsed && items.map((item) => <IssueRow key={item.id} item={item} />)}
                  </div>
                );
              })}
            </div>

            {/* PRs */}
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold text-cafe-muted uppercase tracking-wider">
                Pull Requests
              </div>
              {PR_SECTIONS.map((sec) => {
                const items = prsByGroup(sec.key);
                const isCollapsed = collapsedPrs[sec.key] ?? false;
                return (
                  <div key={sec.key}>
                    <SectionHeader
                      label={sec.label}
                      count={items.length}
                      color={PR_GROUP_COLORS[sec.key] ?? 'text-cafe-muted'}
                      collapsed={isCollapsed}
                      onToggle={() => setCollapsedPrs((p) => ({ ...p, [sec.key]: !p[sec.key] }))}
                    />
                    {!isCollapsed && items.map((item) => <PrRow key={item.taskId} item={item} />)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
