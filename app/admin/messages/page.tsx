'use client';

import { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  getGroupedWorkerConversations,
  getMessagesByWorker,
  sendFacilityMessage,
} from '@/src/lib/actions';
import {
  getFacilityAnnouncements,
  markAnnouncementAsRead,
} from '@/src/lib/system-actions';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'unread' | 'scheduled' | 'completed' | 'office';

// サーバーアクションの型に合わせる
interface Conversation {
  userId: number;
  userName: string;
  userProfileImage: string | null;
  applicationIds: number[];
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  jobTitle: string;
  status: string;
  isOffice?: boolean;  // 運営フラグ
}

interface Message {
  id: number;
  senderType: 'facility' | 'worker' | 'office';
  senderName: string;
  content: string;
  attachments?: string[];
  timestamp: string;
  isRead: boolean;
  jobTitle: string;
  jobDate: string | null;
  workerName?: string;  // 運営通知に関連するワーカー名
}

interface WorkerDetails {
  userId: number;
  userName: string;
  userProfileImage: string | null;
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
  const initialWorkerId = searchParams.get('workerId'); // パラメータ名変更: id -> workerId
  const { admin, isAdmin, isAdminLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    initialWorkerId ? parseInt(initialWorkerId) : null
  );

  // ワーカー詳細情報の表示用（メッセージリスト取得時に更新）
  const [currentWorker, setCurrentWorker] = useState<WorkerDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showVariables, setShowVariables] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ページネーション用state
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
        const data = await getGroupedWorkerConversations(admin.facilityId);
        // Server action returns Date objects, handled correctly by Next.js serialization usually,
        // but if passed to Client Component directly, they stay Date?
        // Let's assume they are Dates. if string, we convert.
        const formattedData = data.map(d => ({
          ...d,
          lastMessageTime: new Date(d.lastMessageTime)
        }));
        setConversations(formattedData);

        // URLパラメータで指定されていれば選択
        if (initialWorkerId && !selectedWorkerId) {
          setSelectedWorkerId(parseInt(initialWorkerId));
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
        toast.error('会話一覧の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [admin?.facilityId, initialWorkerId]);

  // お知らせを読み込む
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

  // 選択された会話（ワーカー）のメッセージを読み込む
  useEffect(() => {
    const loadMessages = async () => {
      if (!admin?.facilityId || !selectedWorkerId) {
        setMessages([]);
        setCurrentWorker(null);
        setCursor(null);
        setHasMore(false);
        setIsInitialLoad(true);
        return;
      }

      setIsInitialLoad(true);
      try {
        const data = await getMessagesByWorker(admin.facilityId, selectedWorkerId, { markAsRead: true });
        if (data) {
          setCurrentWorker({
            userId: data.userId,
            userName: data.userName,
            userProfileImage: data.userProfileImage || null,
          });
          setMessages(data.messages.map(m => ({
            ...m,
            senderType: m.senderType as 'facility' | 'worker' | 'office',
            jobDate: m.jobDate ? new Date(m.jobDate).toISOString() : null
          })));
          setCursor(data.nextCursor);
          setHasMore(data.hasMore);

          // メッセージを開いたら、会話リストの未読バッジをリセット
          // (getMessagesByWorkerでサーバー側は既読にしているが、ローカル状態も更新)
          setConversations(prev => prev.map(conv =>
            conv.userId === selectedWorkerId
              ? { ...conv, unreadCount: 0 }
              : conv
          ));
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        toast.error('メッセージの読み込みに失敗しました');
      } finally {
        setIsInitialLoad(false);
      }
    };

    loadMessages();
  }, [admin?.facilityId, selectedWorkerId]);

  // 初期ロード完了時に最下部にスクロール
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [isInitialLoad, selectedWorkerId]);

  // 過去メッセージを読み込む
  const loadMoreMessages = async () => {
    if (!admin?.facilityId || !selectedWorkerId || !cursor || isLoadingMore || !hasMore) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;

    setIsLoadingMore(true);
    try {
      const data = await getMessagesByWorker(admin.facilityId, selectedWorkerId, {
        cursor,
        markAsRead: false,
      });
      if (data) {
        const newMessages = data.messages.map(m => ({
          ...m,
          senderType: m.senderType as 'facility' | 'worker' | 'office',
          jobDate: m.jobDate ? new Date(m.jobDate).toISOString() : null
        }));
        // 過去メッセージを先頭に追加
        setMessages(prev => [...newMessages, ...prev]);
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

  const handleSendMessage = async () => {
    if ((!messageText.trim() && pendingAttachments.length === 0) || !selectedWorkerId || !admin?.facilityId) return;

    // 最新の応募IDを取得
    const conversation = conversations.find(c => c.userId === selectedWorkerId);
    if (!conversation || conversation.applicationIds.length === 0) {
      toast.error('有効な応募が見つかりません');
      return;
    }
    // applicationIdsの最後（最新）を使用
    // getGroupedWorkerConversations の実装で push しているので、配列の最後が最新とは限らないが、
    // 実装的に findMany からの for loop なので、prisma の order 次第。
    // getGroupedWorkerConversations では findMany order by created_at desc ではない（指定なし）。
    // findMany where ... include details.
    // しかし、通常はID昇順か作成順。
    // 安全のため、配列の最後のIDを使うか、本来なら最新IDをConversationsに含めるべき。
    // ここでは便宜上、配列の最後のIDを使用する（もしくは配列内の最大値）。
    const latestApplicationId = Math.max(...conversation.applicationIds);

    setIsSending(true);
    try {
      const attachmentsToSend = [...pendingAttachments];
      const result = await sendFacilityMessage(
        latestApplicationId,
        admin.facilityId,
        messageText,
        attachmentsToSend
      );

      if (result.success && result.message) {
        // メッセージリストに追加
        const newMessage: Message = {
          id: result.message.id, // result.message型が server logic と異なる場合があるため注意
          // sendFacilityMessageの戻り値は { ...message, senderName: '施設' ... } と推測
          // 実際は actions.ts の sendFacilityMessage を確認すると、
          // return { success: true, message: { ... } };
          // message: { id, senderType: 'facility', senderName, content, timestamp, isRead }
          senderType: 'facility',
          senderName: '施設', // result.messageにあるはず
          content: result.message.content,
          attachments: result.message.attachments || [],
          timestamp: result.message.timestamp,
          isRead: false,
          jobTitle: conversation.jobTitle, // とりあえず会話の最新情報を継承
          jobDate: null, // 新規メッセージには紐付かないか、resultに含めるか。
        };

        // jobTitle等はサーバーレスポンスに含まれない場合があるので、補完
        setMessages((prev) => [...prev, newMessage]);
        setMessageText('');
        setPendingAttachments([]);

        // 会話一覧も更新
        setConversations((prev) =>
          prev.map((conv) =>
            conv.userId === selectedWorkerId
              ? { ...conv, lastMessage: messageText, lastMessageTime: new Date() }
              : conv
          ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
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
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('type', 'message');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success && result.urls) {
        setPendingAttachments(prev => [...prev, ...result.urls]);
      } else {
        toast.error(result.error || 'ファイルのアップロードに失敗しました');
      }
    } catch (error) {
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
      setSelectedWorkerId(null);
      setCurrentWorker(null);
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
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-admin-primary" />
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
            // 通常の会話一覧（すべての場合もお知らせは統合しない - Workerとの会話のみ）
            // 仕様変更：LINE風にするならお知らせと混ぜてもいいが、ここでは会話のみにする
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
                        {conv.lastMessageTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ));
            })()
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
                        <div className={`flex ${isFacility ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-md px-4 py-2 rounded-lg ${isFacility
                              ? 'bg-blue-100 text-gray-900'
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
                                      className="w-32 h-32 object-cover rounded-lg cursor-pointer"
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
                              <p className="text-sm whitespace-pre-wrap">
                                {renderContentWithLinks(message.content, 'default')}
                              </p>
                            )}
                            <p
                              className={`text-xs mt-1 ${isFacility
                                ? 'text-gray-500'
                                : 'text-gray-400'
                                }`}
                            >
                              {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
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
