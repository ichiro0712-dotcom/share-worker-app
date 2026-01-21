/**
 * 支店検索API
 *
 * 指定された銀行の支店を検索
 * ローカルDB優先、見つからない場合はBankcodeJP APIをフォールバック
 *
 * GET /api/bank/0001/branches?q=東京
 * GET /api/bank/0001/branches?q=東京&source=api  (強制的にAPIを使用)
 * GET /api/bank/0001/branches  (全支店を取得、上限あり)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchBranchesFromAPI, getAllBranchesFromAPI } from '@/lib/bankcode-jp';
import { toFullWidth, toHalfWidth, katakanaToHiragana, hiraganaToKatakana } from '@/lib/string-utils';

export interface BranchSearchResult {
  code: string;
  name: string;
  kana: string;
  hira: string;
}

export interface BranchSearchResponse {
  branches: BranchSearchResult[];
  source: 'local' | 'api';
  showApiSearchHint: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bankCode: string }> }
) {
  const { bankCode } = await params;
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const source = searchParams.get('source');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  // 銀行コードのバリデーション
  if (!/^\d{4}$/.test(bankCode)) {
    return NextResponse.json(
      { error: 'Invalid bank code' },
      { status: 400 }
    );
  }

  try {
    // source=api が指定された場合はBankcodeJP APIを使用
    if (source === 'api') {
      let apiResults;
      if (query) {
        apiResults = await searchBranchesFromAPI(bankCode, query, limit);
      } else {
        apiResults = await getAllBranchesFromAPI(bankCode, limit);
      }

      const branches: BranchSearchResult[] = apiResults.map(branch => ({
        code: branch.code,
        name: branch.name,
        kana: branch.hiragana,
        hira: branch.hiragana,
      }));

      return NextResponse.json({
        branches,
        source: 'api' as const,
        showApiSearchHint: false,
      });
    }

    // ローカルDB検索
    // 全角・半角、ひらがな・カタカナの両方で検索
    const whereClause: Record<string, unknown> = {
      bankCode,
    };

    if (query) {
      const queryHalfWidth = toHalfWidth(query);
      const queryFullWidth = toFullWidth(query);
      const queryHiragana = katakanaToHiragana(query);
      const queryKatakana = hiraganaToKatakana(query);

      // 重複を除いた検索クエリのセット
      const queries = Array.from(new Set([query, queryHalfWidth, queryFullWidth, queryHiragana, queryKatakana]));

      whereClause.OR = queries.flatMap(q => [
        { name: { contains: q, mode: 'insensitive' } },
        { hira: { contains: q, mode: 'insensitive' } },
        { kana: { contains: q, mode: 'insensitive' } },
        { code: { startsWith: q } },
      ]);
    }

    const localResults = await prisma.branch.findMany({
      where: whereClause,
      take: limit,
      orderBy: [
        { code: 'asc' },
      ],
    });

    const branches: BranchSearchResult[] = localResults.map(branch => ({
      code: branch.code,
      name: branch.name,
      kana: branch.kana,
      hira: branch.hira,
    }));

    // 検索クエリがあって結果が0件の場合のみヒントを表示
    const showApiSearchHint = query.length > 0 && branches.length === 0;

    return NextResponse.json({
      branches,
      source: 'local' as const,
      showApiSearchHint,
    });

  } catch (error) {
    console.error('Branch search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
