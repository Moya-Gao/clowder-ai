import type { TreeNode } from '@/hooks/useWorkspace';
import { DirIcon, FileIcon } from './FileIcons';

const CiteIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M1.5 2.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H5L2.5 11.5V9h-1a1 1 0 0 1-1-1V2.5Z" />
    <path d="M13.5 5v4a1 1 0 0 1-1 1H12v2.5L9.5 10H7a1 1 0 0 1-1-1" opacity="0.5" />
  </svg>
);

function TreeItem({
  node,
  depth,
  onSelect,
  onCite,
  expandedPaths,
  toggleExpand,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (path: string) => void;
  onCite?: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  selectedPath: string | null;
}) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;

  return (
    <div className={depth > 0 ? 'animate-fade-in' : ''}>
      <div className="group flex items-center relative">
        <button
          type="button"
          onClick={() => (isDir ? toggleExpand(node.path) : onSelect(node.path))}
          className={`flex-1 text-left py-1 text-xs flex items-center gap-1.5 rounded-md transition-colors duration-100 truncate relative ${
            isSelected ? 'bg-owner-light/60 text-owner-dark font-medium' : 'hover:bg-owner-bg text-cafe-black/80'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '28px' }}
          title={node.path}
        >
          {depth > 0 && (
            <span className="absolute left-0 top-0 bottom-0 pointer-events-none" aria-hidden>
              {Array.from({ length: depth }, (_, i) => `${i * 16 + 14}px`).map((left) => (
                <span key={left} className="absolute top-0 bottom-0 w-px bg-owner-light/50" style={{ left }} />
              ))}
            </span>
          )}
          <span
            className={`w-3 flex items-center justify-center flex-shrink-0 transition-transform duration-150 ${isDir && isExpanded ? 'rotate-90' : ''}`}
          >
            {isDir && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="currentColor"
                className="text-owner-dark/40"
                aria-hidden="true"
              >
                <path d="M2.5 1L6 4L2.5 7" strokeWidth="1" />
              </svg>
            )}
          </span>
          {isDir ? <DirIcon expanded={isExpanded} /> : <FileIcon name={node.name} />}
          <span className="truncate">{node.name}</span>
        </button>
        {!isDir && onCite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCite(node.path);
            }}
            className="absolute right-1 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-owner-dark/40 hover:text-owner-primary hover:bg-owner-light/60 transition-all"
            title="引用到聊天"
          >
            <CiteIcon />
          </button>
        )}
      </div>
      {isDir && isExpanded && (
        <div className="relative">
          {node.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onCite={onCite}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeSkeleton() {
  return (
    <div className="px-3 py-2 space-y-2">
      {[120, 90, 140, 80, 110, 100, 70].map((w, idx) => (
        <div
          key={`skel-${w}`}
          className="h-4 rounded-md animate-shimmer"
          style={{
            width: `${w}px`,
            marginLeft: `${(idx % 3) * 12}px`,
            background:
              'linear-gradient(90deg, var(--color-owner-light) 25%, rgba(255,221,210,0.3) 50%, var(--color-owner-light) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

export function WorkspaceTree({
  tree,
  loading,
  expandedPaths,
  toggleExpand,
  onSelect,
  onCite,
  selectedPath,
  hasFile,
  basisPct,
}: {
  tree: TreeNode[];
  loading: boolean;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onCite?: (path: string) => void;
  selectedPath: string | null;
  hasFile: boolean;
  basisPct?: number;
}) {
  return (
    <div
      className="overflow-y-auto py-1 min-h-0"
      style={
        hasFile && basisPct != null ? { flexBasis: `${basisPct}%`, flexGrow: 0, flexShrink: 0 } : { flex: '1 1 0%' }
      }
    >
      {loading && tree.length === 0 ? (
        <TreeSkeleton />
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <span className="text-2xl mb-2">🐾</span>
          <p className="text-xs text-owner-dark/50">还没有文件树</p>
          <p className="text-[10px] text-owner-dark/30 mt-1">选择一个 worktree 开始浏览</p>
        </div>
      ) : (
        tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            onSelect={onSelect}
            onCite={onCite}
            expandedPaths={expandedPaths}
            toggleExpand={toggleExpand}
            selectedPath={selectedPath}
          />
        ))
      )}
    </div>
  );
}
