/**
 * GA4 API 接続テストスクリプト
 * 実行: npx tsx scripts/test-ga4-connection.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import path from 'path';

async function main() {
    console.log('=== GA4 API 接続テスト ===\n');

    const propertyId = process.env.GA4_PROPERTY_ID;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    console.log(`GA4_PROPERTY_ID: ${propertyId || 'NOT SET'}`);
    console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${credentialsPath || 'NOT SET'}`);

    if (!propertyId || !credentialsPath) {
        console.error('\nERROR: 必要な環境変数が設定されていません。');
        console.error('.env.local に GA4_PROPERTY_ID と GOOGLE_APPLICATION_CREDENTIALS を追加してください。');
        process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), credentialsPath);
    console.log(`認証ファイルパス: ${fullPath}\n`);

    try {
        const client = new BetaAnalyticsDataClient({
            keyFilename: fullPath,
            fallback: 'rest',
        });

        console.log('過去7日間のレポートを取得中...\n');

        const [response] = await client.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'date' }],
            metrics: [
                { name: 'screenPageViews' },
                { name: 'totalUsers' },
                { name: 'sessions' },
            ],
            orderBys: [{ dimension: { dimensionName: 'date' } }],
        });

        console.log('SUCCESS! GA4 APIに接続できました。\n');
        console.log('過去7日間のデータ:');
        console.log('日付         | PV     | ユーザー | セッション');
        console.log('-'.repeat(55));

        (response.rows || []).forEach(row => {
            const rawDate = row.dimensionValues?.[0]?.value || '';
            const pv = row.metricValues?.[0]?.value || '0';
            const users = row.metricValues?.[1]?.value || '0';
            const sessions = row.metricValues?.[2]?.value || '0';
            const formattedDate = rawDate.length === 8
                ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
                : rawDate;
            console.log(
                `${formattedDate}   | ${pv.padStart(6)} | ${users.padStart(8)} | ${sessions.padStart(8)}`
            );
        });

        console.log(`\n取得行数: ${response.rows?.length || 0}`);
        console.log('\n接続テスト PASSED.');
    } catch (error) {
        console.error('\nERROR: GA4 APIへの接続に失敗しました。');
        console.error(error instanceof Error ? error.message : error);
        console.error('\n確認事項:');
        console.error('1. credentials/ga-service-account.json が正しく配置されているか');
        console.error('2. Google Cloud ConsoleでAnalytics Data APIが有効化されているか');
        console.error('3. サービスアカウントにGA4プロパティへのアクセス権があるか');
        process.exit(1);
    }
}

main();
