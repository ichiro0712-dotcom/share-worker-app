/**
 * 既存ワーカーの User 平文の銀行情報を、日払い用の BankAccount テーブルへ一括同期するバックフィル。
 * これが完了するまでは日払いは口座を見つけられず振り込めない（go-live必須）。
 *
 * 安全設計:
 * - 既定は dry-run（DBは変更しない／読み取り＋件数表示のみ）。
 * - 実行時に必ず「接続先DB(host/db名)」を表示（本番=ryvyuxomiqcgkspmpltk / ステージング=qcovuuqxyihbpjlgccxz で判別）。
 * - DATABASE_URL 未設定なら何もせず中断。
 * - `--execute` は `--confirm` が無いと拒否（接続先を見て納得してから付ける）。
 * - 冪等: 既存BankAccountと識別フィールドが同一なら lastChangedAt を更新しない（誤発火防止）。
 *
 * 使い方:
 *   npx tsx --env-file=.env.local scripts/backfill-bank-account-bridge.ts                     # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-bank-account-bridge.ts --execute --confirm # 実行
 *
 * ⚠️ 実行前に必ずDBバックアップを取得してください。
 */
import { PrismaClient } from '@prisma/client'
import {
  buildBankAccountSyncPayload,
  syncBankAccountFromUser,
  type UserBankSnapshot,
} from '../lib/actions/hibarai/bank-account-bridge'

const prisma = new PrismaClient()
const EXECUTE = process.argv.includes('--execute')
const CONFIRMED = process.argv.includes('--confirm')

function describeTargetDb(): string {
  const url = process.env.DATABASE_URL
  if (!url) return '(DATABASE_URL 未設定)'
  try {
    const u = new URL(url)
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`
  } catch {
    return '(DATABASE_URL の形式が不正)'
  }
}

async function main() {
  console.log(`接続先DB: ${describeTargetDb()}`)
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL が未設定です。中断します（どのDBにも接続しません）。')
    process.exit(1)
  }
  if (EXECUTE && !CONFIRMED) {
    console.error('\n❌ --execute には --confirm が必要です。上の「接続先DB」が正しいことを確認し、DBバックアップ取得後に')
    console.error('   npx tsx --env-file=.env.local scripts/backfill-bank-account-bridge.ts --execute --confirm')
    console.error('   を実行してください。')
    process.exit(1)
  }

  // 対象IDのみ取得（実際の銀行情報はupsert直前にtx内で再読込＝並行編集を上書きしない）。
  const targetUserIds = await prisma.user.findMany({
    where: {
      bank_code: { not: null },
      branch_code: { not: null },
      account_number: { not: null },
      account_name: { not: null },
    },
    select: { id: true },
  })
  console.log(`User 口座登録あり: ${targetUserIds.length} 件`)

  if (!EXECUTE) {
    // dry-run: 件数のみ。実際に同期可能かは値を見る必要があるが、ここでは読み取り負荷を抑え件数のみ。
    console.log('\n[dry-run] DBは変更していません（読み取りのみ）。上の「接続先DB」を確認し、バックアップ後に')
    console.log('  npx tsx --env-file=.env.local scripts/backfill-bank-account-bridge.ts --execute --confirm')
    console.log('で実行してください。')
    return
  }

  console.log('\n[execute] BankAccount への同期を実行します...')
  let synced = 0
  let changed = 0
  let skippedMissing = 0
  for (const { id } of targetUserIds) {
    // 並行編集対策: 各ユーザーごとに小さなトランザクションで「読み直し→sync」を行う。
    // 読込からupsertまでが同一tx内なので、バックフィル開始時のスナップショットで新しい編集を
    // 上書きすることを防ぐ（プロフィール側の更新は別tx・別タイミングで完結している前提）。
    try {
      await prisma.$transaction(async (tx) => {
        // 並行プロフィール更新を上書きしないため、対象 user 行を FOR UPDATE でロックしてから読み込む。
        // 他のtxがこの行をUPDATEしようとすると、本txがcommitするまで待たされる。
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`
        const u = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            bank_code: true, bank_name: true, branch_code: true, branch_name: true,
            account_name: true, account_number: true,
          },
        })
        if (!u) { skippedMissing += 1; return }
        const snapshot: UserBankSnapshot = {
          bank_code: u.bank_code,
          bank_name: u.bank_name,
          branch_code: u.branch_code,
          branch_name: u.branch_name,
          account_name: u.account_name,
          account_number: u.account_number,
        }
        if (buildBankAccountSyncPayload(snapshot) == null) { skippedMissing += 1; return }
        const res = await syncBankAccountFromUser(id, snapshot, { tx, updatedByType: 'BACKFILL' })
        if (res.synced) synced += 1
        if (res.changed) changed += 1
      })
    } catch (e) {
      console.error(`⚠️ user_id=${id} の同期で例外（スキップして続行）:`, e)
    }
  }
  console.log(`✅ 完了: 同期 ${synced} 件（識別変化 ${changed} 件） / スキップ(必須欠落等) ${skippedMissing} 件`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
