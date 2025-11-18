'use client';

import Link from 'next/link';
import { Home, Briefcase, Building2, User, UserCircle, LogIn, Calendar, FileText, Users, Settings, Construction, MessageSquare, MessageCircle } from 'lucide-react';

export default function TestIndexPage() {
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

  const unimplementedPages = sections.flatMap(section =>
    section.links
      .filter(link => !link.implemented)
      .map(link => ({ ...link, section: section.title }))
  );

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
              href="#unimplemented-pages"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              未実装ページ一覧
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

        {/* 未実装ページ一覧 */}
        {unimplementedPages.length > 0 && (
          <div id="unimplemented-pages" className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Construction className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-900">未実装ページ一覧</h3>
            </div>
            <div className="space-y-2">
              {unimplementedPages.map((page, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <page.icon className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-800">
                    <span className="font-medium">{page.label}</span>
                    <span className="text-orange-600 ml-2">({page.section})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
