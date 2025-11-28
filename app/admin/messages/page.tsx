'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Send,
  Info,
  Phone,
  Calendar,
  Star,
  Briefcase,
  Award,
  ChevronDown,
  Loader2,
  User,
} from 'lucide-react';
import {
  getFacilityConversations,
  getFacilityMessages,
  sendFacilityMessage,
} from '@/src/lib/actions';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'unread' | 'scheduled' | 'completed';

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

  if (!isAdmin || !admin) {
    return null;
  }

  if (isLoading || isAdminLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* 会話リスト */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3">メッセージ</h2>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">すべて</option>
            <option value="unread">未読のみ</option>
            <option value="scheduled">勤務予定</option>
            <option value="completed">完了</option>
          </select>
        </div>

        {/* 会話リスト */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>メッセージはありません</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.applicationId}
                onClick={() => setSelectedApplicationId(conv.applicationId)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${selectedApplicationId === conv.applicationId ? 'bg-primary-light' : ''
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
            ))
          )}
        </div>
      </div>

      {/* チャット画面 */}
      <div className="flex-1 flex flex-col bg-white">
        {currentApplication ? (
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
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                          }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${message.senderType === 'facility'
                            ? 'text-primary-light'
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      {currentApplication && showUserInfo && (
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
                  className="block w-full px-4 py-2 text-center text-primary border border-primary rounded-lg hover:bg-primary-light transition-colors text-sm"
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
