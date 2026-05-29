/**
 * 既存の User.account_number（平文）を暗号化するバックフィル。
 *
 * 安全設計:
 * - 既定は dry-run（件数表示のみ・DB変更なし）。実行は --execute を明示。
 * - 冪等: 既に暗号化済み(v1:接頭辞)の行はスキップ（二重暗号化しない）。
 * - 値は復号で完全一致するため、表示・実値は不変（保存形式のみ平文→暗号文）。
 * - 鍵 HIBARAI_ACCOUNT_ENC_KEY が未設定なら中断。
 *
 * 使い方:
 *   npx tsx scripts/backfill-account-encryption.ts             # dry-run（確認）
 *   npx tsx scripts/backfill-account-encryption.ts --execute   # 実行（DBバックアップ後に）
 *
 * ⚠️ 実行前に必ずDBバックアップを取得してください。鍵を紛失すると復号不能になります。
 */
import { PrismaClient } from '@prisma/client'
import {
  encryptAccountNumber,
  isEncrypted,
  isAccountEncryptionConfigured,
} from '../lib/actions/hibarai/account-encryption'

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes('--execute')

async function main() {
  if (!isAccountEncryptionConfigured()) {
    console.error('❌ HIBARAI_ACCOUNT_ENC_KEY が未設定です。中断します。')
    process.exit(1)
  }

  const targets = await prisma.user.findMany({
    where: { account_number: { not: null } },
    select: { id: true, account_number: true },
  })

  let toEncrypt = 0
  let alreadyEncrypted = 0
  for (const u of targets) {
    if (isEncrypted(u.account_number)) alreadyEncrypted += 1
    else if (u.account_number && u.account_number.trim() !== '') toEncrypt += 1
  }

  console.log('--- account_number 暗号化バックフィル ---')
  console.log(`対象(account_number あり): ${targets.length} 件`)
  console.log(`暗号化済み(スキップ): ${alreadyEncrypted} 件`)
  console.log(`今回暗号化する: ${toEncrypt} 件`)

  if (!EXECUTE) {
    console.log('\n[dry-run] DBは変更していません。実行するには --execute を付けてください（DBバックアップ後に）。')
    return
  }

  console.log('\n[execute] 暗号化を実行します...')
  let done = 0
  let skippedConcurrent = 0
  for (const u of targets) {
    const value = u.account_number
    if (!value || value.trim() === '' || isEncrypted(value)) continue
    // 競合対策: 読み取り時と値が一致する行だけ更新（間に編集が入ったら更新しない＝編集を上書きしない）。
    const res = await prisma.user.updateMany({
      where: { id: u.id, account_number: value },
      data: { account_number: encryptAccountNumber(value) },
    })
    if (res.count > 0) done += 1
    else skippedConcurrent += 1
  }
  console.log(`✅ 完了: ${done} 件を暗号化しました。${skippedConcurrent > 0 ? `（並行更新で ${skippedConcurrent} 件スキップ→再実行で処理されます）` : ''}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
