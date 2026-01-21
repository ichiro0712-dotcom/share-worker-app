/**
 * 銀行検索API
 *
 * ローカルDB優先、見つからない場合はBankcodeJP APIをフォールバック
 *
 * GET /api/bank/search?q=みずほ
 * GET /api/bank/search?q=みずほ&source=api  (強制的にAPIを使用)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchBanksFromAPI } from '@/lib/bankcode-jp';
import { toFullWidth, toHalfWidth, katakanaToHiragana, hiraganaToKatakana } from '@/lib/string-utils';

export interface BankSearchResult {
  code: string;
  name: string;
  kana: string;
  hira: string;
}

export interface BankSearchResponse {
  banks: BankSearchResult[];
  source: 'local' | 'api';
  showApiSearchHint: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const source = searchParams.get('source'); // 'api' を指定するとAPIを使用
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  if (!query || query.length < 1) {
    return NextResponse.json({
      banks: [],
      source: 'local',
      showApiSearchHint: false,
    });
  }

  try {
    // source=api が指定された場合はBankcodeJP APIを使用
    if (source === 'api') {
      const apiResults = await searchBanksFromAPI(query, limit);
      const banks: BankSearchResult[] = apiResults.map(bank => ({
        code: bank.code,
        name: bank.name,
        kana: bank.hiragana, // APIのhiraganaをkanaとして使用
        hira: bank.hiragana,
      }));

      return NextResponse.json({
        banks,
        source: 'api' as const,
        showApiSearchHint: false,
      });
    }

    // ローカルDB検索
    // 全角・半角、ひらがな・カタカナの両方で検索
    const queryHalfWidth = toHalfWidth(query);
    const queryFullWidth = toFullWidth(query);
    const queryHiragana = katakanaToHiragana(query);
    const queryKatakana = hiraganaToKatakana(query);

    // 重複を除いた検索クエリのセット
    const queries = Array.from(new Set([query, queryHalfWidth, queryFullWidth, queryHiragana, queryKatakana]));

    const localResults = await prisma.bank.findMany({
      where: {
        OR: queries.flatMap(q => [
          { name: { contains: q, mode: 'insensitive' } },
          { hira: { contains: q, mode: 'insensitive' } },
          { kana: { contains: q, mode: 'insensitive' } },
          { code: { startsWith: q } },
        ]),
      },
      take: limit,
      orderBy: [
        { code: 'asc' },
      ],
    });

    const banks: BankSearchResult[] = localResults.map(bank => ({
      code: bank.code,
      name: bank.name,
      kana: bank.kana,
      hira: bank.hira,
    }));

    return NextResponse.json({
      banks,
      source: 'local' as const,
      showApiSearchHint: banks.length === 0,
    });

  } catch (error) {
    console.error('Bank search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
