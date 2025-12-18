
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const errorMessageSettings = [
    {
        key: 'APPLY_ERROR',
        title: '応募エラー',
        banner_message: '応募に失敗しました。再度お試しください。',
        detail_message: 'システムエラーにより応募処理が完了しませんでした。ネットワーク環境をご確認の上、再度お試しください。',
    },
    {
        key: 'MATCH_ERROR',
        title: 'マッチングエラー',
        banner_message: 'マッチングに失敗しました。再度お試しください。',
        detail_message: 'マッチング処理中にエラーが発生しました。相手方の状況が変わった可能性があります。',
    },
    {
        key: 'SAVE_ERROR',
        title: '保存エラー',
        banner_message: '保存に失敗しました。再度お試しください。',
        detail_message: 'データの保存中にエラーが発生しました。入力内容をご確認ください。',
    },
    {
        key: 'SYSTEM_ERROR',
        title: 'システムエラー',
        banner_message: '予期せぬエラーが発生しました。ネットワーク接続をご確認ください。',
        detail_message: 'システム内部で予期せぬエラーが発生しました。しばらく経ってから再度お試しください。',
    },
    {
        key: 'DUPLICATE_ERROR',
        title: '重複エラー',
        banner_message: 'すでに登録されているデータです。',
        detail_message: '指定されたデータは既にシステムに登録されています。別の値を指定してください。',
    },
];

async function main() {
    console.log('⚠️ エラーメッセージ設定を更新中...');

    for (const setting of errorMessageSettings) {
        // 既存のレコードがあるか確認
        const existing = await prisma.errorMessageSetting.findUnique({
            where: { key: setting.key },
        });

        if (existing) {
            // 既存レコードの更新
            await prisma.errorMessageSetting.update({
                where: { key: setting.key },
                data: {
                    title: setting.title,
                    banner_message: setting.banner_message,
                    detail_message: setting.detail_message,
                    // 既存の設定がない場合はデフォルト値を設定
                    banner_enabled: true,
                    chat_enabled: false,
                    email_enabled: false,
                    push_enabled: false,
                },
            });
        } else {
            // 新規作成
            await prisma.errorMessageSetting.create({
                data: {
                    key: setting.key,
                    title: setting.title,
                    banner_message: setting.banner_message,
                    detail_message: setting.detail_message,
                    banner_enabled: true,
                    chat_enabled: false,
                    email_enabled: false,
                    push_enabled: false,
                },
            });
        }
    }
    console.log(`✅ ${errorMessageSettings.length}件のエラーメッセージ設定を更新しました`);
}

main()
    .catch((e) => {
        console.error('❌ 更新に失敗しました:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
