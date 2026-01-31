import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'public', 'lp', 'lp-config.json');

type Campaign = {
  code: string;
  name: string;
  createdAt: string;
};

type LPConfig = {
  title: string;
  isActive: boolean;
  campaigns: Campaign[];
};

// GET: 設定を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!fs.existsSync(configPath)) {
      return NextResponse.json(action === 'list' ? { pages: [] } : {});
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

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
          title: config[entry.name]?.title || `LP ${entry.name}`,
          isActive: config[entry.name]?.isActive !== false,
          campaigns: config[entry.name]?.campaigns || [],
        }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));

      return NextResponse.json({ pages });
    }

    return NextResponse.json(config);
  } catch (e) {
    console.error('LP config GET error:', e);
    return NextResponse.json({}, { status: 500 });
  }
}

// POST: 設定を更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, title, campaign, code } = body;

    let config: Record<string, LPConfig> = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // 既存のエントリがない場合は初期化
    if (!config[id]) {
      config[id] = { title: `LP ${id}`, isActive: true, campaigns: [] };
    }

    // isActiveがない場合は初期化（既存データのマイグレーション）
    if (config[id].isActive === undefined) {
      config[id].isActive = true;
    }

    // campaignsがない場合は初期化
    if (!config[id].campaigns) {
      config[id].campaigns = [];
    }

    switch (action) {
      case 'addCampaign':
        // キャンペーンを追加
        config[id].campaigns.push(campaign);
        break;

      case 'deleteCampaign':
        // キャンペーンを削除
        config[id].campaigns = config[id].campaigns.filter(c => c.code !== code);
        break;

      case 'activate':
        // LPを有効化
        config[id].isActive = true;
        break;

      case 'deactivate':
        // LPを停止
        config[id].isActive = false;
        break;

      case 'toggleStatus':
        // LPのステータスをトグル
        config[id].isActive = !config[id].isActive;
        break;

      default:
        // タイトルの更新（従来の動作）
        if (title) {
          config[id].title = title;
        }
        break;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('LP config error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
