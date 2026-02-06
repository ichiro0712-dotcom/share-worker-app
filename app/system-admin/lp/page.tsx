import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import LPList from './LPList';
import DBLPList from './components/DBLPList';
import { BarChart3, Tag, BookOpen, AlertTriangle, Megaphone, Database, FolderOpen } from 'lucide-react';
import { getLandingPages } from '@/lib/lp-actions';

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

// LP一覧ページ - DB管理とファイルベースの両方を表示
export const dynamic = 'force-dynamic';

export default async function LPIndexPage() {
  // DB管理のLPを取得
  const dbPages = await getLandingPages();

  // ファイルベースのLP（既存互換）
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
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(lpDir, { withFileTypes: true });
  } catch (e) {
    // ディレクトリがない場合は空配列
  }

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

      {/* DB管理LP（新方式） */}
      <div className="mb-8 p-6 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800">DB管理LP（新方式）</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          ZIPファイルをアップロードして管理。GTM/LINE Tag/tracking.jsが自動挿入されます。
        </p>
        <DBLPList initialPages={dbPages} />
      </div>

      {/* 既存LP（ファイルベース・移行中） */}
      {lpPages.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-800">既存LP（ファイルベース）</h2>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
              移行中
            </span>
          </div>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">
                  既存LPの移行について
                </h3>
                <p className="text-xs text-amber-700">
                  public/lp/ にあるLPは順次DB管理に移行されます。
                  移行が完了したらこのセクションは非表示になります。
                </p>
              </div>
            </div>
          </div>
          <LPList initialPages={lpPages} />
        </div>
      )}

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
