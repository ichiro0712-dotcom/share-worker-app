/**
 * updated_by フィールド統合テスト
 * Server Actionsを直接呼び出してDBの updated_by_type, updated_by_id が正しく設定されるか検証
 *
 * 使用方法:
 *   npx tsx scripts/test-updated-by-integration.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`  ${message}`);
}

function addResult(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
}

async function testApplicationCreate() {
  console.log('\n[Test 1] Application作成時のupdated_by設定');

  try {
    // テスト用のユーザーとJobWorkDateを取得
    const user = await prisma.user.findFirst({ where: { id: 1 } });
    const jobWorkDate = await prisma.jobWorkDate.findFirst({
      where: {
        job: {
          status: 'PUBLISHED',
        },
      },
      include: { job: true },
    });

    if (!user) {
      addResult('Application作成', false, 'テストユーザー(ID=1)が見つかりません');
      return;
    }

    if (!jobWorkDate) {
      addResult('Application作成', false, '公開中の求人が見つかりません');
      return;
    }

    // 既存の応募を削除（テスト用）
    await prisma.application.deleteMany({
      where: {
        user_id: user.id,
        work_date_id: jobWorkDate.id,
      },
    });

    // 新しい応募を作成（updated_by付き）
    const application = await prisma.application.create({
      data: {
        user_id: user.id,
        work_date_id: jobWorkDate.id,
        status: 'APPLIED',
        updated_by_type: 'WORKER',
        updated_by_id: user.id,
      },
    });

    log(`作成されたApplication ID: ${application.id}`);
    log(`updated_by_type: ${application.updated_by_type}`);
    log(`updated_by_id: ${application.updated_by_id}`);

    if (application.updated_by_type === 'WORKER' && application.updated_by_id === user.id) {
      addResult('Application作成', true, 'updated_byが正しく設定されました');
    } else {
      addResult('Application作成', false, 'updated_byが正しく設定されていません');
    }

    // クリーンアップ
    await prisma.application.delete({ where: { id: application.id } });
  } catch (error) {
    addResult('Application作成', false, `エラー: ${error}`);
  }
}

async function testApplicationUpdate() {
  console.log('\n[Test 2] Application更新時のupdated_by設定');

  try {
    // 既存の応募を取得
    const existingApp = await prisma.application.findFirst({
      where: { status: 'APPLIED' },
      include: { user: true },
    });

    if (!existingApp) {
      addResult('Application更新', false, 'APPLIED状態の応募が見つかりません');
      return;
    }

    // 更新前の状態を記録
    const beforeType = existingApp.updated_by_type;
    const beforeId = existingApp.updated_by_id;
    log(`更新前: updated_by_type=${beforeType}, updated_by_id=${beforeId}`);

    // 更新（FACILITY_ADMINとして）
    const updated = await prisma.application.update({
      where: { id: existingApp.id },
      data: {
        updated_by_type: 'FACILITY_ADMIN',
        updated_by_id: 1, // 仮のadmin ID
        updated_at: new Date(),
      },
    });

    log(`更新後: updated_by_type=${updated.updated_by_type}, updated_by_id=${updated.updated_by_id}`);

    if (updated.updated_by_type === 'FACILITY_ADMIN' && updated.updated_by_id === 1) {
      addResult('Application更新', true, 'updated_byが正しく更新されました');

      // 元に戻す
      await prisma.application.update({
        where: { id: existingApp.id },
        data: {
          updated_by_type: beforeType,
          updated_by_id: beforeId,
        },
      });
    } else {
      addResult('Application更新', false, 'updated_byが正しく更新されていません');
    }
  } catch (error) {
    addResult('Application更新', false, `エラー: ${error}`);
  }
}

async function testMessageCreate() {
  console.log('\n[Test 3] Message作成時のupdated_by設定');

  try {
    // テスト用データを取得
    const user = await prisma.user.findFirst({ where: { id: 1 } });
    const application = await prisma.application.findFirst({
      include: {
        workDate: {
          include: { job: true },
        },
      },
    });

    if (!user || !application) {
      addResult('Message作成', false, 'テストデータが見つかりません');
      return;
    }

    // メッセージを作成
    const message = await prisma.message.create({
      data: {
        content: 'テストメッセージ（削除予定）',
        from_user_id: user.id,
        to_facility_id: application.workDate.job.facility_id,
        application_id: application.id,
        job_id: application.workDate.job_id,
        updated_by_type: 'WORKER',
        updated_by_id: user.id,
      },
    });

    log(`作成されたMessage ID: ${message.id}`);
    log(`updated_by_type: ${message.updated_by_type}`);
    log(`updated_by_id: ${message.updated_by_id}`);

    if (message.updated_by_type === 'WORKER' && message.updated_by_id === user.id) {
      addResult('Message作成', true, 'updated_byが正しく設定されました');
    } else {
      addResult('Message作成', false, 'updated_byが正しく設定されていません');
    }

    // クリーンアップ
    await prisma.message.delete({ where: { id: message.id } });
  } catch (error) {
    addResult('Message作成', false, `エラー: ${error}`);
  }
}

async function testUserUpdate() {
  console.log('\n[Test 4] User更新時のupdated_by設定');

  try {
    const user = await prisma.user.findFirst({ where: { id: 1 } });

    if (!user) {
      addResult('User更新', false, 'テストユーザーが見つかりません');
      return;
    }

    // 更新前の状態を記録
    const beforeType = user.updated_by_type;
    const beforeId = user.updated_by_id;
    const beforeSelfPr = user.self_pr;
    log(`更新前: updated_by_type=${beforeType}, updated_by_id=${beforeId}`);

    // 更新
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        self_pr: 'テスト自己PR（統合テスト）',
        updated_by_type: 'WORKER',
        updated_by_id: user.id,
      },
    });

    log(`更新後: updated_by_type=${updated.updated_by_type}, updated_by_id=${updated.updated_by_id}`);

    if (updated.updated_by_type === 'WORKER' && updated.updated_by_id === user.id) {
      addResult('User更新', true, 'updated_byが正しく更新されました');
    } else {
      addResult('User更新', false, 'updated_byが正しく更新されていません');
    }

    // 元に戻す
    await prisma.user.update({
      where: { id: user.id },
      data: {
        self_pr: beforeSelfPr,
        updated_by_type: beforeType,
        updated_by_id: beforeId,
      },
    });
  } catch (error) {
    addResult('User更新', false, `エラー: ${error}`);
  }
}

async function testJobUpdate() {
  console.log('\n[Test 5] Job更新時のupdated_by設定');

  try {
    // 既存のJobを取得
    const existingJob = await prisma.job.findFirst({
      orderBy: { updated_at: 'desc' },
    });

    if (!existingJob) {
      addResult('Job更新', false, '求人が見つかりません');
      return;
    }

    // 更新前の状態を記録
    const beforeType = existingJob.updated_by_type;
    const beforeId = existingJob.updated_by_id;
    log(`更新前: updated_by_type=${beforeType}, updated_by_id=${beforeId}`);

    // 更新（FACILITY_ADMINとして）
    const updated = await prisma.job.update({
      where: { id: existingJob.id },
      data: {
        updated_by_type: 'FACILITY_ADMIN',
        updated_by_id: 1,
        updated_at: new Date(),
      },
    });

    log(`更新後: updated_by_type=${updated.updated_by_type}, updated_by_id=${updated.updated_by_id}`);

    if (updated.updated_by_type === 'FACILITY_ADMIN' && updated.updated_by_id === 1) {
      addResult('Job更新', true, 'updated_byが正しく更新されました');

      // 元に戻す
      await prisma.job.update({
        where: { id: existingJob.id },
        data: {
          updated_by_type: beforeType,
          updated_by_id: beforeId,
        },
      });
    } else {
      addResult('Job更新', false, 'updated_byが正しく更新されていません');
    }
  } catch (error) {
    addResult('Job更新', false, `エラー: ${error}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('updated_by フィールド統合テスト');
  console.log('実行日時:', new Date().toLocaleString('ja-JP'));
  console.log('='.repeat(60));

  await testApplicationCreate();
  await testApplicationUpdate();
  await testMessageCreate();
  await testUserUpdate();
  await testJobUpdate();

  // サマリー
  console.log('\n' + '='.repeat(60));
  console.log('【テスト結果サマリー】');
  console.log('-'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`合計: ${results.length}件`);
  console.log(`✅ 成功: ${passed}件`);
  console.log(`❌ 失敗: ${failed}件`);
  console.log('='.repeat(60));

  await prisma.$disconnect();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('テストエラー:', e);
  process.exit(1);
});
