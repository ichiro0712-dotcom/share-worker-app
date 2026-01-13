'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Power, RotateCcw, Calendar, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface DebugTimeSettings {
  enabled: boolean;
  time: string | null;
}

export default function DebugTimePage() {
  const [settings, setSettings] = useState<DebugTimeSettings>({
    enabled: false,
    time: null
  });
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [realTime, setRealTime] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // リアルタイム時計を更新
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 初期設定を読み込み（ローカルストレージを優先）
  useEffect(() => {
    // ローカルストレージから読み込み（優先）
    const stored = localStorage.getItem('debugTimeSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        if (parsed.time) {
          const date = new Date(parsed.time);
          setDateInput(formatDateForInput(date));
          setTimeInput(formatTimeForInput(date));
        }
        // ローカルストレージに値があればそれを使い、サーバーAPIは呼ばない
        return;
      } catch (e) {
        console.error('Failed to parse debug time settings:', e);
      }
    }

    // ローカルストレージになければサーバーから読み込み
    fetch('/api/debug/time')
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled !== undefined) {
          setSettings(data);
          // ローカルストレージにも保存して同期
          localStorage.setItem('debugTimeSettings', JSON.stringify(data));
          if (data.time) {
            const date = new Date(data.time);
            setDateInput(formatDateForInput(date));
            setTimeInput(formatTimeForInput(date));
          }
        }
      })
      .catch(console.error);
  }, []);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const saveSettings = async (newSettings: DebugTimeSettings) => {
    setSaving(true);
    setMessage(null);

    try {
      // ローカルストレージに保存
      localStorage.setItem('debugTimeSettings', JSON.stringify(newSettings));

      // サーバーにも同期
      const res = await fetch('/api/debug/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      if (!res.ok) throw new Error('Failed to save');

      setSettings(newSettings);
      if (newSettings.enabled) {
        setMessage({ type: 'success', text: 'デバッグ時刻をONにしました。システムはこの時刻で動作します。' });
      } else {
        setMessage({ type: 'success', text: 'デバッグ時刻をOFFにしました。通常の時刻に戻ります。' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // 適用ボタン: 日時を設定してONにする
  const handleApplyAndEnable = () => {
    if (!dateInput || !timeInput) {
      setMessage({ type: 'error', text: '日時を入力してください' });
      return;
    }

    const newTime = new Date(`${dateInput}T${timeInput}:00`).toISOString();
    saveSettings({ enabled: true, time: newTime });
  };

  // OFFボタン: デバッグ時刻を無効化
  const handleDisable = () => {
    saveSettings({ enabled: false, time: settings.time });
  };

  const handleReset = () => {
    const now = new Date();
    setDateInput(formatDateForInput(now));
    setTimeInput(formatTimeForInput(now));
    saveSettings({ enabled: false, time: null });
  };

  const handleQuickSet = (daysOffset: number, hours: number, minutes: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hours, minutes, 0, 0);
    setDateInput(formatDateForInput(date));
    setTimeInput(formatTimeForInput(date));
  };

  // 現在のデバッグ時刻を計算
  const debugTime = settings.enabled && settings.time ? new Date(settings.time) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/system-admin/dev-portal" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">デバッグ時刻設定</h1>
            <p className="text-sm text-gray-500">システムの動作検証用に時刻を変更できます</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* 警告バナー */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">システム管理者専用機能</p>
            <p className="text-sm text-amber-700 mt-1">
              設定した時刻でシステムが動作します。検証後は必ずOFFに戻してください。
            </p>
          </div>
        </div>

        {/* 現在時刻表示 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            時刻情報
          </h2>

          <div className="space-y-4">
            {/* 実際の時刻 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">実際の時刻</p>
                <p className="text-lg font-mono font-medium text-gray-900">
                  {formatDateTime(realTime)}
                </p>
              </div>
            </div>

            {/* デバッグ時刻（ON/OFF表示付き） */}
            <div
              className={`p-4 rounded-lg ${
                settings.enabled
                  ? 'bg-indigo-50 border-2 border-indigo-400'
                  : 'bg-gray-100 border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm text-gray-500">
                      システム時刻 {settings.enabled ? <span className="text-green-600 font-bold">ON</span> : <span className="text-gray-500">OFF</span>}
                    </p>
                    <p
                      className={`text-lg font-mono font-medium ${
                        settings.enabled ? 'text-indigo-700' : 'text-gray-400'
                      }`}
                    >
                      {debugTime ? formatDateTime(debugTime) : '未設定'}
                    </p>
                  </div>
                </div>
                {settings.enabled && (
                  <button
                    onClick={handleDisable}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <Power className="w-4 h-4" />
                    OFF にする
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 時刻設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            デバッグ時刻を設定
          </h2>

          <div className="space-y-4">
            {/* 日付・時刻入力 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時刻</label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* クイック設定ボタン */}
            <div>
              <p className="text-sm text-gray-500 mb-2">クイック設定</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickSet(-2, 18, 0)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  2日前 18:00
                </button>
                <button
                  onClick={() => handleQuickSet(-1, 12, 0)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  昨日 12:00
                </button>
                <button
                  onClick={() => handleQuickSet(0, 6, 0)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  今日 6:00
                </button>
                <button
                  onClick={() => handleQuickSet(0, 23, 59)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  今日 23:59
                </button>
                <button
                  onClick={() => handleQuickSet(1, 9, 0)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  明日 9:00
                </button>
                <button
                  onClick={() => handleQuickSet(7, 12, 0)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  1週間後 12:00
                </button>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleApplyAndEnable}
                disabled={saving || !dateInput || !timeInput}
                className="flex-1 bg-indigo-500 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                この時刻で ON にする
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* メッセージ */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 使い方 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">使い方</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              1. <strong>日付と時刻を設定</strong>：検証したい日時を入力またはクイック選択
            </p>
            <p>
              2. <strong>「この時刻でONにする」を押す</strong>：システムがその時刻で動作開始
            </p>
            <p>
              3. <strong>検証を実行</strong>：求人検索、求人作成制限などを確認
            </p>
            <p>
              4. <strong>「OFFにする」を押す</strong>：実際の時刻に戻る
            </p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>検証できる機能：</strong>
              <br />
              • 求人の日付フィルター（過去の求人が表示されないか）
              <br />
              • 求人作成の4時間ルール（当日の求人作成制限）
              <br />
              • 募集締切の判定
              <br />
              • 日付スライダーの「今日」表示
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
