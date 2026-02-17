import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { MemoPad } from './MemoPad';
import { Smartphone, Layout, Hash, Shield, Book, Users, Building2, Settings, ExternalLink, Image as ImageIcon, BellRing, ListChecks, Clock, Bug, Activity, AlertTriangle, Calculator } from 'lucide-react';

// サイトマップ定義（ツリー構造）
interface SiteMapNode {
    name: string;
    title: string;
    href?: string;
    isDynamic?: boolean;
    isConversion?: boolean;  // コンバージョン計測対象
    note?: string;           // 広告タグ管理用メモ
    children?: SiteMapNode[];
}

// ワーカー画面（ツリー構造）
const WORKER_TREE: SiteMapNode[] = [
    { name: '/', title: 'トップページ (LP)', href: '/', isConversion: true, note: 'LP表示' },
    { name: 'login', title: 'ログインページ', href: '/login' },
    {
        name: 'register', title: '新規登録', href: '/register', isConversion: true, note: '会員登録開始', children: [
            { name: 'worker', title: 'ワーカー情報登録（プロフィール入力）', href: '/register/worker', isConversion: true, note: 'プロフィール入力完了' },
        ]
    },
    {
        name: 'auth', title: '認証関連', children: [
            { name: 'verify', title: 'メール認証確認', href: '/auth/verify', isConversion: true, note: 'メール認証完了 ★重要CV' },
            { name: 'verify-pending', title: '認証待機中（メール送信済み）', href: '/auth/verify-pending' },
            { name: 'resend-verification', title: '認証メール再送信', href: '/auth/resend-verification' },
        ]
    },
    {
        name: 'jobs', title: '求人一覧', href: '/jobs', children: [
            {
                name: '[id]', title: '求人詳細', isDynamic: true, note: '/jobs/123 形式', children: [
                    { name: 'labor-document', title: '労働条件通知書（ログイン後）', isDynamic: true, note: '/jobs/123/labor-document' },
                ]
            },
        ]
    },
    { name: 'job-list', title: '求人リスト（別レイアウト）', href: '/job-list' },
    {
        name: 'public/jobs', title: '公開求人（ログイン不要）', children: [
            {
                name: '[id]', title: '求人詳細（公開）', isDynamic: true, note: '/public/jobs/123 形式', children: [
                    { name: 'labor-document', title: '労働条件通知書（公開）', isDynamic: true },
                ]
            },
        ]
    },
    {
        name: 'mypage', title: 'マイページ', href: '/mypage', children: [
            { name: 'profile', title: 'プロフィール編集', href: '/mypage/profile' },
            { name: 'applications', title: '応募一覧', href: '/mypage/applications' },
            { name: 'notifications', title: '通知設定', href: '/mypage/notifications' },
            {
                name: 'reviews', title: 'レビュー', href: '/mypage/reviews', children: [
                    { name: 'received', title: '受け取ったレビュー', href: '/mypage/reviews/received' },
                    { name: '[applicationId]', title: 'レビュー投稿', isDynamic: true, note: '/mypage/reviews/456' },
                ]
            },
            { name: 'muted-facilities', title: 'ミュート施設', href: '/mypage/muted-facilities' },
            {
                name: 'attendance', title: '勤怠', children: [
                    { name: '[attendanceId]', title: '勤怠詳細', isDynamic: true, note: '/mypage/attendance/789' },
                ]
            },
        ]
    },
    {
        name: 'my-jobs', title: 'マイ求人（採用済み案件）', href: '/my-jobs', children: [
            {
                name: '[id]', title: '求人詳細', isDynamic: true, children: [
                    { name: 'labor-document', title: '労働条件通知書', isDynamic: true },
                ]
            },
        ]
    },
    { name: 'applications', title: '応募管理', href: '/applications' },
    { name: 'messages', title: 'メッセージ', href: '/messages' },
    { name: 'notifications', title: '通知一覧', href: '/notifications' },
    { name: 'favorites', title: 'お気に入り', href: '/favorites' },
    { name: 'bookmarks', title: 'ブックマーク', href: '/bookmarks' },
    {
        name: 'attendance', title: '勤怠', href: '/attendance', children: [
            { name: 'modify', title: '勤怠修正申請', href: '/attendance/modify' },
        ]
    },
    {
        name: 'facilities', title: '施設', children: [
            { name: '[id]', title: '施設詳細', isDynamic: true, note: '/facilities/123' },
        ]
    },
    { name: 'application-complete', title: '応募完了', href: '/application-complete', isConversion: true, note: '求人応募完了 ★重要CV' },
    {
        name: 'password-reset', title: 'パスワードリセット', href: '/password-reset', children: [
            { name: '[token]', title: 'パスワード再設定完了', isDynamic: true, note: '/password-reset/token123' },
        ]
    },
    { name: 'contact', title: 'お問い合わせ', href: '/contact' },
    { name: 'faq', title: 'FAQ', href: '/faq' },
    { name: 'terms', title: '利用規約（ワーカー向け）', href: '/terms' },
    { name: 'terms/facility', title: '利用規約（施設向け）', href: '/terms/facility' },
    { name: 'privacy', title: 'プライバシーポリシー', href: '/privacy' },
];

// 施設管理画面（ツリー構造）
const ADMIN_TREE: SiteMapNode[] = [
    { name: '/', title: '管理ダッシュボード', href: '/admin' },
    { name: 'login', title: '管理者ログイン', href: '/admin/login' },
    {
        name: 'jobs', title: '求人管理', href: '/admin/jobs', children: [
            { name: 'new', title: '求人作成', href: '/admin/jobs/new', isConversion: true, note: '求人作成完了' },
            {
                name: '[id]', title: '求人詳細', isDynamic: true, note: '/admin/jobs/123', children: [
                    { name: 'edit', title: '求人編集', isDynamic: true, note: '/admin/jobs/123/edit' },
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
    { name: 'attendance', title: '勤怠承認', href: '/admin/attendance' },
    {
        name: 'tasks', title: 'タスク管理', children: [
            {
                name: 'attendance', title: '勤怠タスク一覧', href: '/admin/tasks/attendance', children: [
                    { name: '[id]', title: '勤怠タスク詳細', isDynamic: true, note: '/admin/tasks/attendance/123' },
                ]
            },
        ]
    },
    {
        name: 'workers', title: 'ワーカー管理', href: '/admin/workers', children: [
            {
                name: '[id]', title: 'ワーカー詳細', isDynamic: true, note: '/admin/workers/123', children: [
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
    { name: 'contact', title: 'お問い合わせ', href: '/admin/contact' },
    {
        name: 'reports', title: 'レポート', children: [
            { name: 'usage', title: '利用状況レポート', href: '/admin/reports/usage' },
        ]
    },
    {
        name: 'settings', title: '設定', children: [
            { name: 'offer-templates', title: 'オファーテンプレート', href: '/admin/settings/offer-templates' },
        ]
    },
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
            { name: '[id]', title: 'ワーカー詳細', isDynamic: true, note: '/system-admin/workers/123' },
        ]
    },
    { name: 'attendance', title: '勤怠管理', href: '/system-admin/attendance' },
    {
        name: 'announcements', title: 'お知らせ管理', href: '/system-admin/announcements', children: [
            { name: 'create', title: '新規作成', href: '/system-admin/announcements/create' },
            { name: '[id]', title: '編集', isDynamic: true, note: '/system-admin/announcements/123' },
        ]
    },
    { name: 'alerts', title: 'アラート', href: '/system-admin/alerts' },
    { name: 'csv-export', title: 'CSVエクスポート', href: '/system-admin/csv-export' },
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
            { name: 'system', title: 'システム設定', href: '/system-admin/settings/system' },
        ]
    },
    {
        name: 'dev-portal', title: '開発ポータル', href: '/system-admin/dev-portal', children: [
            { name: 'logs', title: 'バグ調査ダッシュボード', href: '/system-admin/dev-portal/logs' },
            { name: 'sample-images', title: 'サンプル画像', href: '/system-admin/dev-portal/sample-images' },
            { name: 'notification-logs', title: '通知ログ', href: '/system-admin/dev-portal/notification-logs' },
            { name: 'formulas', title: '計算式・指標一覧', href: '/system-admin/dev-portal/formulas' },
            { name: 'debug-checklist', title: 'デバッグチェックリスト', href: '/system-admin/dev-portal/debug-checklist' },
            { name: 'debug-time', title: 'デバッグ時刻設定', href: '/system-admin/dev-portal/debug-time' },
            { name: 'error-alert', title: 'エラー通知設定', href: '/system-admin/dev-portal/error-alert' },
            { name: 'test-notifications', title: 'テスト通知送信', href: '/system-admin/dev-portal/test-notifications' },
        ]
    },
];

// LP・広告ランディングページ（ツリー構造）
const LP_TREE: SiteMapNode[] = [
    {
        name: 'lp', title: 'ランディングページ', href: '/lp', isConversion: true, note: 'LP閲覧', children: [
            { name: 'guide', title: '使い方ガイド', href: '/lp/guide' },
            {
                name: 'tracking', title: 'トラッキングテスト', href: '/lp/tracking', children: [
                    { name: 'spec', title: 'トラッキング仕様', href: '/lp/tracking/spec' },
                ]
            },
        ]
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
    colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'red',
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
        orange: {
            link: 'text-orange-600 hover:text-orange-800',
            line: 'border-orange-200',
        },
        red: {
            link: 'text-red-600 hover:text-red-800',
            line: 'border-red-200',
        },
    };
    const c = colors[colorScheme];

    return (
        <div className={depth > 0 ? `ml-4 pl-3 border-l-2 ${c.line}` : ''}>
            {nodes.map((node, index) => (
                <div key={`${node.name}-${index}`} className="py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* ディレクトリ/ファイル名 */}
                        <span className="text-gray-400 text-xs font-mono min-w-[100px]">{node.name}</span>

                        {/* コンバージョンマーク */}
                        {node.isConversion && (
                            <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-1.5 py-0.5 rounded">CV</span>
                        )}

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

                        {/* メモ（広告タグ管理用） */}
                        {node.note && (
                            <span className="text-gray-400 text-[10px] italic">{node.note}</span>
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

                {/* ヘッダー */}
                <header className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Hash className="w-6 h-6 text-white" />
                        </div>
                        開発ポータル ダッシュボード
                    </h1>
                    <p className="text-sm text-gray-500">+タスタス Development Hub - クイックアクセス＆デバッグツール</p>
                </header>

                {/* クイックステータス */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    <Link href="/system-admin/dev-portal/logs" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-red-300 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">バグ調査</p>
                                <p className="text-lg font-bold text-red-600 group-hover:text-red-700">エラーログ確認</p>
                            </div>
                            <Bug className="w-8 h-8 text-red-200 group-hover:text-red-300" />
                        </div>
                    </Link>
                    <Link href="/system-admin/dev-portal/notification-logs" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">通知ログ</p>
                                <p className="text-lg font-bold text-orange-600 group-hover:text-orange-700">送信履歴</p>
                            </div>
                            <BellRing className="w-8 h-8 text-orange-200 group-hover:text-orange-300" />
                        </div>
                    </Link>
                    <Link href="/system-admin/dev-portal/debug-checklist" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">デバッグ項目</p>
                                <p className="text-lg font-bold text-blue-600 group-hover:text-blue-700">チェックリスト</p>
                            </div>
                            <ListChecks className="w-8 h-8 text-blue-200 group-hover:text-blue-300" />
                        </div>
                    </Link>
                    <Link href="/system-admin/dev-portal/debug-time" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">デバッグ時刻</p>
                                <p className="text-lg font-bold text-indigo-600 group-hover:text-indigo-700">時刻変更</p>
                            </div>
                            <Clock className="w-8 h-8 text-indigo-200 group-hover:text-indigo-300" />
                        </div>
                    </Link>
                    <Link href="/system-admin/dev-portal/formulas" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">計算式一覧</p>
                                <p className="text-lg font-bold text-purple-600 group-hover:text-purple-700">指標・計算式</p>
                            </div>
                            <Calculator className="w-8 h-8 text-purple-200 group-hover:text-purple-300" />
                        </div>
                    </Link>
                </div>

                {/* クイックリンク */}
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
                    </div>
                </div>

                {/* Site Maps - 3 sections */}
                <div id="sitemap" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                        <Settings className="w-5 h-5 text-orange-600" />
                        サイトマップ
                        <span className="ml-auto text-xs font-normal text-gray-400 flex items-center gap-2">
                            <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-1.5 py-0.5 rounded">CV</span>
                            = コンバージョン計測対象
                        </span>
                    </h2>

                    <div className="space-y-6">
                        {/* ワーカー画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                ワーカー画面
                            </h3>
                            <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-4 overflow-x-auto">
                                <SiteMapTree nodes={WORKER_TREE} colorScheme="blue" />
                            </div>
                        </div>

                        {/* LP・広告ランディングページ */}
                        <div>
                            <h3 className="text-sm font-bold text-orange-700 mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                LP・広告ランディングページ <span className="text-xs font-normal text-gray-400">(/lp)</span>
                            </h3>
                            <div className="bg-orange-50/50 rounded-lg border border-orange-100 p-4 overflow-x-auto">
                                <SiteMapTree nodes={LP_TREE} colorScheme="orange" />
                            </div>
                        </div>

                        {/* 施設管理画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                施設管理画面 <span className="text-xs font-normal text-gray-400">(/admin)</span>
                            </h3>
                            <div className="bg-green-50/50 rounded-lg border border-green-100 p-4 overflow-x-auto">
                                <SiteMapTree nodes={ADMIN_TREE} colorScheme="green" />
                            </div>
                        </div>

                        {/* システム管理画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                システム管理画面 <span className="text-xs font-normal text-gray-400">(/system-admin)</span>
                            </h3>
                            <div className="bg-red-50/50 rounded-lg border border-red-100 p-4 overflow-x-auto">
                                <SiteMapTree nodes={SYSTEM_ADMIN_TREE} colorScheme="red" />
                            </div>
                        </div>

                        {/* 独立画面 */}
                        <div>
                            <h3 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                独立画面（開発・ツール）
                            </h3>
                            <div className="bg-purple-50/50 rounded-lg border border-purple-100 p-4 overflow-x-auto">
                                <SiteMapTree nodes={STANDALONE_TREE} colorScheme="purple" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Docs */}
                <div id="docs" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
