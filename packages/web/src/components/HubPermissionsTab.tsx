'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api-client';

interface GroupEntry {
  externalChatId: string;
  label?: string;
  addedAt: number;
}

interface PermissionConfig {
  whitelistEnabled: boolean;
  commandAdminOnly: boolean;
  adminOpenIds: string[];
  allowedGroups: GroupEntry[];
}

const EMPTY_CONFIG: PermissionConfig = {
  whitelistEnabled: false,
  commandAdminOnly: false,
  adminOpenIds: [],
  allowedGroups: [],
};

export default function HubPermissionsTab() {
  const [config, setConfig] = useState<PermissionConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'ok' | 'error' | null>(null);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newAdminId, setNewAdminId] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/connector/permissions/feishu');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // Permission store may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = async (patch: Partial<PermissionConfig>) => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await apiFetch('/api/connector/permissions/feishu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSaveResult('ok');
      } else {
        setSaveResult('error');
      }
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 2000);
    }
  };

  const addGroup = () => {
    if (!newGroupId.trim()) return;
    const updated = [...config.allowedGroups, { externalChatId: newGroupId.trim(), label: newGroupLabel.trim() || undefined, addedAt: Date.now() }];
    saveConfig({ allowedGroups: updated });
    setNewGroupId('');
    setNewGroupLabel('');
  };

  const removeGroup = (chatId: string) => {
    const updated = config.allowedGroups.filter(g => g.externalChatId !== chatId);
    saveConfig({ allowedGroups: updated });
  };

  const addAdmin = () => {
    if (!newAdminId.trim()) return;
    const updated = [...config.adminOpenIds, newAdminId.trim()];
    saveConfig({ adminOpenIds: updated });
    setNewAdminId('');
  };

  const removeAdmin = (openId: string) => {
    const updated = config.adminOpenIds.filter(id => id !== openId);
    saveConfig({ adminOpenIds: updated });
  };

  if (loading) return <div className="p-6 text-gray-400 text-sm">加载权限配置...</div>;

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-400 flex items-center gap-1">
        <span className="text-blue-500 cursor-pointer">飞书 Feishu</span>
        <span>›</span>
        <span>群聊权限</span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-200 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-400">
            🛡️
          </div>
          <div>
            <div className="font-semibold text-sm">群聊权限管理</div>
            <div className="text-xs text-gray-500">控制谁能用 bot、谁能用管理命令</div>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Section 1: Group Whitelist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-bold text-xs">❶</span>
                <span className="font-semibold text-sm">群白名单</span>
              </div>
              <button
                onClick={() => saveConfig({ whitelistEnabled: !config.whitelistEnabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${config.whitelistEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                disabled={saving}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.whitelistEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">开启后，仅白名单内的群可使用 bot</p>

            {config.whitelistEnabled && (
              <div className="space-y-1.5">
                {config.allowedGroups.map(g => (
                  <div key={g.externalChatId} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
                    <span className="text-blue-500">👥</span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                      {g.label || g.externalChatId} {g.label ? <span className="text-gray-400">{g.externalChatId.slice(-8)}</span> : null}
                    </span>
                    <button onClick={() => removeGroup(g.externalChatId)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={newGroupId}
                    onChange={e => setNewGroupId(e.target.value)}
                    placeholder="chat_id"
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  />
                  <input
                    value={newGroupLabel}
                    onChange={e => setNewGroupLabel(e.target.value)}
                    placeholder="群名（可选）"
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  />
                  <button onClick={addGroup} disabled={!newGroupId.trim()} className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg disabled:opacity-40">
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Section 2: Admin List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-xs">❷</span>
              <span className="font-semibold text-sm">管理员</span>
            </div>
            <p className="text-xs text-gray-500">管理员可使用 /allow-group、/deny-group、/new、/use 等管理命令</p>

            <div className="space-y-1.5">
              {config.adminOpenIds.map((id, i) => (
                <div key={id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
                  <span className="text-amber-500">👑</span>
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{id}</span>
                  {i === 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">Owner</span>}
                  <button onClick={() => removeAdmin(id)} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newAdminId}
                  onChange={e => setNewAdminId(e.target.value)}
                  placeholder="open_id (ou_xxxx...)"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  onKeyDown={e => e.key === 'Enter' && addAdmin()}
                />
                <button onClick={addAdmin} disabled={!newAdminId.trim()} className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg disabled:opacity-40">
                  添加
                </button>
              </div>
            </div>
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Section 3: Command Admin Only */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-bold text-xs">❸</span>
                <span className="font-semibold text-sm">群聊命令仅管理员</span>
              </div>
              <button
                onClick={() => saveConfig({ commandAdminOnly: !config.commandAdminOnly })}
                className={`relative w-10 h-5 rounded-full transition-colors ${config.commandAdminOnly ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                disabled={saving}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.commandAdminOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">开启后，非管理员在群聊发 /threads /new /use 会收到提示</p>
            {config.commandAdminOnly && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400">
                <span>⚠️</span>
                <span>非管理员会看到：&quot;此命令仅管理员可用&quot;</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save feedback */}
      {saveResult === 'ok' && <div className="text-xs text-green-600">✅ 已保存</div>}
      {saveResult === 'error' && <div className="text-xs text-red-600">❌ 保存失败</div>}
      {saving && <div className="text-xs text-gray-400">保存中...</div>}
    </div>
  );
}
