import React from 'react';
import type { ProfileItem, ProfileTestResult } from './hub-provider-profiles.types';

interface HubProviderProfileItemProps {
  profile: ProfileItem;
  isActive: boolean;
  busy: boolean;
  testResult?: ProfileTestResult;
  onActivate: (profileId: string) => void;
  onEdit: (profile: ProfileItem) => void;
  onTest: (profileId: string) => void;
  onDelete: (profileId: string) => void;
}

export function HubProviderProfileItem({
  profile,
  isActive,
  busy,
  testResult,
  onActivate,
  onEdit,
  onTest,
  onDelete,
}: HubProviderProfileItemProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{profile.name}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{profile.mode}</span>
            {isActive && <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">active</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {profile.mode === 'api_key'
              ? `baseUrl: ${profile.baseUrl ?? '(未设置)'} · apiKey: ${profile.hasApiKey ? '已配置' : '未配置'}`
              : '走本机订阅登录态（不使用 API key）'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {!isActive && (
            <button
              type="button"
              className="px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs hover:bg-blue-50"
              onClick={() => onActivate(profile.id)}
              disabled={busy}
            >
              激活
            </button>
          )}
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 text-gray-700 text-xs hover:bg-gray-50"
            onClick={() => onEdit(profile)}
            disabled={busy}
          >
            编辑
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded border border-indigo-200 text-indigo-700 text-xs hover:bg-indigo-50"
            onClick={() => onTest(profile.id)}
            disabled={busy}
          >
            测试
          </button>
          {profile.id !== 'anthropic-subscription-default' && (
            <button
              type="button"
              className="px-2 py-1 rounded border border-red-200 text-red-700 text-xs hover:bg-red-50"
              onClick={() => onDelete(profile.id)}
              disabled={busy}
            >
              删除
            </button>
          )}
        </div>
      </div>

      {testResult && (
        <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-700' : 'text-red-600'}`}>
          {testResult.ok
            ? `测试通过${testResult.status ? ` (HTTP ${testResult.status})` : ''}`
            : `测试失败${testResult.status ? ` (HTTP ${testResult.status})` : ''}${testResult.error ? `: ${testResult.error}` : ''}`}
        </p>
      )}
    </div>
  );
}
