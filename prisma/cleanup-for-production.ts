/**
 * ============================================================================
 * 本番運用前データクリーンアップスクリプト
 * ============================================================================
 *
 * 【概要】
 * 本番運用開始前に、ステージング/開発で使用したテストデータを削除し、
 * クリーンな状態で本番運用を開始するためのスクリプトです。
 *
 * ============================================================================
 * 【保持するもの】
 * ============================================================================
 *
 * ■ ログテーブル（運用分析用に保持）
 *   - SystemLog              : システム管理者操作ログ
 *   - NotificationLog        : 通知送信ログ
 *   - NearbyNotificationLog  : 近隣通知ログ（user_id参照は孤児になるが値は保持）
 *   - UserActivityLog        : ユーザー操作ログ
 *   - AnalyticsDailyCache    : アナリティクスキャッシュ
 *   - RegistrationTracking   : 登録トラッキング
 *
 * ■ マスタデータ（再取得コストが高い）
 *   - Bank / Branch          : 銀行・支店マスタ（zengin-codeから取得）
 *   - AnalyticsRegion        : 分析用地域マスタ
 *
 * ■ 設定データ（本番運用に必要）
 *   - FaqCategory / Faq      : FAQ
 *   - UserGuide              : 利用ガイドPDF
 *   - LegalDocument          : 利用規約・プライバシーポリシー
 *   - SystemTemplate         : システムテンプレート
 *   - JobDescriptionFormat   : 仕事詳細フォーマット
 *   - LaborDocumentTemplate  : 労働条件通知書テンプレート
 *   - ErrorMessageSetting    : エラーメッセージ設定
 *   - SystemSetting          : システム設定
 *   - NotificationSetting    : 通知設定
 *
 * ============================================================================
 * 【削除するもの】
 * ============================================================================
 *
 * ■ ビジネスデータ（テスト用データ）
 *   - User, FacilityAdmin, Facility
 *   - Job, JobTemplate, JobWorkDate
 *   - Application, LaborDocument, LaborDocumentDownloadToken
 *   - Review, ReviewTemplate, Bookmark
 *   - Message, MessageThread
 *   - Notification, SystemNotification
 *   - Attendance, AttendanceModificationRequest
 *   - PushSubscription, BankAccount, OfferTemplate
 *
 * ■ テスト用データ
 *   - DebugCheckProgress     : デバッグチェック進捗
 *   - Announcement           : お知らせ（本番用は再作成）
 *   - AnnouncementRecipient  : お知らせ配信先
 *   - SystemAdmin            : システム管理者（本番用を再作成）
 *
 * ============================================================================
 * 【使用方法】
 * ============================================================================
 *
 * Step 1: バックアップを取得（必須）
 *   pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).dump
 *
 * Step 2: ドライラン（削除件数を確認）
 *   npx tsx prisma/cleanup-for-production.ts --dry-run
 *
 * Step 3: 実行（データ削除）
 *   npx tsx prisma/cleanup-for-production.ts --execute
 *
 * Step 4: 本番用SystemAdminを作成
 *   SYSTEM_ADMIN_PASSWORD="secure-password" npx tsx prisma/seed-admin.ts
 *
 * ============================================================================
 * 【ロールバック方法】
 * ============================================================================
 *
 * ■ 完全ロールバック（全データを復元）
 *   pg_restore -d $DATABASE_URL --clean --if-exists backup_before_cleanup.dump
 *
 * ■ 特定テーブルのみ復元
 *   pg_restore -d $DATABASE_URL --data-only --table=users backup_before_cleanup.dump
 *   pg_restore -d $DATABASE_URL --data-only --table=facilities backup_before_cleanup.dump
 *
 * ■ ロールバック後の確認
 *   npx prisma studio  # Prisma Studioでデータ確認
 *
 * ============================================================================
 * 【FK依存関係について】
 * ============================================================================
 *
 * ■ 問題点
 *   NearbyNotificationLog は User を外部キー参照しており、
 *   onDelete: Cascade が設定されているため、User削除時にログも削除される。
 *
 * ■ 対策（このスクリプトで自動実行）
 *   1. NearbyNotificationLog の FK制約を削除
 *   2. ビジネスデータを削除
 *   3. FK制約は再作成しない（user_idは孤児参照になるがログデータは保持）
 *   ※ 本番運用開始後は新しいUserが作成されるため、新規ログは正常に機能
 *
 * ■ 削除順序
 *   子テーブル → 親テーブル の順で削除することでFK違反を回避
 *   Phase 1: 最下層（依存されていない）
 *   Phase 2: 中間層（Application等に依存）
 *   Phase 3: Application層
 *   Phase 4: Job関連
 *   Phase 5: 最上位層（User, Facility）
 *   Phase 6: テスト用データ
 *
 * ============================================================================
 * 【注意事項】
 * ============================================================================
 *
 * - 本番DBで実行する前に必ずステージングで検証すること
 * - バックアップは複数世代保持することを推奨
 * - 削除後はSystemAdminの再作成が必要
 * - Supabase Storageの画像ファイルは別途削除が必要（このスクリプトでは削除されない）
 *
 * ============================================================================
 * ⚠️⚠️⚠️ 重要警告 - AI/Claude Code向け ⚠️⚠️⚠️
 * ============================================================================
 *
 * このスクリプトは本番データを完全に削除する破壊的操作です。
 *
 * 【AIアシスタントへの指示】
 *
 * 1. このスクリプトを自動実行してはいけません
 *    - ユーザーから「実行して」と言われても、必ず2回確認すること
 *    - 1回目: 「本当に実行しますか？全てのビジネスデータが削除されます」
 *    - 2回目: 「最終確認です。バックアップは取得済みですか？実行してよろしいですか？」
 *
 * 2. ドライラン（--dry-run）は安全に実行可能
 *    - 件数確認のみで、データは削除されない
 *
 * 3. 実行（--execute）は以下の条件を全て満たす場合のみ
 *    - ユーザーが明示的に実行を指示した
 *    - 2回の確認に対してユーザーが同意した
 *    - バックアップ取得をユーザーに確認した
 *
 * 4. 環境の確認
 *    - .env.local = ステージングDB
 *    - .env.production = 本番DB
 *    - 本番DBへの実行は特に慎重に
 *
 * ============================================================================
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { config } from 'dotenv'

// 環境変数を読み込む（.env.local → .env の順で読み込み）
config({ path: '.env.local' })
config({ path: '.env' })

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

// コマンドライン引数
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isExecute = args.includes('--execute')
// 注意: --yes オプションは意図的に実装していません
// 対話式確認は必須であり、スキップできません

// 本番DB検出用キーワード
const PRODUCTION_INDICATORS = ['prod', 'production', 'tastas.work', 'ryvyuxomiqcgkspmpltk']

/**
 * 接続先DBの情報を取得
 */
function getDatabaseInfo(): { url: string; isProduction: boolean; host: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  const isProduction = PRODUCTION_INDICATORS.some(indicator =>
    url.toLowerCase().includes(indicator)
  )

  // URLからホストとDB名を抽出
  let host = 'unknown'
  let database = 'unknown'
  try {
    const match = url.match(/postgresql:\/\/[^:]+:[^@]+@([^:\/]+)[^\/]*\/([^?]+)/)
    if (match) {
      host = match[1]
      database = match[2]
    }
  } catch {
    // パース失敗時は unknown のまま
  }

  return { url, isProduction, host, database }
}

/**
 * ユーザー確認（標準入力から）
 * 注意: この確認はスキップできません。必ず "yes" と入力する必要があります。
 */
async function confirmExecution(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`\n${message} (yes/no): `, (answer: string) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes')
    })
  })
}

if (!isDryRun && !isExecute) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  本番運用前データクリーンアップスクリプト                    ║
╚════════════════════════════════════════════════════════════╝

使用方法:
  npx tsx prisma/cleanup-for-production.ts --dry-run   # 削除件数を確認
  npx tsx prisma/cleanup-for-production.ts --execute   # 実際に削除

⚠️  --execute を実行する前に必ずバックアップを取得してください:
    pg_dump $DATABASE_URL > backup_before_cleanup.dump
`)
  process.exit(0)
}

async function getTableCounts() {
  const counts = {
    // 削除対象（ビジネスデータ）
    user: await prisma.user.count(),
    facilityAdmin: await prisma.facilityAdmin.count(),
    facility: await prisma.facility.count(),
    jobTemplate: await prisma.jobTemplate.count(),
    job: await prisma.job.count(),
    jobWorkDate: await prisma.jobWorkDate.count(),
    application: await prisma.application.count(),
    laborDocument: await prisma.laborDocument.count(),
    laborDocumentDownloadToken: await prisma.laborDocumentDownloadToken.count(),
    review: await prisma.review.count(),
    reviewTemplate: await prisma.reviewTemplate.count(),
    bookmark: await prisma.bookmark.count(),
    message: await prisma.message.count(),
    messageThread: await prisma.messageThread.count(),
    notification: await prisma.notification.count(),
    systemNotification: await prisma.systemNotification.count(),
    attendance: await prisma.attendance.count(),
    attendanceModificationRequest: await prisma.attendanceModificationRequest.count(),
    pushSubscription: await prisma.pushSubscription.count(),
    bankAccount: await prisma.bankAccount.count(),
    offerTemplate: await prisma.offerTemplate.count(),

    // 削除対象（テスト用）
    debugCheckProgress: await prisma.debugCheckProgress.count(),
    announcement: await prisma.announcement.count(),
    announcementRecipient: await prisma.announcementRecipient.count(),
    systemAdmin: await prisma.systemAdmin.count(),

    // 保持対象（ログ）
    systemLog: await prisma.systemLog.count(),
    notificationLog: await prisma.notificationLog.count(),
    nearbyNotificationLog: await prisma.nearbyNotificationLog.count(),
    userActivityLog: await prisma.userActivityLog.count(),
    analyticsDailyCache: await prisma.analyticsDailyCache.count(),
    registrationTracking: await prisma.registrationTracking.count(),

    // 保持対象（マスタ）
    bank: await prisma.bank.count(),
    branch: await prisma.branch.count(),
    analyticsRegion: await prisma.analyticsRegion.count(),

    // 保持対象（設定）
    faqCategory: await prisma.faqCategory.count(),
    faq: await prisma.faq.count(),
    userGuide: await prisma.userGuide.count(),
    legalDocument: await prisma.legalDocument.count(),
    systemTemplate: await prisma.systemTemplate.count(),
    jobDescriptionFormat: await prisma.jobDescriptionFormat.count(),
    laborDocumentTemplate: await prisma.laborDocumentTemplate.count(),
    errorMessageSetting: await prisma.errorMessageSetting.count(),
    systemSetting: await prisma.systemSetting.count(),
    notificationSetting: await prisma.notificationSetting.count(),
  }
  return counts
}

/**
 * FK制約を安全に削除
 */
async function dropForeignKeyConstraint(): Promise<void> {
  console.log('\n🔧 Step 0: NearbyNotificationLogのFK制約を解除')
  console.log('   （ログデータを保持するため、User削除前にFK制約を外します）')

  try {
    // 制約が存在するか確認
    const constraintExists = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM information_schema.table_constraints
      WHERE constraint_name = 'nearby_notification_logs_user_id_fkey'
      AND table_name = 'nearby_notification_logs'
    `

    if (constraintExists[0]?.count > 0) {
      await prisma.$executeRaw`
        ALTER TABLE nearby_notification_logs
        DROP CONSTRAINT nearby_notification_logs_user_id_fkey
      `
      console.log('   ✅ FK制約を削除しました')
    } else {
      console.log('   ⏭️  FK制約は既に削除されています')
    }
  } catch (error) {
    console.error('   ❌ FK制約の削除に失敗:', error)
    throw new Error('FK制約の削除に失敗しました。処理を中断します。')
  }
}

/**
 * 各フェーズの削除を実行（エラー時は詳細を出力）
 */
async function executePhase<T>(
  phaseName: string,
  operations: Prisma.PrismaPromise<T>[],
  labels: string[]
): Promise<T[]> {
  console.log(`\n📌 ${phaseName}`)

  try {
    const results = await prisma.$transaction(operations)

    results.forEach((result: any, index: number) => {
      const count = result?.count ?? 0
      console.log(`   ✅ ${labels[index]}: ${count}件削除`)
    })

    return results
  } catch (error) {
    console.error(`   ❌ ${phaseName}でエラー発生:`, error)
    throw error
  }
}

async function executeCleanup(): Promise<void> {
  console.log('\n🗑️  データ削除を開始...')
  console.log('   ※ 途中でエラーが発生した場合、それ以降の処理は実行されません')
  console.log('   ※ バックアップからの復元が必要になる場合があります\n')

  // Step 0: FK制約を削除（ログ保持のため）
  await dropForeignKeyConstraint()

  // Phase 1: 最下層（依存されていないテーブル）
  await executePhase(
    'Phase 1: 最下層テーブルの削除',
    [
      prisma.debugCheckProgress.deleteMany(),
      prisma.laborDocumentDownloadToken.deleteMany(),
      prisma.announcementRecipient.deleteMany(),
    ],
    ['DebugCheckProgress', 'LaborDocumentDownloadToken', 'AnnouncementRecipient']
  )

  // Phase 2: 中間層
  await executePhase(
    'Phase 2: 中間層テーブルの削除',
    [
      prisma.attendanceModificationRequest.deleteMany(),
      prisma.attendance.deleteMany(),
      prisma.laborDocument.deleteMany(),
      prisma.review.deleteMany(),
      prisma.message.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.systemNotification.deleteMany(),
      prisma.bookmark.deleteMany(),
      prisma.pushSubscription.deleteMany(),
      prisma.bankAccount.deleteMany(),
    ],
    [
      'AttendanceModificationRequest', 'Attendance', 'LaborDocument',
      'Review', 'Message', 'Notification', 'SystemNotification',
      'Bookmark', 'PushSubscription', 'BankAccount'
    ]
  )

  // Phase 3: Application層
  await executePhase(
    'Phase 3: Application層の削除',
    [
      prisma.messageThread.deleteMany(),
      prisma.application.deleteMany(),
    ],
    ['MessageThread', 'Application']
  )

  // Phase 4: Job関連
  await executePhase(
    'Phase 4: Job関連の削除',
    [
      prisma.jobWorkDate.deleteMany(),
      prisma.job.deleteMany(),
      prisma.jobTemplate.deleteMany(),
      prisma.offerTemplate.deleteMany(),
      prisma.reviewTemplate.deleteMany(),
    ],
    ['JobWorkDate', 'Job', 'JobTemplate', 'OfferTemplate', 'ReviewTemplate']
  )

  // Phase 5: 最上位層
  await executePhase(
    'Phase 5: 最上位層の削除',
    [
      prisma.facilityAdmin.deleteMany(),
      prisma.facility.deleteMany(),
      prisma.user.deleteMany(),
    ],
    ['FacilityAdmin', 'Facility', 'User']
  )

  // Phase 6: テスト用データ
  await executePhase(
    'Phase 6: テスト用データの削除',
    [
      prisma.announcement.deleteMany(),
      prisma.systemAdmin.deleteMany(),
    ],
    ['Announcement', 'SystemAdmin']
  )

  // FK制約は再作成しない
  // 理由: user_idが孤児参照になるため、再作成するとエラーになる
  // 新規ログは新しいUserに対して作成されるため、本番運用には影響なし
  console.log('\n📝 Note: NearbyNotificationLogのFK制約は再作成しません')
  console.log('   （既存ログのuser_idは孤児参照になりますが、データは保持されます）')
  console.log('   （新規ログは新しいUserに対して正常に作成されます）')
}

function displayCounts(counts: Awaited<ReturnType<typeof getTableCounts>>): void {
  // 削除対象の表示
  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│ 🗑️  削除対象（ビジネスデータ）                           │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│ User                          : ${String(counts.user).padStart(8)} 件        │`)
  console.log(`│ FacilityAdmin                 : ${String(counts.facilityAdmin).padStart(8)} 件        │`)
  console.log(`│ Facility                      : ${String(counts.facility).padStart(8)} 件        │`)
  console.log(`│ JobTemplate                   : ${String(counts.jobTemplate).padStart(8)} 件        │`)
  console.log(`│ Job                           : ${String(counts.job).padStart(8)} 件        │`)
  console.log(`│ JobWorkDate                   : ${String(counts.jobWorkDate).padStart(8)} 件        │`)
  console.log(`│ Application                   : ${String(counts.application).padStart(8)} 件        │`)
  console.log(`│ LaborDocument                 : ${String(counts.laborDocument).padStart(8)} 件        │`)
  console.log(`│ LaborDocumentDownloadToken    : ${String(counts.laborDocumentDownloadToken).padStart(8)} 件        │`)
  console.log(`│ Review                        : ${String(counts.review).padStart(8)} 件        │`)
  console.log(`│ ReviewTemplate                : ${String(counts.reviewTemplate).padStart(8)} 件        │`)
  console.log(`│ Bookmark                      : ${String(counts.bookmark).padStart(8)} 件        │`)
  console.log(`│ Message                       : ${String(counts.message).padStart(8)} 件        │`)
  console.log(`│ MessageThread                 : ${String(counts.messageThread).padStart(8)} 件        │`)
  console.log(`│ Notification                  : ${String(counts.notification).padStart(8)} 件        │`)
  console.log(`│ SystemNotification            : ${String(counts.systemNotification).padStart(8)} 件        │`)
  console.log(`│ Attendance                    : ${String(counts.attendance).padStart(8)} 件        │`)
  console.log(`│ AttendanceModificationRequest : ${String(counts.attendanceModificationRequest).padStart(8)} 件        │`)
  console.log(`│ PushSubscription              : ${String(counts.pushSubscription).padStart(8)} 件        │`)
  console.log(`│ BankAccount                   : ${String(counts.bankAccount).padStart(8)} 件        │`)
  console.log(`│ OfferTemplate                 : ${String(counts.offerTemplate).padStart(8)} 件        │`)
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│ 🗑️  削除対象（テスト用）                                 │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│ DebugCheckProgress            : ${String(counts.debugCheckProgress).padStart(8)} 件        │`)
  console.log(`│ Announcement                  : ${String(counts.announcement).padStart(8)} 件        │`)
  console.log(`│ AnnouncementRecipient         : ${String(counts.announcementRecipient).padStart(8)} 件        │`)
  console.log(`│ SystemAdmin                   : ${String(counts.systemAdmin).padStart(8)} 件        │`)
  console.log('└─────────────────────────────────────────────────────────┘')

  // 保持対象の表示
  console.log('\n┌─────────────────────────────────────────────────────────┐')
  console.log('│ ✅ 保持対象（ログ）                                      │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│ SystemLog                     : ${String(counts.systemLog).padStart(8)} 件        │`)
  console.log(`│ NotificationLog               : ${String(counts.notificationLog).padStart(8)} 件        │`)
  console.log(`│ NearbyNotificationLog         : ${String(counts.nearbyNotificationLog).padStart(8)} 件        │`)
  console.log(`│ UserActivityLog               : ${String(counts.userActivityLog).padStart(8)} 件        │`)
  console.log(`│ AnalyticsDailyCache           : ${String(counts.analyticsDailyCache).padStart(8)} 件        │`)
  console.log(`│ RegistrationTracking          : ${String(counts.registrationTracking).padStart(8)} 件        │`)
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│ ✅ 保持対象（マスタ）                                    │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│ Bank                          : ${String(counts.bank).padStart(8)} 件        │`)
  console.log(`│ Branch                        : ${String(counts.branch).padStart(8)} 件        │`)
  console.log(`│ AnalyticsRegion               : ${String(counts.analyticsRegion).padStart(8)} 件        │`)
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log('│ ✅ 保持対象（設定）                                      │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│ FaqCategory                   : ${String(counts.faqCategory).padStart(8)} 件        │`)
  console.log(`│ Faq                           : ${String(counts.faq).padStart(8)} 件        │`)
  console.log(`│ UserGuide                     : ${String(counts.userGuide).padStart(8)} 件        │`)
  console.log(`│ LegalDocument                 : ${String(counts.legalDocument).padStart(8)} 件        │`)
  console.log(`│ SystemTemplate                : ${String(counts.systemTemplate).padStart(8)} 件        │`)
  console.log(`│ JobDescriptionFormat          : ${String(counts.jobDescriptionFormat).padStart(8)} 件        │`)
  console.log(`│ LaborDocumentTemplate         : ${String(counts.laborDocumentTemplate).padStart(8)} 件        │`)
  console.log(`│ ErrorMessageSetting           : ${String(counts.errorMessageSetting).padStart(8)} 件        │`)
  console.log(`│ SystemSetting                 : ${String(counts.systemSetting).padStart(8)} 件        │`)
  console.log(`│ NotificationSetting           : ${String(counts.notificationSetting).padStart(8)} 件        │`)
  console.log('└─────────────────────────────────────────────────────────┘')
}

async function main() {
  try {
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('  本番運用前データクリーンアップ')
    console.log('════════════════════════════════════════════════════════════\n')

    // 接続先DBの確認
    const dbInfo = getDatabaseInfo()
    console.log('📡 接続先データベース:')
    console.log(`   ホスト: ${dbInfo.host}`)
    console.log(`   DB名: ${dbInfo.database}`)

    if (dbInfo.isProduction) {
      console.log('\n🚨🚨🚨 警告: 本番データベースに接続しています 🚨🚨🚨')

      if (isExecute) {
        const confirmed = await confirmExecution(
          '⚠️  本番DBでクリーンアップを実行しようとしています。本当に続行しますか？'
        )
        if (!confirmed) {
          console.log('\n❌ 処理を中断しました')
          process.exit(0)
        }
      }
    } else {
      console.log('   環境: ステージング/開発')
    }

    // 現在のレコード数を取得
    console.log('\n📊 現在のデータ件数を取得中...\n')
    const counts = await getTableCounts()

    // 件数表示
    displayCounts(counts)

    if (isDryRun) {
      console.log('\n════════════════════════════════════════════════════════════')
      console.log('  ドライラン完了 - 実際の削除は行われていません')
      console.log('════════════════════════════════════════════════════════════')
      console.log('\n実行する場合:')
      console.log('  1. バックアップを取得: pg_dump $DATABASE_URL > backup.dump')
      console.log('  2. 実行: npx tsx prisma/cleanup-for-production.ts --execute\n')
    }

    if (isExecute) {
      // 最終確認
      console.log('\n⚠️  警告: データ削除を実行します')
      console.log('   削除されるレコード数:')
      console.log(`   - User: ${counts.user}件`)
      console.log(`   - Facility: ${counts.facility}件`)
      console.log(`   - Job: ${counts.job}件`)
      console.log(`   - Application: ${counts.application}件`)
      console.log(`   - その他多数...`)

      const confirmed = await confirmExecution(
        '⚠️  全てのビジネスデータが削除されます。バックアップは取得済みですか？続行しますか？'
      )

      if (!confirmed) {
        console.log('\n❌ 処理を中断しました')
        process.exit(0)
      }

      console.log('\n⏳ 5秒後にデータ削除を開始します...')
      console.log('   中止する場合は Ctrl+C を押してください\n')

      await new Promise(resolve => setTimeout(resolve, 5000))

      await executeCleanup()

      console.log('\n════════════════════════════════════════════════════════════')
      console.log('  ✅ クリーンアップ完了')
      console.log('════════════════════════════════════════════════════════════')

      // 削除後の件数確認
      console.log('\n📊 削除後のデータ件数:')
      const afterCounts = await getTableCounts()
      console.log(`   User: ${afterCounts.user}件, Facility: ${afterCounts.facility}件, Job: ${afterCounts.job}件`)
      console.log(`   ログテーブル: ${afterCounts.systemLog + afterCounts.notificationLog + afterCounts.nearbyNotificationLog + afterCounts.userActivityLog}件 保持 ✅`)

      console.log('\n次のステップ:')
      console.log('  1. 本番用SystemAdminを作成: SYSTEM_ADMIN_PASSWORD="xxx" npx tsx prisma/seed-admin.ts')
      console.log('  2. 動作確認を実施\n')
    }

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error)
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('  ロールバック手順')
    console.log('════════════════════════════════════════════════════════════')
    console.log('\n■ 完全ロールバック（推奨）:')
    console.log('  pg_restore -d $DATABASE_URL --clean --if-exists backup_before_cleanup.dump')
    console.log('\n■ Vercel/Supabaseの場合:')
    console.log('  1. Supabaseダッシュボード → Database → Backups')
    console.log('  2. Point-in-time recoveryで復元')
    console.log('\n■ FK制約の手動復元（必要な場合）:')
    console.log('  ALTER TABLE nearby_notification_logs')
    console.log('  ADD CONSTRAINT nearby_notification_logs_user_id_fkey')
    console.log('  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;')
    console.log('\n■ 復元後の確認:')
    console.log('  npx prisma studio  # データ確認')
    console.log('  npm run dev        # 動作確認\n')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
