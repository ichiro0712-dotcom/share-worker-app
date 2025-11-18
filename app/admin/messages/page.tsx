'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Send, Info, Phone, MapPin, Calendar, Star, Briefcase, Award, ChevronDown } from 'lucide-react';

type FilterType = 'all' | 'care' | 'nursing' | 'other' | 'upcoming' | 'recent';

interface Message {
  id: number;
  senderId: number;
  text: string;
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
  emergencyContact: string;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showVariables, setShowVariables] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

  // ダミーのチャットユーザーリスト
  const chatUsers: ChatUser[] = [
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
      emergencyContact: '080-1234-5678（山田太郎・夫）',
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
      emergencyContact: '090-9876-5432（佐藤美香・妻）',
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
      emergencyContact: '090-3333-4444（田中一郎・夫）',
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
    },
  ];

  // ダミーのメッセージデータ
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      senderId: 0, // 管理者
      text: '山田様\n\nこの度は、ケアテック恵比寿の求人にご応募いただき、誠にありがとうございます。\n施設長の斉藤と申します。',
      timestamp: '2025-11-18T09:00:00',
      isAdmin: true,
    },
    {
      id: 2,
      senderId: 1,
      text: 'こちらこそ、よろしくお願いいたします。',
      timestamp: '2025-11-18T09:15:00',
      isAdmin: false,
    },
    {
      id: 3,
      senderId: 0,
      text: '勤務日の詳細について確認させていただきたいのですが、11月25日の9:00〜17:00でお間違いないでしょうか？',
      timestamp: '2025-11-18T10:00:00',
      isAdmin: true,
    },
    {
      id: 4,
      senderId: 1,
      text: 'はい、その日時で大丈夫です。',
      timestamp: '2025-11-19T10:25:00',
      isAdmin: false,
    },
    {
      id: 5,
      senderId: 1,
      text: 'ありがとうございます。よろしくお願いいたします。',
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
    return true;
  });

  const selectedUser = selectedUserId ? chatUsers.find(u => u.id === selectedUserId) : null;

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedUserId) return;

    // 変数を実際の値に置き換え
    let processedText = messageText;
    if (selectedUser) {
      const workerLastName = selectedUser.name.split(' ')[0];
      processedText = processedText.replace(/\[ワーカー名字\]/g, workerLastName);
    }
    processedText = processedText.replace(/\[事業所責任者名字\]/g, '斉藤');
    processedText = processedText.replace(/\[事業所名\]/g, 'ケアテック恵比寿');

    const newMessage: Message = {
      id: messages.length + 1,
      senderId: 0,
      text: processedText,
      timestamp: new Date().toISOString(),
      isAdmin: true,
    };

    setMessages([...messages, newMessage]);
    setMessageText('');
  };

  const insertVariable = (variable: string) => {
    setMessageText(messageText + variable);
    setShowVariables(false);
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

            {/* フィルター */}
            <div className="space-y-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">すべて</option>
                <option value="care">介護</option>
                <option value="nursing">看護</option>
                <option value="other">その他</option>
                <option value="upcoming">勤務予定あり</option>
                <option value="recent">直近3ヶ月で勤務実績あり</option>
              </select>
            </div>
          </div>

          {/* ユーザーリスト */}
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedUserId === user.id ? 'bg-primary-light' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl flex-shrink-0">
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                      {user.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {user.unreadCount}
                        </span>
                      )}
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
                          className={`max-w-md px-4 py-2 rounded-lg ${
                            message.isAdmin
                              ? 'bg-primary text-white'
                              : 'bg-white border border-gray-200 text-gray-900'
                          }`}
                        >
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
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* 入力エリア */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="mb-2">
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                  >
                    利用できる変数
                    <ChevronDown className={`w-4 h-4 transition-transform ${showVariables ? 'rotate-180' : ''}`} />
                  </button>

                  {showVariables && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-2">
                      <div>
                        <button
                          onClick={() => insertVariable('[ワーカー名字]')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          [ワーカー名字]
                        </button>
                        <span className="text-gray-700">: ワーカーの名字（例: 山田）に変換されます</span>
                      </div>
                      <div>
                        <button
                          onClick={() => insertVariable('[事業所責任者名字]')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          [事業所責任者名字]
                        </button>
                        <span className="text-gray-700">: 事業所責任者の名字（例: 斉藤）に変換されます</span>
                      </div>
                      <div>
                        <button
                          onClick={() => insertVariable('[事業所名]')}
                          className="text-blue-700 hover:underline font-mono"
                        >
                          [事業所名]
                        </button>
                        <span className="text-gray-700">: 事業所名（例: ケアテック恵比寿）に変換されます</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
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
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    送信
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
              <h3 className="text-lg font-bold text-gray-900 mb-4">ワーカー情報</h3>

              {/* 顔写真と基本情報 */}
              <div className="text-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl mx-auto mb-3">
                  {selectedUser.avatar}
                </div>
                <h4 className="font-bold text-gray-900 text-lg">{selectedUser.name}</h4>
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
                {/* 経験・資格 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-gray-600" />
                    <h5 className="text-sm font-bold text-gray-900">資格</h5>
                  </div>
                  <div className="space-y-1">
                    {selectedUser.qualifications.map((qual, index) => (
                      <div key={index} className="text-sm text-gray-700 pl-6">• {qual}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4 text-gray-600" />
                    <h5 className="text-sm font-bold text-gray-900">経験</h5>
                  </div>
                  <div className="space-y-1">
                    {selectedUser.experience.map((exp, index) => (
                      <div key={index} className="text-sm text-gray-700 pl-6">• {exp}</div>
                    ))}
                  </div>
                </div>

                {/* 住所 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-gray-600" />
                    <h5 className="text-sm font-bold text-gray-900">住所</h5>
                  </div>
                  <p className="text-sm text-gray-700 pl-6">
                    {selectedUser.prefecture} {selectedUser.city}
                  </p>
                </div>

                {/* 次回勤務予定 */}
                {selectedUser.nextWorkDate && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <h5 className="text-sm font-bold text-gray-900">次回勤務予定</h5>
                    </div>
                    <p className="text-sm text-gray-700 pl-6">
                      {new Date(selectedUser.nextWorkDate).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {/* 緊急連絡先 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-gray-600" />
                    <h5 className="text-sm font-bold text-gray-900">緊急連絡先</h5>
                  </div>
                  <p className="text-sm text-gray-700 pl-6">{selectedUser.emergencyContact}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
