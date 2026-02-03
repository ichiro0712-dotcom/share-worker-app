import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'public', 'lp', 'lp-config.json');

type Campaign = {
  code: string;
  name: string;
  createdAt: string;
  genrePrefix?: string;
};

type Genre = {
  prefix: string;  // 3文字（例: "AAA", "AAB"）
  name: string;    // ジャンル名（例: "LINE", "Meta広告"）
};

type LPConfig = {
  title: string;
  isActive: boolean;
  campaigns: Campaign[];
};

type FullConfig = {
  genres?: Genre[];
  [lpId: string]: LPConfig | Genre[] | undefined;
};

// デフォルトジャンル
const DEFAULT_GENRES: Genre[] = [
  { prefix: 'AAA', name: 'LINE' },
  { prefix: 'AAB', name: 'Meta広告' },
  { prefix: 'AAC', name: 'Facebook' },
  { prefix: 'AAD', name: 'Instagram' },
  { prefix: 'AAE', name: 'Messenger' },
  { prefix: 'AAF', name: 'Audience Network' },
  { prefix: 'AAG', name: 'Threads' },
];

// 次のプレフィックスを生成（AAA → AAB → ... → AAZ → ABA → ...）
function getNextPrefix(genres: Genre[]): string {
  if (genres.length === 0) return 'AAA';

  const lastPrefix = genres[genres.length - 1].prefix;
  const chars = lastPrefix.split('');

  // 末尾から繰り上げ処理
  for (let i = 2; i >= 0; i--) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      break;
    }
  }

  return chars.join('');
}

// 設定ファイルを読み込む
function loadConfig(): FullConfig {
  if (!fs.existsSync(configPath)) {
    return { genres: DEFAULT_GENRES };
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  // genresがなければデフォルトを設定
  if (!config.genres) {
    config.genres = DEFAULT_GENRES;
  }
  return config;
}

// 設定ファイルを保存
function saveConfig(config: FullConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// GET: 設定を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const config = loadConfig();

    // キャッシュ無効化ヘッダー
    const noCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    // ジャンル一覧を返す
    if (action === 'genres') {
      return NextResponse.json({ genres: config.genres || DEFAULT_GENRES }, { headers: noCacheHeaders });
    }

    // リスト形式で返す（LPListコンポーネント用）
    if (action === 'list') {
      const lpDir = path.join(process.cwd(), 'public', 'lp');
      const entries = fs.readdirSync(lpDir, { withFileTypes: true });

      const pages = entries
        .filter(entry => {
          if (!entry.isDirectory()) return false;
          if (!/^\d+$/.test(entry.name)) return false;
          const indexPath = path.join(lpDir, entry.name, 'index.html');
          return fs.existsSync(indexPath);
        })
        .map(entry => ({
          id: entry.name,
          path: `/lp/${entry.name}/index.html`,
          title: (config[entry.name] as LPConfig)?.title || `LP ${entry.name}`,
          isActive: (config[entry.name] as LPConfig)?.isActive !== false,
          campaigns: (config[entry.name] as LPConfig)?.campaigns || [],
        }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));

      return NextResponse.json({ pages, genres: config.genres || DEFAULT_GENRES }, { headers: noCacheHeaders });
    }

    return NextResponse.json(config, { headers: noCacheHeaders });
  } catch (e) {
    console.error('LP config GET error:', e);
    return NextResponse.json({}, { status: 500 });
  }
}

// POST: 設定を更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, title, campaign, code, genreName, genrePrefix } = body;

    const config = loadConfig();

    // ジャンル関連のアクション
    switch (action) {
      case 'addGenre': {
        // 新しいジャンルを追加
        const genres = config.genres || DEFAULT_GENRES;
        const newPrefix = getNextPrefix(genres);
        const newGenre: Genre = { prefix: newPrefix, name: genreName };
        config.genres = [...genres, newGenre];
        saveConfig(config);
        return NextResponse.json({ success: true, genre: newGenre });
      }

      case 'updateGenre': {
        // ジャンル名を更新（プレフィックスは変更不可）
        const genres = config.genres || DEFAULT_GENRES;
        config.genres = genres.map(g =>
          g.prefix === genrePrefix ? { ...g, name: genreName } : g
        );
        saveConfig(config);
        return NextResponse.json({ success: true });
      }

      case 'deleteGenre': {
        // ジャンルを削除（コードが紐づいていない場合のみ）
        // まず使用中かチェック
        let isUsed = false;
        for (const key of Object.keys(config)) {
          if (key === 'genres') continue;
          const lpConfig = config[key] as LPConfig;
          if (lpConfig.campaigns?.some(c => c.genrePrefix === genrePrefix)) {
            isUsed = true;
            break;
          }
        }
        if (isUsed) {
          return NextResponse.json(
            { error: 'このジャンルは使用中のため削除できません' },
            { status: 400 }
          );
        }
        const genres = config.genres || DEFAULT_GENRES;
        config.genres = genres.filter(g => g.prefix !== genrePrefix);
        saveConfig(config);
        return NextResponse.json({ success: true });
      }

      case 'generateCode': {
        // ジャンルを指定してコードを生成
        const genres = config.genres || DEFAULT_GENRES;
        const genre = genres.find(g => g.prefix === genrePrefix);
        if (!genre) {
          return NextResponse.json({ error: 'ジャンルが見つかりません' }, { status: 400 });
        }
        // ランダム6文字を生成
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomPart = '';
        for (let i = 0; i < 6; i++) {
          randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const newCode = `${genrePrefix}-${randomPart}`;
        return NextResponse.json({ success: true, code: newCode, genreName: genre.name });
      }
    }

    // LP関連のアクション（既存）
    if (id) {
      // 既存のエントリがない場合は初期化
      if (!config[id]) {
        config[id] = { title: `LP ${id}`, isActive: true, campaigns: [] };
      }

      const lpConfig = config[id] as LPConfig;

      // isActiveがない場合は初期化（既存データのマイグレーション）
      if (lpConfig.isActive === undefined) {
        lpConfig.isActive = true;
      }

      // campaignsがない場合は初期化
      if (!lpConfig.campaigns) {
        lpConfig.campaigns = [];
      }

      switch (action) {
        case 'addCampaign':
          // キャンペーンを追加
          lpConfig.campaigns.push(campaign);
          break;

        case 'deleteCampaign':
          // キャンペーンを削除
          lpConfig.campaigns = lpConfig.campaigns.filter(c => c.code !== code);
          break;

        case 'activate':
          // LPを有効化
          lpConfig.isActive = true;
          break;

        case 'deactivate':
          // LPを停止
          lpConfig.isActive = false;
          break;

        case 'toggleStatus':
          // LPのステータスをトグル
          lpConfig.isActive = !lpConfig.isActive;
          break;

        default:
          // タイトルの更新（従来の動作）
          if (title) {
            lpConfig.title = title;
          }
          break;
      }

      config[id] = lpConfig;
    }

    saveConfig(config);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('LP config error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
