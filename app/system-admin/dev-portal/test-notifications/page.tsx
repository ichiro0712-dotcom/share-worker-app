'use client';

import { useState, useCallback, useRef } from 'react';
import { searchUsersForNotification, sendTestAnnouncement } from '@/src/lib/actions/test-notification';
import {
  Search, Send, Bell, Mail, MessageCircle,
  CheckCircle, AlertCircle, X, User, Building2,
  AlertTriangle, Loader2,
} from 'lucide-react';

type NotificationTab = 'push' | 'email' | 'chat';

interface SearchableUser {
  id: number;
  name: string;
  email: string;
  userType: 'worker' | 'facility_admin';
  pushSubscriptionCount: number;
  facilityName?: string;
  facilityId?: number;
}

interface SendResult {
  success: boolean;
  message: string;
  details?: any;
}

const TAB_CONFIG = [
  { key: 'push' as const, label: 'プッシュ通知', icon: Bell, color: 'blue' },
  { key: 'email' as const, label: 'メール', icon: Mail, color: 'green' },
  { key: 'chat' as const, label: 'チャット', icon: MessageCircle, color: 'purple' },
];

export default function TestNotificationsPage() {
  // 検索状態
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'worker' | 'facility_admin'>('all');
  const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchableUser | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // タブ状態
  const [activeTab, setActiveTab] = useState<NotificationTab>('push');

  // フォーム状態 - プッシュ
  const [pushTitle, setPushTitle] = useState('+タスタス');
  const [pushMessage, setPushMessage] = useState('');
  const [pushUrl, setPushUrl] = useState('/');

  // フォーム状態 - メール
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // フォーム状態 - チャット
  const [chatMessage, setChatMessage] = useState('');

  // 送信状態
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // ユーザー検索（デバウンス付き）
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setResult(null);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersForNotification(query, userTypeFilter);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [userTypeFilter]);

  // ユーザー選択
  const handleSelectUser = (user: SearchableUser) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery('');
    setEmailTo(user.email);
    setResult(null);
  };

  // ユーザー選択解除
  const handleClearUser = () => {
    setSelectedUser(null);
    setEmailTo('');
    setResult(null);
  };

  // プッシュ通知送信
  const handleSendPush = async () => {
    if (!selectedUser || !pushMessage.trim()) return;
    setIsSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          userType: selectedUser.userType,
          title: pushTitle || '+タスタス',
          message: pushMessage,
          url: pushUrl || '/',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        setResult({
          success: successCount > 0,
          message: `プッシュ通知送信完了: ${successCount}/${totalCount} デバイスに成功`,
          details: data.results,
        });
      } else {
        // APIエラーを日本語に変換
        let errorMessage = '送信に失敗しました';
        if (res.status === 404 || data.error === 'No subscriptions found') {
          errorMessage = 'このユーザーにはプッシュ通知の購読が登録されていません。ユーザーが通知を許可していないか、購読が期限切れ/削除済みです。';
        } else if (res.status === 401) {
          errorMessage = 'システム管理者の認証が必要です。ログインし直してください。';
        } else if (res.status === 500 && data.error === 'VAPID keys are not configured') {
          errorMessage = 'VAPID鍵が設定されていません。環境変数を確認してください。';
        } else if (data.error) {
          errorMessage = data.error;
        }
        setResult({ success: false, message: errorMessage });
      }
    } catch (error: any) {
      setResult({ success: false, message: `通信エラー: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  // メール送信
  const handleSendEmail = async () => {
    if (!selectedUser || !emailTo.trim()) return;
    setIsSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/system-admin/test-notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject || undefined,
          body: emailBody || undefined,
          recipientId: selectedUser.id,
          targetType: selectedUser.userType === 'worker' ? 'WORKER' : 'FACILITY',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `メール送信成功（${emailTo}）`,
          details: { messageId: data.messageId },
        });
      } else {
        let errorMessage = 'メール送信に失敗しました';
        if (res.status === 401) {
          errorMessage = 'システム管理者の認証が必要です。ログインし直してください。';
        } else if (data.error?.includes('RESEND_API_KEY')) {
          errorMessage = 'メール送信サービス（Resend）のAPIキーが設定されていません。';
        } else if (data.error) {
          errorMessage = data.error;
        }
        setResult({ success: false, message: errorMessage });
      }
    } catch (error: any) {
      setResult({ success: false, message: `通信エラー: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  // チャット（お知らせ）送信
  const handleSendChat = async () => {
    if (!selectedUser || !chatMessage.trim()) return;
    setIsSending(true);
    setResult(null);

    try {
      const targetType = selectedUser.userType === 'worker' ? 'WORKER' : 'FACILITY';
      const recipientId = selectedUser.id;

      const data = await sendTestAnnouncement({
        targetType: targetType as 'WORKER' | 'FACILITY',
        recipientId,
        content: chatMessage,
      });

      if (data.success) {
        setResult({
          success: true,
          message: `お知らせ送信成功（ID: ${data.announcementId}）`,
          details: { announcementId: data.announcementId },
        });
      } else {
        setResult({ success: false, message: data.error || 'お知らせ送信に失敗しました' });
      }
    } catch (error: any) {
      setResult({ success: false, message: `通信エラー: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    switch (activeTab) {
      case 'push': return handleSendPush();
      case 'email': return handleSendEmail();
      case 'chat': return handleSendChat();
    }
  };

  const isSendDisabled = !selectedUser || isSending || (
    activeTab === 'push' ? !pushMessage.trim() :
    activeTab === 'email' ? !emailTo.trim() :
    !chatMessage.trim()
  );

  return (
    <div className="p-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">テスト通知送信</h1>
        <p className="text-sm text-gray-500 mt-1">
          ユーザーを選択して、プッシュ通知・メール・チャットのテスト送信を行います
        </p>
      </div>

      {/* 注意バナー */}
      <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>注意:</strong> 実際のユーザーに通知が送信されます。テスト用アカウントで確認することを推奨します。
        </div>
      </div>

      {/* ユーザー検索セクション */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">送信先ユーザー</h2>

        {selectedUser ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              selectedUser.userType === 'worker' ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              {selectedUser.userType === 'worker'
                ? <User className="w-4 h-4 text-blue-600" />
                : <Building2 className="w-4 h-4 text-green-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">
                {selectedUser.name}
                <span className="ml-2 text-xs text-gray-500">ID: {selectedUser.id}</span>
              </div>
              <div className="text-sm text-gray-500">
                {selectedUser.email}
                {selectedUser.facilityName && (
                  <span className="ml-2">({selectedUser.facilityName})</span>
                )}
              </div>
              <div className="text-xs mt-0.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                  selectedUser.userType === 'worker'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {selectedUser.userType === 'worker' ? 'ワーカー' : '施設管理者'}
                </span>
                <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                  selectedUser.pushSubscriptionCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <Bell className="w-3 h-3" />
                  Push購読: {selectedUser.pushSubscriptionCount}件
                </span>
              </div>
            </div>
            <button
              onClick={handleClearUser}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="ID・名前・メールアドレスで検索..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
              <select
                value={userTypeFilter}
                onChange={(e) => {
                  setUserTypeFilter(e.target.value as any);
                  if (searchQuery) handleSearch(searchQuery);
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="worker">ワーカー</option>
                <option value="facility_admin">施設管理者</option>
              </select>
            </div>

            {/* 検索結果 */}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">種別</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">名前</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">メール</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Push</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {searchResults.map((user) => (
                      <tr key={`${user.userType}-${user.id}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{user.id}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                            user.userType === 'worker'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {user.userType === 'worker' ? 'W' : 'F'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {user.name}
                          {user.facilityName && (
                            <span className="block text-xs text-gray-400">{user.facilityName}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{user.email}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs ${user.pushSubscriptionCount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {user.pushSubscriptionCount}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleSelectUser(user)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            選択
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 mt-2">該当するユーザーが見つかりません</p>
            )}
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setResult(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 space-y-4">
          {/* プッシュ通知タブ */}
          {activeTab === 'push' && (
            <>
              {selectedUser && selectedUser.pushSubscriptionCount === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <span className="text-sm text-amber-800">
                    このユーザーにはプッシュ通知の購読がありません。通知は届きません。
                  </span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="+タスタス"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="テスト通知です"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">遷移先URL</label>
                <input
                  type="text"
                  value={pushUrl}
                  onChange={(e) => setPushUrl(e.target.value)}
                  placeholder="/"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* メールタブ */}
          {activeTab === 'email' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">宛先 <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">件名</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="【テスト】+タスタス メール送信テスト"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本文</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="これはテストメールです。"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
            </>
          )}

          {/* チャットタブ */}
          {activeTab === 'chat' && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                「運営からのお知らせ」として送信されます。ユーザーのお知らせ一覧に即時表示されます。
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ <span className="text-red-500">*</span></label>
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="テストメッセージです。"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
            </>
          )}

          {/* 送信ボタン */}
          <div className="pt-2">
            <button
              onClick={handleSend}
              disabled={isSendDisabled}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSending ? '送信中...' : 'テスト送信'}
            </button>
          </div>

          {/* 結果表示 */}
          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {result.success
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <AlertCircle className="w-5 h-5 text-red-600" />}
                <span className={`font-medium text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </span>
              </div>
              {result.details && (
                <pre className="mt-2 text-xs bg-white/60 p-2 rounded overflow-auto max-h-40 text-gray-700">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
