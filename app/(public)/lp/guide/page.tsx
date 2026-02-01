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
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="コピー"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-300" />}
      </button>
    </div>
  );
}

export default function LPGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/lp"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            LP管理に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">LP作成ガイド</h1>
          <p className="text-gray-600 mt-2">
            新しいLPを作成する際に必要な設定や、トラッキング機能を活用するための手順をまとめています。
          </p>
        </div>

        {/* 目次 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">目次</h2>
          <ol className="space-y-2 text-sm">
            <li><a href="#file-structure" className="text-blue-600 hover:underline">1. ファイル構成</a></li>
            <li><a href="#tracking-script" className="text-blue-600 hover:underline">2. トラッキングスクリプトの設置</a></li>
            <li><a href="#gtm-clarity" className="text-blue-600 hover:underline">3. GTM・Clarityタグの設置</a></li>
            <li><a href="#section-tracking" className="text-blue-600 hover:underline">4. セクション別滞在時間の計測</a></li>
            <li><a href="#cta-tracking" className="text-blue-600 hover:underline">5. CTAボタンのトラッキング</a></li>
            <li><a href="#ogp-meta" className="text-blue-600 hover:underline">6. OGP・メタタグの設定</a></li>
            <li><a href="#checklist" className="text-blue-600 hover:underline">7. リリース前チェックリスト</a></li>
          </ol>
        </div>

        {/* セクション1: ファイル構成 */}
        <section id="file-structure" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">1. ファイル構成</h2>
          </div>

          <p className="text-gray-600 mb-4">
            新しいLPは <code className="bg-gray-100 px-2 py-1 rounded text-sm">public/lp/</code> ディレクトリ配下に、
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
        <section id="tracking-script" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">2. トラッキングスクリプトの設置</h2>
          </div>

          <p className="text-gray-600 mb-4">
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">&lt;/body&gt;</code> タグの直前に以下を追加してください。
            これにより、PV・スクロール・滞在時間・CTAクリックが自動計測されます。
          </p>

          <CodeBlock code={`<!-- LP Tracking Script -->
<script src="../tracking.js"></script>
</body>
</html>`} />

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">自動計測される項目:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
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
        <section id="gtm-clarity" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">3. GTM・Clarityタグの設置</h2>
          </div>

          <h3 className="font-medium text-gray-900 mb-2">Google Tag Manager</h3>
          <p className="text-gray-600 mb-4">
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">&lt;head&gt;</code> タグの直後に以下を追加:
          </p>

          <CodeBlock code={`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MSBWVNVB');</script>
<!-- End Google Tag Manager -->`} />

          <p className="text-gray-600 my-4">
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">&lt;body&gt;</code> タグの直後に以下を追加:
          </p>

          <CodeBlock code={`<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MSBWVNVB"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`} />

          <h3 className="font-medium text-gray-900 mt-6 mb-2">Microsoft Clarity（ヒートマップ）</h3>
          <p className="text-gray-600 mb-2">
            Clarityを使用する場合は、GTM経由で設定するか、以下を <code className="bg-gray-100 px-1 rounded text-sm">&lt;head&gt;</code> に追加:
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
        <section id="section-tracking" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">4. セクション別滞在時間の計測</h2>
          </div>

          <p className="text-gray-600 mb-4">
            LPの各セクションに <code className="bg-gray-100 px-2 py-1 rounded text-sm">data-section-id</code> 属性を追加すると、
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
        <section id="cta-tracking" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">5. CTAボタンのトラッキング</h2>
          </div>

          <p className="text-gray-600 mb-4">
            以下のクラス名を持つボタンは自動的にCTAクリックとして計測されます:
          </p>

          <CodeBlock code={`<!-- 自動計測されるCTAボタン -->
<a href="https://line.me/..." class="btn-line-cta">
  今すぐ公式LINEに登録
</a>

<a href="https://line.me/..." class="btn-line-header">
  LINE登録
</a>

<!-- テキストに「LINE」を含むボタンも自動計測 -->
<button>LINEで相談する</button>`} />

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">トラッキング対象:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <code className="bg-blue-100 px-1 rounded">.btn-line-cta</code> クラスを持つ要素</li>
              <li>• <code className="bg-blue-100 px-1 rounded">.btn-line-header</code> クラスを持つ要素</li>
              <li>• テキストに「LINE」を含むリンク/ボタン</li>
              <li>• <code className="bg-blue-100 px-1 rounded">.cta</code> または <code className="bg-blue-100 px-1 rounded">.btn</code> クラスを持つ要素</li>
            </ul>
          </div>
        </section>

        {/* セクション6: OGP */}
        <section id="ogp-meta" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">6. OGP・メタタグの設定</h2>
          </div>

          <p className="text-gray-600 mb-4">
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
        <section id="checklist" className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">7. リリース前チェックリスト</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">ファイル構成</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-gray-100 px-1 rounded">public/lp/{'{'}数字{'}'}/index.html</code> を作成</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>スタイルシート（styles.css）を作成</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">トラッキング設定</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-gray-100 px-1 rounded">&lt;script src=&quot;../tracking.js&quot;&gt;&lt;/script&gt;</code> を追加</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>GTMタグを <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> と <code className="bg-gray-100 px-1 rounded">&lt;body&gt;</code> に追加</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>セクションに <code className="bg-gray-100 px-1 rounded">data-section-id</code> を設定（任意）</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">CTAリンク</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンの <code className="bg-gray-100 px-1 rounded">href=&quot;#&quot;</code> を実際のLINE URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>CTAボタンに適切なクラス（<code className="bg-gray-100 px-1 rounded">.btn-line-cta</code>）を設定</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">OGP・メタ情報</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-gray-100 px-1 rounded">og:url</code> を本番URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span><code className="bg-gray-100 px-1 rounded">og:image</code> を本番URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>OGP画像（1200×630px）を用意</span>
                </li>
                <li className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 rounded" />
                  <span>タイトル・説明文を設定</span>
                </li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">動作確認</h3>
              <ul className="space-y-2 text-sm text-gray-600">
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
              </ul>
            </div>
          </div>
        </section>

        {/* フッター */}
        <div className="text-center py-8">
          <Link
            href="/lp"
            className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            LP管理に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
