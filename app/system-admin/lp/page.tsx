import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import LPList from './LPList';
import { BarChart3, Tag, BookOpen, AlertTriangle, Megaphone } from 'lucide-react';

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
    <div className="p-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">LP管理</h1>
            <p className="text-slate-500">ランディングページの管理・トラッキング</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/system-admin/lp/tracking"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              トラッキング
            </Link>
            <Link
              href="/system-admin/lp/genres"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Tag className="w-4 h-4" />
              コード編集
            </Link>
            <Link
              href="/system-admin/lp/guide"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              作成ガイド
            </Link>
          </div>
        </div>
      </div>

      {/* 未設定セクション */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-amber-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
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
      <div className="mt-6 p-4 bg-white rounded-xl border border-slate-200">
        <h4 className="text-xs font-semibold text-slate-600 mb-2">使い方</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Megaphone className="w-3.5 h-3.5 text-slate-400" />
            タイトルをクリックして名前を編集
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            「コード」からキャンペーンURL発行
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            外部リンクアイコンでプレビュー
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            トラッキングで効果測定
          </div>
        </div>
      </div>
    </div>
  );
}
