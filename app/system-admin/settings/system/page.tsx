'use client';

import { useState, useEffect } from 'react';
import { Save, Settings, AlertCircle, CheckCircle } from 'lucide-react';

interface SystemSettings {
  distance_sort_filter_enabled: string;
  distance_sort_default_km: string;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    distance_sort_filter_enabled: 'false',
    distance_sort_default_km: '50',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 設定を読み込む
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/system-admin/system-settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('設定の読み込みに失敗しました:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 設定を保存する
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/system-admin/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '設定を保存しました' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '保存に失敗しました' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-gray-600" />
        <h1 className="text-2xl font-bold">システム設定</h1>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* 距離検索設定セクション */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">距離検索設定</h2>
          <p className="text-sm text-gray-600 mb-6">
            「近い順」ソート時の距離フィルター動作を設定します。
          </p>

          {/* 自動距離フィルター */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.distance_sort_filter_enabled === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    distance_sort_filter_enabled: e.target.checked ? 'true' : 'false',
                  })
                }
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <div className="font-medium">「近い順」ソート時に自動距離フィルターを適用</div>
                <div className="text-sm text-gray-500 mt-1">
                  有効にすると、「近い順」でソートした際に指定範囲内の求人のみ表示されます。
                  <br />
                  無効の場合は、距離でソートするだけで全ての求人が表示されます。
                </div>
              </div>
            </label>
          </div>

          {/* デフォルト距離 */}
          <div className={settings.distance_sort_filter_enabled === 'false' ? 'opacity-50' : ''}>
            <label className="block">
              <div className="font-medium mb-2">デフォルトの検索距離（km）</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={settings.distance_sort_default_km}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      distance_sort_default_km: e.target.value,
                    })
                  }
                  disabled={settings.distance_sort_filter_enabled === 'false'}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100"
                />
                <span className="text-gray-600">km</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                ユーザーが距離を指定していない場合に使用されるデフォルト値です。
              </div>
            </label>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="p-6 bg-gray-50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>

      {/* 説明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">設定の影響について</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• この設定は、ワーカーが求人一覧で「近い順」を選択した際の動作に影響します。</li>
          <li>• 自動距離フィルターが<strong>無効</strong>の場合：全ての求人が距離順で表示されます。</li>
          <li>• 自動距離フィルターが<strong>有効</strong>の場合：デフォルト距離内の求人のみ表示されます。</li>
          <li>• ユーザーが「絞り込み」から距離を明示的に指定した場合は、その設定が優先されます。</li>
        </ul>
      </div>
    </div>
  );
}
