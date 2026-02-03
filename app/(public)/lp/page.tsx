import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import LPList from './LPList';

// キャンペーン型
type Campaign = {
  code: string;
  name: string;
  createdAt: string;
};

// タイトル設定の型
type LPConfig = {
  [key: string]: {
    title: string;
    isActive?: boolean;
    campaigns?: Campaign[];
  };
};

// LP一覧ページ - /lp内のHTMLファイルを動的に検出して表示
export const dynamic = 'force-dynamic';

export default async function LPIndexPage() {
  const lpDir = path.join(process.cwd(), 'public', 'lp');

  // タイトル設定を読み込む
  let lpConfig: LPConfig = {};
  const configPath = path.join(lpDir, 'lp-config.json');
  if (fs.existsSync(configPath)) {
    try {
      lpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse lp-config.json:', e);
    }
  }

  // ディレクトリ内のサブディレクトリを取得
  const entries = fs.readdirSync(lpDir, { withFileTypes: true });

  // 数字名のディレクトリ（0, 1, 2...）を取得し、index.htmlがあるもののみ
  const lpPages = entries
    .filter(entry => {
      if (!entry.isDirectory()) return false;
      if (!/^\d+$/.test(entry.name)) return false;
      const indexPath = path.join(lpDir, entry.name, 'index.html');
      return fs.existsSync(indexPath);
    })
    .map(entry => ({
      id: entry.name,
      path: `/lp/${entry.name}/index.html`,
      title: lpConfig[entry.name]?.title || `LP ${entry.name}`,
      isActive: lpConfig[entry.name]?.isActive !== false,
      campaigns: lpConfig[entry.name]?.campaigns || [],
    }))
    .sort((a, b) => parseInt(a.id) - parseInt(b.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">LP管理</h1>
              <p className="text-xs text-gray-500">ランディングページの管理・トラッキング</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/lp/tracking"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg text-sm font-medium hover:from-rose-700 hover:to-rose-800 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              トラッキング
            </Link>
            <Link
              href="/lp/genres"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg text-sm font-medium hover:from-rose-700 hover:to-rose-800 transition-all shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              コード編集
            </Link>
            <Link
              href="/lp/guide"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              作成ガイド
            </Link>
          </div>
        </div>

        {/* 未設定セクション */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">
                リリース前の確認事項
              </h3>
              <ul className="space-y-1.5 text-xs text-amber-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                  <span><strong>CTAリンク</strong>：各LPの「公式LINEに登録」ボタンの <code className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">href=&quot;#&quot;</code> を実際のURLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                  <span><strong>OGP画像</strong>：<code className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">public/lp/images/ogp.png</code> を作成（1200×630px推奨）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                  <span><strong>OGP設定</strong>：各LP HTMLの <code className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">og:url</code> と <code className="px-1 py-0.5 bg-amber-100 rounded text-[10px]">og:image</code> を本番URLに変更</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                  <span><strong>Analytics</strong>：GTMタグ（GTM-MSBWVNVB）の設定確認</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* LP一覧 */}
        <LPList initialPages={lpPages} />

        {/* フッターヒント */}
        <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">使い方</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              タイトルをクリックして名前を編集
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              「コード」からキャンペーンURL発行
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              外部リンクアイコンでプレビュー
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              コピーアイコンでURLをコピー
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
