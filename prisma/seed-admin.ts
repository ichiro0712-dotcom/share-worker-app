/**
 * ============================================================================
 * 本番用SystemAdmin作成スクリプト
 * ============================================================================
 *
 * 【概要】
 * クリーンアップ後に実行して、本番用の管理者アカウントを作成します。
 * cleanup-for-production.ts でSystemAdminが削除されるため、
 * 本番運用開始前に必ず実行してください。
 *
 * ============================================================================
 * 【使用方法】
 * ============================================================================
 *
 * ■ 基本的な使用方法
 *   SYSTEM_ADMIN_PASSWORD="your-secure-password" npx tsx prisma/seed-admin.ts
 *
 * ■ カスタム設定
 *   SYSTEM_ADMIN_EMAIL="custom@example.com" \
 *   SYSTEM_ADMIN_PASSWORD="your-secure-password" \
 *   SYSTEM_ADMIN_NAME="管理者太郎" \
 *   npx tsx prisma/seed-admin.ts
 *
 * ============================================================================
 * 【環境変数】
 * ============================================================================
 *
 *   SYSTEM_ADMIN_EMAIL    - 管理者メールアドレス
 *                           デフォルト: admin@tastas.jp
 *
 *   SYSTEM_ADMIN_PASSWORD - 管理者パスワード（必須）
 *                           12文字以上必須
 *                           英大文字・小文字・数字・記号を含むことを推奨
 *
 *   SYSTEM_ADMIN_NAME     - 管理者表示名
 *                           デフォルト: システム管理者
 *
 * ============================================================================
 * 【セキュリティ要件】
 * ============================================================================
 *
 * - パスワードは12文字以上
 * - bcryptでハッシュ化（ソルトラウンド: 12）
 * - 環境変数で渡すことでコマンド履歴に残らない
 *
 * ============================================================================
 * 【トラブルシューティング】
 * ============================================================================
 *
 * ■ 「既に存在します」と表示される場合
 *   → 既存アカウントのパスワードを更新するか確認されます
 *   → Ctrl+C でキャンセル可能
 *
 * ■ ログインできない場合
 *   1. メールアドレスを確認: npx prisma studio → SystemAdmin
 *   2. パスワードをリセット: このスクリプトを再実行
 *
 * ■ アカウントを削除したい場合
 *   npx prisma studio → SystemAdmin → 削除
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import bcrypt from 'bcryptjs'

// 環境変数を読み込む（.env.local → .env の順で読み込み）
config({ path: '.env.local' })
config({ path: '.env' })

const prisma = new PrismaClient()

async function main() {
  console.log('\n════════════════════════════════════════════════════════════')
  console.log('  本番用SystemAdmin作成')
  console.log('════════════════════════════════════════════════════════════\n')

  const email = process.env.SYSTEM_ADMIN_EMAIL || 'admin@tastas.jp'
  const password = process.env.SYSTEM_ADMIN_PASSWORD
  const name = process.env.SYSTEM_ADMIN_NAME || 'システム管理者'

  if (!password) {
    console.error('❌ エラー: SYSTEM_ADMIN_PASSWORD 環境変数が設定されていません')
    console.log('\n使用方法:')
    console.log('  SYSTEM_ADMIN_PASSWORD="your-secure-password" npx tsx prisma/seed-admin.ts\n')
    process.exit(1)
  }

  // パスワード強度チェック
  if (password.length < 12) {
    console.error('❌ エラー: パスワードは12文字以上である必要があります')
    process.exit(1)
  }

  // 既存の管理者チェック
  const existingAdmin = await prisma.systemAdmin.findUnique({
    where: { email }
  })

  if (existingAdmin) {
    console.log(`⚠️  警告: ${email} は既に存在します`)
    console.log('   既存のアカウントを更新しますか？（5秒後に更新）')
    console.log('   中止する場合は Ctrl+C を押してください\n')
    await new Promise(resolve => setTimeout(resolve, 5000))

    const hashedPassword = await bcrypt.hash(password, 12)
    await prisma.systemAdmin.update({
      where: { email },
      data: {
        password_hash: hashedPassword,
        name,
        updated_at: new Date()
      }
    })
    console.log('✅ パスワードを更新しました\n')
  } else {
    const hashedPassword = await bcrypt.hash(password, 12)
    await prisma.systemAdmin.create({
      data: {
        email,
        password_hash: hashedPassword,
        name,
        role: 'super_admin'
      }
    })
    console.log('✅ SystemAdminを作成しました')
    console.log(`   メール: ${email}`)
    console.log(`   名前: ${name}`)
    console.log(`   権限: super_admin\n`)
  }

  // 作成後の確認
  const adminCount = await prisma.systemAdmin.count()
  console.log(`📊 現在のSystemAdmin数: ${adminCount}件\n`)
}

main()
  .catch((error) => {
    console.error('❌ エラー:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
