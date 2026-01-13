'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
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
  Paperclip,
  X,
  FileText,
  Check,
  AlertCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  sendFacilityMessage,
} from '@/src/lib/actions';
import { markAnnouncementAsRead } from '@/src/lib/system-actions';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import { directUpload } from '@/utils/directUpload';
import {
  useAdminConversations,
  useAdminMessagesByWorker,
  useAdminAnnouncements,
  type AdminMessage,
  type AdminConversation,
  type AdminAnnouncement,
  type AdminMessagesResponse,
} from '@/hooks/useAdminMessages';
import { MessagesSkeleton, ConversationsSkeleton } from '@/components/MessagesSkeleton';

type FilterType = 'all' | 'unread' | 'scheduled' | 'completed' | 'office';

interface WorkerDetails {
  userId: number;
  userName: string;
  userProfileImage: string | null;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const { showDebugError: showDebug } = useDebugError();
  const showDebugError = showDebug || ((x: any) => console.log(x));
  const searchParams = useSearchParams();
  const initialWorkerId = searchParams.get('workerId');
  const initialFilter = searchParams.get('filter') as FilterType | null;
  const { admin, isAdmin, isAdminLoading } = useAuth();

  // SWRでデータ取得
  const {
    conversations,
    isLoading: isConversationsLoading,
    mutate: mutateConversations
  } = useAdminConversations(admin?.facilityId);

  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    initialWorkerId ? parseInt(initialWorkerId) : null
  );

  const {
    chatData: swrChatData,
    isLoading: isChatLoading,
    mutate: mutateMessages
  } = useAdminMessagesByWorker(admin?.facilityId, selectedWorkerId);

  // ローカルでのメッセージ追加用
  const [localMessages, setLocalMessages] = useState<AdminMessage[]>([]);
  const messages = useMemo(() => {
    const swrMessages = swrChatData?.messages ?? [];
    const messageIds = new Set(swrMessages.map(m => m.id));
    const filteredLocal = localMessages.filter(m => !messageIds.has(m.id));
    return [...swrMessages, ...filteredLocal];
  }, [swrChatData, localMessages]);

  const {
    announcements,
    isLoading: announcementsLoading,
    mutate: mutateAnnouncements
  } = useAdminAnnouncements(admin?.facilityId);

  const [messageText, setMessageText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>(
    initialFilter && ['all', 'unread', 'scheduled', 'completed', 'office'].includes(initialFilter)
      ? initialFilter
      : 'all'
  );
  const [showVariables, setShowVariables] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ページネーション用
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AdminAnnouncement | null>(null);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // 初期ロード
  useEffect(() => {
    if (initialWorkerId && !selectedWorkerId) {
      setSelectedWorkerId(parseInt(initialWorkerId));
    }
  }, [initialWorkerId]);

  // selectedWorkerId が変更されたらローカル状態をリセット
  useEffect(() => {
    setLocalMessages([]);
    setExtraPastMessages([]);
    setCursor(null);
    setHasMore(false);
    setIsInitialLoad(true);
  }, [selectedWorkerId]);

  // SWRの初期設定
  useEffect(() => {
    if (swrChatData && isInitialLoad) {
      setCursor(swrChatData.nextCursor);
      setHasMore(swrChatData.hasMore);
      setIsInitialLoad(false);
    }
  }, [swrChatData, isInitialLoad]);

  const currentWorker = swrChatData ? {
    userId: swrChatData.userId,
    userName: swrChatData.userName,
    userProfileImage: swrChatData.userProfileImage,
  } : null;

  // 本文内のURLをクリック可能なリンクに変換する
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

  // 過去メッセージ読み込み
  const [extraPastMessages, setExtraPastMessages] = useState<AdminMessage[]>([]);
  // messagesもuseMemoで拡張
  const allMessages = useMemo(() => {
    const combined = [...extraPastMessages, ...messages];
    // 重複排除
    return Array.from(new Map(combined.map(m => [m.id, m])).values());
  }, [extraPastMessages, messages]);

  // 初期ロード完了時に最下部にスクロール
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [isInitialLoad, selectedWorkerId]);

  // 過去メッセージを読み込む
  const loadMoreMessages = async () => {
    if (!selectedWorkerId || !cursor || isLoadingMore || !hasMore) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;

    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/messages/detail?workerId=${selectedWorkerId}&cursor=${cursor}&markAsRead=false`);
      if (!res.ok) throw new Error('Failed to load more');
      const data: AdminMessagesResponse = await res.json();
      if (data) {
        const newMessages: AdminMessage[] = data.messages.map(m => ({
          ...m,
          senderType: m.senderType as 'facility' | 'worker' | 'office',
          jobDate: m.jobDate ? new Date(m.jobDate).toISOString() : null
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
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'fetch',
        operation: '過去メッセージ追加取得',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId: admin?.facilityId, selectedWorkerId, cursor }
      });
      console.error('Failed to load more messages:', error);
      toast.error('過去メッセージの読み込みに失敗しました');
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

  // フィルタリングされた会話リスト
  const filteredConversations = conversations.filter((conv) => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return conv.unreadCount > 0;
    if (filterType === 'scheduled') return conv.status === 'SCHEDULED';
    if (filterType === 'completed') return conv.status.includes('COMPLETED');
    if (filterType === 'office') return false;
    return true;
  });

  // メッセージを送信（LINEライク楽観的更新）
  const handleSendMessage = async () => {
    if ((!messageText.trim() && pendingAttachments.length === 0) || !selectedWorkerId || !admin?.facilityId) return;

    // 最新の応募IDを取得（conversationsから取得、なければchatDataから取得）
    const conversation = conversations.find(c => c.userId === selectedWorkerId);

    // applicationIdsを取得（conversationsから、またはchatDataから取得）
    let applicationIds: number[] = [];
    let jobTitle = '';

    if (conversation && conversation.applicationIds.length > 0) {
      applicationIds = conversation.applicationIds;
      jobTitle = conversation.jobTitle;
    } else if (swrChatData && swrChatData.applicationIds && swrChatData.applicationIds.length > 0) {
      // リロード後などでconversationsがまだロードされていない場合はchatDataから取得
      applicationIds = swrChatData.applicationIds;
      jobTitle = swrChatData.messages[0]?.jobTitle || '';
    }

    if (applicationIds.length === 0) {
      toast.error('有効な応募が見つかりません');
      return;
    }
    const latestApplicationId = Math.max(...applicationIds);

    setIsSending(true);
    const content = messageText.trim();
    const attachmentsToSend = [...pendingAttachments];
    const tempId = -Date.now(); // 一時ID（負の値で本物と区別）

    // 楽観的更新：即座にUIに表示（送信中状態）
    const tempMessage: AdminMessage = {
      id: tempId,
      applicationId: latestApplicationId,
      senderType: 'facility',
      senderName: '施設',
      content: content,
      attachments: attachmentsToSend,
      timestamp: new Date().toISOString(),
      isRead: false,
      jobTitle: jobTitle,
      jobDate: null,
      sendStatus: 'sending',
      _retryData: {
        applicationId: latestApplicationId,
        facilityId: admin.facilityId,
        content,
        attachments: attachmentsToSend,
      },
    };

    setLocalMessages((prev) => [...prev, tempMessage]);
    setMessageText('');
    setPendingAttachments([]);

    try {
      const result = await sendFacilityMessage(
        latestApplicationId,
        admin.facilityId,
        content,
        attachmentsToSend
      );

      if (result.success && result.message) {
        // 成功：一時メッセージを本物に置き換え
        setLocalMessages((prev) => prev.map(m =>
          m.id === tempId
            ? {
                ...m,
                id: result.message!.id,
                timestamp: result.message!.timestamp,
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
        setLocalMessages((prev) => prev.map(m =>
          m.id === tempId
            ? { ...m, sendStatus: 'failed' as const }
            : m
        ));
        toast.error(result.error || 'メッセージの送信に失敗しました');
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'save',
        operation: 'メッセージ送信',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId: admin.facilityId, selectedWorkerId }
      });
      console.error('[Message] Send error:', error);
      // エラー：失敗状態に更新
      setLocalMessages((prev) => prev.map(m =>
        m.id === tempId
          ? { ...m, sendStatus: 'failed' as const }
          : m
      ));
    } finally {
      setIsSending(false);
    }
  };

  // 失敗したメッセージを再送信
  const handleRetryMessage = async (message: AdminMessage) => {
    if (!message._retryData || message.sendStatus !== 'failed') return;

    const { applicationId, facilityId, content, attachments } = message._retryData;
    const tempId = message.id;

    // 送信中状態に更新
    setLocalMessages((prev) => prev.map(m =>
      m.id === tempId ? { ...m, sendStatus: 'sending' as const } : m
    ));

    try {
      const result = await sendFacilityMessage(applicationId, facilityId, content, attachments);

      if (result.success && result.message) {
        // 成功
        setLocalMessages((prev) => prev.map(m =>
          m.id === tempId
            ? {
                ...m,
                id: result.message!.id,
                timestamp: result.message!.timestamp,
                sendStatus: 'sent' as const,
                _retryData: undefined,
              }
            : m
        ));
        mutateConversations();
        mutateMessages();
      } else {
        // 失敗
        setLocalMessages((prev) => prev.map(m =>
          m.id === tempId ? { ...m, sendStatus: 'failed' as const } : m
        ));
        toast.error(result.error || '再送信に失敗しました');
      }
    } catch (error) {
      console.error('[Message] Retry failed:', error);
      setLocalMessages((prev) => prev.map(m =>
        m.id === tempId ? { ...m, sendStatus: 'failed' as const } : m
      ));
    }
  };

  // 失敗したメッセージを削除
  const handleDeleteFailedMessage = (messageId: number) => {
    setLocalMessages((prev) => prev.filter(m => m.id !== messageId));
  };

  const insertVariable = (variable: string) => {
    setMessageText(messageText + variable);
  };

  // ファイル選択ハンドラ
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (pendingAttachments.length + files.length > 3) {
      toast.error('添付ファイルは3つまでです');
      return;
    }

    setIsUploading(true);
    try {
      const adminSession = localStorage.getItem('admin_session') || '';
      const results = await Promise.all(
        Array.from(files).map(file => directUpload(file, {
          uploadType: 'message',
          adminSession,
        }))
      );

      const failedUploads = results.filter(r => !r.success);
      if (failedUploads.length > 0) {
        toast.error(failedUploads[0].error || 'ファイルのアップロードに失敗しました');
      }

      const uploadedUrls = results
        .filter(r => r.success && r.url)
        .map(r => r.url!);

      if (uploadedUrls.length > 0) {
        setPendingAttachments(prev => [...prev, ...uploadedUrls]);
      }
    } catch (error) {
      const debugInfo = extractDebugInfo(error);
      showDebugError({
        type: 'upload',
        operation: 'メッセージ添付ファイルアップロード',
        message: debugInfo.message,
        details: debugInfo.details,
        stack: debugInfo.stack,
        context: { facilityId: admin?.facilityId }
      });
      console.error('Upload error:', error);
      toast.error('ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const isImageFile = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(url);
  };

  // お知らせを既読にする
  const handleReadAnnouncement = async (announcement: AdminAnnouncement) => {
    setSelectedAnnouncement(announcement);
    if (!announcement.isRead && admin?.facilityId) {
      await markAnnouncementAsRead(announcement.id, 'FACILITY', admin.facilityId);
      mutateAnnouncements();
    }
  };

  // フィルタ変更時にリセット
  const handleFilterChange = (newFilter: FilterType) => {
    setFilterType(newFilter);
    if (newFilter === 'office') {
      setSelectedWorkerId(null);
      setSelectedAnnouncement(null);
    } else {
      setSelectedAnnouncement(null);
    }
    // URLパラメータを更新
    const params = new URLSearchParams(window.location.search);
    if (newFilter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', newFilter);
    }
    // officeの場合はworkerIdもクリア
    if (newFilter === 'office') {
      params.delete('workerId');
    }
    router.replace(`/admin/messages?${params.toString()}`, { scroll: false });
  };

  // お知らせ日時をフォーマット
  const formatAnnouncementDate = (date: string | Date | null | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 日付フォーマット
  const formatDate = (dateInput: string | Date | null) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

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

  if (isAdminLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  // 選択中の会話の情報を取得
  const selectedConversation = conversations.find(c => c.userId === selectedWorkerId);

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
            <option value="office">運営から {unreadAnnouncementsCount > 0 && `(${unreadAnnouncementsCount})`}</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filterType === 'office' ? (
            // 運営からのお知らせ一覧
            announcementsLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>運営からのお知らせはありません</p>
              </div>
            ) : (
              announcements.map((announcement) => {
                const categoryStyle = getCategoryStyle(announcement.category);
                return (
                  <div
                    key={announcement.id}
                    onClick={() => handleReadAnnouncement(announcement)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${selectedAnnouncement?.id === announcement.id ? 'bg-admin-primary-light' : ''
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
            // 通常の会話一覧
            isConversationsLoading ? (
              <ConversationsSkeleton />
            ) : (
              (() => {
                if (filteredConversations.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <p>メッセージはありません</p>
                    </div>
                  );
                }

                return filteredConversations.map((conv) => (
                  <div
                    key={conv.userId}
                    onClick={() => {
                      setSelectedAnnouncement(null);
                      setSelectedWorkerId(conv.userId);
                      // URLパラメータを更新してリロード時にも選択状態を維持
                      const params = new URLSearchParams(window.location.search);
                      params.set('workerId', conv.userId.toString());
                      router.replace(`/admin/messages?${params.toString()}`, { scroll: false });
                    }}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${selectedWorkerId === conv.userId ? 'bg-admin-primary-light' : ''
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 運営の場合は専用アイコン */}
                      {conv.isOffice ? (
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-6 h-6 text-indigo-600" />
                        </div>
                      ) : (
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
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {conv.userName}
                            {conv.isOffice && (
                              <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                                システム通知
                              </span>
                            )}
                          </h3>
                          {conv.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {!conv.isOffice && (
                          <p className="text-xs text-gray-500 mb-1">{conv.jobTitle}</p>
                        )}
                        <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(conv.lastMessageTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ));
              })()
            )
          )}
        </div>
      </div>

      {/* チャット画面 / お知らせ詳細 */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedAnnouncement ? (
          // お知らせ詳細
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-indigo-600">運営</span>
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

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="flex justify-start">
                <div className="max-w-lg bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {renderContentWithLinks(selectedAnnouncement.content)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm text-gray-500 text-center">
                このお知らせは運営からの一方向の通知です
              </p>
            </div>
          </div>
        ) : filterType === 'office' ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>お知らせを選択して内容を表示</p>
            </div>
          </div>
        ) : isChatLoading && isInitialLoad ? (
          <div className="flex-1 overflow-hidden">
            <MessagesSkeleton />
          </div>
        ) : currentWorker ? (
          <>
            {/* チャットヘッダー */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* 運営の場合は専用アイコン */}
                {selectedConversation?.isOffice ? (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-indigo-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {currentWorker.userProfileImage ? (
                      <img
                        src={currentWorker.userProfileImage}
                        alt={currentWorker.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-gray-900">{currentWorker.userName}</h3>
                  {!selectedConversation?.isOffice && (
                    <p className="text-xs text-gray-500">
                      {selectedConversation?.jobTitle}
                      {selectedConversation?.status ? ` (${selectedConversation.status})` : ''}
                    </p>
                  )}
                </div>
              </div>
              {/* 運営の場合は情報ボタンを非表示 */}
              {!selectedConversation?.isOffice && (
                <button
                  onClick={() => setShowUserInfo(!showUserInfo)}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Info className="w-4 h-4" />
                  {showUserInfo ? '情報を非表示' : '情報を表示'}
                </button>
              )}
            </div>

            {/* メッセージエリア */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 bg-gray-50"
            >
              {/* 過去メッセージ読み込み中 */}
              {isLoadingMore && (
                <div className="flex justify-center py-2 mb-4">
                  <Loader2 className="w-5 h-5 animate-spin text-admin-primary" />
                </div>
              )}
              {/* 過去メッセージあり表示 */}
              {hasMore && !isLoadingMore && (
                <div className="flex justify-center py-2 mb-4">
                  <button
                    onClick={loadMoreMessages}
                    className="text-sm text-gray-500 hover:text-admin-primary"
                  >
                    ↑ 過去のメッセージを読み込む
                  </button>
                </div>
              )}
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>メッセージはありません</p>
                    <p className="text-sm mt-2">最初のメッセージを送信しましょう</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isFacility = message.senderType === 'facility';
                    const showDate = index === 0 ||
                      new Date(message.timestamp).getDate() !== new Date(messages[index - 1].timestamp).getDate();

                    return (
                      <div key={message.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                              {formatDate(message.timestamp)}
                            </span>
                          </div>
                        )}
                        {message.jobTitle && !isFacility && (
                          <div className="text-xs text-gray-500 ml-2 mb-1">
                            {message.jobTitle} ({formatDate(message.jobDate)})
                          </div>
                        )}
                        <div className={`flex ${isFacility ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                          {/* 施設側：送信失敗時の再送・削除ボタン（メッセージの左側） */}
                          {isFacility && message.sendStatus === 'failed' && (
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
                            className={`max-w-md px-4 py-2 rounded-lg ${
                              isFacility
                                ? message.sendStatus === 'failed'
                                  ? 'bg-red-200 border-2 border-red-400 text-gray-900'
                                  : message.sendStatus === 'sending'
                                    ? 'bg-blue-50 text-gray-600'
                                    : 'bg-blue-100 text-gray-900'
                                : 'bg-white border border-gray-200 text-gray-900'
                              }`}
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
                                      className={`w-32 h-32 object-cover rounded-lg cursor-pointer ${
                                        message.sendStatus === 'sending' ? 'opacity-50' : ''
                                      }`}
                                      onClick={() => setPreviewImage(url)}
                                    />
                                  ) : (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isFacility ? 'bg-blue-200' : 'bg-gray-100'}`}
                                    >
                                      <FileText className="w-5 h-5" />
                                      <span className="text-sm underline">ファイルを開く</span>
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                            {message.content && (
                              <p className={`text-sm whitespace-pre-wrap ${
                                message.sendStatus === 'sending' ? 'opacity-70' : ''
                              }`}>
                                {renderContentWithLinks(message.content, 'default')}
                              </p>
                            )}

                            {/* 時刻と送信状態 */}
                            <div className={`flex items-center gap-1.5 mt-1 ${isFacility ? 'justify-end' : ''}`}>
                              <span className={`text-xs ${isFacility ? 'text-gray-500' : 'text-gray-400'}`}>
                                {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>

                              {/* 送信状態インジケーター（施設のメッセージのみ） */}
                              {isFacility && (
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

            {/* 入力エリア - 運営チャットでは非表示 */}
            {selectedConversation?.isOffice ? (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-center text-gray-500 text-sm">
                  運営からの通知は返信できません
                </p>
              </div>
            ) : (
              <div className="border-t border-gray-200 bg-white">
                <div className="px-4 pt-3 pb-1">
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="text-sm text-green-600 hover:text-green-700 transition-colors font-medium"
                  >
                    利用できる変数
                    <ChevronDown
                      className={`w-3 h-3 inline-block ml-1 transition-transform ${showVariables ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showVariables && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                      <div>
                        <button onClick={() => insertVariable('[ワーカー名字]')} className="text-blue-700 hover:underline font-mono">[ワーカー名字]</button>
                        <span className="text-gray-700">: ワーカーの名字に変換されます</span>
                      </div>
                      <div>
                        <button onClick={() => insertVariable('[施設名]')} className="text-blue-700 hover:underline font-mono">[施設名]</button>
                        <span className="text-gray-700">: 施設名に変換されます</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 添付ファイルプレビュー */}
                {pendingAttachments.length > 0 && (
                  <div className="px-4 pb-2">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {pendingAttachments.map((url, index) => (
                        <div key={index} className="relative flex-shrink-0">
                          {isImageFile(url) ? (
                            <img src={url} alt={`添付${index + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
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
                  </div>
                )}

                <div className="px-4 pb-4 pt-2 flex gap-2">
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
                    className={`px-3 py-2 border border-gray-300 rounded-lg transition-colors ${isUploading || pendingAttachments.length >= 3
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:bg-gray-50'
                      }`}
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      // Ctrl+Enter または Cmd+Enter で送信（Enterのみは改行）
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="メッセージを入力...（Ctrl+Enterで送信）"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-primary focus:border-transparent resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={(!messageText.trim() && pendingAttachments.length === 0) || isSending}
                    className="px-4 py-2 bg-admin-primary text-white rounded-lg hover:bg-admin-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>会話を選択してメッセージを開始</p>
          </div>
        )}
      </div>

      {/* ユーザー情報パネル (縮小版) - 運営チャットでは非表示 */}
      {currentWorker && showUserInfo && !selectedAnnouncement && !selectedConversation?.isOffice && (
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">ワーカー情報</h3>
            <div className="text-center mb-6">
              <div className="relative inline-block mb-3">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {currentWorker.userProfileImage ? (
                    <img
                      src={currentWorker.userProfileImage}
                      alt={currentWorker.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              </div>
              <h4 className="font-bold text-gray-900 text-lg mt-3">
                {currentWorker.userName}
              </h4>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <a
                  href={`/admin/workers/${currentWorker.userId}`}
                  target="_blank"
                  className="text-admin-primary hover:underline text-sm"
                >
                  詳細プロフィールを見る
                </a>
              </div>

              {/* 簡易的に最新の応募情報を表示 */}
              {selectedConversation && (
                <div className="mt-6 border-t pt-4">
                  <h5 className="text-sm font-bold text-gray-900 mb-2">最新の応募状況</h5>
                  <p className="text-sm text-gray-700">{selectedConversation.jobTitle}</p>
                  <p className="text-xs text-gray-500 mt-1">Status: {selectedConversation.status}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
