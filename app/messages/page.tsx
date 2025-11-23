'use client';

import { useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { ChevronLeft, Send, Paperclip, MapPin, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: number;
  senderId: number;
  senderType: 'worker' | 'facility';
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface ChatRoom {
  id: number;
  facilityId: number;
  facilityName: string;
  jobTitle: string;
  jobDate: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export default function MessagesPage() {
  const router = useRouter();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messageInput, setMessageInput] = useState('');

  // ダミーデータ
  const [chatRooms] = useState<ChatRoom[]>([
    {
      id: 1,
      facilityId: 1,
      facilityName: 'さくら介護施設',
      jobTitle: '訪問介護スタッフ',
      jobDate: '2025-12-01',
      lastMessage: 'ご応募ありがとうございます。面談の日程についてご相談させてください。',
      lastMessageTime: '10:30',
      unreadCount: 2,
      messages: [
        {
          id: 1,
          senderId: 1,
          senderType: 'facility',
          senderName: 'さくら介護施設',
          content: 'この度はご応募いただきありがとうございます。',
          timestamp: '2025-11-23 09:00',
          isRead: true,
        },
        {
          id: 2,
          senderId: 1,
          senderType: 'facility',
          senderName: 'さくら介護施設',
          content: 'ご応募ありがとうございます。面談の日程についてご相談させてください。',
          timestamp: '2025-11-23 10:30',
          isRead: false,
        },
      ],
    },
    {
      id: 2,
      facilityId: 2,
      facilityName: 'ひまわりクリニック',
      jobTitle: '看護師',
      jobDate: '2025-12-05',
      lastMessage: '勤務開始時刻は8:30からとなります。よろしくお願いいたします。',
      lastMessageTime: '昨日',
      unreadCount: 0,
      messages: [
        {
          id: 1,
          senderId: 2,
          senderType: 'facility',
          senderName: 'ひまわりクリニック',
          content: 'マッチングありがとうございます。勤務開始時刻は8:30からとなります。よろしくお願いいたします。',
          timestamp: '2025-11-22 15:00',
          isRead: true,
        },
      ],
    },
    {
      id: 3,
      facilityId: 3,
      facilityName: 'もみじ薬局',
      jobTitle: '薬剤師',
      jobDate: '2025-11-28',
      lastMessage: '承知いたしました。当日お待ちしております。',
      lastMessageTime: '11/21',
      unreadCount: 0,
      messages: [
        {
          id: 1,
          senderId: 1,
          senderType: 'worker',
          senderName: '田中 花子',
          content: '勤務日の確認をさせていただきたいのですが、11月28日で間違いないでしょうか。',
          timestamp: '2025-11-21 14:00',
          isRead: true,
        },
        {
          id: 2,
          senderId: 3,
          senderType: 'facility',
          senderName: 'もみじ薬局',
          content: '承知いたしました。当日お待ちしております。',
          timestamp: '2025-11-21 16:00',
          isRead: true,
        },
      ],
    },
  ]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedRoom) return;

    // メッセージ送信処理（実際はAPI呼び出し）
    console.log('送信:', messageInput);
    setMessageInput('');
  };

  const handleBackToList = () => {
    setSelectedRoom(null);
  };

  // チャットルーム一覧表示
  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">メッセージ</h1>
        </div>

        {/* チャットルーム一覧 */}
        <div className="divide-y divide-gray-200">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className="w-full bg-white hover:bg-gray-50 px-4 py-4 text-left transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* 施設アイコン */}
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-lg">
                    {room.facilityName.charAt(0)}
                  </span>
                </div>

                {/* メッセージ情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 truncate">
                      {room.facilityName}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">
                        {room.lastMessageTime}
                      </span>
                      {room.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 求人情報 */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span>{room.jobDate}</span>
                    <span>・</span>
                    <span>{room.jobTitle}</span>
                  </div>

                  {/* 最終メッセージ */}
                  <p className="text-sm text-gray-600 truncate">
                    {room.lastMessage}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 空の状態 */}
        {chatRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-center">
              メッセージはまだありません
            </p>
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
              {selectedRoom.facilityName}
            </h2>
            <p className="text-xs text-gray-600 truncate">
              {selectedRoom.jobTitle} - {selectedRoom.jobDate}
            </p>
          </div>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {selectedRoom.messages.map((message) => {
          const isWorker = message.senderType === 'worker';
          return (
            <div
              key={message.id}
              className={`flex ${isWorker ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] ${
                  isWorker
                    ? 'bg-primary text-white'
                    : 'bg-white border border-gray-200'
                } rounded-2xl px-4 py-2`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    isWorker ? 'text-white/70' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.split(' ')[1]}
                </p>
              </div>
            </div>
          );
        })}
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
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className={`p-2 rounded-full transition-colors ${
              messageInput.trim()
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
