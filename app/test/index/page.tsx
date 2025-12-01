'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Briefcase, Building2, User, UserCircle, LogIn, FileText, Heart, Settings, Construction, MessageSquare, MessageCircle, CheckCircle2, Circle, ChevronDown, ChevronUp, Bookmark, Search, Clock, Star, ClipboardList } from 'lucide-react';

export default function TestIndexPage() {
  // 完了したタスクの管理
  const [completedTasks, setCompletedTasks] = useState<string[]>([
    // 既に完了しているタスク
    'completed-1', 'completed-2', 'completed-3', 'completed-4', 'completed-5',
    'completed-6', 'completed-7', 'completed-8', 'completed-9', 'completed-10',
    'completed-11', 'completed-12', 'completed-13', 'completed-14', 'completed-15',
    'completed-16', 'completed-17', 'completed-18', 'completed-19', 'completed-20',
    'completed-21', 'completed-22', 'completed-23', 'completed-24', 'completed-25',
  ]);

  // セクションの開閉状態
  const [expandedSections, setExpandedSections] = useState<string[]>(['future-1', 'future-2', 'future-3']);

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isCompleted = (taskId: string) => completedTasks.includes(taskId);
  const isExpanded = (sectionId: string) => expandedSections.includes(sectionId);

  // 完了済みの開発タスク
  const completedDevelopmentTasks = [
    { id: 'completed-1', label: 'プロジェクトの初期セットアップ' },
    { id: 'completed-2', label: 'Next.js 15 + TypeScript環境構築' },
    { id: 'completed-3', label: 'TailwindCSSの設定' },
    { id: 'completed-4', label: 'カラーテーマとデザインシステムの構築' },
    { id: 'completed-5', label: 'TOPページ（ホーム）の実装' },
    { id: 'completed-6', label: '求人詳細ページの実装' },
    { id: 'completed-7', label: '施設詳細ページの実装' },
    { id: 'completed-8', label: '施設の口コミ一覧ページの実装' },
    { id: 'completed-9', label: '口コミ投稿ページの実装' },
    { id: 'completed-10', label: '管理者ログインページの実装' },
    { id: 'completed-11', label: '管理者TOPページの実装' },
    { id: 'completed-12', label: '求人一覧ページ（管理者）の実装' },
    { id: 'completed-13', label: '求人作成ページの実装' },
    { id: 'completed-14', label: '求人テンプレート一覧ページの実装' },
    { id: 'completed-15', label: '求人テンプレート作成ページの実装' },
    { id: 'completed-16', label: '求人テンプレート編集ページの実装' },
    { id: 'completed-17', label: '企業・施設情報ページの実装' },
    { id: 'completed-18', label: 'レビュー一覧ページ（管理者）の実装' },
    { id: 'completed-19', label: 'メッセージページの実装' },
    { id: 'completed-20', label: '複数求人応募フローの基礎実装' },
    { id: 'completed-21', label: 'ワーカーレビュー機能 - DBスキーマ追加（5項目評価）' },
    { id: 'completed-22', label: 'ワーカーレビュー機能 - 評価項目変更（勤怠・スキル・遂行力・コミュ力・姿勢）' },
    { id: 'completed-23', label: 'ワーカーレビューページ（管理者）の実装' },
    { id: 'completed-24', label: 'ワーカーが受けた評価一覧ページの実装' },
    { id: 'completed-25', label: 'レビューテンプレート機能のDB設計' },
  ];

  // 今後の開発計画
  const futurePlans = [
    {
      id: 'future-1',
      period: '11/22-11/28',
      title: '応募フロー・ダッシュボード・管理画面',
      tasks: [
        { id: 'task-1-1', label: '応募フローの完成（カレンダー選択UI）' },
        { id: 'task-1-2', label: '複数日付選択機能の実装' },
        { id: 'task-1-3', label: '応募確認ページの完成' },
        { id: 'task-1-4', label: '応募完了後のフロー' },
        { id: 'task-1-5', label: 'ワーカー向けダッシュボードの設計' },
        { id: 'task-1-6', label: 'ダッシュボードの実装（指名された、応募した、働いた）' },
        { id: 'task-1-7', label: '運営会社管理画面の設計' },
        { id: 'task-1-8', label: '運営会社管理画面の実装' },
      ]
    },
    {
      id: 'future-2',
      period: '11/29-12/5',
      title: 'テスト・DB設計・デバッグ',
      tasks: [
        { id: 'task-2-1', label: 'mocテストの実施' },
        { id: 'task-2-2', label: 'デバッグ作業' },
        { id: 'task-2-3', label: '実務運用者レビューの実施' },
        { id: 'task-2-4', label: 'レビューフィードバックの収集' },
        { id: 'task-2-5', label: 'DB設計の策定' },
        { id: 'task-2-6', label: 'DBスキーマの作成' },
        { id: 'task-2-7', label: 'DB接続とモデルの実装' },
        { id: 'task-2-8', label: 'テスト・デバッグ作業' },
      ]
    },
    {
      id: 'future-3',
      period: '12/6-12/12',
      title: 'レビュー修正・本番環境デバッグ',
      tasks: [
        { id: 'task-3-1', label: 'レビュー指摘事項の修正' },
        { id: 'task-3-2', label: 'UIの改善作業' },
        { id: 'task-3-3', label: 'パフォーマンスの最適化' },
        { id: 'task-3-4', label: '本番環境を想定したデバッグ' },
        { id: 'task-3-5', label: 'セキュリティチェック' },
        { id: 'task-3-6', label: '最終動作確認' },
      ]
    },
    {
      id: 'future-4',
      period: '12/13-12/19',
      title: '予備期間',
      tasks: [
        { id: 'task-4-1', label: '追加修正対応' },
        { id: 'task-4-2', label: 'ドキュメント整備' },
        { id: 'task-4-3', label: '最終チェック' },
      ]
    }
  ];

  // ワーカー向けページ（サイトマップ形式）
  const workerSitemap = {
    title: 'ワーカー向けページ',
    icon: User,
    root: {
      href: '/register/worker',
      label: 'ワーカー新規登録',
      icon: UserCircle,
      children: [
        {
          href: '/register/qualifications',
          label: '資格登録',
          icon: FileText,
        },
        {
          href: '/login',
          label: 'ワーカーログイン',
          icon: LogIn,
          children: [
            {
              href: '/',
              label: 'ワーカーTOP（求人検索）',
              icon: Search,
              children: [
                {
                  href: '/jobs/49',
                  label: '求人詳細',
                  icon: Briefcase,
                  children: [
                    { href: '/facilities/11', label: '施設詳細', icon: Building2, children: [
                      { href: '/facilities/11/review/new', label: '口コミ投稿', icon: FileText },
                    ]},
                  ]
                },
              ]
            },
            {
              href: '/bookmarks',
              label: '保存済み（求人・施設）',
              icon: Bookmark,
              children: [
                { href: '/favorites', label: 'お気に入り施設', icon: Heart },
              ]
            },
            {
              href: '/messages',
              label: 'メッセージ',
              icon: MessageCircle,
            },
            {
              href: '/my-jobs',
              label: '仕事管理',
              icon: Briefcase,
            },
            {
              href: '/mypage',
              label: 'マイページ',
              icon: User,
              children: [
                { href: '/mypage/profile', label: 'プロフィール編集', icon: User },
                { href: '/mypage/applications', label: '応募履歴', icon: Clock },
                { href: '/mypage/reviews', label: 'レビュー（施設への評価）', icon: Star },
                { href: '/mypage/reviews/received', label: '受けた評価（施設からの評価）', icon: Star },
                { href: '/mypage/muted-facilities', label: 'ミュートした施設', icon: Construction },
                { href: '/under-construction?page=work-history', label: '勤務履歴（工事中）', icon: Construction },
                { href: '/under-construction?page=settings', label: '設定（工事中）', icon: Settings },
                { href: '/under-construction?page=notifications', label: '通知設定（工事中）', icon: Construction },
                { href: '/under-construction?page=qualifications', label: '資格情報（工事中）', icon: Construction },
                { href: '/under-construction?page=bank-account', label: '口座情報（工事中）', icon: Construction },
                { href: '/under-construction?page=help', label: 'ヘルプ（工事中）', icon: Construction },
              ]
            },
          ]
        }
      ]
    }
  };

  // 管理者向けページ（サイトマップ形式）
  const adminSitemap = {
    title: '施設管理者向けページ',
    icon: Settings,
    root: {
      href: '/admin/login',
      label: '管理者ログイン',
      icon: LogIn,
      children: [
        {
          href: '/admin',
          label: '管理者TOP（ダッシュボード）',
          icon: Home,
          children: [
            {
              href: '/admin/jobs',
              label: '求人管理',
              icon: Briefcase,
              children: [
                { href: '/admin/jobs/new', label: '求人作成', icon: Briefcase },
                { href: '/admin/jobs/templates', label: 'テンプレート一覧', icon: FileText, children: [
                  { href: '/admin/jobs/templates/new', label: 'テンプレート作成', icon: FileText },
                  { href: '/admin/jobs/templates/1/edit', label: 'テンプレート編集', icon: FileText },
                ]},
              ]
            },
            {
              href: '/admin/applications',
              label: '応募管理',
              icon: UserCircle,
            },
            {
              href: '/admin/workers',
              label: 'ワーカー管理',
              icon: User,
              children: [
                { href: '/admin/workers/7', label: 'ワーカー詳細（ID:7）', icon: User },
                { href: '/admin/workers/1', label: 'ワーカー詳細（ID:1）', icon: User },
              ]
            },
            {
              href: '/admin/worker-reviews',
              label: 'ワーカーレビュー（施設→ワーカー評価）',
              icon: Star,
            },
            {
              href: '/admin/facility',
              label: '施設情報',
              icon: Building2,
            },
            {
              href: '/admin/reviews',
              label: 'レビュー管理',
              icon: MessageSquare,
            },
            {
              href: '/admin/messages',
              label: 'メッセージ',
              icon: MessageCircle,
            },
            {
              href: '/admin/terms',
              label: '利用規約',
              icon: FileText,
            },
            {
              href: '/admin/privacy',
              label: 'プライバシーポリシー',
              icon: FileText,
            },
          ]
        }
      ]
    }
  };

  // 未実装の機能リスト（Phase 2以降）
  const unimplementedFeatures = [
    {
      feature: '共有機能',
      page: '施設詳細',
      pageHref: '/facilities/11',
      section: 'ワーカー向けページ',
      description: 'Web Share APIを使った施設情報の共有'
    },
    {
      feature: 'Google Map連携',
      page: '求人詳細',
      pageHref: '/jobs/49',
      section: 'ワーカー向けページ',
      description: '施設の住所をGoogle Mapで開く機能'
    },
    {
      feature: 'メッセージ機能',
      page: 'メッセージ',
      pageHref: '/messages',
      section: 'ワーカー向けページ',
      description: '施設とのメッセージのやり取り機能'
    },
    {
      feature: '仕事管理機能',
      page: '仕事管理',
      pageHref: '/my-jobs',
      section: 'ワーカー向けページ',
      description: '応募中・確定・完了した仕事の管理機能'
    },
    {
      feature: '勤務履歴',
      page: 'マイページ',
      pageHref: '/under-construction?page=work-history',
      section: 'ワーカー向けページ',
      description: '過去の勤務履歴の閲覧機能'
    },
    {
      feature: '設定・通知設定',
      page: 'マイページ',
      pageHref: '/under-construction?page=settings',
      section: 'ワーカー向けページ',
      description: 'アプリの各種設定と通知の管理'
    },
    {
      feature: '求人の一括公開/非公開',
      page: '求人一覧',
      pageHref: '/admin/jobs',
      section: '管理者向けページ',
      description: '複数の求人を一括で公開/非公開にする機能'
    },
    {
      feature: '求人の複製機能',
      page: '求人一覧',
      pageHref: '/admin/jobs',
      section: '管理者向けページ',
      description: '既存の求人を複製して新規作成する機能'
    },
    {
      feature: '労働条件通知書の生成',
      page: '求人作成/詳細',
      pageHref: '/admin/jobs/new',
      section: '管理者向けページ',
      description: '入力内容から労働条件通知書PDFを自動生成'
    },
    {
      feature: 'ワーカーレビューAPI実装',
      page: 'ワーカーレビュー',
      pageHref: '/admin/worker-reviews',
      section: '管理者向けページ',
      description: 'レビュー投稿・取得のAPI関数実装（UI実装済み）'
    },
    {
      feature: 'レビューテンプレートCRUD',
      page: 'ワーカーレビュー',
      pageHref: '/admin/worker-reviews',
      section: '管理者向けページ',
      description: 'テンプレートの作成・編集・削除機能（DBスキーマ実装済み）'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-primary rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-white mb-4">
            テスト用インデックス
          </h1>
          <p className="text-white/90 mb-4">
            アプリケーションの全ページへのリンク集です
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <a
              href="#worker-pages"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              ワーカー向けページ
            </a>
            <a
              href="#admin-pages"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              管理者向けページ
            </a>
            <a
              href="#development-plan"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              開発計画
            </a>
            <a
              href="#unimplemented-features"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              未実装機能一覧
            </a>
            <a
              href="#terminology"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              システム用語定義
            </a>
            <a
              href="#usage"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              使い方
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {/* ワーカー向けページ（サイトマップ形式） */}
          <div id="worker-pages" className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <workerSitemap.icon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">{workerSitemap.title}</h2>
            </div>

            {/* ツリー表示 */}
            <div className="space-y-2">
              {/* ルート: 新規登録 */}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex-shrink-0 mt-1">
                  <workerSitemap.root.icon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <Link
                    href={workerSitemap.root.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    {workerSitemap.root.label}
                    <span className="text-xs text-gray-500">{workerSitemap.root.href}</span>
                  </Link>

                  {/* レベル1: ログイン */}
                  {workerSitemap.root.children?.map((level1, idx1) => (
                    <div key={idx1} className="mt-3 ml-6 border-l-2 border-gray-200 pl-4">
                      <div className="flex items-start gap-2 -ml-[18px]">
                        <div className="w-5 h-5 flex-shrink-0 mt-1">
                          <level1.icon className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <Link
                            href={level1.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                          >
                            {level1.label}
                            <span className="text-xs text-gray-500">{level1.href}</span>
                          </Link>

                          {/* レベル2: メインページ */}
                          {level1.children && (
                            <div className="mt-2 space-y-2">
                              {level1.children.map((level2, idx2) => (
                                <div key={idx2} className="ml-6 border-l-2 border-gray-200 pl-4">
                                  <div className="flex items-start gap-2 -ml-[18px]">
                                    <div className="w-4 h-4 flex-shrink-0 mt-1.5">
                                      <level2.icon className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div className="flex-1">
                                      <Link
                                        href={level2.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-primary hover:underline"
                                      >
                                        {level2.label}
                                        <span className="text-xs text-gray-500">{level2.href}</span>
                                      </Link>

                                      {/* レベル3: 詳細ページ */}
                                      {level2.children && (
                                        <div className="mt-1.5 space-y-1.5">
                                          {level2.children.map((level3, idx3) => (
                                            <div key={idx3} className="ml-5 border-l border-gray-200 pl-3">
                                              <div className="flex items-start gap-2 -ml-[14px]">
                                                <div className="w-3 h-3 flex-shrink-0 mt-2">
                                                  <level3.icon className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <div className="flex-1">
                                                  <Link
                                                    href={level3.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-primary hover:underline"
                                                  >
                                                    {level3.label}
                                                    <span className="text-xs text-gray-400">{level3.href}</span>
                                                  </Link>

                                                  {/* レベル4: サブページ */}
                                                  {'children' in level3 && level3.children && (
                                                    <div className="mt-1 space-y-1">
                                                      {level3.children.map((level4, idx4) => (
                                                        <div key={idx4} className="ml-4 border-l border-gray-100 pl-2">
                                                          <div className="flex items-start gap-1.5 -ml-[10px]">
                                                            <div className="w-3 h-3 flex-shrink-0 mt-1.5">
                                                              <level4.icon className="w-3 h-3 text-gray-300" />
                                                            </div>
                                                            <Link
                                                              href={level4.href}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary hover:underline"
                                                            >
                                                              {level4.label}
                                                              <span className="text-xs text-gray-400">{level4.href}</span>
                                                            </Link>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 管理者向けページ（サイトマップ形式） */}
          <div id="admin-pages" className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <adminSitemap.icon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">{adminSitemap.title}</h2>
            </div>

            {/* ツリー表示 */}
            <div className="space-y-2">
              {/* ルート: ログイン */}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex-shrink-0 mt-1">
                  <adminSitemap.root.icon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <Link
                    href={adminSitemap.root.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    {adminSitemap.root.label}
                    <span className="text-xs text-gray-500">{adminSitemap.root.href}</span>
                  </Link>

                  {/* レベル1: ダッシュボード */}
                  {adminSitemap.root.children?.map((level1, idx1) => (
                    <div key={idx1} className="mt-3 ml-6 border-l-2 border-gray-200 pl-4">
                      <div className="flex items-start gap-2 -ml-[18px]">
                        <div className="w-5 h-5 flex-shrink-0 mt-1">
                          <level1.icon className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <Link
                            href={level1.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                          >
                            {level1.label}
                            <span className="text-xs text-gray-500">{level1.href}</span>
                          </Link>

                          {/* レベル2: 各管理ページ */}
                          {level1.children && (
                            <div className="mt-2 space-y-2">
                              {level1.children.map((level2, idx2) => (
                                <div key={idx2} className="ml-6 border-l-2 border-gray-200 pl-4">
                                  <div className="flex items-start gap-2 -ml-[18px]">
                                    <div className="w-4 h-4 flex-shrink-0 mt-1.5">
                                      <level2.icon className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div className="flex-1">
                                      <Link
                                        href={level2.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-primary hover:underline"
                                      >
                                        {level2.label}
                                        <span className="text-xs text-gray-500">{level2.href}</span>
                                      </Link>

                                      {/* レベル3: サブページ */}
                                      {level2.children && (
                                        <div className="mt-1.5 space-y-1.5">
                                          {level2.children.map((level3, idx3) => (
                                            <div key={idx3} className="ml-5 border-l border-gray-200 pl-3">
                                              <div className="flex items-start gap-2 -ml-[14px]">
                                                <div className="w-3 h-3 flex-shrink-0 mt-2">
                                                  <level3.icon className="w-3 h-3 text-gray-400" />
                                                </div>
                                                <div className="flex-1">
                                                  <Link
                                                    href={level3.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-primary hover:underline"
                                                  >
                                                    {level3.label}
                                                    <span className="text-xs text-gray-400">{level3.href}</span>
                                                  </Link>

                                                  {/* レベル4: さらにサブページがある場合 */}
                                                  {level3.children && (
                                                    <div className="mt-1 space-y-1">
                                                      {level3.children.map((level4, idx4) => (
                                                        <div key={idx4} className="ml-4 border-l border-gray-100 pl-2">
                                                          <div className="flex items-start gap-1.5 -ml-[10px]">
                                                            <div className="w-3 h-3 flex-shrink-0 mt-1.5">
                                                              <level4.icon className="w-3 h-3 text-gray-300" />
                                                            </div>
                                                            <Link
                                                              href={level4.href}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary hover:underline"
                                                            >
                                                              {level4.label}
                                                              <span className="text-xs text-gray-400">{level4.href}</span>
                                                            </Link>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 開発計画 */}
        <div id="development-plan" className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">開発計画</h2>
          </div>

          {/* 全体の進捗バー */}
          <div className="mb-6">
            {(() => {
              const allTasks = [
                ...completedDevelopmentTasks,
                ...futurePlans.flatMap(plan => plan.tasks)
              ];
              const totalCompleted = allTasks.filter(task => isCompleted(task.id)).length;
              const totalProgress = Math.round((totalCompleted / allTasks.length) * 100);

              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">全体の進捗</span>
                    <span className="text-sm font-bold text-primary">
                      {totalCompleted}/{allTasks.length} ({totalProgress}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 完了したタスク */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-gray-900">完了したタスク</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completedDevelopmentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-green-50"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="flex-shrink-0"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </button>
                  <span className="text-sm text-gray-700 line-through">
                    {task.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 今後の開発計画 */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">今後の予定</h3>
            {futurePlans.map((plan) => (
              <div key={plan.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(plan.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary bg-white px-3 py-1 rounded-full border border-primary">
                      {plan.period}
                    </span>
                    <h4 className="text-base font-bold text-gray-900">{plan.title}</h4>
                  </div>
                  {isExpanded(plan.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {isExpanded(plan.id) && (
                  <div className="px-4 pb-3 bg-white">
                    <div className="pt-3 space-y-2">
                      {plan.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="flex-shrink-0"
                          >
                            {isCompleted(task.id) ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300" />
                            )}
                          </button>
                          <span
                            className={`text-sm ${
                              isCompleted(task.id)
                                ? 'text-gray-500 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {task.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 未実装機能一覧 */}
        {unimplementedFeatures.length > 0 && (
          <div id="unimplemented-features" className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Construction className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-red-900">未実装機能一覧</h3>
            </div>
            <div className="space-y-2">
              {unimplementedFeatures.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-red-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-bold text-red-900 text-sm whitespace-nowrap">{item.feature}</span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded whitespace-nowrap">
                        {item.section}
                      </span>
                    </div>
                    <Link
                      href={item.pageHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-600 hover:underline whitespace-nowrap"
                    >
                      → {item.page}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 用語定義 */}
        <div id="terminology" className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-bold text-green-900 mb-4">📚 システム用語定義</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">ワーカー</h4>
              <p className="text-sm text-gray-700">
                シェアワーカーアプリを利用する労働者。求人に応募し、施設で働く人。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">管理者</h4>
              <p className="text-sm text-gray-700">
                施設側の管理アカウント。求人の作成・管理を行う。通常は責任者または担当者が兼任。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">企業</h4>
              <p className="text-sm text-gray-700">
                施設を運営する会社組織。将来的には複数施設を管理する想定だが、現システムでは1企業1施設として設計。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">施設</h4>
              <p className="text-sm text-gray-700">
                介護・医療サービスを提供する施設。ワーカーが働く場所。管理者が求人を掲載する単位。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">求人</h4>
              <p className="text-sm text-gray-700">
                施設が募集する仕事。具体的な勤務日、時間、賃金が設定されている。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">求人テンプレート</h4>
              <p className="text-sm text-gray-700">
                求人作成時の雛形。繰り返し使う求人情報を保存しておくもの。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">責任者</h4>
              <p className="text-sm text-gray-700">
                施設の施設長。求人やワーカーとのやり取りの窓口となる人物。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">担当者</h4>
              <p className="text-sm text-gray-700">
                実務担当者。責任者と同一人物の場合もある。ワーカーからの連絡の実務窓口。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">サービス種別</h4>
              <p className="text-sm text-gray-700">
                施設の分類（特別養護老人ホーム、訪問介護など）。1施設は1サービス種別のみ。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">応募</h4>
              <p className="text-sm text-gray-700">
                ワーカーが求人に対して申し込むこと。複数の勤務日を一括で選択可能。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">口コミ/レビュー（ワーカー→施設）</h4>
              <p className="text-sm text-gray-700">
                ワーカーが施設に対して投稿する評価（星5段階）とコメント。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">ワーカーレビュー（施設→ワーカー）</h4>
              <p className="text-sm text-gray-700">
                施設がワーカーに対して投稿する評価。5項目（勤怠・時間、スキル、遂行力、コミュ力、姿勢）で評価。減点方式で問題なければ5点。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">勤務日</h4>
              <p className="text-sm text-gray-700">
                求人に設定された実際に働く日付と時間帯。
              </p>
            </div>
          </div>
        </div>

        <div id="usage" className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">📝 使い方</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 各リンクをクリックして、対応するページに移動できます</li>
            <li>• <span className="font-medium text-orange-700">未実装ページ</span>: まだ作成されていないページの一覧</li>
            <li>• <span className="font-medium text-red-700">未実装機能</span>: 既存ページ内で未実装の機能（対象ページへのリンク付き）</li>
            <li>• 管理者ページはログインが必要な場合があります</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
