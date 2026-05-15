'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/shadcn/button'

export interface SqlApprovalRequest {
  toolUseId: string
  purpose: string
  sql: string
  expectedRows?: number
}

export interface SqlApprovalModalProps {
  open: boolean
  request: SqlApprovalRequest | null
  onApprove: (skipForSession: boolean) => void
  onCancel: () => void
}

/**
 * SQL 実行承認モーダル
 *
 * - LLM が宣言した「目的 (purpose)」を主に表示
 * - SQL 本文は折りたたみで詳細確認可能 (デフォルト閉)
 * - 「このセッション中は確認をスキップ」チェックでセッションスキップ可能
 *   (タブを閉じるまで有効、永続化はしない)
 */
export function SqlApprovalModal({
  open,
  request,
  onApprove,
  onCancel,
}: SqlApprovalModalProps) {
  const [showSql, setShowSql] = useState(false)
  const [skip, setSkip] = useState(false)

  if (!open || !request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-1 text-lg font-semibold">SQL 実行します。よろしいですか？</h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          (システム責任者推奨)
        </p>

        <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            📊 目的
          </div>
          <div className="text-gray-900 dark:text-gray-100">{request.purpose}</div>
          {typeof request.expectedRows === 'number' && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              期待行数: 約 {request.expectedRows} 行
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowSql((v) => !v)}
          className="mb-3 text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {showSql ? '▼ 詳細 (SQL) を閉じる' : '▶ 詳細 (SQL) を見る'}
        </button>
        {showSql && (
          <pre className="mb-3 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
            {request.sql || '(SQL 未受信)'}
          </pre>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
            className="h-4 w-4"
          />
          <span>このセッション中は確認をスキップ</span>
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button onClick={() => onApprove(skip)}>実行する</Button>
        </div>
      </div>
    </div>
  )
}
