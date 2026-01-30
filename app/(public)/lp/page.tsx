import fs from 'fs';
import path from 'path';
import LPList from './LPList';

// タイトル設定の型
type LPConfig = {
  [key: string]: {
    title: string;
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
    }))
    .sort((a, b) => parseInt(a.id) - parseInt(b.id));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      padding: '24px',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        <h1 style={{
          color: '#333',
          fontSize: '18px',
          fontWeight: 'bold',
          marginBottom: '16px',
          borderBottom: '1px solid #e0e0e0',
          paddingBottom: '12px',
        }}>
          LP一覧
        </h1>

        <LPList initialPages={lpPages} />

        <div style={{
          marginTop: '20px',
          fontSize: '11px',
          color: '#999',
        }}>
          タイトルをクリックして編集できます
        </div>
      </div>
    </div>
  );
}
