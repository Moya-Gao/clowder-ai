import Link from 'next/link';
import { PawIcon } from './icons/PawIcon';
import { ExportButton } from './ExportButton';

interface ChatContainerHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  threadId: string;
  authPendingCount: number;
  viewMode: 'single' | 'split';
  onToggleViewMode: () => void;
  onOpenMobileStatus: () => void;
  statusPanelOpen: boolean;
  onToggleStatusPanel: () => void;
}

export function ChatContainerHeader({
  sidebarOpen,
  onToggleSidebar,
  threadId,
  authPendingCount,
  viewMode,
  onToggleViewMode,
  onOpenMobileStatus,
  statusPanelOpen,
  onToggleStatusPanel,
}: ChatContainerHeaderProps) {
  return (
    <header className="border-b border-owner-light bg-owner-bg safe-area-top">
      <div className="px-5 py-3 flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-lg hover:bg-owner-light transition-colors mr-1"
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <PawIcon className="w-6 h-6 text-owner-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-cafe-black">Cat Cafe</h1>
          <p className="text-xs text-gray-500">三只 AI 猫猫的协作空间</p>
        </div>
        <ExportButton threadId={threadId} />
        <Link
          href="/signals"
          className="p-1 rounded-lg hover:bg-owner-light transition-colors"
          title="Signal Inbox"
          aria-label="Signal Inbox"
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 3.636a1 1 0 010 1.414 7 7 0 000 9.9 1 1 0 11-1.414 1.414 9 9 0 010-12.728 1 1 0 011.414 0zm9.9 0a9 9 0 010 12.728 1 1 0 01-1.414-1.414 7 7 0 000-9.9 1 1 0 011.414-1.414zM7.879 6.464a1 1 0 010 1.414 3 3 0 000 4.243 1 1 0 11-1.415 1.414 5 5 0 010-7.07 1 1 0 011.415 0zm4.242 0a5 5 0 010 7.072 1 1 0 01-1.415-1.415 3 3 0 000-4.242 1 1 0 011.415-1.415zM10 9a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
          </svg>
        </Link>
        {authPendingCount > 0 && (
          <span
            className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse-subtle"
            title={`${authPendingCount} 个授权请求等待处理`}
          >
            🔐 {authPendingCount}
          </span>
        )}
        <button
          onClick={onToggleViewMode}
          className="p-1 rounded-lg hover:bg-owner-light transition-colors hidden md:block"
          aria-label={viewMode === 'single' ? '切换分屏模式' : '切换单屏模式'}
          title={viewMode === 'single' ? '分屏模式' : '单屏模式'}
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            {viewMode === 'single' ? (
              <>
                <rect x="2" y="2" width="7" height="7" rx="1" />
                <rect x="11" y="2" width="7" height="7" rx="1" />
                <rect x="2" y="11" width="7" height="7" rx="1" />
                <rect x="11" y="11" width="7" height="7" rx="1" />
              </>
            ) : (
              <rect x="2" y="2" width="16" height="16" rx="2" />
            )}
          </svg>
        </button>
        {/* Mobile/tablet: status sheet trigger */}
        <button
          onClick={onOpenMobileStatus}
          className="p-1 rounded-lg hover:bg-owner-light transition-colors ml-1 lg:hidden"
          aria-label="打开状态面板"
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
        {/* Desktop: status sidebar toggle */}
        <button
          onClick={onToggleStatusPanel}
          className="p-1 rounded-lg hover:bg-owner-light transition-colors ml-1 hidden lg:block"
          aria-label={statusPanelOpen ? 'Hide status panel' : 'Show status panel'}
        >
          <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 0v12h10V4H5z" clipRule="evenodd" />
            {statusPanelOpen && <rect x="12" y="4" width="4" height="12" rx="0.5" opacity="0.3" />}
          </svg>
        </button>
      </div>
    </header>
  );
}
