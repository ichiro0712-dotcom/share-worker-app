'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Send, Paperclip, Calendar, Search, Bell, Megaphone, X, FileText, Image as ImageIcon, Loader2, Check, AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendMessageToFacility } from '@/src/lib/actions';
import { getWorkerAnnouncements, markAnnouncementAsRead } from '@/src/lib/system-actions';
import { useBadge } from '@/contexts/BadgeContext';
import { directUpload } from '@/utils/directUpload';
import { useConversations, useMessagesByFacility, useAnnouncements, type Message, type Conversation, type MessagesResponse } from '@/hooks/useMessages';
import { MessagesSkeleton, ConversationsSkeleton } from '@/components/MessagesSkeleton';
import { preload } from 'swr';


interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  publishedAt: Date | null;
  isRead: boolean;
}

type TabType = 'messages' | 'notifications';
type SortType = 'newest' | 'workDate';

// SWRプリフェッチ用fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface MessagesClientProps {
  initialConversations?: Conversation[]; // Optional for SWR fallback if wanted
  userId: number;
}

export default function MessagesClient({ initialConversations, userId }: MessagesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { decrementMessages, decrementAnnouncements } = useBadge();

  // SWRでデータ取得（SSRで取得したinitialConversationsをfallbackとして使用）
  const {
    conversations,
    isLoading: isConversationsLoading,
    mutate: mutateConversations
  } = useConversations(initialConversations);

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const {
    chatData: swrChatData,
    isLoading: isChatLoading,
    mutate: mutateMessages
  } = useMessagesByFacility(selectedConversation?.facilityId || null);

  // ローカルでのメッセージ追加用（即時反映のため）
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const chatData = useMemo(() => {
    if (!swrChatData) return null;
    // 重複を避けつつマージ
    const messageIds = new Set(swrChatData.messages.map(m => m.id));
    const filteredLocal = localMessages.filter(m => !messageIds.has(m.id));
    return {
      ...swrChatData,
      messages: [...swrChatData.messages, ...filteredLocal]
    };
  }, [swrChatData, localMessages]);

  const [messageInput, setMessageInput] = useState('');
  const initialTab = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab && ['messages', 'notifications'].includes(initialTab)
      ? initialTab
      : 'messages'
  );

  const updateUrlParams = (tab: TabType) => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'messages') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.replace(`/messages?${params.toString()}`, { scroll: false });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ページネーション用state (SWRとは別に管理)
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // 会話選択時のスクロール制御用（同じ会話を再選択した時はスクロールしない）
  const lastSelectedFacilityIdRef = useRef<number | null>(null);

  // 過去メッセージ読み込み用の追記用
  const [extraPastMessages, setExtraPastMessages] = useState<Message[]>([]);

  // お知らせ
  const {
    announcements,
    isLoading: announcementsLoading,
    mutate: mutateAnnouncements
  } = useAnnouncements();

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // お知らせを開く（既読にして詳細表示）
  const handleOpenAnnouncement = async (announcement: any) => {
    if (!announcement.isRead) {
      await markAnnouncementAsRead(announcement.id, 'WORKER', userId);
      mutateAnnouncements();
      // バッジを減らす
      decrementAnnouncements(1);
    }
    setSelectedAnnouncement({ ...announcement, isRead: true });
  };

  // お知らせ詳細から戻る
  const handleBackFromAnnouncement = () => {
    setSelectedAnnouncement(null);
  };

  // URLパラメータからfacilityIdを取得して自動的に開く
  useEffect(() => {
    if (selectedConversation) return;

    const facilityId = searchParams.get('facilityId');

    if (facilityId) {
      // facilityIdで検索
      const conv = conversations.find((c) => c.facilityId === parseInt(facilityId, 10));
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [searchParams, conversations, selectedConversation]);

  // 初期ロード完了時に最下部にスクロール（新しい会話を選んだ時のみ）
  useEffect(() => {
    if (!isInitialLoad && chatData && messagesEndRef.current) {
      // 同じ会話を再選択した場合（フッターメニュー再クリックなど）はスクロールしない
      const currentFacilityId = selectedConversation?.facilityId || null;
      if (lastSelectedFacilityIdRef.current !== currentFacilityId) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        lastSelectedFacilityIdRef.current = currentFacilityId;
      }
    }
  }, [isInitialLoad, selectedConversation, chatData]);

  // 会話を選択
  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setLocalMessages([]);
    setExtraPastMessages([]);
    setIsInitialLoad(true);
    setCursor(null);
    setHasMore(false);

    // バッジを減らす
    if (conversation.unreadCount > 0) {
      decrementMessages(conversation.unreadCount);
      mutateConversations(); // リストを更新
    }
  };

  // SWRでデータが来た時の初期処理
  useEffect(() => {
    if (swrChatData && isInitialLoad) {
      setCursor(swrChatData.nextCursor);
      setHasMore(swrChatData.hasMore);
      setIsInitialLoad(false);
    }
  }, [swrChatData, isInitialLoad]);

  // 過去メッセージを読み込む
  const loadMoreMessages = async () => {
    if (!selectedConversation || !cursor || isLoadingMore || !hasMore) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;

    try {
      const res = await fetch(`/api/messages/detail?facilityId=${selectedConversation.facilityId}&cursor=${cursor}&markAsRead=false`);
      if (!res.ok) throw new Error('Failed to load more');
      const data: MessagesResponse = await res.json();
      if (data) {
        const newMessages: Message[] = data.messages.map(m => ({
          ...m,
          attachments: m.attachments || [],
          senderType: m.senderType as 'worker' | 'facility',
          timestamp: new Date(m.createdAt).toISOString(),
          jobDate: m.jobDate ? new Date(m.jobDate).toISOString() : null,
        }));
        // 過去メッセージを先頭に追加
        setExtraPastMessages(prev => [...newMessages, ...prev]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);

        // スクロール位置を維持
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 上スクロール検知
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMore || !hasMore) return;

    // 上端に近づいたら追加読み込み（100px以内）
    if (container.scrollTop < 100) {
      loadMoreMessages();
    }
  };

  // メッセージを送信（LINEライク楽観的更新）
  const handleSendMessage = async () => {
    // テキストか添付ファイルのどちらかが必要
    if ((!messageInput.trim() && pendingAttachments.length === 0) || !selectedConversation || isSending) return;

    setIsSending(true);
    const content = messageInput.trim();
    const attachmentsToSend = [...pendingAttachments];
    const tempId = -Date.now(); // 一時ID（負の値で本物と区別）
    const facilityId = selectedConversation.facilityId;

    // 楽観的更新：即座にUIに表示（送信中状態）
    const tempMessage: Message = {
      id: tempId,
      applicationId: swrChatData?.applicationIds[0] || 0,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      attachments: attachmentsToSend,
      jobTitle: '',
      jobDate: null,
      senderType: 'worker',
      senderName: '自分',
      isRead: false,
      content: content,
      sendStatus: 'sending',
      _retryData: { facilityId, content, attachments: attachmentsToSend },
    };

    setLocalMessages(prev => [...prev, tempMessage]);
    setMessageInput('');
    setPendingAttachments([]);

    try {
      const result = await sendMessageToFacility(facilityId, content, attachmentsToSend);

      if (result.success && result.message) {
        // 成功：一時メッセージを本物に置き換え
        setLocalMessages(prev => prev.map(m =>
          m.id === tempId
            ? {
              ...m,
              id: result.message!.id,
              timestamp: result.message!.timestamp,
              createdAt: result.message!.timestamp,
              sendStatus: 'sent' as const,
              _retryData: undefined,
            }
            : m
        ));
        mutateConversations();
        mutateMessages();
      } else {
        // 失敗：失敗状態に更新（UIに残して再送可能に）
        console.error('[Message] Send failed:', result.error);
        setLocalMessages(prev => prev.map(m =>
          m.id === tempId
            ? { ...m, sendStatus: 'failed' as const }
            : m
        ));
      }
    } catch (error) {
      console.error('[Message] Send error:', error);
      // エラー：失敗状態に更新
      setLocalMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, sendStatus: 'failed' as const }
          : m
      ));
    } finally {
      setIsSending(false);
    }
  };

  // 失敗したメッセージを再送信
  const handleRetryMessage = async (message: Message) => {
    if (!message._retryData || message.sendStatus !== 'failed') return;

    const { facilityId, content, attachments } = message._retryData;
    const tempId = message.id;

    // 送信中状態に更新
    setLocalMessages(prev => prev.map(m =>
      m.id === tempId ? { ...m, sendStatus: 'sending' as const } : m
    ));

    try {
      const result = await sendMessageToFacility(facilityId, content, attachments);

      if (result.success && result.message) {
        // 成功
        setLocalMessages(prev => prev.map(m =>
          m.id === tempId
            ? {
              ...m,
              id: result.message!.id,
              timestamp: result.message!.timestamp,
              createdAt: result.message!.timestamp,
              sendStatus: 'sent' as const,
              _retryData: undefined,
            }
            : m
        ));
        mutateConversations();
        mutateMessages();
      } else {
        // 失敗
        setLocalMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, sendStatus: 'failed' as const } : m
        ));
      }
    } catch (error) {
      console.error('[Message] Retry failed:', error);
      setLocalMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, sendStatus: 'failed' as const } : m
      ));
    }
  };

  // 失敗したメッセージを削除
  const handleDeleteFailedMessage = (messageId: number) => {
    setLocalMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setLocalMessages([]);
    setExtraPastMessages([]);
    router.push('/messages');
  };

  // ファイル選択ハンドラ
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 3ファイルまで制限
    if (pendingAttachments.length + files.length > 3) {
      alert('添付ファイルは3つまでです');
      return;
    }

    setIsUploading(true);
    try {
      const results = await Promise.all(
        Array.from(files).map(file => directUpload(file, {
          uploadType: 'message',
        }))
      );

      const failedUploads = results.filter(r => !r.success);
      if (failedUploads.length > 0) {
        alert(failedUploads[0].error || 'ファイルのアップロードに失敗しました');
      }

      const uploadedUrls = results
        .filter(r => r.success && r.url)
        .map(r => r.url!);

      if (uploadedUrls.length > 0) {
        setPendingAttachments(prev => [...prev, ...uploadedUrls]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 添付ファイルを削除
  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ファイルが画像かどうか判定
  const isImageFile = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(url);
  };

  // 検索・ソート処理
  const filteredAndSortedConversations = conversations
    .filter((conv) => conv.facilityName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // 常に新着順（LINEライク）
      const timeA = new Date(a.lastMessageTime).getTime();
      const timeB = new Date(b.lastMessageTime).getTime();
      return timeB - timeA;
    });

  // メッセージ時間をフォーマット
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  // 日付フォーマット
  const formatDate = (dateInput: Date | string | null) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // お知らせ日時をフォーマット
  const formatAnnouncementDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // カテゴリー別の色とアイコン
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

  // 会話にホバーした時にメッセージ詳細をプリフェッチ
  const handleConversationHover = useCallback((facilityId: number) => {
    const url = `/api/messages/detail?facilityId=${facilityId}&markAsRead=false`;
    preload(url, fetcher);
  }, []);

  // テキスト内のURLをリンクに変換する関数
  const renderContentWithLinks = (content: string, linkColorStyle: 'default' | 'light' = 'default') => {
    // 外部URL、www、アプリ内パス（/jobs/123, /my-jobs/123など）を検出
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\/(?:jobs|my-jobs)\/\d+)/g;
    const parts = content.split(urlRegex);

    const linkClassName = linkColorStyle === 'light'
      ? 'text-white/90 underline hover:text-white break-all'
      : 'text-primary underline hover:text-primary/80 break-all';

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        // 相対パス（/jobs/123）の場合は内部リンク
        const isInternalPath = part.startsWith('/');
        const href = part.startsWith('www.') ? `https://${part}` : part;

        if (isInternalPath) {
          // アプリ内リンク（新しいタブで開かない）
          return (
            <a
              key={index}
              href={href}
              className={linkClassName}
              onClick={(e) => e.stopPropagation()}
            >
              求人詳細を見る
            </a>
          );
        }

        // 外部リンク
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

  // お知らせ詳細表示
  if (selectedAnnouncement) {
    // (省略なし、既存と同じUI)
    const categoryStyle = getCategoryStyle(selectedAnnouncement.category);
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackFromAnnouncement}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="font-bold text-gray-900">お知らせ</h2>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className={`px-4 py-3 ${categoryStyle.bg}`}>
              <div className="flex items-center gap-2">
                {selectedAnnouncement.category === 'IMPORTANT' ? (
                  <Bell className={`w-5 h-5 ${categoryStyle.text}`} />
                ) : (
                  <Megaphone className={`w-5 h-5 ${categoryStyle.text}`} />
                )}
                <span className={`text-sm font-medium ${categoryStyle.text}`}>
                  {categoryStyle.label}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h1 className="text-lg font-bold text-gray-900 mb-2">
                {selectedAnnouncement.title}
              </h1>
              <p className="text-xs text-gray-500 mb-4">
                {formatAnnouncementDate(selectedAnnouncement.publishedAt)}
              </p>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {renderContentWithLinks(selectedAnnouncement.content)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // チャットルーム一覧表示
  if (!selectedConversation) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
          </div>

          <div className="flex border-t border-gray-200">
            <button
              onClick={() => {
                setActiveTab('messages');
                updateUrlParams('messages');
              }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'messages'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500'
                }`}
            >
              メッセージ
            </button>
            <button
              onClick={() => {
                setActiveTab('notifications');
                updateUrlParams('notifications');
              }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notifications'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500'
                }`}
            >
              お知らせ
              {unreadAnnouncementsCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {unreadAnnouncementsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'messages' ? (
          <>
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
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {isConversationsLoading ? (
                <ConversationsSkeleton />
              ) : (
                filteredAndSortedConversations.map((conv) => (
                  <button
                    key={conv.facilityId}
                    onClick={() => handleSelectConversation(conv)}
                    onMouseEnter={() => handleConversationHover(conv.facilityId)}
                    onTouchStart={() => handleConversationHover(conv.facilityId)}
                    className="w-full bg-white hover:bg-gray-50 px-4 py-4 text-left transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* 担当者アバター表示 */}
                      {conv.staffAvatar ? (
                        <img
                          src={conv.staffAvatar}
                          alt={conv.facilityDisplayName || conv.facilityName}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-lg">
                            {(conv.facilityDisplayName || conv.facilityName).charAt(0)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 truncate">{conv.facilityDisplayName || conv.facilityName}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">
                              {formatTime(new Date(conv.lastMessageTime).toISOString())}
                            </span>
                            {conv.unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}

              {!isConversationsLoading && filteredAndSortedConversations.length === 0 && (
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
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="divide-y divide-gray-200">
            {announcementsLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : announcements.length > 0 ? (
              announcements.map((announcement) => {
                const categoryStyle = getCategoryStyle(announcement.category);
                return (
                  <button
                    key={announcement.id}
                    onClick={() => handleOpenAnnouncement(announcement)}
                    className={`w-full text-left px-4 py-4 transition-colors hover:bg-gray-50 ${announcement.isRead ? 'bg-white' : 'bg-blue-50'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${categoryStyle.bg}`}
                      >
                        {announcement.category === 'IMPORTANT' ? (
                          <Bell className={`w-5 h-5 ${categoryStyle.text}`} />
                        ) : (
                          <Megaphone className={`w-5 h-5 ${categoryStyle.text}`} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryStyle.bg} ${categoryStyle.text}`}>
                              {categoryStyle.label}
                            </span>
                            <h3
                              className={`font-bold text-sm ${announcement.isRead ? 'text-gray-700' : 'text-gray-900'
                                }`}
                            >
                              {announcement.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">
                              {formatAnnouncementDate(announcement.publishedAt)}
                            </span>
                            {!announcement.isRead && (
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                          </div>
                        </div>

                        <p
                          className={`text-sm line-clamp-2 ${announcement.isRead ? 'text-gray-500' : 'text-gray-700'
                            }`}
                        >
                          {announcement.content}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-center">お知らせはありません</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // チャット画面
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー - 固定 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* ヘッダーにアバター表示 */}
            {(chatData?.staffAvatar || selectedConversation.staffAvatar) ? (
              <img
                src={chatData?.staffAvatar || selectedConversation.staffAvatar || ''}
                alt="担当者"
                className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                {(chatData?.facilityDisplayName || selectedConversation.facilityDisplayName || chatData?.facilityName || selectedConversation.facilityName).charAt(0)}
              </div>
            )}
            <h2 className="font-bold text-gray-900 truncate">
              {chatData?.facilityDisplayName || selectedConversation.facilityDisplayName || chatData?.facilityName || selectedConversation.facilityName}
            </h2>
          </div>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {/* 過去メッセージ読み込み中 */}
        {isLoadingMore && (
          <div className="flex justify-center py-2 mb-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {/* 過去メッセージあり表示 */}
        {hasMore && !isLoadingMore && !isChatLoading && (
          <div className="flex justify-center py-2 mb-4">
            <button
              onClick={loadMoreMessages}
              className="text-sm text-gray-500 hover:text-primary"
            >
              ↑ 過去のメッセージを読み込む
            </button>
          </div>
        )}
        <div className="space-y-4">
          {(isChatLoading && isInitialLoad) ? (
            <div className="absolute inset-0 z-0 h-full">
              <MessagesSkeleton />
            </div>
          ) : (chatData?.messages.length === 0 && !isChatLoading) ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Send className="w-12 h-12 mb-2 text-gray-300" />
              <p>まだメッセージはありません</p>
              <p className="text-sm">施設からの連絡をお待ちください</p>
            </div>
          ) : (
            chatData?.messages.map((message, index) => {
              const isWorker = message.senderType === 'worker';
              const showDate = index === 0 ||
                new Date(message.timestamp).getDate() !== new Date(chatData!.messages[index - 1].timestamp).getDate();

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                        {formatDate(new Date(message.timestamp))}
                      </span>
                    </div>
                  )}
                  {message.jobTitle && !isWorker && (
                    <div className="text-xs text-gray-500 ml-2 mb-1">
                      {message.jobTitle} ({formatDate(message.jobDate ? new Date(message.jobDate) : null)})
                    </div>
                  )}
                  <div className={`flex ${isWorker ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    {/* 施設側のアバター表示 */}
                    {!isWorker && (
                      <div className="flex-shrink-0 mb-1">
                        {message.senderAvatar ? (
                          <img
                            src={message.senderAvatar}
                            alt={message.senderName}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                            {message.senderName.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ワーカー側：送信状態表示（メッセージの左側） */}
                    {isWorker && message.sendStatus === 'failed' && (
                      <div className="flex items-center gap-1 mb-1">
                        <button
                          onClick={() => handleRetryMessage(message)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 rounded-full transition-colors"
                          title="再送信"
                        >
                          <RotateCcw className="w-4 h-4 text-red-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteFailedMessage(message.id)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}

                    <div
                      className={`max-w-[70%] ${isWorker
                          ? message.sendStatus === 'failed'
                            ? 'bg-red-200 border-2 border-red-400 text-gray-900'
                            : message.sendStatus === 'sending'
                              ? 'bg-red-50 text-gray-600'
                              : 'bg-red-100 text-gray-900'
                          : 'bg-white border border-gray-200'
                        } rounded-2xl px-4 py-2`}
                    >
                      {/* 添付ファイル表示 */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((url, i) => (
                            isImageFile(url) ? (
                              <img
                                key={i}
                                src={url}
                                alt={`添付${i + 1}`}
                                className={`w-32 h-32 object-cover rounded-lg cursor-pointer ${message.sendStatus === 'sending' ? 'opacity-50' : ''
                                  }`}
                                onClick={() => setPreviewImage(url)}
                              />
                            ) : (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isWorker ? 'bg-red-200' : 'bg-gray-100'
                                  }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="w-5 h-5" />
                                <span className="text-sm underline">ファイルを開く</span>
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      {message.content && (
                        <p className={`text-sm whitespace-pre-wrap break-words ${message.sendStatus === 'sending' ? 'opacity-70' : ''
                          }`}>
                          {renderContentWithLinks(message.content, isWorker ? 'default' : 'default')}
                        </p>
                      )}

                      {/* 時刻と送信状態 */}
                      <div className={`flex items-center gap-1.5 mt-1 ${isWorker ? 'justify-end' : ''}`}>
                        <span className="text-xs text-gray-500">
                          {formatTime(message.timestamp)}
                        </span>

                        {/* 送信状態インジケーター（ワーカーのメッセージのみ） */}
                        {isWorker && (
                          <>
                            {message.sendStatus === 'sending' && (
                              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                            )}
                            {message.sendStatus === 'sent' && (
                              <Check className="w-3 h-3 text-green-500" />
                            )}
                            {message.sendStatus === 'failed' && (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                            {/* sendStatusがundefined（SWRから取得した既存メッセージ）は送信済みとして扱う */}
                            {!message.sendStatus && (
                              <Check className="w-3 h-3 text-green-500" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 入力エリア - 固定 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0 z-10">
        {/* 添付ファイルプレビュー */}
        {pendingAttachments.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
            {pendingAttachments.map((url, index) => (
              <div key={index} className="relative flex-shrink-0">
                {isImageFile(url) ? (
                  <img
                    src={url}
                    alt={`添付${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <button
                  onClick={() => handleRemoveAttachment(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* ファイル添付ボタン */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || pendingAttachments.length >= 3}
            className={`p-2 transition-colors ${isUploading || pendingAttachments.length >= 3
              ? 'text-gray-300'
              : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
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
            disabled={(!messageInput.trim() && pendingAttachments.length === 0) || isSending}
            className={`p-2 rounded-full transition-colors ${(messageInput.trim() || pendingAttachments.length > 0) && !isSending
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-200 text-gray-400'
              }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 画像プレビューモーダル */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={previewImage}
            alt="プレビュー"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
