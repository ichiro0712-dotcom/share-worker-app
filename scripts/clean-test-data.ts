import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestData() {
    console.log('テストデータを削除中...');

    // 1. Reviewを削除
    const deletedReviews = await prisma.review.deleteMany({});
    console.log(`削除したレビュー: ${deletedReviews.count}件`);

    // 2. Messageを削除
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`削除したメッセージ: ${deletedMessages.count}件`);

    // 3. Applicationを削除
    const deletedApplications = await prisma.application.deleteMany({});
    console.log(`削除した応募: ${deletedApplications.count}件`);

    // 4. JobWorkDateのapplied_countをリセット
    const updatedWorkDates = await prisma.jobWorkDate.updateMany({
        data: {
            applied_count: 0
        }
    });
    console.log(`勤務日の応募数をリセットしました: ${updatedWorkDates.count}件`);

    console.log('テストデータの削除完了');
}

cleanTestData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
