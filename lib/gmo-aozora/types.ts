import { z } from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const dateTimeSchema = z.string().min(1)
const digitStringSchema = z.preprocess((value) => {
  if (typeof value === 'number') return String(value)
  return value
}, z.string().regex(/^\d+$/))

const optionalDigitStringSchema = digitStringSchema.optional()
const beneficiaryNameSchema = z.string().min(1).max(48).regex(/^[ァ-ヴーｦ-ﾟーｰ・･（）()\[\]「」『』【】\-－.,．，/／ 　]+$/)

const gmoCodeStringSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => {
    if (typeof value === 'number') return String(value)
    return value
  }, z.enum(values))

const gmoIntSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return value
}, z.number().int())

const gmoBooleanSchema = z.preprocess((value) => {
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  return value
}, z.boolean())

function sumTransferAmounts(transfers: Array<{ transferAmount: string }>): string {
  return transfers.reduce((total, transfer) => total + BigInt(transfer.transferAmount), BigInt(0)).toString()
}

export const TransferStatusCodeSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return value
}, z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(8),
  z.literal(11),
  z.literal(12),
  z.literal(13),
  z.literal(20),
  z.literal(22),
  z.literal(24),
  z.literal(25),
  z.literal(26),
  z.literal(40),
]))

export const RefundStatusSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return value
}, z.union([z.literal(1), z.literal(2), z.literal(3)]))

export const AccountTypeCodeSchema = gmoCodeStringSchema(['1', '2', '4'] as const)
export const TransferDateHolidayCodeSchema = gmoCodeStringSchema(['1', '2', '3'] as const)
export const ResultCodeSchema = gmoCodeStringSchema(['1', '2'] as const)
export const QueryKeyClassSchema = gmoCodeStringSchema(['1', '2'] as const)

export const TransferSchema = z.object({
  itemId: digitStringSchema,
  transferAmount: digitStringSchema,
  ediInfo: z.string().max(20).optional(),
  beneficiaryBankCode: z.string().regex(/^\d{4}$/),
  beneficiaryBankName: z.string().min(1).max(30).optional(),
  beneficiaryBranchCode: z.string().regex(/^\d{3}$/),
  beneficiaryBranchName: z.string().min(1).max(30).optional(),
  accountTypeCode: AccountTypeCodeSchema,
  accountNumber: z.string().regex(/^\d{7}$/),
  beneficiaryName: beneficiaryNameSchema,
})

export type Transfer = z.infer<typeof TransferSchema>

export const TransferRequestSchema = z.object({
  accountId: z.string().min(1),
  remitterName: z.string().min(1).max(48),
  transferDesignatedDate: dateSchema,
  transferDateHolidayCode: TransferDateHolidayCodeSchema,
  totalCount: digitStringSchema,
  totalAmount: digitStringSchema,
  applyComment: z.string().max(120).optional(),
  transfers: z.array(TransferSchema).min(1),
}).refine((request) => request.totalCount === String(request.transfers.length), {
  message: 'totalCount must match transfers.length',
  path: ['totalCount'],
}).refine((request) => request.totalAmount === sumTransferAmounts(request.transfers), {
  message: 'totalAmount must match sum of transferAmount',
  path: ['totalAmount'],
})

export type TransferRequest = z.infer<typeof TransferRequestSchema>

export const TransferRequestResponseSchema = z.object({
  applyNo: z.string().regex(/^\d{16}$/),
  resultCode: ResultCodeSchema,
  applyEndDatetime: dateTimeSchema,
  accountId: z.string().min(1).optional(),
}).passthrough()

export type TransferRequestResponse = z.infer<typeof TransferRequestResponseSchema>

export const TransferStatusQuerySchema = z.object({
  accountId: z.string().min(1),
  queryKeyClass: QueryKeyClassSchema,
  applyNo: z.string().min(1).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  nextItemKey: z.string().min(1).optional(),
  requestTransferStatus: z.preprocess((value) => {
    if (typeof value === 'number') return String(value)
    return value
  }, z.string().min(1)).optional(),
  requestTransferClass: z.preprocess((value) => {
    if (typeof value === 'number') return String(value)
    return value
  }, z.string().min(1)).optional(),
  requestTransferTerm: z.preprocess((value) => {
    if (typeof value === 'number') return String(value)
    return value
  }, z.string().min(1)).optional(),
})

export type TransferStatusQuery = z.infer<typeof TransferStatusQuerySchema>

export const TransferResponseSchema = z.object({
  itemId: z.string().min(1).optional(),
  transferAmount: optionalDigitStringSchema,
  transferFee: optionalDigitStringSchema,
  transferStatus: TransferStatusCodeSchema.optional(),
  transferDetailStatus: z.string().min(1).optional(),
  refundStatus: RefundStatusSchema.optional(),
  isRepayment: gmoBooleanSchema.optional(),
  repaymentDate: dateSchema.optional(),
  ediInfo: z.string().optional(),
  beneficiaryBankCode: z.string().regex(/^\d{4}$/).optional(),
  beneficiaryBankName: z.string().optional(),
  beneficiaryBranchCode: z.string().regex(/^\d{3}$/).optional(),
  beneficiaryBranchName: z.string().optional(),
  accountTypeCode: AccountTypeCodeSchema.optional(),
  accountNumber: z.string().regex(/^\d{7}$/).optional(),
  beneficiaryName: z.string().max(48).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
}).passthrough()

export type TransferResponse = z.infer<typeof TransferResponseSchema>

export const TransferAcceptSchema = z.object({
  accountId: z.string().min(1).optional(),
  applyNo: z.string().min(1).optional(),
  applyStatus: gmoIntSchema.optional(),
  applyDatetime: dateTimeSchema.optional(),
  applyEndDatetime: dateTimeSchema.optional(),
  applyComment: z.string().optional(),
  remitterName: z.string().optional(),
  transferDesignatedDate: dateSchema.optional(),
  transferDateHolidayCode: TransferDateHolidayCodeSchema.optional(),
  totalCount: optionalDigitStringSchema,
  totalAmount: optionalDigitStringSchema,
  totalFee: optionalDigitStringSchema,
  transferStatus: TransferStatusCodeSchema.optional(),
  transferResponses: z.array(TransferResponseSchema).default([]),
}).passthrough()

export type TransferAccept = z.infer<typeof TransferAcceptSchema>

export const TransferDetailSchema = z.object({
  accountId: z.string().min(1).optional(),
  applyNo: z.string().min(1).optional(),
  transferStatus: TransferStatusCodeSchema.optional(),
  transferAccepts: z.array(TransferAcceptSchema).default([]),
  transferResponses: z.array(TransferResponseSchema).optional(),
}).passthrough()

export type TransferDetail = z.infer<typeof TransferDetailSchema>

export const TransferStatusResponseSchema = z.object({
  accountId: z.string().min(1).optional(),
  nextItemKey: z.string().min(1).optional(),
  hasNext: gmoBooleanSchema.optional(),
  transferDetails: z.array(TransferDetailSchema).default([]),
  transferAccepts: z.array(TransferAcceptSchema).optional(),
  transferResponses: z.array(TransferResponseSchema).optional(),
}).passthrough()

export type TransferStatusResponse = z.infer<typeof TransferStatusResponseSchema>

export const TransferRequestResultResponseSchema = TransferStatusResponseSchema

export type TransferRequestResultResponse = z.infer<typeof TransferRequestResultResponseSchema>

export const TransferFeeRequestSchema = TransferRequestSchema

export type TransferFeeRequest = z.infer<typeof TransferFeeRequestSchema>

export const TransferFeeDetailSchema = z.object({
  itemId: z.string().min(1).optional(),
  transferAmount: optionalDigitStringSchema,
  transferFee: optionalDigitStringSchema,
  beneficiaryBankCode: z.string().regex(/^\d{4}$/).optional(),
  beneficiaryBranchCode: z.string().regex(/^\d{3}$/).optional(),
  accountTypeCode: AccountTypeCodeSchema.optional(),
  accountNumber: z.string().regex(/^\d{7}$/).optional(),
  beneficiaryName: z.string().max(48).optional(),
}).passthrough()

export type TransferFeeDetail = z.infer<typeof TransferFeeDetailSchema>

export const TransferFeeResponseSchema = z.object({
  totalCount: optionalDigitStringSchema,
  totalAmount: optionalDigitStringSchema,
  totalFee: digitStringSchema,
  transferFeeDetails: z.array(TransferFeeDetailSchema).default([]),
}).passthrough()

export type TransferFeeResponse = z.infer<typeof TransferFeeResponseSchema>

export const AccountSchema = z.object({
  accountId: z.string().min(1),
  branchCode: z.string().regex(/^\d{3}$/).optional(),
  branchName: z.string().optional(),
  accountTypeCode: AccountTypeCodeSchema.optional(),
  accountNumber: z.string().regex(/^\d{7}$/).optional(),
  accountName: z.string().optional(),
  accountNameKana: z.string().optional(),
  currencyCode: z.string().optional(),
  transferLimitAmount: optionalDigitStringSchema,
}).passthrough()

export type Account = z.infer<typeof AccountSchema>

export const AccountsResponseSchema = z.object({
  accounts: z.array(AccountSchema).default([]),
}).passthrough()

export type AccountsResponse = z.infer<typeof AccountsResponseSchema>

export const BalanceSchema = z.object({
  accountId: z.string().min(1).optional(),
  balance: digitStringSchema,
  withdrawableAmount: digitStringSchema,
  currencyCode: z.string().optional(),
  previousDayBalance: optionalDigitStringSchema,
  previousMonthBalance: optionalDigitStringSchema,
}).passthrough()

export type Balance = z.infer<typeof BalanceSchema>

export const BalanceResponseSchema = z.object({
  balances: z.array(BalanceSchema).default([]),
}).passthrough()

export type BalanceResponse = z.infer<typeof BalanceResponseSchema>

export const OAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().min(1),
  expires_in: gmoIntSchema,
  scope: z.string().optional(),
  id_token: z.string().optional(),
}).passthrough()

export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>

export const WebhookAccountSchema = z.object({
  accountId: z.string().min(1).optional(),
  branchCode: z.string().regex(/^\d{3}$/).optional(),
  branchName: z.string().optional(),
  accountTypeCode: AccountTypeCodeSchema.optional(),
  accountNumber: z.string().regex(/^\d{7}$/).optional(),
  accountName: z.string().optional(),
  accountNameKana: z.string().optional(),
}).passthrough()

export type WebhookAccount = z.infer<typeof WebhookAccountSchema>

export const VaTransactionSchema = z.object({
  transactionId: z.string().optional(),
  vaTransactionId: z.string().optional(),
  virtualAccountId: z.string().optional(),
  transactionDate: dateSchema.optional(),
  paymentDate: dateSchema.optional(),
  depositAmount: digitStringSchema,
  remitterName: z.string().optional(),
  remitterNameKana: z.string().optional(),
  remarks: z.string().optional(),
}).passthrough()

export type VaTransaction = z.infer<typeof VaTransactionSchema>

export const WebhookDepositMessageSchema = z.object({
  messageId: z.string().min(1),
  timestamp: dateTimeSchema,
  account: WebhookAccountSchema,
  vaTransaction: VaTransactionSchema,
}).passthrough()

export type WebhookDepositMessage = z.infer<typeof WebhookDepositMessageSchema>

export const WebhookDepositPayloadSchema = z.object({
  messages: z.array(WebhookDepositMessageSchema).default([]),
}).passthrough()

export type WebhookDepositPayload = z.infer<typeof WebhookDepositPayloadSchema>

export const ErrorResponseSchema = z.object({
  errorCode: z.string().min(1),
  errorMessage: z.string().min(1),
  errorDetails: z.unknown().optional(),
}).passthrough()

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
