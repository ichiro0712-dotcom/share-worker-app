'use client';

import Link from 'next/link';
import { ArrowLeft, FileCode, Tag, BarChart3, FolderOpen, CheckCircle, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

// コードブロックコンポーネント
function CodeBlock({ code, language = 'html' }: { code: string; language?: string }) {
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
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
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
          <h1 className="text-2xl font-bold text-slate-800">LP作成ガイド</h1>
          <p className="text-slate-500 mt-2">
            新しいLPを作成する際に必要な設定や、トラッキング機能を活用するための手順をまとめています。
          </p>
        </div>

        {/* 目次 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">目次</h2>
          <ol className="space-y-2 text-sm">
            <li><a href="#file-structure" className="text-indigo-600 hover:underline">1. ファイル構成</a></li>
            <li><a href="#tracking-script" className="text-indigo-600 hover:underline">2. トラッキングスクリプトの設置</a></li>
            <li><a href="#gtm-clarity" className="text-indigo-600 hover:underline">3. GTM・Clarityタグの設置</a></li>
            <li><a href="#section-tracking" className="text-indigo-600 hover:underline">4. セクション別滞在時間の計測</a></li>
            <li><a href="#cta-tracking" className="text-indigo-600 hover:underline">5. CTAボタンのトラッキング</a></li>
            <li><a href="#ad-url" className="text-indigo-600 hover:underline">5.5 広告用URL発行（LINEタグ設定）</a></li>
            <li><a href="#ogp-meta" className="text-indigo-600 hover:underline">6. OGP・メタタグの設定</a></li>
            <li><a href="#checklist" className="text-indigo-600 hover:underline">7. リリース前チェックリスト</a></li>
          </ol>
        </div>

        {/* セクション1: ファイル構成 */}
        <section id="file-structure" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">1. ファイル構成</h2>
          </div>

          <p className="text-slate-600 mb-4">
            新しいLPは <code className="bg-slate-100 px-2 py-1 rounded text-sm">public/lp/</code> ディレクトリ配下に、
            <strong>数字のフォルダ名</strong>で作成してください。
          </p>

          <CodeBlock code={`public/
└── lp/
    ├── tracking.js        # 共通トラッキングスクリプト（編集不要）
    ├── lp-config.json     # LP設定ファイル（自動生成）
    ├── images/            # 共通画像
    │   └── ogp.png        # OGP画像（1200×630px推奨）
    ├── 0/                 # LP 0
    │   ├── index.html     # メインHTML
    │   └── styles.css     # スタイルシート
    ├── 1/                 # LP 1
    │   ├── index.html
    │   └── styles.css
    └── 2/                 # LP 2（新規作成）
        ├── index.html     # ← 必須
        └── styles.css     # ← 任意`} language="text" />

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>重要:</strong> フォルダ名は必ず数字（0, 1, 2...）にしてください。
                LP管理画面で自動検出されます。
              </div>
            </div>
          </div>
        </section>

        {/* セクション2: トラッキングスクリプト */}
        <section id="tracking-script" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">2. トラッキングスクリプトの設置</h2>
          </div>

          <p className="text-slate-600 mb-4">
            <code className="bg-slate-100 px-2 py-1 rounded text-sm">&lt;/body&gt;</code> タグの直前に以下を追加してください。
            これにより、PV・スクロール・滞在時間・CTAクリックが自動計測されます。
          </p>

          <CodeBlock code={`<!-- LP Tracking Script -->
<script src="../tracking.js"></script>
</body>
</html>`} />

          <div className="mt-4 p-4 bg-indigo-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">自動計測される項目:</h4>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>✓ ページビュー（PV）</li>
              <li>✓ スクロール深度（25%, 50%, 75%, 90%到達）</li>
              <li>✓ 滞在時間（5秒, 10秒到達）</li>
              <li>✓ エンゲージメントレベル（Level 1〜5）</li>
              <li>✓ CTAボタンクリック</li>
              <li>✓ キャンペーンコード（URLパラメータから自動取得）</li>
            </ul>
          </div>
        </section>

        {/* セクション3: GTM・Clarity */}
        <section id="gtm-clarity" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">3. GTM・Clarityタグの設置</h2>
          </div>

          <h3 className="font-medium text-slate-900 mb-2">Google Tag Manager</h3>
          <p className="text-slate-600 mb-4">
            <code className="bg-slate-100 px-2 py-1 rounded text-sm">&lt;head&gt;</code> タグの直後に以下を追加:
          </p>

          <CodeBlock code={`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MSBWVNVB');</script>
<!-- End Google Tag Manager -->`} />

          <p className="text-slate-600 my-4">
            <code className="bg-slate-100 px-2 py-1 rounded text-sm">&lt;body&gt;</code> タグの直後に以下を追加:
          </p>

          <CodeBlock code={`<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MSBWVNVB"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`} />

          <h3 className="font-medium text-slate-900 mt-6 mb-2">Microsoft Clarity（ヒートマップ）</h3>
          <p className="text-slate-600 mb-2">
            Clarityを使用する場合は、GTM経由で設定するか、以下を <code className="bg-slate-100 px-1 rounded text-sm">&lt;head&gt;</code> に追加:
          </p>

          <CodeBlock code={`<!-- Clarity -->
<script type="text/javascript">
(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "YOUR_CLARITY_ID");
</script>`} />
        </section>

        {/* セクション4: セクション別滞在時間 */}
        <section id="section-tracking" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">4. セクション別滞在時間の計測</h2>
          </div>

          <p className="text-slate-600 mb-4">
            LPの各セクションに <code className="bg-slate-100 px-2 py-1 rounded text-sm">data-section-id</code> 属性を追加すると、
            セクションごとの滞在時間が計測されます。
          </p>

          <CodeBlock code={`<!-- セクション別滞在時間を計測する例 -->
<section data-section-id="hero" data-section-name="ヒーロー">
  <!-- ヒーローセクションの内容 -->
</section>

<section data-section-id="features" data-section-name="機能紹介">
  <!-- 機能紹介セクションの内容 -->
</section>

<section data-section-id="testimonials" data-section-name="お客様の声">
  <!-- 口コミセクションの内容 -->
</section>

<section data-section-id="cta" data-section-name="CTA">
  <!-- CTAセクションの内容 -->
</section>`} />

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">計測の仕組み:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Intersection Observerで画面表示を監視</li>
              <li>• セクションが画面の50%以上表示されている間の時間を累積</li>
              <li>• ページ離脱時にサーバーへ送信</li>
              <li>• トラッキングページの「セクション別滞在時間」で確認可能</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>注意:</strong> 複数のLPで同じ <code className="bg-amber-100 px-1 rounded">data-section-id</code> を使用すると、
                トラッキングデータがマージされます。LP間で区別したい場合は、
                <code className="bg-amber-100 px-1 rounded">lp1-hero</code>、<code className="bg-amber-100 px-1 rounded">lp2-hero</code> のように
                ユニークなIDを使用してください。
              </div>
            </div>
          </div>
        </section>

        {/* セクション5: CTAボタン */}
        <section id="cta-tracking" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">5. CTAボタンのトラッキング</h2>
          </div>

          <p className="text-slate-600 mb-4">
            以下のクラス名を持つボタンは自動的にCTAクリックとして計測されます。
            <strong>hrefは「#」のままでOK</strong> - tracking.jsがutm_sourceに基づいて自動でLINE URLを設定します。
          </p>

          <CodeBlock code={`<!-- CTAボタン（href="#" でOK、自動でLINE URLが設定される） -->
<a href="#" class="btn-line-cta" data-cats="lineFriendsFollowLink">
  今すぐ公式LINEに登録
</a>

<a href="#" class="btn-line-header" data-cats="lineFriendsFollowLink">
  LINE登録
</a>`} />

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">LINE URL自動切り替えの仕組み:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• URLに <code className="bg-green-100 px-1 rounded">?utm_source=google</code> → Google広告用LINE URL</li>
              <li>• URLに <code className="bg-green-100 px-1 rounded">?utm_source=meta</code> → Meta広告用LINE URL</li>
              <li>• tracking.jsが自動でhref属性を設定</li>
              <li>• <code className="bg-green-100 px-1 rounded">data-cats=&quot;lineFriendsFollowLink&quot;</code> はCATS計測用</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2">トラッキング対象:</h4>
            <ul className="text-sm text-indigo-700 space-y-1">
              <li>• <code className="bg-indigo-100 px-1 rounded">.btn-line-cta</code> クラスを持つ要素</li>
              <li>• <code className="bg-indigo-100 px-1 rounded">.btn-line-header</code> クラスを持つ要素</li>
              <li>• テキストに「LINE」を含むリンク/ボタン</li>
              <li>• <code className="bg-indigo-100 px-1 rounded">.cta</code> または <code className="bg-indigo-100 px-1 rounded">.btn</code> クラスを持つ要素</li>
            </ul>
          </div>
        </section>

        {/* セクション5.5: 広告用URL発行 */}
        <section id="ad-url" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">5.5 広告用URL発行（LINEタグ設定）</h2>
          </div>

          <p className="text-slate-600 mb-4">
            Google広告とMeta広告では、LINE友だち追加URLの計測タグが異なります。
            LP管理画面でLINEタグを選択し、適切なURLを発行してください。
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">発行手順:</h4>
            <ol className="text-sm text-slate-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>LP管理画面の上部にある「LINEタグ」ドロップダウンで広告プラットフォームを選択</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>「適用」ボタンをクリック</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>各LPカードの「開く」ボタンまたは「コピー」ボタンで広告用URLを取得</span>
              </li>
            </ol>
          </div>

          <CodeBlock code={`# Google広告用URL
https://tastas.work/lp/0/index.html?utm_source=google

# Meta広告用URL
https://tastas.work/lp/0/index.html?utm_source=meta

# キャンペーンコード付き（例: サマーキャンペーン）
https://tastas.work/lp/0/index.html?utm_source=google&c=AAH-SUMMER`} language="text" />

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>重要:</strong> 広告入稿時は必ずLP管理画面から発行したURLを使用してください。
                utm_sourceパラメータがないと、LINE友だち追加の計測が正しく行われません。
              </div>
            </div>
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
            SNS共有時に正しく表示されるよう、以下のメタタグを設定してください:
          </p>

          <CodeBlock code={`<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="ページの説明文（120文字以内推奨）">
  <title>ページタイトル | TASTAS</title>

  <!-- OGP / SNS共有用メタタグ -->
  <meta property="og:title" content="ページタイトル | TASTAS">
  <meta property="og:description" content="ページの説明文">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://share-worker-app.vercel.app/lp/2/index.html">
  <meta property="og:image" content="https://share-worker-app.vercel.app/lp/images/ogp.png">
  <meta property="og:site_name" content="TASTAS">
  <meta property="og:locale" content="ja_JP">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="ページタイトル | TASTAS">
  <meta name="twitter:description" content="ページの説明文">
</head>`} />

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>リリース前に必ず確認:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• <code className="bg-amber-100 px-1 rounded">og:url</code> を本番URLに変更</li>
                  <li>• <code className="bg-amber-100 px-1 rounded">og:image</code> を本番URLに変更</li>
                  <li>• OGP画像（1200×630px）を用意</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* セクション7: チェックリスト */}
        <section id="checklist" className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">7. リリース前チェックリスト</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">ファイル構成</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">public/lp/{'{'}数字{'}'}/index.html</code> を作成</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>スタイルシート（styles.css）を作成</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">トラッキング設定</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">&lt;script src=&quot;../tracking.js&quot;&gt;&lt;/script&gt;</code> を追加</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>GTMタグ（GTM-MSBWVNVB）を <code className="bg-slate-100 px-1 rounded">&lt;head&gt;</code> と <code className="bg-slate-100 px-1 rounded">&lt;body&gt;</code> に追加</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>セクションに <code className="bg-slate-100 px-1 rounded">data-section-id</code> を設定（任意）</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">CTAボタン設定</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンに <code className="bg-slate-100 px-1 rounded">.btn-line-cta</code> または <code className="bg-slate-100 px-1 rounded">.btn-line-header</code> クラスを設定</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンに <code className="bg-slate-100 px-1 rounded">data-cats=&quot;lineFriendsFollowLink&quot;</code> を追加（CATS計測用）</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">href=&quot;#&quot;</code> のままでOK（tracking.jsが自動でLINE URLを設定）</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">OGP・メタ情報</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">og:url</code> を本番URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">og:image</code> を本番URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>OGP画像（1200×630px）を <code className="bg-slate-100 px-1 rounded">public/lp/images/ogp.png</code> に配置</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>タイトル・説明文を設定</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-3">広告入稿用URL発行</h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>LP管理画面でLINEタグ（Meta/Google）を選択し「適用」ボタンをクリック</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>Google広告用: <code className="bg-green-100 px-1 rounded">?utm_source=google</code> 付きURLを発行</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>Meta広告用: <code className="bg-green-100 px-1 rounded">?utm_source=meta</code> 付きURLを発行</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>キャンペーンコードが必要な場合は「コード」ボタンから発行</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-3">動作確認</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>LP管理画面（/lp）に新しいLPが表示される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>トラッキングデータがトラッキング画面に反映される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンクリックが計測される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>キャンペーンURL（?c=xxx）でアクセスした際にコードが記録される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">?utm_source=google</code> でGoogle用LINE URLが設定される</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-slate-100 px-1 rounded">?utm_source=meta</code> でMeta用LINE URLが設定される</span>
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
