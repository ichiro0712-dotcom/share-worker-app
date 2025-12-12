'use client';

import Link from 'next/link';
import {
    MessageSquareText,
    BookOpen,
    FileText,
    Bell,
    FileSignature,
    LayoutTemplate,
    BellRing,
    MessageCircle,
    Shield,
} from 'lucide-react';

interface ContentCard {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
    enabled: boolean;
}

export default function ContentManagementPage() {
    const contentCards: ContentCard[] = [
        {
            title: 'FAQ編集',
            description: 'ワーカー・施設向けのよくある質問を管理',
            href: '/system-admin/content/faq',
            icon: <MessageSquareText className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: 'ご利用ガイド編集',
            description: '施設向けご利用ガイドPDFを管理',
            href: '/system-admin/content/user-guide',
            icon: <BookOpen className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: '利用規約・PP編集',
            description: '利用規約・プライバシーポリシーを管理',
            href: '/system-admin/content/legal',
            icon: <FileText className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: 'お知らせ管理',
            description: 'ワーカー・施設へのお知らせを作成・編集',
            href: '/system-admin/announcements',
            icon: <Bell className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: '労働条件通知書テンプレート',
            description: '労働条件通知書のテンプレートを編集',
            href: '/system-admin/content/labor-template',
            icon: <FileSignature className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: 'テンプレート管理',
            description: '求人フォーマット・メール・メッセージテンプレート',
            href: '/system-admin/content/templates',
            icon: <LayoutTemplate className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: '通知管理',
            description: '通知タイミングと表示先を一覧で確認',
            href: '/system-admin/content/notifications',
            icon: <BellRing className="w-6 h-6" />,
            enabled: true,
        },
        {
            title: 'NGワード管理',
            description: 'メッセージやレビュー、求人内容などに登録できないワードの設定',
            href: '/system-admin/content/ng-words',
            icon: <MessageCircle className="w-6 h-6" />,
            enabled: false,
        },
        {
            title: '巡回機能管理',
            description: 'AI巡回・テンプレート承認・不適切コンテンツ監視',
            href: '/system-admin/content/patrol',
            icon: <Shield className="w-6 h-6" />,
            enabled: false,
        },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">コンテンツ管理</h1>
                <p className="text-slate-500">FAQ、利用規約、各種テンプレートなどのコンテンツを管理します</p>
            </div>

            {/* 有効なカード */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-700 mb-4">編集可能</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contentCards.filter(card => card.enabled).map((card, index) => (
                        <Link
                            key={index}
                            href={card.href}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-indigo-300 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                                    {card.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                        {card.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">{card.description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* 今後実装予定 */}
            <div>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">今後実装予定</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contentCards.filter(card => !card.enabled).map((card, index) => (
                        <div
                            key={index}
                            className="bg-slate-50 rounded-xl border border-slate-200 p-6 opacity-60 cursor-not-allowed"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-slate-200 rounded-lg text-slate-400">
                                    {card.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-500">
                                        {card.title}
                                    </h3>
                                    <p className="text-sm text-slate-400 mt-1">{card.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
