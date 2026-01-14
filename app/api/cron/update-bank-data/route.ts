/**
 * 銀行・支店マスタデータ定期更新API
 *
 * Vercel Cronから週1回呼び出され、zengin-code/source-dataからデータを取得してDBを更新する
 *
 * スケジュール: 毎週日曜 3:00 AM (UTC)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/zengin-code/source-data/master/data';

interface BankData {
  code: string;
  name: string;
  kana: string;
  hira: string;
  roma?: string;
}

interface BranchData {
  code: string;
  name: string;
  kana: string;
  hira: string;
  roma?: string;
}

async function fetchBanks(): Promise<Record<string, BankData>> {
  const response = await fetch(`${GITHUB_RAW_BASE}/banks.json`, {
    next: { revalidate: 0 }, // キャッシュ無効化
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch banks.json: ${response.status}`);
  }
  return response.json();
}

async function fetchBranches(bankCode: string): Promise<Record<string, BranchData> | null> {
  const response = await fetch(`${GITHUB_RAW_BASE}/branches/${bankCode}.json`, {
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch branches/${bankCode}.json: ${response.status}`);
  }
  return response.json();
}

export async function GET(request: Request) {
  // Vercel Cronからの呼び出し確認
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 本番環境ではCRON_SECRETによる認証を必須とする
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const results = {
    banks: { inserted: 0, updated: 0, errors: 0 },
    branches: { inserted: 0, updated: 0, errors: 0 },
  };

  try {
    // 1. 銀行データを取得・更新
    console.log('[Cron] Fetching banks data...');
    const banksData = await fetchBanks();
    const bankCodes = Object.keys(banksData);
    console.log(`[Cron] Found ${bankCodes.length} banks`);

    for (const [code, bank] of Object.entries(banksData)) {
      try {
        await prisma.bank.upsert({
          where: { code },
          update: {
            name: bank.name,
            kana: bank.kana,
            hira: bank.hira,
            roma: bank.roma || null,
          },
          create: {
            code,
            name: bank.name,
            kana: bank.kana,
            hira: bank.hira,
            roma: bank.roma || null,
          },
        });
        results.banks.inserted++;
      } catch (error) {
        console.error(`[Cron] Error upserting bank ${code}:`, error);
        results.banks.errors++;
      }
    }

    // 2. 支店データを取得・更新（主要銀行のみ、時間制限対策）
    // 全銀行の支店を取得すると時間がかかるため、主要銀行のみを優先
    const majorBankCodes = [
      '0001', '0005', '0009', '0010', '0017', // メガバンク
      '0033', '0034', '0035', '0036', '0038', '0039', '0040', '0041', '0042', // ネット銀行
      '9900', // ゆうちょ
    ];

    // 主要銀行以外も含めて処理（ただし時間制限に注意）
    const uniqueBankCodes = new Set([...majorBankCodes, ...bankCodes]);
    const allBankCodes = Array.from(uniqueBankCodes);
    let processedCount = 0;

    for (const bankCode of allBankCodes) {
      // 4分経過したら中断（Vercelの5分制限対策）
      if (Date.now() - startTime > 240000) {
        console.log(`[Cron] Time limit approaching, stopping at ${processedCount} banks`);
        break;
      }

      const branchesData = await fetchBranches(bankCode);
      if (!branchesData) {
        processedCount++;
        continue;
      }

      for (const [branchCode, branch] of Object.entries(branchesData)) {
        try {
          await prisma.branch.upsert({
            where: {
              bankCode_code: {
                bankCode,
                code: branchCode,
              },
            },
            update: {
              name: branch.name,
              kana: branch.kana,
              hira: branch.hira,
              roma: branch.roma || null,
            },
            create: {
              bankCode,
              code: branchCode,
              name: branch.name,
              kana: branch.kana,
              hira: branch.hira,
              roma: branch.roma || null,
            },
          });
          results.branches.inserted++;
        } catch (error) {
          results.branches.errors++;
        }
      }

      processedCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const duration = Date.now() - startTime;
    console.log(`[Cron] Completed in ${duration}ms:`, results);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results,
      processedBanks: processedCount,
      totalBanks: bankCodes.length,
    });

  } catch (error) {
    console.error('[Cron] Update failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 }
    );
  }
}
