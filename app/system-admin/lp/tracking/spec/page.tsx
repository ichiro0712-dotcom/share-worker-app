'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3, Clock, MousePointer, Scroll, Activity, Target, Info, Users, FileText } from 'lucide-react';

export default function TrackingSpecPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/system-admin/lp/tracking"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            トラッキングに戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">LPトラッキング仕様</h1>
          <p className="text-slate-500 mt-1">
            LPトラッキングで計測している指標の定義と仕組みについて説明します
          </p>
        </div>

        {/* Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            概要
          </h2>
          <p className="text-slate-700 leading-relaxed mb-3">
            LPトラッキングは、各ランディングページへの訪問者の行動を計測し、
            マーケティング効果を分析するためのシステムです。
            ページビュー、スクロール深度、滞在時間、CTAクリックなどを自動で記録し、
            エンゲージメントレベルとして数値化します。
          </p>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>2種類のトラッキング:</strong> 通常LP（ZIPアップロード方式）と
              LP0（公開求人検索 <code className="bg-blue-100 px-1 rounded">/public/jobs</code>）では
              計測項目が異なります。LP0は一覧→詳細の遷移型のため、求人閲覧数や閲覧求人ランキングなどLP0固有の指標があります。
            </p>
          </div>
        </div>

        {/* Data Collection */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            データ収集の仕組み
          </h2>
          <div className="space-y-4 text-slate-700">
            <div>
              <h3 className="font-medium text-slate-900 mb-2">トラッキングスクリプト</h3>
              <p className="text-sm">
                各LPページに<code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/lp/tracking.js</code>が
                読み込まれ、ユーザーの行動を自動で計測します。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-2">セッションID</h3>
              <p className="text-sm">
                ブラウザのsessionStorageを使用して、同一訪問を識別します。
                タブを閉じるまでが1セッションとしてカウントされます。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-2">キャンペーンコード</h3>
              <p className="text-sm">
                URLパラメータ<code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">?c=xxx</code>または
                UTMパラメータ（utm_source, utm_campaign等）から広告媒体を識別します。
                7日間localStorageに保存され、会員登録時に紐付けられます。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-2">データ送信</h3>
              <p className="text-sm">
                Beacon APIを使用して、ページを離れる時もデータを確実に送信します。
                タブを閉じた時やページ遷移時も計測データが失われません。
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Definition */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            指標の定義
          </h2>

          <div className="space-y-6">
            {/* Page Views */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">PV（ページビュー）</h3>
              </div>
              <p className="text-sm text-slate-700">
                LPページが読み込まれた回数。同一ユーザーが複数回訪問した場合も、それぞれ1PVとしてカウントされます。
              </p>
            </div>

            {/* Sessions */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">セッション</h3>
              </div>
              <p className="text-sm text-slate-700">
                ユニークな訪問数。sessionStorageベースのセッションIDで識別されるため、
                同一ブラウザの同一タブでの複数PVは1セッションとしてカウントされます。
              </p>
            </div>

            {/* Events */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">イベント（CTAクリック）</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                CTAボタンがクリックされた回数。LP種別により対象が異なります。
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li><strong>通常LP:</strong> CTAボタン（<code className="bg-slate-100 px-1 rounded">{'data-cats="lineFriendsFollowLink"'}</code>属性付きリンク、または「LINE」を含むテキスト）</li>
                <li><strong>LP0（公開求人検索）:</strong> 「会員登録して応募する」ボタン（ボタンID: <code className="bg-slate-100 px-1 rounded">cta_register</code>）</li>
              </ul>
            </div>

            {/* Event CTR */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">イベントCTR</h3>
              </div>
              <p className="text-sm text-slate-700">
                セッションあたりのCTAクリック率。計算式: イベント数 ÷ セッション数 × 100
              </p>
            </div>

            {/* Registration */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">登録</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                LP経由での会員登録数。LP訪問時にlocalStorageに保存されたLP ID・キャンペーンコードが、
                会員登録時にユーザーレコードに紐付けられます。
              </p>
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-600">
                <p className="font-medium mb-1">追跡の仕組み:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>LP訪問時にlp_id, lp_campaign_codeをlocalStorageに保存（7日間保持）</li>
                  <li>会員登録ページでlocalStorageからLP情報を取得</li>
                  <li>登録時にUserレコードのregistration_lp_id, registration_campaign_codeに保存</li>
                </ol>
              </div>
            </div>

            {/* Registration Rate */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">登録率</h3>
              </div>
              <p className="text-sm text-slate-700">
                セッションあたりの登録率。計算式: 登録数 ÷ セッション数 × 100
              </p>
            </div>

            {/* Scroll Depth */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Scroll className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">スクロール到達率</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                ページをどこまでスクロールしたかを計測。以下の閾値でイベントを記録します：
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>25%到達: ページの1/4までスクロール</li>
                <li>50%到達: ページの半分までスクロール</li>
                <li>75%到達: ページの3/4までスクロール</li>
                <li>90%到達: ページのほぼ最後までスクロール</li>
              </ul>
            </div>

            {/* Dwell Time */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">滞在時間達成率</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                ページに滞在した時間を計測。以下の閾値でイベントを記録します：
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>5秒以上: 最低限のコンテンツ閲覧</li>
                <li>10秒以上: 一定の関心を示す滞在</li>
              </ul>
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>上限:</strong> 滞在時間はタブを開きっぱなしにした場合などの異常値を防ぐためキャップされます。
                </p>
                <ul className="text-sm text-slate-600 list-disc list-inside mt-1 space-y-1">
                  <li>通常LP: 最大300秒（5分）</li>
                  <li>LP0（公開求人検索）: 最大600秒（10分）※一覧→詳細の遷移があるため長め</li>
                </ul>
              </div>
            </div>

            {/* Section Dwell */}
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">セクション別滞在時間</h3>
              </div>
              <p className="text-sm text-slate-700">
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">data-section-id</code>属性を持つ
                HTMLセクションごとの平均滞在時間を計測。Intersection Observerを使用して、
                画面に50%以上表示されている間の滞在時間を累積します。
              </p>
            </div>
          </div>
        </div>

        {/* Post-Registration Funnel Metrics */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            登録後ファネル指標（LP帰属）
          </h2>
          <p className="text-slate-700 mb-4">
            LP経由で登録したワーカーが、プラットフォーム内でどの程度アクティブに行動しているかを計測する指標です。
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">User.registration_lp_id</code> で
            登録元LPを特定し、LP/キャンペーンコード別に集計します。
          </p>

          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">親求人PV</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                LP経由で登録したワーカーが、プラットフォーム内の求人詳細ページ（<code className="bg-slate-100 px-1 rounded">/jobs/[id]</code>）を
                閲覧した回数。ログイン済みワーカーの閲覧のみ計測されます。
              </p>
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-600">
                <p className="font-medium mb-1">計測の仕組み:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>ワーカーが求人詳細ページにアクセス</li>
                  <li><code className="bg-slate-100 px-1 rounded">JobDetailTracker</code> コンポーネントがサーバーにPOST</li>
                  <li>サーバー側で <code className="bg-slate-100 px-1 rounded">getServerSession</code> でユーザーIDを取得（改ざん防止）</li>
                  <li><code className="bg-slate-100 px-1 rounded">job_detail_page_views</code> テーブルにレコード作成</li>
                  <li>集計時に <code className="bg-slate-100 px-1 rounded">User.registration_lp_id</code> でLP帰属を逆引き</li>
                </ol>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">親求人セッション</h3>
              </div>
              <p className="text-sm text-slate-700">
                LP経由で登録したワーカーのうち、求人詳細ページを1回以上閲覧したユニークユーザー数。
                計算式: <code className="bg-slate-100 px-1 rounded">job_detail_page_views</code> テーブルで対象LP帰属ユーザーのユニーク user_id 数
              </p>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">応募数（LP帰属）</h3>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                LP経由で登録したワーカーが行った応募の総数。
                応募・マッチング分析タブの「応募数」と同じ <code className="bg-slate-100 px-1 rounded">applications</code> テーブルを使用しますが、
                <code className="bg-slate-100 px-1 rounded">User.registration_lp_id</code> によるLP帰属フィルターで絞り込みます。
              </p>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">応募率</h3>
              </div>
              <p className="text-sm text-slate-700">
                LP経由の登録者のうち、1回以上応募したユニークユーザーの割合（100%を超えない）。計算式: 応募ユニークユーザー数（LP帰属） ÷ 登録数 × 100
              </p>
            </div>

            <div className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-900">平均応募日数</h3>
              </div>
              <p className="text-sm text-slate-700">
                LP経由で登録したワーカー1人あたりの平均応募日数（何日分のシフトに応募したか）。
                計算式: 応募数（LP帰属） ÷ ユニーク応募ワーカー数
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-teal-50 rounded-lg">
            <p className="text-sm text-teal-800">
              <strong>分析のポイント</strong>: 登録率が高くても応募率が低い場合、LPの訴求内容と実際の求人内容にギャップがある可能性があります。
              平均応募日数が少ない場合、ワーカーの継続利用促進やリピート応募の施策改善余地を示唆します。
            </p>
          </div>
        </div>

        {/* Engagement Level */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            エンゲージメントレベル
          </h2>
          <p className="text-slate-700 mb-4">
            滞在時間とスクロール深度を組み合わせて、訪問者のエンゲージメントを5段階で評価します。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">レベル</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">条件</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">意味</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 font-medium">Level 0</td>
                  <td className="px-4 py-3 text-slate-600">5秒未満の滞在</td>
                  <td className="px-4 py-3 text-slate-600">直帰・即離脱</td>
                </tr>
                <tr className="bg-purple-50">
                  <td className="px-4 py-3 font-medium text-purple-700">Level 1</td>
                  <td className="px-4 py-3 text-slate-600">5秒以上滞在</td>
                  <td className="px-4 py-3 text-slate-600">最低限の興味</td>
                </tr>
                <tr className="bg-purple-50">
                  <td className="px-4 py-3 font-medium text-purple-700">Level 2</td>
                  <td className="px-4 py-3 text-slate-600">10秒以上滞在</td>
                  <td className="px-4 py-3 text-slate-600">一定の関心</td>
                </tr>
                <tr className="bg-purple-100">
                  <td className="px-4 py-3 font-medium text-purple-800">Level 3</td>
                  <td className="px-4 py-3 text-slate-600">10秒以上 + 50%スクロール</td>
                  <td className="px-4 py-3 text-slate-600">内容を読んでいる</td>
                </tr>
                <tr className="bg-purple-100">
                  <td className="px-4 py-3 font-medium text-purple-800">Level 4</td>
                  <td className="px-4 py-3 text-slate-600">10秒以上 + 75%スクロール</td>
                  <td className="px-4 py-3 text-slate-600">高い興味を持っている</td>
                </tr>
                <tr className="bg-purple-200">
                  <td className="px-4 py-3 font-medium text-purple-900">Level 5</td>
                  <td className="px-4 py-3 text-slate-600">10秒以上 + 90%スクロール</td>
                  <td className="px-4 py-3 text-slate-600">非常に強い興味・検討中</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">CTAクリック有無による比較</h2>
          <p className="text-slate-700 mb-4">
            エンゲージメント分析では、CTAをクリックしたユーザーとしなかったユーザーを比較できます。
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 bg-slate-600 rounded-sm"></span>
              <span className="text-sm text-slate-700">
                <strong>全体</strong>: すべてのセッションの集計
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 bg-green-600 rounded-sm"></span>
              <span className="text-sm text-slate-700">
                <strong>CTAクリックあり</strong>: CTAボタン等をクリックしたセッション
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 bg-red-600 rounded-sm"></span>
              <span className="text-sm text-slate-700">
                <strong>CTAクリックなし</strong>: CTAをクリックせずに離脱したセッション
              </span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
            <p className="text-sm text-indigo-800">
              <strong>分析のポイント</strong>: CTAクリックありのユーザーがどの程度スクロールしているか、
              どのセクションに長く滞在しているかを比較することで、
              コンバージョンに効果的なコンテンツを特定できます。
            </p>
          </div>
        </div>

        {/* Data Layer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">GTM/Google Analytics連携</h2>
          <p className="text-slate-700 mb-4">
            トラッキングスクリプトは、Google Tag Manager (GTM) のdataLayerにもイベントをプッシュします。
            GTMを設定すれば、Google Analyticsでもデータを確認できます。
          </p>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-900 mb-2">プッシュされるイベント:</p>
            <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
              <li><code className="bg-slate-100 px-1 rounded">lp_pageview</code> - ページ表示</li>
              <li><code className="bg-slate-100 px-1 rounded">lp_scroll</code> - スクロール到達</li>
              <li><code className="bg-slate-100 px-1 rounded">lp_dwell</code> - 滞在時間達成</li>
              <li><code className="bg-slate-100 px-1 rounded">lp_cta_click</code> - CTAクリック</li>
              <li><code className="bg-slate-100 px-1 rounded">lp_engagement</code> - エンゲージメントレベル達成</li>
            </ul>
          </div>
        </div>

        {/* LP Status Management */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            LP有効/停止管理
          </h2>
          <p className="text-slate-700 mb-4">
            LP管理ページでは、各LPを「有効」または「停止」に設定できます。
          </p>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <h3 className="font-medium text-slate-900">有効なLP</h3>
              </div>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>トラッキング一覧に表示される</li>
                <li>アクセス数・登録数が計測される</li>
                <li>キャンペーンコードが発行可能</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                <h3 className="font-medium text-slate-900">停止中のLP</h3>
              </div>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>トラッキング一覧に表示されない</li>
                <li>過去のデータは保持される（削除されない）</li>
                <li>LPページ自体は引き続きアクセス可能（公開状態）</li>
                <li>いつでも再度有効化できる</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>注意</strong>: LPを停止しても、LP自体のHTMLページは削除されません。
              トラッキング一覧に表示されなくなるだけで、URLにアクセスすれば引き続き閲覧可能です。
              完全にページを非公開にしたい場合は、HTMLファイルを削除してください。
            </p>
          </div>
        </div>

        {/* Campaign Code Generation */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-rose-600" />
            キャンペーンコード発行
          </h2>
          <p className="text-slate-700 mb-4">
            LP管理ページから、広告媒体別にキャンペーンコードを発行できます。
            コードにはジャンル（広告媒体）を識別するプレフィックスが付与されます。
          </p>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">コード形式</h3>
              <p className="text-sm text-slate-600 mb-2">
                コードは以下の形式で生成されます：
              </p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <code className="text-sm font-mono">
                  <span className="text-indigo-600">[プレフィックス]</span>
                  <span className="text-slate-400">-</span>
                  <span className="text-green-600">[ランダム6文字]</span>
                </code>
                <p className="text-xs text-slate-500 mt-2">例: AAA-X4Y5Z6, AAB-1B2C3D</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-3">ジャンル（プレフィックス）一覧</h3>
              <p className="text-sm text-slate-600 mb-3">
                デフォルトで以下のジャンルが登録されています。ジャンルは自由に追加・編集できます。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">プレフィックス</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">ジャンル名</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAA</code></td>
                      <td className="px-3 py-2 text-slate-600">LINE</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAB</code></td>
                      <td className="px-3 py-2 text-slate-600">Meta広告</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAC</code></td>
                      <td className="px-3 py-2 text-slate-600">Facebook</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAD</code></td>
                      <td className="px-3 py-2 text-slate-600">Instagram</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAE</code></td>
                      <td className="px-3 py-2 text-slate-600">Messenger</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAF</code></td>
                      <td className="px-3 py-2 text-slate-600">Audience Network</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2"><code className="bg-slate-100 px-1.5 py-0.5 rounded">AAG</code></td>
                      <td className="px-3 py-2 text-slate-600">Threads</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">ジャンル編集</h3>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>LP管理ページの「コードジャンル編集」からジャンルを追加・編集・削除できます</li>
                <li>新規ジャンル追加時、プレフィックスは自動で割り当てられます（AAH, AAI, ...）</li>
                <li>一度割り当てられたプレフィックスは変更できません（ジャンル名のみ変更可能）</li>
                <li>コードが発行されているジャンルは削除できません</li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">コード発行手順</h3>
              <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                <li>LP管理ページでLPカードの「コード」ボタンをクリック</li>
                <li>「新規コード発行」ボタンをクリック</li>
                <li>ジャンル選択モーダルから広告媒体を選択</li>
                <li>コードが自動生成され、一覧に追加されます</li>
              </ol>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">コードの使用方法</h3>
              <p className="text-sm text-slate-600 mb-2">
                発行したコードをURLパラメータとして付与します：
              </p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <code className="text-sm break-all">
                  https://example.com/lp/1/index.html<span className="text-rose-600">?c=AAA-X4Y5Z6</span>
                </code>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                このURLでアクセスしたユーザーは、該当ジャンル（広告媒体）からの流入として記録されます。
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
            <p className="text-sm text-indigo-800">
              <strong>分析のポイント</strong>: プレフィックスにより広告媒体ごとの流入を識別できるため、
              将来的にトラッキング一覧でジャンル別の絞り込みや比較分析が可能になります。
            </p>
          </div>
        </div>

        {/* LP0 Specific */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            LP0（公開求人検索）固有の指標
          </h2>
          <p className="text-slate-700 mb-4">
            LP0は <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/public/jobs</code>（求人一覧）と
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">/public/jobs/[id]</code>（求人詳細）を
            対象とするシステムLPです。通常LPとは異なる指標を計測します。
          </p>

          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-medium text-slate-900 mb-2">求人閲覧数</h3>
              <p className="text-sm text-slate-700">
                求人詳細ページ（<code className="bg-slate-100 px-1 rounded">/public/jobs/[id]</code>）が閲覧された合計回数。
                <code className="bg-slate-100 px-1 rounded">job_pageview</code> イベントで記録されます。
              </p>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-medium text-slate-900 mb-2">閲覧求人ランキング</h3>
              <p className="text-sm text-slate-700">
                どの求人が多く閲覧されているかを、PV数・ユニークセッション数でランキング表示します。
                上位50件まで表示されます。
              </p>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-medium text-slate-900 mb-2">計測されない項目</h3>
              <p className="text-sm text-slate-700 mb-2">
                LP0では以下の項目は計測されません（一覧→詳細の遷移型ページのため）：
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>スクロール到達率（25/50/75/90%）</li>
                <li>エンゲージメントレベル（常に0）</li>
                <li>セクション別滞在時間</li>
                <li>GTM / dataLayer連携</li>
              </ul>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-medium text-slate-900 mb-2">登録後ファネル指標（LP0帰属）</h3>
              <p className="text-sm text-slate-700 mb-2">
                LP0（公開求人検索）でも、登録後ファネル指標（親求人PV、親求人セッション、応募数、応募率、平均応募日数）を
                キャンペーンコード別に集計しています。
                <code className="bg-slate-100 px-1 rounded">User.registration_lp_id = &apos;0&apos;</code> のユーザーが対象です。
              </p>
            </div>

            <div className="pb-2">
              <h3 className="font-medium text-slate-900 mb-2">セッションIDの分離</h3>
              <p className="text-sm text-slate-700">
                LP0は通常LPとは別のセッションIDを使用します
                （<code className="bg-slate-100 px-1 rounded">lp_session_id_0</code>）。
                同一ブラウザで通常LPとLP0を両方閲覧しても、データが混在することはありません。
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>トラッキング画面:</strong> LP0のトラッキングデータは
              <code className="bg-blue-100 px-1 rounded">/system-admin/lp/tracking/public-jobs</code>
              で確認できます。通常LPのトラッキング画面とは別ページです。
            </p>
          </div>
        </div>

        {/* External Tools */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">外部ツールとの連携</h2>
          <p className="text-slate-700 mb-4">
            より詳細な分析には、以下の外部ツールとの併用を推奨します。
          </p>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">Microsoft Clarity</h3>
              <p className="text-sm text-slate-600">
                無料で使えるヒートマップ・セッション録画ツール。
                ピクセル単位のクリック・スクロールヒートマップ、ユーザーセッションの録画を確認できます。
              </p>
              <a
                href="https://clarity.microsoft.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block"
              >
                clarity.microsoft.com →
              </a>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <h3 className="font-medium text-slate-900 mb-2">Google Analytics 4</h3>
              <p className="text-sm text-slate-600">
                GTMを通じてイベントを送信することで、GA4でもLPのパフォーマンスを分析できます。
                ファネル分析やオーディエンスセグメント等の高度な分析が可能です。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
