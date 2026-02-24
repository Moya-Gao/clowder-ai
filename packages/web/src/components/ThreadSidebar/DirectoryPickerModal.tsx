import { useCallback, useEffect, useRef, useState } from 'react';
import { formatCatName, useCatData } from '@/hooks/useCatData';
import { apiFetch } from '@/utils/api-client';
import { CatSelector } from './CatSelector';
import { projectDisplayName } from './thread-utils';

interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface BrowseResult {
  current: string;
  name: string;
  parent: string | null;
  entries: DirEntry[];
}

/** F33: Session binding passed alongside thread creation */
export interface SessionBinding {
  catId: string;
  cliSessionId: string;
}

export function DirectoryPickerModal({
  existingProjects,
  onSelect,
  onCancel,
}: {
  existingProjects: string[];
  onSelect: (projectPath: string | undefined, preferredCats?: string[], sessionBindings?: SessionBinding[]) => void;
  onCancel: () => void;
}) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cwdPath, setCwdPath] = useState<string | null>(null);
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  /** F33: Per-cat session ID inputs (catId → cliSessionId) */
  const [sessionInputs, setSessionInputs] = useState<Record<string, string>>({});
  const [bindExpanded, setBindExpanded] = useState(false);
  const { getCatById } = useCatData();
  const modalRef = useRef<HTMLDivElement>(null);

  const selectWithCats = useCallback(
    (projectPath: string | undefined) => {
      // F33: Collect non-empty session bindings
      const bindings: SessionBinding[] = [];
      for (const [catId, sid] of Object.entries(sessionInputs)) {
        const trimmed = sid.trim();
        if (trimmed && selectedCats.includes(catId)) {
          bindings.push({ catId, cliSessionId: trimmed });
        }
      }
      const cats = selectedCats.length > 0 ? selectedCats : undefined;
      // Only pass 3rd arg when bindings exist, to preserve existing call signature
      if (bindings.length > 0) {
        onSelect(projectPath, cats, bindings);
      } else {
        onSelect(projectPath, cats);
      }
    },
    [onSelect, selectedCats, sessionInputs],
  );

  const browseTo = useCallback(async (path?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : '';
      const res = await apiFetch(`/api/projects/browse${params}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to browse');
        return;
      }
      setBrowseData(await res.json());
    } catch {
      setError('无法连接到服务器');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/projects/cwd`);
        if (res.ok) {
          const data = await res.json();
          setCwdPath(data.path);
          await browseTo(data.path);
        } else {
          await browseTo();
        }
      } catch {
        await browseTo();
      }
    })();
  }, [browseTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-close, keyboard Escape handled by useEffect
    <div
      role="presentation"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) onCancel();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] mx-4 max-h-[80vh] flex flex-col overflow-hidden"
      >
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

        {/* ── Cat selector ── */}
        <div className="px-5 py-3 border-b border-gray-100">
          <CatSelector selectedCats={selectedCats} onSelectionChange={setSelectedCats} />
        </div>

        {/* ── F33: Session binding (only shown when cats are selected) ── */}
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

        {/* ── Quick picks: one-tap project selection ── */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-1">
          <div className="text-xs text-gray-500 font-medium mb-1.5">选择项目目录</div>
          {/* Server cwd as recommended project (always present) */}
          {cwdPath && !existingProjects.includes(cwdPath) && (
            <button
              type="button"
              onClick={() => selectWithCats(cwdPath)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2 ring-1 ring-owner-primary/30 bg-owner-bg/50"
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
              onClick={() => selectWithCats(path)}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
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
            onClick={() => selectWithCats(undefined)}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-500 hover:bg-owner-bg rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-base">🏠</span>
            <span>大厅 (无项目)</span>
          </button>
        </div>

        {/* ── Directory browser: collapsed on mobile by default ── */}
        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => setBrowseExpanded((v) => !v)}
            className="w-full px-5 py-2.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors"
          >
            <span>浏览其他目录</span>
            <svg
              aria-hidden="true"
              className={`w-3.5 h-3.5 transition-transform ${browseExpanded ? 'rotate-180' : ''}`}
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

          {browseExpanded && (
            <>
              {browseData && (
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                  <FolderIcon />
                  <span className="truncate" title={browseData.current}>
                    {browseData.current}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectWithCats(browseData.current)}
                    className="ml-auto flex-shrink-0 px-2.5 py-1 rounded-md bg-owner-primary text-white text-xs hover:bg-owner-dark transition-colors"
                  >
                    选择此目录
                  </button>
                </div>
              )}

              {isLoading && <div className="text-center py-8 text-sm text-gray-400">加载中...</div>}
              {error && <div className="text-center py-8 text-sm text-red-400">{error}</div>}

              {browseData && !isLoading && (
                <div className="py-1">
                  {browseData.parent && (
                    <button
                      type="button"
                      onClick={() => {
                        if (browseData.parent) browseTo(browseData.parent);
                      }}
                      className="w-full text-left px-5 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>.. 上级目录</span>
                    </button>
                  )}

                  {browseData.entries.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-300">无子目录</div>
                  )}

                  {browseData.entries.map((entry) => (
                    <button
                      type="button"
                      key={entry.path}
                      onClick={() => browseTo(entry.path)}
                      className="w-full text-left px-5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 group"
                    >
                      <FolderIcon />
                      <span className="truncate">{entry.name}</span>
                      <svg
                        aria-hidden="true"
                        className="w-3 h-3 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        viewBox="0 0 12 12"
                        fill="currentColor"
                      >
                        <path d="M4 2l4 4-4 4V2z" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`w-4 h-4 flex-shrink-0 ${className ?? ''}`}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
    </svg>
  );
}
