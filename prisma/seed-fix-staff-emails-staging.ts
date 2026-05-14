/**
 * ステージング用: staff_emails が空の施設を補完するスクリプト
 *
 * 背景:
 *   施設向け通知メール（cron + 応募/メッセージ通知）の送信先を
 *   FacilityAdmin.email から Facility.staff_emails に統一する修正に伴い、
 *   staff_emails が空の施設では通知メールが届かなくなる。
 *
 *   本番DB調査結果: both_empty=0（全施設で staff_emails 設定済み）
 *   ステージングDB: シード/E2E起源の施設で staff_emails が空のものが複数件
 *
 *   ステージングでの動作確認のため、空の施設に「FacilityAdmin.email」を
 *   staff_emails としてコピーする。
 *
 * 使い方:
 *   # ドライラン（実行内容を表示するだけ）
 *   npx tsx prisma/seed-fix-staff-emails-staging.ts --dry-run
 *
 *   # 実行
 *   npx tsx prisma/seed-fix-staff-emails-staging.ts --execute
 *
 * 注意:
 *   - .env.local に設定された DATABASE_URL に対して動作する
 *   - 本番(production)で実行する想定はない（影響対象0件のため）
 *   - 実行時は「STAGING DB に接続している」ことを必ず確認すること
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        execute: args.includes('--execute'),
    };
}

async function main() {
    const { dryRun, execute } = parseArgs();

    if (!dryRun && !execute) {
        console.error('❌ --dry-run または --execute のいずれかを指定してください');
        console.error('   例: npx tsx prisma/seed-fix-staff-emails-staging.ts --dry-run');
        process.exit(1);
    }

    console.log('========================================');
    console.log('  staff_emails 補完スクリプト');
    console.log(`  モード: ${dryRun ? 'ドライラン（実行しない）' : '実行'}`);
    console.log('========================================\n');

    // 接続先の安全確認
    const dbUrl = process.env.DATABASE_URL ?? '';
    const masked = dbUrl.replace(/:[^:@/]+@/, ':***@');
    console.log(`接続先 DATABASE_URL: ${masked}\n`);

    if (dbUrl.includes('ryvyuxomiqcgkspmpltk')) {
        console.error('❌ 本番DB(ryvyuxomiqcgkspmpltk)に接続しようとしています。中断します。');
        console.error('   このスクリプトは本番では実行しないでください（影響対象0件）。');
        process.exit(1);
    }

    // staff_emails が空の施設を取得（staff_email も空のもの）
    const targets = await prisma.facility.findMany({
        where: {
            deleted_at: null,
            AND: [
                {
                    OR: [
                        { staff_emails: { equals: [] } },
                        { staff_emails: { isEmpty: true } },
                    ],
                },
                {
                    OR: [
                        { staff_email: null },
                        { staff_email: '' },
                    ],
                },
            ],
        },
        select: {
            id: true,
            facility_name: true,
            staff_email: true,
            staff_emails: true,
            admins: {
                select: { id: true, email: true, name: true },
                orderBy: { id: 'asc' },
            },
        },
        orderBy: { id: 'asc' },
    });

    console.log(`■ 補完対象の施設: ${targets.length} 件\n`);

    if (targets.length === 0) {
        console.log('✅ 補完対象なし。終了します。');
        return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const f of targets) {
        const adminEmails = f.admins
            .map(a => a.email)
            .filter(e => typeof e === 'string' && e.trim() !== '');

        if (adminEmails.length === 0) {
            console.log(`  [SKIP] [${f.id}] ${f.facility_name}: 管理者メールも無いためスキップ`);
            skippedCount++;
            continue;
        }

        const newStaffEmail = adminEmails[0];
        const newStaffEmails = adminEmails;

        console.log(
            `  [${dryRun ? 'DRY' : 'RUN'}] [${f.id}] ${f.facility_name}\n` +
            `         staff_email:  null → "${newStaffEmail}"\n` +
            `         staff_emails: [] → ${JSON.stringify(newStaffEmails)}`
        );

        if (!dryRun) {
            await prisma.facility.update({
                where: { id: f.id },
                data: {
                    staff_email: newStaffEmail,
                    staff_emails: newStaffEmails,
                },
            });
            updatedCount++;
        }
    }

    console.log('\n========================================');
    console.log('  結果');
    console.log('========================================');
    console.log(`  対象      : ${targets.length} 件`);
    console.log(`  ${dryRun ? '更新予定' : '更新完了'}: ${dryRun ? targets.length - skippedCount : updatedCount} 件`);
    console.log(`  スキップ  : ${skippedCount} 件 (管理者メール無し)`);

    if (dryRun) {
        console.log('\n💡 実行する場合:');
        console.log('   npx tsx prisma/seed-fix-staff-emails-staging.ts --execute');
    }
}

main()
    .catch((e) => {
        console.error('エラー:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
