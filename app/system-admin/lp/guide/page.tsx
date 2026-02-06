'use client';

import Link from 'next/link';
import { ArrowLeft, Upload, FileArchive, CheckCircle, AlertTriangle, Tag, BarChart3, Trash2, Edit3 } from 'lucide-react';
import { useState } from 'react';

// コードブロックコンポーネント
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-700 hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="コピー"
      >
        {copied ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function LPGuidePage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/system-admin/lp"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            LP管理に戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">LP作成・アップロードガイド</h1>
          <p className="text-slate-500 mt-2">
            管理画面からLPをアップロードする方法と、自動設定される機能について説明します。
          </p>
        </div>

        {/* 新方式の概要 */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-indigo-900 mb-3">新しいLP管理方式</h2>
          <p className="text-indigo-800 mb-4">
            LPはZIPファイルでアップロードするだけで公開できます。<br />
            <strong>GTM・LINE・トラッキングのタグは自動で挿入</strong>されるため、手動設定は不要です。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-600 font-medium mb-2">
                <Upload className="w-4 h-4" />
                ZIPアップロード
              </div>
              <p className="text-slate-600">HTML+画像をまとめてアップロード</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-600 font-medium mb-2">
                <Tag className="w-4 h-4" />
                タグ自動挿入
              </div>
              <p className="text-slate-600">GTM・LINE・トラッキングを自動設定</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-600 font-medium mb-2">
                <BarChart3 className="w-4 h-4" />
                即座に計測開始
              </div>
              <p className="text-slate-600">アップロード後すぐにトラッキング可能</p>
            </div>
          </div>
        </div>

        {/* 目次 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">目次</h2>
          <ol className="space-y-2 text-sm">
            <li><a href="#zip-structure" className="text-indigo-600 hover:underline">1. ZIPファイルの構成</a></li>
            <li><a href="#upload-flow" className="text-indigo-600 hover:underline">2. アップロード手順</a></li>
            <li><a href="#auto-tags" className="text-indigo-600 hover:underline">3. 自動挿入されるタグ</a></li>
            <li><a href="#cta-settings" className="text-indigo-600 hover:underline">4. CTAボタンの設定</a></li>
            <li><a href="#section-tracking" className="text-indigo-600 hover:underline">5. セクション別滞在時間の計測（任意）</a></li>
            <li><a href="#ogp-meta" className="text-indigo-600 hover:underline">6. OGP・メタタグの設定</a></li>
            <li><a href="#edit-delete" className="text-indigo-600 hover:underline">7. LPの編集・削除</a></li>
            <li><a href="#warnings" className="text-indigo-600 hover:underline">8. 警告アイコンについて</a></li>
            <li><a href="#checklist" className="text-indigo-600 hover:underline">9. リリース前チェックリスト</a></li>
          </ol>
        </div>

        {/* セクション1: ZIPファイルの構成 */}
        <section id="zip-structure" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FileArchive className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">1. ZIPファイルの構成</h2>
          </div>

          <p className="text-slate-600 mb-4">
            アップロードするZIPファイルは、以下の構成にしてください。
            <code className="bg-slate-100 px-2 py-1 rounded text-sm">index.html</code> は必須です。
          </p>

          <CodeBlock code={`my-lp.zip
├── index.html      # 必須: メインHTMLファイル
├── styles.css      # 任意: スタイルシート
└── images/         # 任意: 画像フォルダ
    ├── hero.png
    ├── logo.svg
    └── feature.jpg`} />

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">ポイント</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• <code className="bg-green-100 px-1 rounded">index.html</code> はZIPのルート直下に配置</li>
              <li>• 画像は <code className="bg-green-100 px-1 rounded">images/</code> フォルダにまとめると管理しやすい</li>
              <li>• 画像パスは自動でSupabase Storage URLに変換されます</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>注意:</strong> ZIPファイル内にフォルダが1階層あるパターン（例: <code className="bg-amber-100 px-1 rounded">lp-folder/index.html</code>）もサポートしています。
              </div>
            </div>
          </div>
        </section>

        {/* セクション2: アップロード手順 */}
        <section id="upload-flow" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">2. アップロード手順</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-medium text-slate-900">LP管理画面を開く</h4>
                <p className="text-sm text-slate-600 mt-1">
                  <code className="bg-slate-200 px-1 rounded">/system-admin/lp</code> にアクセス
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium text-slate-900">「+ LP追加」ボタンをクリック</h4>
                <p className="text-sm text-slate-600 mt-1">
                  画面右上の追加ボタンからアップロードモーダルを開きます
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium text-slate-900">ZIPファイルをアップロード</h4>
                <p className="text-sm text-slate-600 mt-1">
                  LP名を入力し、ZIPファイルを選択またはドラッグ&ドロップ
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h4 className="font-medium text-slate-900">自動処理が実行される</h4>
                <p className="text-sm text-slate-600 mt-1">
                  ZIPが解凍され、タグが自動挿入され、Supabase Storageに保存されます
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-green-900">完了！</h4>
                <p className="text-sm text-green-700 mt-1">
                  LP番号が自動採番され、<code className="bg-green-100 px-1 rounded">/api/lp/[番号]</code> で公開されます（認証不要でどこからでもアクセス可能）
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* セクション3: 自動挿入されるタグ */}
        <section id="auto-tags" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">3. 自動挿入されるタグ</h2>
          </div>

          <p className="text-slate-600 mb-4">
            以下のタグは<strong>アップロード時に自動挿入</strong>されます。
            既にタグが存在する場合は、重複を避けるため挿入されません。
          </p>

          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-2">GTMタグ（Google Tag Manager）</h3>
              <p className="text-sm text-slate-600 mb-2">
                <code className="bg-slate-100 px-1 rounded">&lt;head&gt;</code> 直後と <code className="bg-slate-100 px-1 rounded">&lt;body&gt;</code> 直後に挿入
              </p>
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                GTM-MSBWVNVB が自動設定されます
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-2">LINE友だち登録ボタン属性</h3>
              <p className="text-sm text-slate-600 mb-2">
                LINE CTAボタンの <code className="bg-slate-100 px-1 rounded">&lt;a&gt;</code> タグに挿入
              </p>
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                <code>data-cats=&quot;lineFriendsFollowLink&quot;</code> 属性が自動設定されます（markecats連携用）
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-2">トラッキングスクリプト</h3>
              <p className="text-sm text-slate-600 mb-2">
                <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code> 直前に挿入
              </p>
              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                PV・スクロール・滞在時間・CTAクリックを自動計測
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">自動計測される項目</h4>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>✓ ページビュー（PV）</li>
              <li>✓ スクロール深度（25%, 50%, 75%, 90%到達）</li>
              <li>✓ 滞在時間（5秒, 10秒到達）</li>
              <li>✓ エンゲージメントレベル（Level 1〜5）</li>
              <li>✓ CTAボタンクリック</li>
              <li>✓ キャンペーンコード（URLパラメータから自動取得）</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>重複チェック:</strong> 既にGTMタグやトラッキングスクリプトが含まれている場合、自動挿入はスキップされます。
                既存のタグがそのまま維持されます。
              </div>
            </div>
          </div>
        </section>

        {/* セクション4: CTAボタンの設定 */}
        <section id="cta-settings" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">4. CTAボタンの設定</h2>
          </div>

          <p className="text-slate-600 mb-4">
            LINE登録ボタンは、以下のクラス名を設定するとクリック計測され、URLも自動設定されます。
            <strong>hrefは「#」でOK</strong> です。
          </p>

          <CodeBlock code={`<!-- CTAボタンの推奨設定 -->
<a href="#" class="btn-line-cta">
  今すぐ公式LINEに登録
</a>

<!-- ヘッダーのLINEボタン -->
<a href="#" class="btn-line-header">
  LINE登録
</a>

<!-- 自動挿入後（data-cats属性が追加される） -->
<a href="#" class="btn-line-cta" data-cats="lineFriendsFollowLink">
  今すぐ公式LINEに登録
</a>`} />

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">自動処理</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• <code className="bg-green-100 px-1 rounded">href=&quot;#&quot;</code> は自動でLINE URLに置換されます</li>
              <li>• <code className="bg-green-100 px-1 rounded">?utm_source=google</code> → Google広告用LINE URL</li>
              <li>• <code className="bg-green-100 px-1 rounded">?utm_source=meta</code> → Meta広告用LINE URL</li>
              <li>• クリック計測が自動で行われます</li>
              <li>• <code className="bg-green-100 px-1 rounded">data-cats=&quot;lineFriendsFollowLink&quot;</code> 属性が自動挿入されます（markecats連携用）</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">トラッキング対象クラス</h4>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>• <code className="bg-indigo-100 px-1 rounded">.btn-line-cta</code> - メインCTAボタン</li>
              <li>• <code className="bg-indigo-100 px-1 rounded">.btn-line-header</code> - ヘッダーLINEボタン</li>
              <li>• テキストに「LINE」を含むリンク/ボタン</li>
            </ul>
          </div>
        </section>

        {/* セクション5: セクション別滞在時間 */}
        <section id="section-tracking" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">5. セクション別滞在時間の計測（任意）</h2>
          </div>

          <p className="text-slate-600 mb-4">
            各セクションに <code className="bg-slate-100 px-2 py-1 rounded text-sm">data-section-id</code> 属性を追加すると、
            セクションごとの滞在時間が計測されます。<strong>任意設定</strong>です。
          </p>

          <CodeBlock code={`<section data-section-id="hero" data-section-name="ヒーロー">
  <!-- ヒーローセクションの内容 -->
</section>

<section data-section-id="features" data-section-name="機能紹介">
  <!-- 機能紹介セクションの内容 -->
</section>

<section data-section-id="cta" data-section-name="CTA">
  <!-- CTAセクションの内容 -->
</section>`} />

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            計測データは「トラッキング」画面の「セクション別滞在時間」で確認できます。
          </div>
        </section>

        {/* セクション6: OGP */}
        <section id="ogp-meta" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">6. OGP・メタタグの設定</h2>
          </div>

          <p className="text-slate-600 mb-4">
            SNS共有時に正しく表示されるよう、以下のメタタグをHTML内に設定してください。
            <strong>これは自動挿入されない</strong>ため、手動で設定が必要です。
          </p>

          <CodeBlock code={`<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ページタイトル | TASTAS</title>
  <meta name="description" content="ページの説明文">

  <!-- OGP設定 -->
  <meta property="og:title" content="ページタイトル | TASTAS">
  <meta property="og:description" content="ページの説明文">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://tastas.work/api/lp/X">
  <meta property="og:image" content="https://tastas.work/lp/images/ogp.png">
  <meta property="og:site_name" content="TASTAS">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
</head>`} />

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>注意:</strong> <code className="bg-amber-100 px-1 rounded">og:url</code> と <code className="bg-amber-100 px-1 rounded">og:image</code> は本番URLに変更してください。
              </div>
            </div>
          </div>
        </section>

        {/* セクション7: LPの編集・削除 */}
        <section id="edit-delete" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">7. LPの編集・削除</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-medium text-slate-900">LPの編集（上書き更新）</h3>
              </div>
              <p className="text-sm text-slate-600">
                既存のLPを更新する場合、同じLP番号を指定して新しいZIPをアップロードします。
                古いファイルは削除され、新しいファイルに置き換わります。
              </p>
            </div>

            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <h3 className="font-medium text-red-900">LPの削除</h3>
              </div>
              <p className="text-sm text-red-800">
                LP一覧の削除ボタンから削除できます。削除されたLPのURLはアクセス不可になります。
                <strong>この操作は取り消せません。</strong>
              </p>
            </div>
          </div>
        </section>

        {/* セクション8: 警告アイコンについて */}
        <section id="warnings" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">8. 警告アイコンについて</h2>
          </div>

          <p className="text-slate-600 mb-4">
            LP一覧で、以下のタグが設定されていないLPには警告アイコンが表示されます。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-3 border-b">状態</th>
                  <th className="text-left p-3 border-b">表示</th>
                  <th className="text-left p-3 border-b">対処方法</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border-b">GTMタグなし</td>
                  <td className="p-3 border-b"><span className="text-amber-600">⚠️ GTM未設定</span></td>
                  <td className="p-3 border-b text-slate-600">通常は自動挿入されます。既存タグがある場合は維持されます。</td>
                </tr>
                <tr>
                  <td className="p-3 border-b">LINE属性なし</td>
                  <td className="p-3 border-b"><span className="text-amber-600">⚠️ LINE未設定</span></td>
                  <td className="p-3 border-b text-slate-600">LINE CTAボタンに<code className="bg-slate-100 px-1 rounded">data-cats</code>属性が設定されていません。CTAボタンのクラス名を確認してください。</td>
                </tr>
                <tr>
                  <td className="p-3 border-b">トラッキングなし</td>
                  <td className="p-3 border-b"><span className="text-amber-600">⚠️ トラッキング未設定</span></td>
                  <td className="p-3 border-b text-slate-600">通常は自動挿入されます。</td>
                </tr>
                <tr>
                  <td className="p-3">全て設定済み</td>
                  <td className="p-3"><span className="text-green-600">✓</span></td>
                  <td className="p-3 text-slate-600">問題ありません。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* セクション9: チェックリスト */}
        <section id="checklist" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">9. リリース前チェックリスト</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">アップロード前の確認</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">index.html</code> がZIPのルートに存在する</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>画像ファイルがZIPに含まれている</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>HTMLが文法的に正しい（開始/終了タグの対応）</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">HTML内の設定</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンに <code className="bg-slate-100 px-1 rounded">.btn-line-cta</code> クラスを設定</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>OGPメタタグ（og:title, og:image等）を設定</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>セクション別計測が必要なら <code className="bg-slate-100 px-1 rounded">data-section-id</code> を設定</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-3">アップロード後の確認</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>LP一覧に警告アイコンがないこと（✓が表示）</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>「開く」ボタンでLPが正常に表示される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>画像が正しく表示される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンをクリックするとLINE URLに遷移する</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>トラッキング画面でPVが計測される</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">広告入稿時</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>Google広告: <code className="bg-slate-100 px-1 rounded">?utm_source=google</code> 付きURLを使用</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>Meta広告: <code className="bg-slate-100 px-1 rounded">?utm_source=meta</code> 付きURLを使用</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>キャンペーンコードが必要な場合は「コード」から発行</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* フッター */}
        <div className="text-center py-8">
          <Link
            href="/system-admin/lp"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            LP管理に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
