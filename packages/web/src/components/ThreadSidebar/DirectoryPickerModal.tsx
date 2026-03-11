import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCatName, useCatData } from '@/hooks/useCatData';
import { apiFetch } from '@/utils/api-client';
import { CatSelector } from './CatSelector';
import { projectDisplayName } from './thread-utils';

/** F33: Session binding passed alongside thread creation */
export interface SessionBinding {
  catId: string;
  cliSessionId: string;
}

/** F095 Phase C: All options collected by the new-thread modal */
export interface NewThreadOptions {
  projectPath?: string;
  preferredCats?: string[];
  sessionBindings?: SessionBinding[];
  title?: string;
  pinned?: boolean;
  backlogItemId?: string;
}

interface BacklogItemSummary {
  id: string;
  title: string;
  status: string;
}

export function DirectoryPickerModal({
  existingProjects,
  onSelect,
  onCancel,
}: {
  existingProjects: string[];
  onSelect: (opts: NewThreadOptions) => void;
  onCancel: () => void;
}) {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [sessionInputs, setSessionInputs] = useState<Record<string, string>>({});
  const [bindExpanded, setBindExpanded] = useState(false);
  const [cwdPath, setCwdPath] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);
  const { getCatById } = useCatData();
  const modalRef = useRef<HTMLDivElement>(null);

  // F095 Phase C: new fields
  const [threadTitle, setThreadTitle] = useState('');
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [backlogItems, setBacklogItems] = useState<BacklogItemSummary[]>([]);
  const [selectedBacklogItemId, setSelectedBacklogItemId] = useState('');

  // Fetch active backlog items for feat dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/backlog/items');
        if (res.ok) {
          const data = await res.json();
          const active = (data.items ?? []).filter(
            (item: BacklogItemSummary) => item.status !== 'done' && item.status !== 'cancelled',
          );
          setBacklogItems(active);
        }
      } catch {
        // ignore — backlog is optional
      }
    })();
  }, []);

  const selectWithOptions = useCallback(
    (projectPath: string | undefined) => {
      const bindings: SessionBinding[] = [];
      for (const [catId, sid] of Object.entries(sessionInputs)) {
        const trimmed = sid.trim();
        if (trimmed && selectedCats.includes(catId)) {
          bindings.push({ catId, cliSessionId: trimmed });
        }
      }
      onSelect({
        projectPath,
        preferredCats: selectedCats.length > 0 ? selectedCats : undefined,
        sessionBindings: bindings.length > 0 ? bindings : undefined,
        title: threadTitle.trim() || undefined,
        pinned: pinOnCreate || undefined,
        backlogItemId: selectedBacklogItemId || undefined,
      });
    },
    [onSelect, selectedCats, sessionInputs, threadTitle, pinOnCreate, selectedBacklogItemId],
  );

  // F068: Open native macOS folder picker via backend osascript
  const pickDirectory = useCallback(async () => {
    setIsPicking(true);
    setPathError(null);
    try {
      const res = await apiFetch('/api/projects/pick-directory', { method: 'POST' });
      if (res.status === 204) return; // User cancelled
      if (!res.ok) {
        const data = await res.json();
        setPathError(data.error || '选择失败');
        return;
      }
      const data = await res.json();
      selectWithOptions(data.path);
    } catch {
      setPathError('无法连接到服务器');
    } finally {
      setIsPicking(false);
    }
  }, [selectWithOptions]);

  // F068: Submit path from text input — validate via browse endpoint before accepting
  const handlePathSubmit = useCallback(async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) return;
    setPathError(null);
    try {
      const res = await apiFetch(`/api/projects/browse?path=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const data = await res.json();
        setPathError(data.error || '路径无效');
        return;
      }
      // Valid directory — use the canonicalized path from server
      const data = await res.json();
      selectWithOptions(data.current);
    } catch {
      setPathError('无法连接到服务器');
    }
  }, [pathInput, selectWithOptions]);

  // Fetch cwd for "推荐" badge
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/projects/cwd');
        if (res.ok) {
          const data = await res.json();
          setCwdPath(data.path);
        }
      } catch {
        // ignore — cwd is optional
      }
    })();
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-close
    <div
      role="presentation"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) onCancel();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-[640px] mx-4 max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cafe-black">新建对话</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* ── F095 Phase C: Thread title ── */}
        <div className="px-5 py-3 border-b border-gray-100">
          <input
            type="text"
            value={threadTitle}
            onChange={(e) => setThreadTitle(e.target.value)}
            placeholder="对话标题（可选）"
            maxLength={200}
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-owner-primary"
          />
        </div>

        {/* ── Cat selector ── */}
        <div className="px-5 py-3 border-b border-gray-100">
          <CatSelector selectedCats={selectedCats} onSelectionChange={setSelectedCats} />
        </div>

        {/* ── F33: Session binding ── */}
        {selectedCats.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setBindExpanded((v) => !v)}
              className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center justify-between transition-colors py-1"
            >
              <span>绑定外部 Session (可选)</span>
              <svg
                aria-hidden="true"
                className={`w-3.5 h-3.5 transition-transform ${bindExpanded ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {bindExpanded && (
              <div className="mt-1.5 space-y-2">
                <p className="text-[10px] text-gray-400">粘贴 Claude Code / Codex 的 Session ID，创建后自动绑定</p>
                {selectedCats.map((catId) => {
                  const cat = getCatById(catId);
                  const label = cat ? formatCatName(cat) : catId;
                  return (
                    <div key={catId} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-16 truncate flex-shrink-0" title={label}>
                        {label}
                      </span>
                      <input
                        value={sessionInputs[catId] ?? ''}
                        onChange={(e) => setSessionInputs((prev) => ({ ...prev, [catId]: e.target.value }))}
                        placeholder="CLI Session ID"
                        maxLength={500}
                        className="flex-1 text-[11px] font-mono px-2 py-1 rounded border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-owner-primary"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── F095 Phase C: Feat association + Pin on create ── */}
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-3">
          {backlogItems.length > 0 && (
            <div className="flex-1 min-w-0">
              <select
                value={selectedBacklogItemId}
                onChange={(e) => setSelectedBacklogItemId(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-owner-primary text-gray-600"
              >
                <option value="">关联 Feature（可选）</option>
                {backlogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={pinOnCreate}
              onChange={(e) => setPinOnCreate(e.target.checked)}
              className="rounded border-gray-300 text-owner-primary focus:ring-owner-primary"
            />
            <span>创建后置顶</span>
          </label>
        </div>

        {/* ── F068: Pick folder button ── */}
        <div className="px-5 pt-4 pb-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={pickDirectory}
            disabled={isPicking}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-owner-primary hover:bg-owner-dark text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {isPicking ? (
              <span className="animate-pulse">等待选择...</span>
            ) : (
              <>
                <FolderOpenIcon />
                <span>选择文件夹...</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-gray-400">打开系统文件选择器，选择项目目录</p>
          {pathError && <p className="text-[10px] text-red-500">{pathError}</p>}
        </div>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 px-5 py-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] text-gray-400">或</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ── F068: Path input ── */}
        <div className="px-5 py-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handlePathSubmit(); }}
              placeholder="输入路径，如 /home/user/projects/..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-owner-primary"
            />
            <button
              type="button"
              onClick={handlePathSubmit}
              disabled={!pathInput.trim()}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-30"
              aria-label="跳转到路径"
            >
              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Quick picks: recent projects ── */}
        <div className="flex-1 overflow-y-auto px-5 py-2 border-t border-gray-100 space-y-1">
          <div className="text-[10px] text-gray-400 font-medium mb-1">最近项目</div>

          {cwdPath && !existingProjects.includes(cwdPath) && (
            <button
              type="button"
              onClick={() => selectWithOptions(cwdPath)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2 ring-1 ring-owner-primary/30 bg-owner-bg/50"
              title={cwdPath}
            >
              <FolderIcon />
              <div className="min-w-0 flex-1">
                <span className="font-medium block truncate">{projectDisplayName(cwdPath)}</span>
                <span className="text-[10px] text-gray-400 block truncate">{cwdPath}</span>
              </div>
              <span className="text-[10px] text-owner-primary flex-shrink-0">推荐</span>
            </button>
          )}

          {existingProjects.map((path) => (
            <button
              type="button"
              key={path}
              onClick={() => selectWithOptions(path)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
              title={path}
            >
              <FolderIcon />
              <div className="min-w-0 flex-1">
                <span className="font-medium block truncate">{projectDisplayName(path)}</span>
                <span className="text-[10px] text-gray-400 block truncate">{path}</span>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => selectWithOptions(undefined)}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-base">🏠</span>
            <span>大厅 (无项目)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`w-4 h-4 flex-shrink-0 ${className ?? ''}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      <path fillRule="evenodd" d="M2 8h16v4a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" clipRule="evenodd" opacity="0.4" />
    </svg>
  );
}
