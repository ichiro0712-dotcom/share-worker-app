'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Send, Info, Phone, MapPin, Calendar, Star, Briefcase, Award, ChevronDown, Image, Smile } from 'lucide-react';

type FilterType = 'all' | 'care' | 'nursing' | 'other' | 'upcoming' | 'recent' | 'favorites';

type MessageType = 'text' | 'image' | 'stamp';

interface Message {
  id: number;
  senderId: number;
  text?: string;
  imageUrl?: string;
  stampId?: string;
  type: MessageType;
  timestamp: string;
  isAdmin: boolean;
}

interface ChatUser {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  occupation: 'care' | 'nursing' | 'other';
  age: number;
  gender: string;
  rating: number;
  qualifications: string[];
  experience: string[];
  prefecture: string;
  city: string;
  nextWorkDate?: string;
  nextWorkFacility?: string;
  nextWorkJobId?: number;
  emergencyContact: string;
  isFavorite: boolean;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [messageText, setMessageText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showVariables, setShowVariables] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showEmergencyContact, setShowEmergencyContact] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  // ダミーのチャットユーザーリスト
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([
    {
      id: 1,
      name: '山田 花子',
      avatar: '👩',
      lastMessage: 'ありがとうございます。よろしくお願いいたします。',
      lastMessageTime: '2025-11-19T10:30:00',
      unreadCount: 2,
      occupation: 'care',
      age: 28,
      gender: '女性',
      rating: 4.8,
      qualifications: ['介護福祉士', '介護職員初任者研修'],
      experience: ['特別養護老人ホーム 3年', '訪問介護 2年'],
      prefecture: '東京都',
      city: '渋谷区',
      nextWorkDate: '2025-11-25',
      nextWorkFacility: 'ケアテック恵比寿',
      nextWorkJobId: 1,
      emergencyContact: '080-1234-5678（山田太郎・夫）',
      isFavorite: true,
    },
    {
      id: 2,
      name: '佐藤 健太',
      avatar: '👨',
      lastMessage: '了解しました。当日よろしくお願いします。',
      lastMessageTime: '2025-11-18T15:20:00',
      unreadCount: 0,
      occupation: 'nursing',
      age: 32,
      gender: '男性',
      rating: 4.9,
      qualifications: ['正看護師', 'BLS資格'],
      experience: ['総合病院 5年', '訪問看護 3年'],
      prefecture: '東京都',
      city: '新宿区',
      nextWorkDate: '2025-11-22',
      nextWorkFacility: 'メディケア新宿',
      nextWorkJobId: 2,
      emergencyContact: '090-9876-5432（佐藤美香・妻）',
      isFavorite: false,
    },
    {
      id: 3,
      name: '鈴木 美咲',
      avatar: '👩',
      lastMessage: '次回の勤務について確認したいことがあります',
      lastMessageTime: '2025-11-17T09:15:00',
      unreadCount: 1,
      occupation: 'care',
      age: 25,
      gender: '女性',
      rating: 4.5,
      qualifications: ['介護職員初任者研修'],
      experience: ['デイサービス 1年'],
      prefecture: '東京都',
      city: '世田谷区',
      emergencyContact: '080-1111-2222（鈴木太郎・父）',
      isFavorite: true,
    },
    {
      id: 4,
      name: '田中 優子',
      avatar: '👩',
      lastMessage: 'ご連絡ありがとうございます。',
      lastMessageTime: '2025-11-16T14:30:00',
      unreadCount: 0,
      occupation: 'nursing',
      age: 35,
      gender: '女性',
      rating: 4.7,
      qualifications: ['准看護師'],
      experience: ['クリニック 4年', '介護施設 2年'],
      prefecture: '東京都',
      city: '品川区',
      nextWorkDate: '2025-11-28',
      nextWorkFacility: 'ヘルスケア品川',
      nextWorkJobId: 3,
      emergencyContact: '090-3333-4444（田中一郎・夫）',
      isFavorite: false,
    },
    {
      id: 5,
      name: '高橋 隆',
      avatar: '👨',
      lastMessage: '明日の勤務、楽しみにしています。',
      lastMessageTime: '2025-11-15T11:00:00',
      unreadCount: 0,
      occupation: 'other',
      age: 40,
      gender: '男性',
      rating: 4.6,
      qualifications: ['普通自動車免許'],
      experience: ['施設管理 5年'],
      prefecture: '東京都',
      city: '目黒区',
      emergencyContact: '080-5555-6666（高橋春子・妻）',
      isFavorite: false,
    },
  ]);

  // スタンプ定義
  const stamps = [
    { id: 'thumbs_up', emoji: '👍', label: 'いいね' },
    { id: 'clap', emoji: '👏', label: '拍手' },
    { id: 'ok', emoji: '👌', label: 'OK' },
    { id: 'smile', emoji: '😊', label: '笑顔' },
    { id: 'thanks', emoji: '🙏', label: 'ありがとう' },
    { id: 'heart', emoji: '❤️', label: 'ハート' },
    { id: 'check', emoji: '✅', label: 'チェック' },
    { id: 'star', emoji: '⭐', label: '星' },
  ];

  // ダミーのメッセージデータ
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      senderId: 0, // 管理者
      text: '山田様\n\nこの度は、ケアテック恵比寿の求人にご応募いただき、誠にありがとうございます。\n施設長の斉藤と申します。',
      type: 'text',
      timestamp: '2025-11-18T09:00:00',
      isAdmin: true,
    },
    {
      id: 2,
      senderId: 1,
      text: 'こちらこそ、よろしくお願いいたします。',
      type: 'text',
      timestamp: '2025-11-18T09:15:00',
      isAdmin: false,
    },
    {
      id: 3,
      senderId: 0,
      text: '勤務日の詳細について確認させていただきたいのですが、11月25日の9:00〜17:00でお間違いないでしょうか？',
      type: 'text',
      timestamp: '2025-11-18T10:00:00',
      isAdmin: true,
    },
    {
      id: 4,
      senderId: 1,
      text: 'はい、その日時で大丈夫です。',
      type: 'text',
      timestamp: '2025-11-19T10:25:00',
      isAdmin: false,
    },
    {
      id: 5,
      senderId: 1,
      text: 'ありがとうございます。よろしくお願いいたします。',
      type: 'text',
      timestamp: '2025-11-19T10:30:00',
      isAdmin: false,
    },
  ]);

  // フィルタリングされたユーザーリスト
  const filteredUsers = chatUsers.filter((user) => {
    if (filterType === 'all') return true;
    if (filterType === 'care') return user.occupation === 'care';
    if (filterType === 'nursing') return user.occupation === 'nursing';
    if (filterType === 'other') return user.occupation === 'other';
    if (filterType === 'upcoming') return !!user.nextWorkDate;
    if (filterType === 'recent') {
      // 直近3ヶ月で勤務実績あり（ダミーデータでは全員該当とする）
      return true;
    }
    if (filterType === 'favorites') return user.isFavorite;
    return true;
  });

  const selectedUser = selectedUserId ? chatUsers.find(u => u.id === selectedUserId) : null;

  const toggleFavorite = (userId: number) => {
    setChatUsers(chatUsers.map(user =>
      user.id === userId ? { ...user, isFavorite: !user.isFavorite } : user
    ));
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedUserId) return;

    // 変数を実際の値に置き換え
    let processedText = messageText;
    if (selectedUser) {
      const workerLastName = selectedUser.name.split(' ')[0];
      processedText = processedText.replace(/＜ワーカー＞/g, workerLastName);
    }
    processedText = processedText.replace(/＜施設担当＞/g, '斉藤');
    processedText = processedText.replace(/＜施設名＞/g, 'ケアテック恵比寿');

    const newMessage: Message = {
      id: messages.length + 1,
      senderId: 0,
      text: processedText,
      type: 'text',
      timestamp: new Date().toISOString(),
      isAdmin: true,
    };

    setMessages([...messages, newMessage]);
    setMessageText('');
  };

  const handleSendStamp = (stampId: string) => {
    if (!selectedUserId) return;

    const newMessage: Message = {
      id: messages.length + 1,
      senderId: 0,
      stampId,
      type: 'stamp',
      timestamp: new Date().toISOString(),
      isAdmin: true,
    };

    setMessages([...messages, newMessage]);
    setShowStampPicker(false);
  };

  const handleSendImage = (imageUrl: string) => {
    if (!selectedUserId) return;

    const newMessage: Message = {
      id: messages.length + 1,
      senderId: 0,
      imageUrl,
      type: 'image',
      timestamp: new Date().toISOString(),
      isAdmin: true,
    };

    setMessages([...messages, newMessage]);
    setShowImageUpload(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 実際の実装ではファイルをアップロードしてURLを取得
      // ここではダミーのURLを使用
      const dummyUrl = 'https://via.placeholder.com/400x300';
      handleSendImage(dummyUrl);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageText(messageText + variable);
  };

  if (!isAdmin || !admin) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* ユーザーリスト */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-3">メッセージ</h2>

            {/* フィルターと複数選択モードボタン */}
            <div className="space-y-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">すべて</option>
                <option value="favorites">お気に入り</option>
                <option value="care">介護</option>
                <option value="nursing">看護</option>
                <option value="other">その他</option>
                <option value="upcoming">勤務予定あり</option>
                <option value="recent">直近3ヶ月で勤務実績あり</option>
              </select>
              <button
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedUserIds([]);
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                  isMultiSelectMode
                    ? 'bg-primary text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isMultiSelectMode ? '選択モード解除' : '複数選択モード'}
              </button>
              {isMultiSelectMode && selectedUserIds.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedUserIds.length}人選択中
                </div>
              )}
            </div>
          </div>

          {/* ユーザーリスト */}
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleUserSelection(user.id);
                  } else {
                    setSelectedUserId(user.id);
                  }
                }}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedUserId === user.id ? 'bg-primary-light' : ''
                } ${selectedUserIds.includes(user.id) ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {isMultiSelectMode && (
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="mt-3 w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl flex-shrink-0">
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                        {user.isFavorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(user.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              user.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'
                            }`}
                          />
                        </button>
                        {user.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {user.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{user.lastMessage}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(user.lastMessageTime).toLocaleString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* チャット画面 */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedUser ? (
            <>
              {/* チャットヘッダー */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">
                    {selectedUser.avatar}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedUser.name}</h3>
                    <p className="text-xs text-gray-500">
                      {selectedUser.occupation === 'care' ? '介護' : selectedUser.occupation === 'nursing' ? '看護' : 'その他'}
                    </p>
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
                  {messages
                    .filter((msg) => msg.senderId === 0 || msg.senderId === selectedUserId)
                    .map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`${
                            message.type === 'stamp' ? '' : 'max-w-md'
                          } ${
                            message.type === 'stamp'
                              ? ''
                              : message.isAdmin
                              ? 'bg-primary text-white px-4 py-2 rounded-lg'
                              : 'bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg'
                          }`}
                        >
                          {message.type === 'text' && (
                            <>
                              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                              <p
                                className={`text-xs mt-1 ${
                                  message.isAdmin ? 'text-primary-light' : 'text-gray-400'
                                }`}
                              >
                                {new Date(message.timestamp).toLocaleString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </>
                          )}
                          {message.type === 'stamp' && (
                            <div className="flex flex-col items-center">
                              <div className="text-6xl">
                                {stamps.find((s) => s.id === message.stampId)?.emoji}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(message.timestamp).toLocaleString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          )}
                          {message.type === 'image' && (
                            <div>
                              <img
                                src={message.imageUrl}
                                alt="送信画像"
                                className="max-w-sm rounded-lg"
                              />
                              <p
                                className={`text-xs mt-1 ${
                                  message.isAdmin ? 'text-primary-light' : 'text-gray-400'
                                }`}
                              >
                                {new Date(message.timestamp).toLocaleString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* 入力エリア */}
              <div className="border-t border-gray-200 bg-white">
                {/* コントロールエリア */}
                <div className="px-4 pt-3 pb-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowStampPicker(!showStampPicker)}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="スタンプ"
                    >
                      <Smile className="w-5 h-5 text-gray-600" />
                    </button>
                    <label className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer" title="画像">
                      <Image className="w-5 h-5 text-gray-600" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => setShowVariables(!showVariables)}
                      className="text-sm text-green-600 hover:text-green-700 transition-colors font-medium"
                    >
                      利用できる変数
                      <ChevronDown className={`w-3 h-3 inline-block ml-1 transition-transform ${showVariables ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* スタンプピッカー */}
                  {showStampPicker && (
                    <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium text-gray-700">スタンプを選択</h4>
                        <button
                          onClick={() => setShowStampPicker(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {stamps.map((stamp) => (
                          <button
                            key={stamp.id}
                            onClick={() => handleSendStamp(stamp.id)}
                            className="flex flex-col items-center p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <span className="text-3xl mb-1">{stamp.emoji}</span>
                            <span className="text-xs text-gray-600">{stamp.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 変数パネル */}
                  {showVariables && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                      <div>
                        <button
                          onClick={() => insertVariable('＜ワーカー＞')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          ＜ワーカー＞
                        </button>
                        <span className="text-gray-700">: ワーカーの名字（例: 山田）に変換されます</span>
                      </div>
                      <div>
                        <button
                          onClick={() => insertVariable('＜施設担当＞')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          ＜施設担当＞
                        </button>
                        <span className="text-gray-700">: 事業所責任者の名字（例: 斉藤）に変換されます</span>
                      </div>
                      <div>
                        <button
                          onClick={() => insertVariable('＜施設名＞')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          ＜施設名＞
                        </button>
                        <span className="text-gray-700">: 事業所名（例: ケアテック恵比寿）に変換されます</span>
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
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>ユーザーを選択してメッセージを開始</p>
            </div>
          )}
        </div>

        {/* ユーザー情報パネル */}
        {selectedUser && showUserInfo && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">ワーカー情報</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(selectedUser.id);
                  }}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <Star
                    className={`w-5 h-5 ${
                      selectedUser.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'
                    }`}
                  />
                </button>
              </div>

              {/* 顔写真と基本情報 */}
              <div className="text-center mb-6">
                <div className="relative inline-block mb-3">
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl">
                    {selectedUser.avatar}
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded-full shadow-md border border-gray-200">
                    <p className="text-xs text-gray-700 whitespace-nowrap">
                      {selectedUser.prefecture} {selectedUser.city}
                    </p>
                  </div>
                </div>
                <h4 className="font-bold text-gray-900 text-lg mt-3">{selectedUser.name}</h4>
                <p className="text-sm text-gray-600">
                  {selectedUser.age}歳 / {selectedUser.gender}
                </p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium text-gray-900">{selectedUser.rating.toFixed(1)}</span>
                </div>
              </div>

              {/* 詳細情報 */}
              <div className="space-y-4">
                {/* 資格 */}
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-2">資格</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.qualifications.map((qual, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                      >
                        <Award className="w-3 h-3" />
                        <span>{qual}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 経験 */}
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-2">経験</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.experience.map((exp, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs"
                      >
                        <Briefcase className="w-3 h-3" />
                        <span>{exp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 次回勤務予定 */}
                {selectedUser.nextWorkDate && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <h5 className="text-sm font-bold text-gray-900">次回勤務予定</h5>
                    </div>
                    <div className="pl-6 space-y-1">
                      <p className="text-sm text-gray-700">
                        {new Date(selectedUser.nextWorkDate).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      {selectedUser.nextWorkFacility && (
                        <p className="text-sm text-gray-600">
                          勤務先: {selectedUser.nextWorkFacility}
                        </p>
                      )}
                      {selectedUser.nextWorkJobId && (
                        <a
                          href={`/admin/jobs/${selectedUser.nextWorkJobId}`}
                          className="text-sm text-primary hover:text-primary-dark underline inline-block"
                        >
                          求人詳細を見る →
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* 緊急連絡先 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-gray-600" />
                    <h5 className="text-sm font-bold text-gray-900">緊急連絡先</h5>
                  </div>
                  <button
                    onClick={() => setShowEmergencyContact(true)}
                    className="ml-6 text-sm text-primary hover:text-primary-dark underline"
                  >
                    表示する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 緊急連絡先モーダル */}
        {showEmergencyContact && selectedUser && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowEmergencyContact(false)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">緊急連絡先</h3>
                <button
                  onClick={() => setShowEmergencyContact(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">ワーカー名</p>
                  <p className="text-base font-medium text-gray-900">{selectedUser.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">緊急連絡先</p>
                  <p className="text-base font-medium text-gray-900">
                    {selectedUser.emergencyContact}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmergencyContact(false)}
                className="w-full mt-6 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
