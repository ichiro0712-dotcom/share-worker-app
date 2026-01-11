/**
 * 主要銀行リストAPI
 *
 * 初期表示用の主要銀行リスト（クイック選択用）
 *
 * GET /api/bank/major
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 主要銀行コード（表示順）
const MAJOR_BANK_CODES = [
  '0001', // みずほ銀行
  '0005', // 三菱UFJ銀行
  '0009', // 三井住友銀行
  '9900', // ゆうちょ銀行
  '0036', // 楽天銀行
  '0033', // PayPay銀行
  '0038', // 住信SBIネット銀行
  '0040', // イオン銀行
  '0039', // auじぶん銀行
];

export interface MajorBank {
  code: string;
  name: string;
}

export interface MajorBanksResponse {
  banks: MajorBank[];
}

export async function GET() {
  try {
    // DBから主要銀行を取得
    const banks = await prisma.bank.findMany({
      where: {
        code: {
          in: MAJOR_BANK_CODES,
        },
      },
      select: {
        code: true,
        name: true,
      },
    });

    // MAJOR_BANK_CODESの順序で並び替え
    const sortedBanks = MAJOR_BANK_CODES
      .map(code => banks.find(bank => bank.code === code))
      .filter((bank): bank is MajorBank => bank !== undefined);

    // DBにデータがない場合はフォールバック（静的データ）
    if (sortedBanks.length === 0) {
      return NextResponse.json({
        banks: [
          { code: '0001', name: 'みずほ' },
          { code: '0005', name: '三菱ＵＦＪ' },
          { code: '0009', name: '三井住友' },
          { code: '9900', name: 'ゆうちょ' },
          { code: '0036', name: '楽天' },
          { code: '0033', name: 'ＰａｙＰａｙ' },
          { code: '0038', name: '住信ＳＢＩネット' },
          { code: '0040', name: 'イオン' },
          { code: '0039', name: 'ａｕじぶん' },
        ],
      });
    }

    return NextResponse.json({ banks: sortedBanks });

  } catch (error) {
    console.error('Major banks fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
