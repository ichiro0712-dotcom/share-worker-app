'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Briefcase, Building2, User, UserCircle, LogIn, Calendar, FileText, Users, Settings, Construction, MessageSquare, MessageCircle, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

export default function TestIndexPage() {
  // 完了したタスクの管理
  const [completedTasks, setCompletedTasks] = useState<string[]>([
    // 既に完了しているタスク
    'completed-1', 'completed-2', 'completed-3', 'completed-4', 'completed-5',
    'completed-6', 'completed-7', 'completed-8', 'completed-9', 'completed-10',
    'completed-11', 'completed-12', 'completed-13', 'completed-14', 'completed-15',
    'completed-16', 'completed-17', 'completed-18', 'completed-19', 'completed-20'
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

  const sections = [
    {
      title: 'ワーカー向けページ',
      icon: User,
      links: [
        { href: '/mypage', label: 'ワーカーログイン', icon: LogIn, implemented: true },
        { href: '/', label: 'TOP（ホーム）', icon: Home, implemented: true },
        { href: '/jobs/1', label: '求人詳細', icon: Briefcase, implemented: true },
        { href: '/facilities/1', label: '施設詳細', icon: Building2, implemented: true },
        { href: '/facilities/1/reviews', label: '施設の口コミ一覧', icon: FileText, implemented: true },
        { href: '/facilities/1/review/new', label: '口コミ投稿', icon: FileText, implemented: true },
        { href: '/register/worker', label: 'ワーカー新規登録', icon: UserCircle, implemented: true },
        { href: '/under-construction?page=nominated', label: '指名された', icon: Calendar, implemented: false },
        { href: '/under-construction?page=applied', label: '応募した', icon: Calendar, implemented: false },
        { href: '/under-construction?page=working', label: '働いた', icon: Calendar, implemented: false },
      ],
    },
    {
      title: '管理者向けページ',
      icon: Settings,
      links: [
        { href: '/admin/login', label: '管理者ログイン', icon: LogIn, implemented: true },
        { href: '/admin', label: '管理者TOP', icon: Home, implemented: true },
        { href: '/admin/jobs', label: '求人一覧', icon: Briefcase, implemented: true },
        { href: '/admin/jobs/new', label: '求人作成', icon: Briefcase, implemented: true },
        { href: '/admin/jobs/templates', label: '求人テンプレート一覧', icon: FileText, implemented: true },
        { href: '/admin/jobs/templates/new', label: '求人テンプレート作成', icon: FileText, implemented: true },
        { href: '/admin/jobs/templates/1/edit', label: '求人テンプレート編集', icon: FileText, implemented: true },
        { href: '/admin/facility', label: '企業・施設情報', icon: Building2, implemented: true },
        { href: '/admin/reviews', label: 'レビュー一覧', icon: MessageSquare, implemented: true },
        { href: '/admin/messages', label: 'メッセージ', icon: MessageCircle, implemented: true },
      ],
    },
  ];

  // 未実装の機能リスト
  const unimplementedFeatures = [
    {
      feature: '求人への応募機能',
      page: '求人詳細',
      pageHref: '/jobs/1',
      section: 'ワーカー向けページ',
      description: 'カレンダーから日付を選択して応募する機能'
    },
    {
      feature: '複数日付選択機能',
      page: '求人詳細',
      pageHref: '/jobs/1',
      section: 'ワーカー向けページ',
      description: '複数の勤務日を一括で選択できる機能'
    },
    {
      feature: '応募確認ページ',
      page: '求人詳細',
      pageHref: '/jobs/1',
      section: 'ワーカー向けページ',
      description: '選択した求人の確認と最終的な応募処理'
    },
    {
      feature: 'お気に入り機能',
      page: '施設詳細',
      pageHref: '/facilities/1',
      section: 'ワーカー向けページ',
      description: '施設をお気に入りに追加/削除する機能'
    },
    {
      feature: '施設への問い合わせ',
      page: '施設詳細',
      pageHref: '/facilities/1',
      section: 'ワーカー向けページ',
      description: '施設に直接メッセージを送る機能'
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
      feature: '求人テンプレートからの作成',
      page: '求人作成',
      pageHref: '/admin/jobs/new',
      section: '管理者向けページ',
      description: 'テンプレートを選択して求人を作成する機能'
    },
    {
      feature: '画像の並び替え',
      page: '求人作成',
      pageHref: '/admin/jobs/new',
      section: '管理者向けページ',
      description: 'アップロードした画像の順序を変更する機能'
    },
    {
      feature: '労働条件通知書の生成',
      page: '求人作成/詳細',
      pageHref: '/admin/jobs/new',
      section: '管理者向けページ',
      description: '入力内容から労働条件通知書PDFを自動生成'
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
          {sections.map((section, idx) => (
            <div
              key={idx}
              id={idx === 0 ? 'worker-pages' : 'admin-pages'}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <section.icon className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.links.map((link, linkIdx) => (
                  <Link
                    key={linkIdx}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary-light/10 transition-colors group"
                  >
                    <link.icon className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                    <div>
                      <div className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                        {link.label}
                      </div>
                      <div className="text-xs text-gray-500">{link.href}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
                介護・医療サービスを提供する事業所。ワーカーが働く場所。管理者が求人を掲載する単位。
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-green-800 mb-2">求人</h4>
              <p className="text-sm text-gray-700">
                施設が募集する仕事案件。具体的な勤務日、時間、賃金が設定されている。
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
              <h4 className="font-bold text-green-800 mb-2">口コミ/レビュー</h4>
              <p className="text-sm text-gray-700">
                ワーカーが施設に対して投稿する評価（星5段階）とコメント。
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
