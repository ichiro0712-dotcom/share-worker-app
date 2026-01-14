import Link from 'next/link';
import {
  ChevronRight,
  User as UserIcon,
  Calendar,
  Heart,
  HelpCircle,
  FileText,
  Star,
  MessageSquare,
  VolumeX,
  MessageCircle,
  Shield,
  Bell,
} from 'lucide-react';
import { UserCard, LogoutButton } from './MyPageContent';

// 静的メニュー項目（ログアウト以外）
const menuItems = [
  { icon: 'calendar', label: '仕事管理', href: '/my-jobs' },
  { icon: 'messageSquare', label: 'レビュー', href: '/mypage/reviews' },
  { icon: 'heart', label: 'お気に入り施設', href: '/favorites' },
  { icon: 'star', label: 'ブックマーク求人', href: '/bookmarks' },
  { icon: 'user', label: 'プロフィール編集', href: '/mypage/profile' },
  { icon: 'bell', label: '通知設定', href: '/mypage/notifications' },
  { icon: 'helpCircle', label: 'よくある質問', href: '/faq' },
  { icon: 'messageCircle', label: 'お問い合わせ', href: '/contact' },
  { icon: 'fileText', label: '利用規約', href: '/terms' },
  { icon: 'shield', label: 'プライバシーポリシー', href: '/privacy' },
  { icon: 'volumeX', label: 'ミュート施設', href: '/mypage/muted-facilities' },
] as const;

// アイコンコンポーネントのマッピング
const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  messageSquare: MessageSquare,
  heart: Heart,
  star: Star,
  user: UserIcon,
  bell: Bell,
  helpCircle: HelpCircle,
  messageCircle: MessageCircle,
  fileText: FileText,
  shield: Shield,
  volumeX: VolumeX,
};

export default function MyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 静的ヘッダー - Server Component（即座にHTML表示） */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold">マイページ</h1>
        </div>
      </div>

      {/* 動的ユーザー情報カード - Client Component */}
      <UserCard />

      {/* 静的メニュー - Server Component（即座にHTML表示） */}
      <div className="bg-white border-b border-gray-200">
        {menuItems.map((item, index) => {
          const IconComponent = IconMap[item.icon];
          return (
            <Link
              key={index}
              href={item.href}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-600">
                  <IconComponent className="w-5 h-5" />
                </span>
                <span className="text-sm">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          );
        })}
      </div>

      {/* ログアウトボタン - Client Component */}
      <LogoutButton />

      {/* バージョン情報 - 静的 */}
      <div className="text-center py-4 text-xs text-gray-500">
        +TASTAS v1.0.0 (Phase 1)
      </div>
    </div>
  );
}
