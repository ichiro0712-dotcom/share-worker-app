import { BetaAnalyticsDataClient } from '@google-analytics/data';
import path from 'path';

// ======================== クライアント初期化 ========================

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
    if (!client) {
        // Vercel本番: 環境変数にJSON全文を格納
        const credentialsJson = process.env.GA_CREDENTIALS_JSON;
        if (credentialsJson) {
            const credentials = JSON.parse(credentialsJson);
            client = new BetaAnalyticsDataClient({
                credentials,
                fallback: 'rest', // gRPCではなくREST（サーバーレス対応）
            });
        } else {
            // ローカル: ファイルパスから読み込み
            const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (!credentialsPath) {
                throw new Error('GOOGLE_APPLICATION_CREDENTIALS または GA_CREDENTIALS_JSON が未設定です');
            }
            client = new BetaAnalyticsDataClient({
                keyFilename: path.resolve(process.cwd(), credentialsPath),
                fallback: 'rest',
            });
        }
    }
    return client;
}

function getPropertyId(): string {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
        throw new Error('GA4_PROPERTY_ID が未設定です');
    }
    return propertyId;
}

// ======================== 日付ヘルパー ========================

/** GA4の YYYYMMDD → YYYY-MM-DD に変換 */
function formatGA4Date(rawDate: string): string {
    if (rawDate.length === 8) {
        return `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }
    return rawDate;
}

/** 今日のJST日付文字列 */
function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split('T')[0];
}

// ======================== レスポンス型 ========================

export interface GA4OverviewData {
    daily: Array<{
        date: string;
        pageViews: number;
        totalUsers: number;
        sessions: number;
        bounceRate: number;
        avgSessionDuration: number;
    }>;
    totals: {
        pageViews: number;
        totalUsers: number;
        sessions: number;
        bounceRate: number;
        avgSessionDuration: number;
    };
}

export interface GA4TrafficData {
    sources: Array<{
        source: string;
        medium: string;
        sessions: number;
        totalUsers: number;
        pageViews: number;
        bounceRate: number;
    }>;
}

export interface GA4PagesData {
    pages: Array<{
        pagePath: string;
        pageTitle: string;
        pageViews: number;
        totalUsers: number;
        avgSessionDuration: number;
    }>;
}

export interface GA4LpPerformanceData {
    lpPages: Array<{
        pagePath: string;
        pageViews: number;
        totalUsers: number;
        sessions: number;
        bounceRate: number;
        avgSessionDuration: number;
    }>;
}

// ======================== レポート取得関数 ========================

/** サイト全体の概要（日別PV/UU/セッション/直帰率/滞在時間） */
export async function fetchOverviewReport(
    startDate: string,
    endDate: string
): Promise<GA4OverviewData> {
    const analyticsClient = getClient();
    const propertyId = getPropertyId();

    const [response] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
    });

    const daily = (response.rows || []).map(row => ({
        date: formatGA4Date(row.dimensionValues?.[0]?.value || ''),
        pageViews: parseInt(row.metricValues?.[0]?.value || '0'),
        totalUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        sessions: parseInt(row.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
    }));

    // 合計計算
    const totalSessions = daily.reduce((sum, d) => sum + d.sessions, 0) || 1;
    const totals = {
        pageViews: daily.reduce((sum, d) => sum + d.pageViews, 0),
        totalUsers: daily.reduce((sum, d) => sum + d.totalUsers, 0),
        sessions: daily.reduce((sum, d) => sum + d.sessions, 0),
        // 直帰率・滞在時間はセッション加重平均
        bounceRate: daily.reduce((sum, d) => sum + d.bounceRate * d.sessions, 0) / totalSessions,
        avgSessionDuration: daily.reduce((sum, d) => sum + d.avgSessionDuration * d.sessions, 0) / totalSessions,
    };

    return { daily, totals };
}

/** 流入元×メディア別セッション数（上位50） */
export async function fetchTrafficReport(
    startDate: string,
    endDate: string
): Promise<GA4TrafficData> {
    const analyticsClient = getClient();
    const propertyId = getPropertyId();

    const [response] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
            { name: 'sessionSource' },
            { name: 'sessionMedium' },
        ],
        metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
    });

    const sources = (response.rows || []).map(row => ({
        source: row.dimensionValues?.[0]?.value || '(not set)',
        medium: row.dimensionValues?.[1]?.value || '(not set)',
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        totalUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
    }));

    return { sources };
}

/** ページ別PV/UU/滞在時間（上位100） */
export async function fetchPagesReport(
    startDate: string,
    endDate: string
): Promise<GA4PagesData> {
    const analyticsClient = getClient();
    const propertyId = getPropertyId();

    const [response] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
            { name: 'pagePath' },
            { name: 'pageTitle' },
        ],
        metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 100,
    });

    const pages = (response.rows || []).map(row => ({
        pagePath: row.dimensionValues?.[0]?.value || '',
        pageTitle: row.dimensionValues?.[1]?.value || '',
        pageViews: parseInt(row.metricValues?.[0]?.value || '0'),
        totalUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[2]?.value || '0'),
    }));

    return { pages };
}

/** LP配下（/lp/）のページメトリクス */
export async function fetchLpPerformanceReport(
    startDate: string,
    endDate: string
): Promise<GA4LpPerformanceData> {
    const analyticsClient = getClient();
    const propertyId = getPropertyId();

    const [response] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
        ],
        dimensionFilter: {
            filter: {
                fieldName: 'pagePath',
                stringFilter: {
                    matchType: 'BEGINS_WITH',
                    value: '/lp/',
                },
            },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
    });

    const lpPages = (response.rows || []).map(row => ({
        pagePath: row.dimensionValues?.[0]?.value || '',
        pageViews: parseInt(row.metricValues?.[0]?.value || '0'),
        totalUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        sessions: parseInt(row.metricValues?.[2]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
    }));

    return { lpPages };
}

// ======================== GA4差分比較レポート ========================

export interface GA4ComparisonData {
    registrationPage: { pageViews: number; totalUsers: number };
    jobSearchPage: { pageViews: number; totalUsers: number };
    jobDetailPage: { pageViews: number; totalUsers: number };
}

/** DB側と比較するための3ページグループ別PV/UU */
export async function fetchComparisonReport(
    startDate: string,
    endDate: string
): Promise<GA4ComparisonData> {
    const analyticsClient = getClient();
    const propertyId = getPropertyId();

    // 3つのページグループを並行取得
    const [regResponse, searchResponse, detailResponse] = await Promise.all([
        // 登録ページ: /register/worker
        analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'totalUsers' },
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'BEGINS_WITH',
                        value: '/register/worker',
                    },
                },
            },
        }),
        // 求人検索ページ: / (トップページ)
        analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'totalUsers' },
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'EXACT',
                        value: '/',
                    },
                },
            },
        }),
        // 求人詳細ページ: /worker/jobs/ 配下
        analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'totalUsers' },
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                        matchType: 'BEGINS_WITH',
                        value: '/worker/jobs/',
                    },
                },
            },
        }),
    ]);

    const extractTotals = (response: typeof regResponse) => {
        const row = response[0]?.rows?.[0];
        return {
            pageViews: parseInt(row?.metricValues?.[0]?.value || '0'),
            totalUsers: parseInt(row?.metricValues?.[1]?.value || '0'),
        };
    };

    return {
        registrationPage: extractTotals(regResponse),
        jobSearchPage: extractTotals(searchResponse),
        jobDetailPage: extractTotals(detailResponse),
    };
}

// ======================== 接続テスト ========================

export async function testConnection(): Promise<{
    success: boolean;
    propertyId: string;
    rowCount: number;
    error?: string;
}> {
    try {
        const analyticsClient = getClient();
        const propertyId = getPropertyId();
        const today = getTodayJST();

        const [response] = await analyticsClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: '7daysAgo', endDate: today }],
            metrics: [{ name: 'sessions' }],
        });

        return {
            success: true,
            propertyId,
            rowCount: response.rows?.length || 0,
        };
    } catch (error) {
        return {
            success: false,
            propertyId: process.env.GA4_PROPERTY_ID || 'NOT SET',
            rowCount: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
