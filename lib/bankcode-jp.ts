/**
 * BankcodeJP API クライアント
 *
 * ローカルDBで見つからない場合のフォールバックとして使用
 */

const BANKCODE_JP_BASE_URL = 'https://apis.bankcode-jp.com/v3';

export interface BankcodeJPBank {
  code: string;
  name: string;
  halfWidthKana?: string;
  fullWidthKana?: string;
  hiragana: string;
  businessTypeCode?: string;
  businessType?: string;
}

export interface BankcodeJPBranch {
  code: string;
  name: string;
  halfWidthKana?: string;
  fullWidthKana?: string;
  hiragana: string;
}

interface BankcodeJPBanksResponse {
  banks: BankcodeJPBank[];
  size: number;
  limit: number;
  hasNext: boolean;
  nextCursor?: string;
  hasPrev: boolean;
  prevCursor?: string;
  version: string;
}

interface BankcodeJPBranchesResponse {
  branches: BankcodeJPBranch[];
  size: number;
  limit: number;
  hasNext: boolean;
  nextCursor?: string;
  hasPrev: boolean;
  prevCursor?: string;
  version: string;
}

/**
 * BankcodeJP APIを使って銀行をあいまい検索
 */
export async function searchBanksFromAPI(
  query: string,
  limit: number = 10
): Promise<BankcodeJPBank[]> {
  const apiKey = process.env.BANKCODEJP_API_KEY;

  if (!apiKey) {
    console.warn('BANKCODEJP_API_KEY is not configured');
    return [];
  }

  try {
    const url = new URL(`${BANKCODE_JP_BASE_URL}/freeword/banks`);
    url.searchParams.set('freeword', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'code,name,hiragana');

    const response = await fetch(url.toString(), {
      headers: {
        apikey: apiKey,
      },
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('BankcodeJP API rate limit exceeded');
      }
      throw new Error(`BankcodeJP API error: ${response.status}`);
    }

    const data: BankcodeJPBanksResponse = await response.json();
    return data.banks;
  } catch (error) {
    console.error('BankcodeJP API search failed:', error);
    return [];
  }
}

/**
 * BankcodeJP APIを使って支店をあいまい検索
 */
export async function searchBranchesFromAPI(
  bankCode: string,
  query: string,
  limit: number = 10
): Promise<BankcodeJPBranch[]> {
  const apiKey = process.env.BANKCODEJP_API_KEY;

  if (!apiKey) {
    console.warn('BANKCODEJP_API_KEY is not configured');
    return [];
  }

  try {
    const url = new URL(`${BANKCODE_JP_BASE_URL}/freeword/banks/${bankCode}/branches`);
    url.searchParams.set('freeword', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'code,name,hiragana');

    const response = await fetch(url.toString(), {
      headers: {
        apikey: apiKey,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('BankcodeJP API rate limit exceeded');
      }
      throw new Error(`BankcodeJP API error: ${response.status}`);
    }

    const data: BankcodeJPBranchesResponse = await response.json();
    return data.branches;
  } catch (error) {
    console.error('BankcodeJP API branch search failed:', error);
    return [];
  }
}

/**
 * BankcodeJP APIを使って特定の銀行を取得
 */
export async function getBankFromAPI(bankCode: string): Promise<BankcodeJPBank | null> {
  const apiKey = process.env.BANKCODEJP_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const url = new URL(`${BANKCODE_JP_BASE_URL}/banks/${bankCode}`);
    url.searchParams.set('fields', 'code,name,hiragana');

    const response = await fetch(url.toString(), {
      headers: {
        apikey: apiKey,
      },
      next: { revalidate: 86400 }, // 24時間キャッシュ
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('BankcodeJP API get bank failed:', error);
    return null;
  }
}

/**
 * BankcodeJP APIを使って銀行の全支店を取得
 */
export async function getAllBranchesFromAPI(
  bankCode: string,
  limit: number = 2000
): Promise<BankcodeJPBranch[]> {
  const apiKey = process.env.BANKCODEJP_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const url = new URL(`${BANKCODE_JP_BASE_URL}/banks/${bankCode}/branches`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'code,name,hiragana');

    const response = await fetch(url.toString(), {
      headers: {
        apikey: apiKey,
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return [];
    }

    const data: BankcodeJPBranchesResponse = await response.json();
    return data.branches;
  } catch (error) {
    console.error('BankcodeJP API get branches failed:', error);
    return [];
  }
}
