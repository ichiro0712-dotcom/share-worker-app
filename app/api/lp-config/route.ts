import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'public', 'lp', 'lp-config.json');

// GET: 設定を取得
export async function GET() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return NextResponse.json(config);
    }
    return NextResponse.json({});
  } catch (e) {
    return NextResponse.json({}, { status: 500 });
  }
}

// POST: 設定を更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title } = body;

    let config: Record<string, { title: string }> = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    config[id] = { title };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
