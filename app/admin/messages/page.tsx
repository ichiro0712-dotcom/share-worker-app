'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Send,
  Info,
  Calendar,
  Award,
  ChevronDown,
  Loader2,
  User,
  Bell,
  Megaphone,
} from 'lucide-react';
import {
  getFacilityConversations,
  getFacilityMessages,
  sendFacilityMessage,
} from '@/src/lib/actions';
import {
  getFacilityAnnouncements,
  markAnnouncementAsRead,
} from '@/src/lib/system-actions';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'unread' | 'scheduled' | 'completed' | 'office';

interface Conversation {
  applicationId: number;
  userId: number;
  userName: string;
  userProfileImage: string | null;
  userQualifications: string[];
  jobId: number;
  jobTitle: string;
  jobDate: string;
  status: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

interface Message {
  id: number;
  senderType: 'facility' | 'worker';
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface ApplicationDetails {
  id: number;
  status: string;
  userId: number;
  userName: string;
  userProfileImage: string | null;
  userQualifications: string[];
  jobId: number;
  jobTitle: string;
  jobDate: string;
  jobStartTime: string;
  jobEndTime: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  publishedAt: Date | null;
  isRead: boolean;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialApplicationId = searchParams.get('id');
  const { admin, isAdmin, isAdminLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(
    initialApplicationId ? parseInt(initialApplicationId) : null
  );
  const [currentApplication, setCurrentApplication] = useState<ApplicationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showVariables, setShowVariables] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);

  // お知らせ関連
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // 会話一覧を読み込む
  useEffect(() => {
    const loadConversations = async () => {
      if (!admin?.facilityId) return;

      setIsLoading(true);
      try {
        const data = await getFacilityConversations(admin.facilityId);
        setConversations(data);

        // URLパラメータで指定されていれば選択
        if (initialApplicationId && !selectedApplicationId) {
          setSelectedApplicationId(parseInt(initialApplicationId));
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
        toast.error('会話一覧の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [admin?.facilityId, initialApplicationId]);

  // お知らせを読み込む（初期ロード時に取得して「すべて」でも未読バッジ表示）
  useEffect(() => {
    const loadAnnouncements = async () => {
      if (!admin?.facilityId) return;

      setAnnouncementsLoading(true);
      try {
        const data = await getFacilityAnnouncements(admin.facilityId);
        setAnnouncements(data);
      } catch (error) {
        console.error('Failed to load announcements:', error);
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    loadAnnouncements();
  }, [admin?.facilityId]);

  // 本文内のURLをクリック可能なリンクに変換する
  // linkColorStyle: 'default' | 'light' - lightは白文字背景用（施設からのメッセージ内など）
  const renderContentWithLinks = (content: string, linkColorStyle: 'default' | 'light' = 'default') => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = content.split(urlRegex);

    const linkClassName = linkColorStyle === 'light'
      ? 'text-white/90 underline hover:text-white break-all'
      : 'text-admin-primary underline hover:text-admin-primary-dark break-all';

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // 選択された会話のメッセージを読み込む
  useEffect(() => {
    const loadMessages = async () => {
      if (!admin?.facilityId || !selectedApplicationId) {
        setMessages([]);
        setCurrentApplication(null);
        return;
      }

      try {
        const data = await getFacilityMessages(selectedApplicationId, admin.facilityId);
        if (data) {
          setCurrentApplication(data.application);
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        toast.error('メッセージの読み込みに失敗しました');
      }
    };

    loadMessages();
  }, [admin?.facilityId, selectedApplicationId]);

  // フィルタリングされた会話リスト
  const filteredConversations = conversations.filter((conv) => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return conv.unreadCount > 0;
    if (filterType === 'scheduled') return conv.status === 'SCHEDULED';
    if (filterType === 'completed') return conv.status.includes('COMPLETED');
    if (filterType === 'office') return false; // 事務局フィルター時は会話を表示しない
    return true;
  });

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedApplicationId || !admin?.facilityId) return;

    setIsSending(true);
    try {
      const result = await sendFacilityMessage(
        selectedApplicationId,
        admin.facilityId,
        messageText
      );

      if (result.success && result.message) {
        setMessages((prev) => [...prev, result.message]);
        setMessageText('');

        // 会話一覧も更新
        setConversations((prev) =>
          prev.map((conv) =>
            conv.applicationId === selectedApplicationId
              ? { ...conv, lastMessage: messageText, lastMessageTime: '今' }
              : conv
          )
        );
      } else {
        toast.error(result.error || 'メッセージの送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('メッセージの送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageText(messageText + variable);
  };

  // お知らせを既読にする
  const handleReadAnnouncement = async (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    if (!announcement.isRead && admin?.facilityId) {
      await markAnnouncementAsRead(announcement.id, 'FACILITY', admin.facilityId);
      setAnnouncements(prev =>
        prev.map(a => a.id === announcement.id ? { ...a, isRead: true } : a)
      );
    }
  };

  // フィルタ変更時にリセット
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    if (newFilter === 'office') {
      setSelectedApplicationId(null);
      setCurrentApplication(null);
      setSelectedAnnouncement(null);
    } else {
      setSelectedAnnouncement(null);
    }
  };

  // お知らせ日時をフォーマット
  const formatAnnouncementDate = (date: Date | null | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  // カテゴリー別のスタイル
  const getCategoryStyle = (category: string) => {
    switch (category) {
      case 'IMPORTANT':
        return { bg: 'bg-red-100', text: 'text-red-600', label: '重要' };
      case 'MAINTENANCE':
        return { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'メンテナンス' };
      case 'EVENT':
        return { bg: 'bg-green-100', text: 'text-green-600', label: 'イベント' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'ニュース' };
    }
  };

  const unreadAnnouncementsCount = announcements.filter(a => !a.isRead).length;

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-admin-primary" />
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* 会話リスト / お知らせリスト */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3">メッセージ</h2>
          <select
            value={filterType}
            onChange={(e) => handleFilterChange(e.target.value as FilterType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary focus:border-transparent"
          >
            <option value="all">すべて</option>
            <option value="unread">未読のみ</option>
            <option value="scheduled">勤務予定</option>
            <option value="completed">完了</option>
            <option value="office">事務局から {unreadAnnouncementsCount > 0 && `(${unreadAnnouncementsCount})`}</option>
          </select>
        </div>

        {/* 会話リスト or お知らせリスト */}
        <div className="flex-1 overflow-y-auto">
          {filterType === 'office' ? (
            // 事務局からのお知らせ一覧
            announcementsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-admin-primary" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>事務局からのお知らせはありません</p>
              </div>
            ) : (
              announcements.map((announcement) => {
                const categoryStyle = getCategoryStyle(announcement.category);
                return (
                  <div
                    key={announcement.id}
                    onClick={() => handleReadAnnouncement(announcement)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedAnnouncement?.id === announcement.id ? 'bg-admin-primary-light' : ''
                    } ${!announcement.isRead ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${categoryStyle.bg}`}>
                        {announcement.category === 'IMPORTANT' ? (
                          <Bell className={`w-5 h-5 ${categoryStyle.text}`} />
                        ) : (
                          <Megaphone className={`w-5 h-5 ${categoryStyle.text}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryStyle.bg} ${categoryStyle.text}`}>
                            {categoryStyle.label}
                          </span>
                          {!announcement.isRead && (
                            <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <h3 className={`font-medium text-sm truncate ${announcement.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                          {announcement.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatAnnouncementDate(announcement.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // 通常の会話一覧（「すべて」の場合はお知らせも統合表示）
            (() => {
              // お知らせを会話形式に変換
              const announcementItems = (filterType === 'all' ? announcements : []).map((a) => ({
                type: 'announcement' as const,
                id: `announcement-${a.id}`,
                announcement: a,
                timestamp: a.publishedAt ? new Date(a.publishedAt).getTime() : 0,
                isUnread: !a.isRead,
              }));

              // 通常の会話をアイテム形式に変換
              const conversationItems = filteredConversations.map((conv) => ({
                type: 'conversation' as const,
                id: `conversation-${conv.applicationId}`,
                conversation: conv,
                timestamp: conv.lastMessageTimestamp ? new Date(conv.lastMessageTimestamp).getTime() : 0,
                isUnread: conv.unreadCount > 0,
              }));

              // 統合してソート（未読を優先、その後は新しい順）
              const allItems = [...announcementItems, ...conversationItems].sort((a, b) => {
                // 未読を優先
                if (a.isUnread && !b.isUnread) return -1;
                if (!a.isUnread && b.isUnread) return 1;
                // 同じ未読状態なら新しい順
                return b.timestamp - a.timestamp;
              });

              if (allItems.length === 0) {
                return (
                  <div className="p-8 text-center text-gray-500">
                    <p>メッセージはありません</p>
                  </div>
                );
              }

              return allItems.map((item) => {
                if (item.type === 'announcement') {
                  const announcement = item.announcement;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedApplicationId(null);
                        handleReadAnnouncement(announcement);
                      }}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedAnnouncement?.id === announcement.id ? 'bg-admin-primary-light' : ''
                      } ${!announcement.isRead ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                          <Megaphone className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900 truncate">運営事務局</h3>
                            {!announcement.isRead && (
                              <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-xs text-indigo-600 mb-1">お知らせ</p>
                          <p className="text-sm text-gray-600 truncate">{announcement.title}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatAnnouncementDate(announcement.publishedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const conv = item.conversation;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedAnnouncement(null);
                        setSelectedApplicationId(conv.applicationId);
                      }}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedApplicationId === conv.applicationId ? 'bg-admin-primary-light' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">
                          {conv.userProfileImage ? (
                            <img
                              src={conv.userProfileImage}
                              alt={conv.userName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900 truncate">{conv.userName}</h3>
                            {conv.unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{conv.jobTitle}</p>
                          <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                          <p className="text-xs text-gray-400 mt-1">{conv.lastMessageTime}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
              });
            })()
          )}
        </div>
      </div>

      {/* チャット画面 / お知らせ詳細 */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedAnnouncement ? (
          // お知らせ詳細（事務局フィルターでも、すべてフィルターでも表示）
          <div className="flex-1 flex flex-col">
            {/* お知らせヘッダー */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-indigo-600">運営事務局</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryStyle(selectedAnnouncement.category).bg} ${getCategoryStyle(selectedAnnouncement.category).text}`}>
                      {getCategoryStyle(selectedAnnouncement.category).label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatAnnouncementDate(selectedAnnouncement.publishedAt)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900">{selectedAnnouncement.title}</h3>
                </div>
              </div>
            </div>

            {/* お知らせ本文（チャット風に表示） */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="flex justify-start">
                <div className="max-w-lg bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {renderContentWithLinks(selectedAnnouncement.content)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatAnnouncementDate(selectedAnnouncement.publishedAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* お知らせには返信不可のメッセージ */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm text-gray-500 text-center">
                このお知らせは運営事務局からの一方向の通知です
              </p>
            </div>
          </div>
        ) : filterType === 'office' ? (
          // 事務局フィルターでお知らせ未選択時
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>お知らせを選択して内容を表示</p>
            </div>
          </div>
        ) : currentApplication ? (
          <>
            {/* チャットヘッダー */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {currentApplication.userProfileImage ? (
                    <img
                      src={currentApplication.userProfileImage}
                      alt={currentApplication.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{currentApplication.userName}</h3>
                  <p className="text-xs text-gray-500">{currentApplication.jobTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserInfo(!showUserInfo)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Info className="w-4 h-4" />
                {showUserInfo ? '情報を非表示' : '情報を表示'}
              </button>
            </div>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>メッセージはありません</p>
                    <p className="text-sm mt-2">最初のメッセージを送信しましょう</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderType === 'facility' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${message.senderType === 'facility'
                          ? 'bg-admin-primary text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                          }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {renderContentWithLinks(message.content, message.senderType === 'facility' ? 'light' : 'default')}
                        </p>
                        <p
                          className={`text-xs mt-1 ${message.senderType === 'facility'
                            ? 'text-admin-primary-light'
                            : 'text-gray-400'
                            }`}
                        >
                          {new Date(message.timestamp).toLocaleString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 入力エリア */}
            <div className="border-t border-gray-200 bg-white">
              <div className="px-4 pt-3 pb-1">
                <button
                  onClick={() => setShowVariables(!showVariables)}
                  className="text-sm text-green-600 hover:text-green-700 transition-colors font-medium"
                >
                  利用できる変数
                  <ChevronDown
                    className={`w-3 h-3 inline-block ml-1 transition-transform ${showVariables ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {/* 変数パネル */}
                {showVariables && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                    <div>
                      <button
                        onClick={() => insertVariable('[ワーカー名字]')}
                        className="text-blue-700 hover:underline font-mono"
                      >
                        [ワーカー名字]
                      </button>
                      <span className="text-gray-700">: ワーカーの名字に変換されます</span>
                    </div>
                    <div>
                      <button
                        onClick={() => insertVariable('[施設名]')}
                        className="text-blue-700 hover:underline font-mono"
                      >
                        [施設名]
                      </button>
                      <span className="text-gray-700">: 施設名に変換されます</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 pt-2 flex gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="メッセージを入力..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending}
                  className="px-4 py-2 bg-admin-primary text-white rounded-lg hover:bg-admin-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>会話を選択してメッセージを開始</p>
          </div>
        )}
      </div>

      {/* ユーザー情報パネル */}
      {currentApplication && showUserInfo && !selectedAnnouncement && (
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">ワーカー情報</h3>

            {/* 顔写真と基本情報 */}
            <div className="text-center mb-6">
              <div className="relative inline-block mb-3">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {currentApplication.userProfileImage ? (
                    <img
                      src={currentApplication.userProfileImage}
                      alt={currentApplication.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              </div>
              <h4 className="font-bold text-gray-900 text-lg mt-3">
                {currentApplication.userName}
              </h4>
            </div>

            {/* 詳細情報 */}
            <div className="space-y-4">
              {/* 資格 */}
              <div>
                <h5 className="text-sm font-bold text-gray-900 mb-2">資格</h5>
                <div className="flex flex-wrap gap-2">
                  {currentApplication.userQualifications.length > 0 ? (
                    currentApplication.userQualifications.map((qual, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                      >
                        <Award className="w-3 h-3" />
                        <span>{qual}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">未登録</p>
                  )}
                </div>
              </div>

              {/* 勤務予定 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <h5 className="text-sm font-bold text-gray-900">勤務情報</h5>
                </div>
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-gray-700">{currentApplication.jobTitle}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(currentApplication.jobDate).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {currentApplication.jobStartTime} 〜 {currentApplication.jobEndTime}
                  </p>
                  <p className="text-sm text-gray-500">
                    ステータス: {currentApplication.status}
                  </p>
                </div>
              </div>

              {/* ワーカー詳細ページへのリンク */}
              <div className="pt-4 border-t border-gray-200">
                <a
                  href={`/admin/workers/${currentApplication.userId}`}
                  className="block w-full px-4 py-2 text-center text-admin-primary border border-admin-primary rounded-lg hover:bg-admin-primary-light transition-colors text-sm"
                >
                  ワーカー詳細を見る
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
