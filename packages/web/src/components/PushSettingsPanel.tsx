'use client';

/**
 * Push Notification Settings Panel
 * 推送通知设置 — CatCafeHub "通知" tab
 */

import { usePushNotify } from '@/hooks/usePushNotify';
import { useToastStore } from '@/stores/toastStore';
import { useState } from 'react';

export function PushSettingsPanel() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe, sendTest } = usePushNotify();
  const addToast = useToastStore((s) => s.addToast);
  const [isTesting, setIsTesting] = useState(false);

  const handleSendTest = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const result = await sendTest();
      addToast({
        type: result.ok ? 'success' : 'error',
        title: result.ok ? '系统通知已请求发送' : '系统通知发送失败',
        message: result.message,
        duration: result.ok ? 3000 : 5000,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">推送通知</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">
            当前浏览器不支持推送通知。
          </p>
          <p className="text-xs text-amber-600 mt-1">
            iOS 用户请将 Cat Cafe 添加到主屏幕后再开启推送。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">推送通知</h3>
      <p className="text-xs text-gray-500">
        开启后，猫猫回复、权限请求等会推送到系统通知栏（即使不在 Cat Cafe 页面）。
      </p>

      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {isSubscribed ? '已开启推送' : '推送已关闭'}
          </p>
          <p className="text-xs text-gray-500">
            {isSubscribed ? '猫猫消息会推送到通知栏' : '点击开启接收猫猫推送'}
          </p>
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            isSubscribed
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } disabled:opacity-50`}
        >
          {isLoading ? '...' : isSubscribed ? '关闭' : '开启'}
        </button>
      </div>

      {isSubscribed && (
        <button
          type="button"
          onClick={() => { void handleSendTest(); }}
          disabled={isTesting || isLoading}
          className="text-xs text-blue-500 hover:text-blue-700 underline"
        >
          {isTesting ? '发送中...' : '发送测试通知'}
        </button>
      )}
    </div>
  );
}
