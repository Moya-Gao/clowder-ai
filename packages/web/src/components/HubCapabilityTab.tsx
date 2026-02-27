'use client';

/**
 * HubCapabilityTab — F041 能力看板 tab
 *
 * 展示所有 MCP 工具 + Skills，支持全局/每猫开关。
 */

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

interface CapabilityBoardItem {
  id: string;
  type: 'mcp' | 'skill';
  source: 'cat-cafe' | 'external';
  enabled: boolean;
  cats: Record<string, boolean>;
  description?: string;
}

type FilterType = 'all' | 'mcp' | 'skill';
type FilterSource = 'all' | 'cat-cafe' | 'external';

export function HubCapabilityTab() {
  const [items, setItems] = useState<CapabilityBoardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchCapabilities = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/capabilities');
      if (!res.ok) {
        setError('能力列表加载失败');
        return;
      }
      const data = await res.json() as CapabilityBoardItem[];
      setItems(data);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCapabilities(); }, [fetchCapabilities]);

  const handleToggle = useCallback(async (
    capabilityId: string,
    scope: 'global' | 'cat',
    enabled: boolean,
    catId?: string,
  ) => {
    setToggling(capabilityId);
    try {
      const res = await apiFetch('/api/capabilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId, scope, enabled, catId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        setError((data.error as string) ?? `开关失败 (${res.status})`);
        return;
      }
      await fetchCapabilities();
    } catch {
      setError('网络错误');
    } finally {
      setToggling(null);
    }
  }, [fetchCapabilities]);

  const filtered = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterSource !== 'all' && item.source !== filterSource) return false;
    return true;
  });

  const catIds = items.length > 0
    ? Object.keys(items[0]!.cats).sort()
    : [];

  if (loading) return <p className="text-sm text-gray-400">加载中...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <FilterChips
          label="类型"
          value={filterType}
          options={[
            { value: 'all', label: '全部' },
            { value: 'mcp', label: 'MCP' },
            { value: 'skill', label: 'Skill' },
          ]}
          onChange={(v) => setFilterType(v as FilterType)}
        />
        <FilterChips
          label="来源"
          value={filterSource}
          options={[
            { value: 'all', label: '全部' },
            { value: 'cat-cafe', label: 'Cat Cafe' },
            { value: 'external', label: '外部' },
          ]}
          onChange={(v) => setFilterSource(v as FilterSource)}
        />
      </div>

      {/* Capability table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">名称</th>
              <th className="text-center px-3 py-2 font-medium w-16">类型</th>
              <th className="text-center px-3 py-2 font-medium w-16">来源</th>
              <th className="text-center px-3 py-2 font-medium w-16">全局</th>
              {catIds.map((catId) => (
                <th key={catId} className="text-center px-2 py-2 font-medium w-16">
                  {catId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4 + catIds.length} className="text-center py-6 text-gray-400">
                  无匹配能力
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                  <td className="text-center px-3 py-2">
                    <TypeBadge type={item.type} />
                  </td>
                  <td className="text-center px-3 py-2">
                    <SourceBadge source={item.source} />
                  </td>
                  <td className="text-center px-3 py-2">
                    {item.type === 'mcp' ? (
                      <ToggleSwitch
                        enabled={item.enabled}
                        disabled={toggling === item.id}
                        onChange={(v) => handleToggle(item.id, 'global', v)}
                      />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  {catIds.map((catId) => (
                    <td key={catId} className="text-center px-2 py-2">
                      {item.type === 'mcp' ? (
                        <ToggleSwitch
                          enabled={item.cats[catId] ?? false}
                          disabled={toggling === item.id}
                          onChange={(v) => handleToggle(item.id, 'cat', v, catId)}
                        />
                      ) : (
                        <span className={item.cats[catId] ? 'text-green-500' : 'text-gray-300'}>
                          {item.cats[catId] ? 'Y' : '-'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        共 {items.length} 项能力 (MCP: {items.filter((i) => i.type === 'mcp').length},
        Skill: {items.filter((i) => i.type === 'skill').length})
      </p>
    </div>
  );
}

// ────────── Sub-components ──────────

function FilterChips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">{label}:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            value === opt.value
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: 'mcp' | 'skill' }) {
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${
      type === 'mcp' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {type.toUpperCase()}
    </span>
  );
}

function SourceBadge({ source }: { source: 'cat-cafe' | 'external' }) {
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${
      source === 'cat-cafe' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {source === 'cat-cafe' ? 'cafe' : 'ext'}
    </span>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`w-8 h-4 rounded-full relative transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-green-400' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
          enabled ? 'left-4' : 'left-0.5'
        }`}
      />
    </button>
  );
}
