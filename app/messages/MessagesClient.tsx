'use client';

import { useState, useEffect, useRef } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { ChevronLeft, Send, Paperclip, Calendar, Search, Bell } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getMessages, sendMessage } from '@/src/lib/actions';

interface Message {
  id: number;
  senderType: 'worker' | 'facility';
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Conversation {
  applicationId: number;
  facilityId: number;
  facilityName: string;
  jobId: number;
  jobTitle: string;
  jobDate: string;
  status: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

interface ChatData {
  application: {
    id: number;
    status: string;
    jobId: number;
    jobTitle: string;
    jobDate: string;
    facilityId: number;
    facilityName: string;
  };
  messages: Message[];
}

interface Notification {
  id: number;
  title: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'system' | 'announcement';
}

type TabType = 'messages' | 'notifications';
type SortType = 'newest' | 'workDate';

interface MessagesClientProps {
  initialConversations: Conversation[];
}

export default function MessagesClient({ initialConversations }: MessagesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations] = useState<Conversation[]>(initialConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // お知らせ（ダミーデータ）
  const [notifications] = useState<Notification[]>([
    {
      id: 1,
      title: 'システムメンテナンスのお知らせ',
      content: '2025年12月1日(日) 2:00-5:00の間、システムメンテナンスを実施いたします。',
      timestamp: '2025-11-20 10:00',
      isRead: false,
      type: 'system',
    },
    {
      id: 2,
      title: '新機能追加のお知らせ',
      content: 'メッセージ機能が強化されました。検索・ソート機能をご利用いただけます。',
      timestamp: '2025-11-18 14:00',
      isRead: true,
      type: 'announcement',
    },
  ]);

  // URLパラメータからapplicationIdまたはfacilityIdを取得して自動的に開く
  useEffect(() => {
    if (selectedConversation) return;

    const appId = searchParams.get('applicationId');
    const facilityId = searchParams.get('facilityId');

    if (appId) {
      const conv = conversations.find((c) => c.applicationId === parseInt(appId, 10));
      if (conv) {
        handleSelectConversation(conv);
      }
    } else if (facilityId) {
      // facilityIdで検索し、最新のメッセージを持つ会話を開く
      const conv = conversations
        .filter((c) => c.facilityId === parseInt(facilityId, 10))
        .sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime())[0];
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [searchParams, conversations, selectedConversation]);

  // メッセージ一覧の最下部にスクロール
  useEffect(() => {
    if (chatData) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatData]);

  // 会話を選択してメッセージを取得
  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsLoading(true);

    try {
      const data = await getMessages(conversation.applicationId);
      if (data) {
        setChatData(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // メッセージを送信
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    const content = messageInput.trim();
    setMessageInput('');

    try {
      const result = await sendMessage(selectedConversation.applicationId, content);

      if (result.success && result.message) {
        // 送信成功：メッセージを追加
        setChatData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...prev.messages, result.message!],
          };
        });
      } else {
        // 送信失敗：入力を復元
        setMessageInput(content);
        alert(result.error || 'メッセージの送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageInput(content);
      alert('メッセージの送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setChatData(null);
    router.push('/messages');
  };

  // 検索・ソート処理
  const filteredAndSortedConversations = conversations
    .filter((conv) => conv.facilityName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortType === 'newest') {
        return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
      } else {
        const dateA = new Date(a.jobDate).getTime();
        const dateB = new Date(b.jobDate).getTime();
        return dateB - dateA;
      }
    });

  // メッセージ時間をフォーマット
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  // チャットルーム一覧表示
  if (!selectedConversation) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
          </div>

          {/* タブ */}
          <div className="flex border-t border-gray-200">
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'messages'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500'
              }`}
            >
              メッセージ
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notifications'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500'
              }`}
            >
              お知らせ
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'messages' ? (
          <>
            {/* 検索・ソート */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="施設名で検索"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <select
                  value={sortType}
                  onChange={(e) => setSortType(e.target.value as SortType)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="newest">新着順</option>
                  <option value="workDate">勤務日順</option>
                </select>
              </div>
            </div>

            {/* 会話一覧 */}
            <div className="divide-y divide-gray-200">
              {filteredAndSortedConversations.map((conv) => (
                <button
                  key={conv.applicationId}
                  onClick={() => handleSelectConversation(conv)}
                  className="w-full bg-white hover:bg-gray-50 px-4 py-4 text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* 施設アイコン */}
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-lg">
                        {conv.facilityName.charAt(0)}
                      </span>
                    </div>

                    {/* メッセージ情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 truncate">{conv.facilityName}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{conv.lastMessageTime}</span>
                          {conv.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 求人情報 */}
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                        <Calendar className="w-3 h-3" />
                        <span>{conv.jobDate}</span>
                        <span>・</span>
                        <span>{conv.jobTitle}</span>
                      </div>

                      {/* 最終メッセージ */}
                      <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                    </div>
                  </div>
                </button>
              ))}

              {/* 空の状態 */}
              {filteredAndSortedConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Send className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-center">
                    {searchQuery
                      ? '検索結果が見つかりませんでした'
                      : conversations.length === 0
                        ? '求人に応募するとメッセージが表示されます'
                        : 'メッセージはまだありません'}
                  </p>
                  {conversations.length === 0 && (
                    <button
                      onClick={() => router.push('/')}
                      className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      求人を探す
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* お知らせ一覧 */
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div key={notification.id} className="bg-white px-4 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notification.type === 'system' ? 'bg-blue-100' : 'bg-green-100'
                    }`}
                  >
                    <Bell
                      className={`w-5 h-5 ${
                        notification.type === 'system' ? 'text-blue-600' : 'text-green-600'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className={`font-bold text-sm ${
                          notification.isRead ? 'text-gray-700' : 'text-gray-900'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {notification.timestamp.split(' ')[0].replace('2025-', '')}
                        </span>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </div>
                    </div>

                    <p
                      className={`text-sm ${
                        notification.isRead ? 'text-gray-500' : 'text-gray-700'
                      }`}
                    >
                      {notification.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-center">お知らせはありません</p>
              </div>
            )}
          </div>
        )}

        <BottomNav />
      </div>
    );
  }

  // チャット画面
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">
              {chatData?.application.facilityName || selectedConversation.facilityName}
            </h2>
            <p className="text-xs text-gray-600 truncate">
              {chatData?.application.jobTitle || selectedConversation.jobTitle} -{' '}
              {chatData?.application.jobDate || selectedConversation.jobDate}
            </p>
          </div>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : chatData?.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Send className="w-12 h-12 mb-2 text-gray-300" />
            <p>まだメッセージはありません</p>
            <p className="text-sm">施設からの連絡をお待ちください</p>
          </div>
        ) : (
          chatData?.messages.map((message) => {
            const isWorker = message.senderType === 'worker';
            return (
              <div key={message.id} className={`flex ${isWorker ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] ${
                    isWorker ? 'bg-primary text-white' : 'bg-white border border-gray-200'
                  } rounded-2xl px-4 py-2`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${isWorker ? 'text-white/70' : 'text-gray-500'}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="メッセージを入力"
              className="w-full bg-transparent border-none outline-none text-sm"
              disabled={isSending}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
            className={`p-2 rounded-full transition-colors ${
              messageInput.trim() && !isSending
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
