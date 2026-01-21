/**
 * 既存施設の緯度経度データを補完するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/backfill-facility-coordinates.ts [--production]
 *
 * --production: 本番DBを使用
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// --production 引数がある場合は .env.production を読み込む
const isProduction = process.argv.includes('--production');
if (isProduction) {
    config({ path: '.env.production' });
    console.log('🔴 本番DBモードで実行');
} else {
    config({ path: '.env.local' });
    console.log('🟢 ステージングDBモードで実行');
}

const prisma = new PrismaClient();

/**
 * 国土地理院APIで住所から座標を取得
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodedAddress}`
        );
        const data = await response.json();

        if (data && data.length > 0 && data[0].geometry?.coordinates) {
            const [lng, lat] = data[0].geometry.coordinates;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

async function main() {
    console.log('=== 施設緯度経度補完スクリプト ===\n');

    // 緯度経度が未設定（0）かつ住所がある施設を取得
    // Facilityモデルのlat/lngは @default(0) なのでnullにはならない
    const facilities = await prisma.facility.findMany({
        where: {
            deleted_at: null,
            lat: 0,
            lng: 0,
            prefecture: {
                notIn: ['', '（未設定）']
            }
        },
        select: {
            id: true,
            facility_name: true,
            prefecture: true,
            city: true,
            address_line: true,
            lat: true,
            lng: true,
        }
    });

    console.log(`対象施設数: ${facilities.length}件\n`);

    if (facilities.length === 0) {
        console.log('補完が必要な施設はありません。');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const facility of facilities) {
        const address = `${facility.prefecture || ''}${facility.city || ''}${facility.address_line || ''}`.trim();

        if (!address || address === '') {
            console.log(`[SKIP] ID:${facility.id} ${facility.facility_name} - 住所が空`);
            failCount++;
            continue;
        }

        console.log(`[処理中] ID:${facility.id} ${facility.facility_name}`);
        console.log(`  住所: ${address}`);

        const location = await geocodeAddress(address);

        if (location) {
            await prisma.facility.update({
                where: { id: facility.id },
                data: {
                    lat: location.lat,
                    lng: location.lng,
                }
            });
            console.log(`  → 成功: lat=${location.lat}, lng=${location.lng}`);
            successCount++;
        } else {
            console.log(`  → 失敗: 座標を取得できませんでした`);
            failCount++;
        }

        // API負荷軽減のため少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== 結果 ===');
    console.log(`成功: ${successCount}件`);
    console.log(`失敗: ${failCount}件`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
