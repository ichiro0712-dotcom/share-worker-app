import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { MemoPad } from './MemoPad';
import { Smartphone, Layout, Hash, Shield, Book, Users, Building2, Settings, ExternalLink, Image as ImageIcon, BellRing, ListChecks, Clock } from 'lucide-react';

// サイトマップ定義（ツリー構造）
interface SiteMapNode {
    name: string;
    title: string;
    href?: string;
    isDynamic?: boolean;
    children?: SiteMapNode[];
}

// ワーカー画面（ツリー構造）
const WORKER_TREE: SiteMapNode[] = [
    { name: '/', title: 'トップページ (LP)', href: '/' },
    { name: 'login', title: 'ログインページ', href: '/login' },
    {
        name: 'register', title: '新規登録', href: '/register', children: [
            { name: 'worker', title: 'ワーカー情報登録', href: '/register/worker' },
        ]
    },
    {
        name: 'jobs', title: '求人一覧', href: '/jobs', children: [
            { name: '[id]', title: '求人詳細', isDynamic: true },
        ]
    },
    { name: 'job-list', title: '求人リスト（別形式）', href: '/job-list' },
    {
        name: 'mypage', title: 'マイページ', href: '/mypage', children: [
            { name: 'profile', title: 'プロフィール編集', href: '/mypage/profile' },
            { name: 'applications', title: '応募一覧', href: '/mypage/applications' },
            {
                name: 'reviews', title: 'レビュー', href: '/mypage/reviews', children: [
                    { name: 'received', title: '受け取ったレビュー', href: '/mypage/reviews/received' },
                    { name: '[applicationId]', title: 'レビュー投稿', isDynamic: true },
                ]
            },
            { name: 'muted-facilities', title: 'ミュート施設', href: '/mypage/muted-facilities' },
        ]
    },
    {
        name: 'my-jobs', title: 'マイ求人', href: '/my-jobs', children: [
            {
                name: '[id]', title: '求人詳細', isDynamic: true, children: [
                    { name: 'labor-document', title: '労働条件通知書', isDynamic: true },
                ]
            },
        ]
    },
    { name: 'applications', title: '応募管理', href: '/applications' },
    { name: 'messages', title: 'メッセージ', href: '/messages' },
    { name: 'notifications', title: '通知', href: '/notifications' },
    { name: 'favorites', title: 'お気に入り', href: '/favorites' },
    { name: 'bookmarks', title: 'ブックマーク', href: '/bookmarks' },
    {
        name: 'facilities', title: '施設', children: [
            { name: '[id]', title: '施設詳細', isDynamic: true },
        ]
    },
    { name: 'application-complete', title: '応募完了', href: '/application-complete' },
    {
        name: 'password-reset', title: 'パスワードリセット', href: '/password-reset', children: [
            { name: '[token]', title: 'パスワード再設定', isDynamic: true },
        ]
    },
    { name: 'contact', title: 'お問い合わせ', href: '/contact' },
    { name: 'faq', title: 'FAQ', href: '/faq' },
    { name: 'terms', title: '利用規約', href: '/terms' },
    { name: 'privacy', title: 'プライバシーポリシー', href: '/privacy' },
];

// 施設管理画面（ツリー構造）
const ADMIN_TREE: SiteMapNode[] = [
    { name: '/', title: '管理ダッシュボード', href: '/admin' },
    { name: 'login', title: '管理者ログイン', href: '/admin/login' },
    {
        name: 'jobs', title: '求人管理', href: '/admin/jobs', children: [
            { name: 'new', title: '求人作成', href: '/admin/jobs/new' },
            {
                name: '[id]', title: '求人詳細', isDynamic: true, children: [
                    { name: 'edit', title: '求人編集', isDynamic: true },
                ]
            },
            {
                name: 'templates', title: 'テンプレート一覧', href: '/admin/jobs/templates', children: [
                    { name: 'new', title: 'テンプレート作成', href: '/admin/jobs/templates/new' },
                    {
                        name: '[id]', title: 'テンプレート詳細', isDynamic: true, children: [
                            { name: 'edit', title: 'テンプレート編集', isDynamic: true },
                        ]
                    },
                ]
            },
        ]
    },
    { name: 'applications', title: '応募管理', href: '/admin/applications' },
    { name: 'shifts', title: 'シフト管理', href: '/admin/shifts' },
    {
        name: 'workers', title: 'ワーカー管理', href: '/admin/workers', children: [
            {
                name: '[id]', title: 'ワーカー詳細', isDynamic: true, children: [
                    { name: 'review', title: 'レビュー投稿', isDynamic: true },
                    { name: 'certificates', title: '資格証明書', isDynamic: true },
                    { name: 'emergency-contacts', title: '緊急連絡先', isDynamic: true },
                    { name: 'schedules', title: '勤務予定', isDynamic: true },
                    {
                        name: 'labor-documents', title: '労働条件通知書一覧', isDynamic: true, children: [
                            { name: '[applicationId]', title: '労働条件通知書詳細', isDynamic: true },
                        ]
                    },
                ]
            },
        ]
    },
    { name: 'worker-reviews', title: 'ワーカーレビュー管理', href: '/admin/worker-reviews' },
    { name: 'reviews', title: '施設レビュー管理', href: '/admin/reviews' },
    { name: 'facility', title: '施設情報', href: '/admin/facility' },
    { name: 'messages', title: 'メッセージ', href: '/admin/messages' },
    { name: 'notifications', title: 'お知らせ管理', href: '/admin/notifications' },
    { name: 'masquerade', title: 'なりすまし', href: '/admin/masquerade' },
    {
        name: 'masquerade-actions', title: 'なりすまし操作', children: [
            { name: 'password-reset', title: 'パスワードリセット', href: '/admin/masquerade-actions/password-reset' },
            { name: 'delete-facility', title: '施設削除', href: '/admin/masquerade-actions/delete-facility' },
        ]
    },
    { name: 'faq', title: 'FAQ', href: '/admin/faq' },
    { name: 'terms-privacy', title: '利用規約・プライバシーポリシー', href: '/admin/terms-privacy' },
];

// システム管理画面（ツリー構造）
const SYSTEM_ADMIN_TREE: SiteMapNode[] = [
    { name: '/', title: 'システム管理ダッシュボード', href: '/system-admin' },
    { name: 'login', title: 'システム管理者ログイン', href: '/system-admin/login' },
    {
        name: 'facilities', title: '施設管理', href: '/system-admin/facilities', children: [
            { name: 'new', title: '施設新規登録', href: '/system-admin/facilities/new' },
        ]
    },
    { name: 'jobs', title: '求人管理', href: '/system-admin/jobs' },
    {
        name: 'workers', title: 'ワーカー管理', href: '/system-admin/workers', children: [
            { name: '[id]', title: 'ワーカー詳細', isDynamic: true },
        ]
    },
    {
        name: 'announcements', title: 'お知らせ管理', href: '/system-admin/announcements', children: [
            { name: 'create', title: '新規作成', href: '/system-admin/announcements/create' },
            { name: '[id]', title: '編集', isDynamic: true },
        ]
    },
    { name: 'alerts', title: 'アラート', href: '/system-admin/alerts' },
    {
        name: 'content', title: 'コンテンツ管理', href: '/system-admin/content', children: [
            { name: 'notifications', title: '通知テンプレート', href: '/system-admin/content/notifications' },
            { name: 'templates', title: 'エラーメッセージ設定', href: '/system-admin/content/templates' },
            { name: 'faq', title: 'FAQ管理', href: '/system-admin/content/faq' },
            { name: 'legal', title: '規約・ポリシー', href: '/system-admin/content/legal' },
            { name: 'user-guide', title: '使い方ガイド', href: '/system-admin/content/user-guide' },
            { name: 'labor-template', title: '労働条件通知書テンプレート', href: '/system-admin/content/labor-template' },
        ]
    },
    {
        name: 'analytics', title: 'アナリティクス', href: '/system-admin/analytics', children: [
            { name: 'regions', title: '地域別分析', href: '/system-admin/analytics/regions' },
            { name: 'ai', title: 'AIインサイト', href: '/system-admin/analytics/ai' },
            { name: 'export', title: 'データエクスポート', href: '/system-admin/analytics/export' },
        ]
    },
    {
        name: 'settings', title: 'システム設定', children: [
            { name: 'admins', title: '管理者アカウント管理', href: '/system-admin/settings/admins' },
        ]
    },
    {
        name: 'dev-portal', title: '開発ポータル', href: '/system-admin/dev-portal', children: [
            { name: 'sample-images', title: 'サンプル画像', href: '/system-admin/dev-portal/sample-images' },
            { name: 'notification-logs', title: '通知ログ', href: '/system-admin/dev-portal/notification-logs' },
        ]
    },
    {
        name: 'debug-checklist', title: 'デバッグチェックリスト', href: '/system-admin/dev-portal/debug-checklist'
    },
];

// 独立画面（ツリー構造）
const STANDALONE_TREE: SiteMapNode[] = [
    { name: 'style-guide', title: 'スタイルガイド', href: '/style-guide' },
    {
        name: 'dev', title: 'モバイルテスト', href: '/dev', children: [
            { name: 'qr', title: 'QR生成', href: '/dev/qr' },
        ]
    },
    { name: 'pwa-test', title: 'PWAテスト', href: '/pwa-test' },
    {
        name: 'masquerade', title: 'なりすまし', children: [
            { name: 'worker', title: 'ワーカーなりすまし', href: '/masquerade/worker' },
        ]
    },
    { name: 'under-construction', title: '準備中ページ', href: '/under-construction' },
    { name: 'auth-construction', title: '認証準備中', href: '/auth-construction' },
];

// Document Title Mapping
const DOC_TITLES: Record<string, string> = {
    'requirements.md': '要件定義書',
    'screen-specification.md': '画面仕様書',
    'system-design.md': 'システム設計書',
    'LLM_TASK.md': 'LLMタスク管理',
    'style-guide-admin.md': '管理者向けスタイルガイド',
    'style-guide-worker.md': 'ワーカー向けスタイルガイド',
    'system-admin-features.md': 'システム管理機能',
    'PHASE1_PLAN.md': 'フェーズ1計画書',
    'TASK_WORKER_REVIEW.md': 'ワーカーレビュー実装タスク',
    'LLM_TASK_DESIGN_UPDATES.md': 'デザイン更新タスク',
};

// Helper to get flat list of docs
const getDocs = (dirPath: string): string[] => {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
};

// ツリー表示コンポーネント
const SiteMapTree = ({
    nodes,
    colorScheme = 'blue',
    depth = 0
}: {
    nodes: SiteMapNode[],
    colorScheme?: 'blue' | 'green' | 'purple',
    depth?: number
}) => {
    const colors = {
        blue: {
            link: 'text-blue-600 hover:text-blue-800',
            line: 'border-blue-200',
        },
        green: {
            link: 'text-green-600 hover:text-green-800',
            line: 'border-green-200',
        },
        purple: {
            link: 'text-purple-600 hover:text-purple-800',
            line: 'border-purple-200',
        },
    };
    const c = colors[colorScheme];

    return (
        <div className={depth > 0 ? `ml-4 pl-3 border-l-2 ${c.line}` : ''}>
            {nodes.map((node, index) => (
                <div key={`${node.name}-${index}`} className="py-1">
                    <div className="flex items-center gap-2">
                        {/* ディレクトリ/ファイル名 */}
                        <span className="text-gray-400 text-xs font-mono min-w-[80px]">{node.name}</span>

                        {/* リンクまたは動的ルート表示 */}
                        {node.isDynamic ? (
                            <span className="text-gray-500 text-sm">{node.title}</span>
                        ) : node.href ? (
                            <Link
                                href={node.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-sm font-medium ${c.link} hover:underline flex items-center gap-1`}
                            >
                                {node.title}
                                <ExternalLink className="w-3 h-3 opacity-40" />
                            </Link>
                        ) : (
                            <span className="text-gray-700 text-sm">{node.title}</span>
                        )}
                    </div>

                    {/* 子ノード */}
                    {node.children && node.children.length > 0 && (
                        <SiteMapTree nodes={node.children} colorScheme={colorScheme} depth={depth + 1} />
                    )}
                </div>
            ))}
        </div>
    );
};


export default function DevPortalPage() {
    const docsDir = path.join(process.cwd(), 'docs');
    const claudeDocsDir = path.join(process.cwd(), 'claudedocs');

    const docs = getDocs(docsDir);
    const claudeDocs = getDocs(claudeDocsDir);

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-[900px] mx-auto space-y-6">

                {/* Header */}
                <header className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <Hash className="w-6 h-6 text-white" />
                            </div>
                            開発ポータル
                        </h1>
                        <p className="text-sm text-gray-500">+TASTAS Development Hub</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/system-admin" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                            システム管理へ戻る
                        </Link>
                    </div>
                </header>

                {/* Quick Links */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                        <Layout className="w-4 h-4 text-blue-600" />
                        クイックリンク
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Link href="/style-guide" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-blue-600">スタイルガイド</div>
                                <Layout className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            </div>
                            <p className="text-xs text-gray-500">UIコンポーネント・配色</p>
                        </Link>
                        <Link href="/dev" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-purple-600">モバイル検証QR</div>
                                <Smartphone className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                            </div>
                            <p className="text-xs text-gray-500">実機テスト用URL</p>
                        </Link>
                        <Link href="/admin/login" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-green-600">管理者ログイン</div>
                                <Shield className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                            </div>
                            <p className="text-xs text-gray-500">施設管理画面へ</p>
                        </Link>
                        <Link href="/system-admin" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-red-600">システム管理</div>
                                <Shield className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                            </div>
                            <p className="text-xs text-gray-500">全体管理者ダッシュボード</p>
                        </Link>
                        <Link href="/system-admin/dev-portal/sample-images" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-pink-600">サンプル画像</div>
                                <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-pink-500" />
                            </div>
                            <p className="text-xs text-gray-500">モック用画像素材集</p>
                        </Link>
                        <Link href="/system-admin/dev-portal/notification-logs" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-orange-600">通知ログ</div>
                                <BellRing className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                            </div>
                            <p className="text-xs text-gray-500">送信済み通知の確認</p>
                        </Link>
                        <Link href="/system-admin/dev-portal/debug-checklist" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-blue-600">デバッグ項目</div>
                                <ListChecks className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            </div>
                            <p className="text-xs text-gray-500">機能検証チェックリスト</p>
                        </Link>
                        <Link href="/system-admin/dev-portal/debug-time" target="_blank" rel="noopener noreferrer" className="block w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all group bg-white">
                            <div className="flex items-center justify-between mb-1">
                                <div className="font-bold text-gray-800 group-hover:text-indigo-600">デバッグ時刻</div>
                                <Clock className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                            </div>
                            <p className="text-xs text-gray-500">システム時刻の変更</p>
                        </Link>
                    </div>
                </div>

                {/* Site Maps - 3 sections */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                        <Settings className="w-5 h-5 text-orange-600" />
                        サイトマップ
                    </h2>

                    <div className="space-y-6">
                        {/* ワーカー画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                ワーカー画面
                            </h3>
                            <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-4">
                                <SiteMapTree nodes={WORKER_TREE} colorScheme="blue" />
                            </div>
                        </div>

                        {/* 施設管理画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                施設管理画面 <span className="text-xs font-normal text-gray-400">(/admin)</span>
                            </h3>
                            <div className="bg-green-50/50 rounded-lg border border-green-100 p-4">
                                <SiteMapTree nodes={ADMIN_TREE} colorScheme="green" />
                            </div>
                        </div>

                        {/* システム管理画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                システム管理画面 <span className="text-xs font-normal text-gray-400">(/system-admin)</span>
                            </h3>
                            <div className="bg-red-50/50 rounded-lg border border-red-100 p-4">
                                <SiteMapTree nodes={SYSTEM_ADMIN_TREE} colorScheme="purple" />
                            </div>
                        </div>

                        {/* 独立画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                独立画面（開発・ツール）
                            </h3>
                            <div className="bg-purple-50/50 rounded-lg border border-purple-100 p-4">
                                <SiteMapTree nodes={STANDALONE_TREE} colorScheme="purple" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Docs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                            <Book className="w-4 h-4 text-green-600" />
                            プロジェクト資料 (docs/)
                        </h2>
                        <ul className="space-y-2">
                            {docs.map(doc => {
                                const title = DOC_TITLES[doc];
                                return (
                                    <li key={doc} className="p-2 rounded hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                {title && <div className="text-sm font-bold text-gray-900 mb-0.5">{title}</div>}
                                                <div className="text-xs text-gray-500 font-mono break-all">{doc}</div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                            <Book className="w-4 h-4 text-teal-600" />
                            Claudeドキュメント
                        </h2>
                        <ul className="space-y-2 text-sm">
                            {claudeDocs.map(doc => {
                                const title = DOC_TITLES[doc];
                                return (
                                    <li key={doc} className="p-2 rounded hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                {title && <div className="text-sm font-bold text-gray-900 mb-0.5">{title}</div>}
                                                <div className="text-xs text-gray-500 font-mono break-all">{doc}</div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>

                {/* Memo */}
                <MemoPad />

            </div>
        </div >
    );
}
