# GMOあおぞらネット銀行 クライアント利用例

Jest/Vitest のユニットテスト基盤がないため、`lib/gmo-aozora/__tests__/transfer-status.test.ts` は Node.js 標準 `node:test` 形式で置いています。

```ts
import {
  createGmoClient,
  generateIdempotencyKey,
  verifyWebhookSignature,
  WebhookDepositPayloadSchema,
} from '@/lib/gmo-aozora'

const client = createGmoClient()

const token = 'stored-access-token'
const accounts = await client.listAccounts(token)
const balance = await client.getBalance(token, accounts.accounts[0]?.accountId)

const transfer = await client.requestTransfer(token, generateIdempotencyKey('WID'), {
  accountId: '101011234567',
  remitterName: 'プラスタスタス カ',
  transferDesignatedDate: '2026-05-28',
  transferDateHolidayCode: '1',
  totalCount: '1',
  totalAmount: '10657',
  applyComment: 'WORKER#36 5/28勤務分',
  transfers: [
    {
      itemId: '1',
      transferAmount: '10657',
      ediInfo: 'WID-36',
      beneficiaryBankCode: '0001',
      beneficiaryBranchCode: '001',
      accountTypeCode: '1',
      accountNumber: '1234567',
      beneficiaryName: 'サトウ ミサキ',
    },
  ],
})

const status = await client.getTransferStatus(token, {
  accountId: transfer.accountId,
  queryKeyClass: '1',
  applyNo: transfer.applyNo,
})

const isValidWebhook = verifyWebhookSignature(
  rawBody,
  request.headers.get('x-webhook-signature'),
  process.env.GMO_AOZORA_WEBHOOK_SECRET ?? ''
)

if (isValidWebhook) {
  const payload = WebhookDepositPayloadSchema.parse(JSON.parse(rawBody))
}
```
