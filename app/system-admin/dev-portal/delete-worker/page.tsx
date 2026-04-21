'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { deleteWorkerCompletely, DeleteWorkerResult } from '@/src/lib/actions/dev-user-delete';

export default function DeleteWorkerPage() {
  const [identifier, setIdentifier] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [forceMode, setForceMode] = useState(false);
  const [forceConfirmText, setForceConfirmText] = useState('');
  const [result, setResult] = useState<DeleteWorkerResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const baseValid = identifier.trim() !== '' && confirmText === '削除する';
  const forceValid = !forceMode || forceConfirmText === '強制削除';
  const canSubmit = baseValid && forceValid && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteWorkerCompletely(identifier.trim(), { force: forceMode });
      setResult(res);
      if (res.success) {
        setIdentifier('');
        setConfirmText('');
        setForceMode(false);
        setForceConfirmText('');
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/system-admin/dev-portal"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          開発者ポータルに戻る
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-6 h-6 text-red-600" />
          <h1 className="text-2xl font-bold">ワーカー完全削除（開発・テスト用）</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          指定したワーカーユーザーと、それに紐付く応募・ブックマーク・メッセージ・プッシュ通知登録・出退勤・銀行口座などのデータを<strong>完全に削除</strong>します。
        </p>

        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-bold mb-2">⚠️ 重要な注意事項</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>この操作は<strong>不可逆</strong>です。削除後の復元はできません。</li>
                <li>対象ユーザーのオファー求人の <code className="bg-red-100 px-1 rounded">target_worker_id</code> は null にリセットされます（求人自体は削除されません）。</li>
                <li>操作ログ（UserActivityLog）は履歴保持のため残存します。</li>
                <li>本番環境では <code className="bg-red-100 px-1 rounded">ALLOW_DEV_USER_DELETE=true</code> が設定されていないと実行できません。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              対象ユーザー（メールアドレス または ユーザーID）
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isPending}
              placeholder="例: test@example.com または 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              確認のため「<strong>削除する</strong>」と入力してください
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isPending}
              placeholder="削除する"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* 強制削除オプション */}
          <div className="border border-orange-300 rounded-md bg-orange-50 p-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                id="force-delete"
                type="checkbox"
                checked={forceMode}
                onChange={(e) => setForceMode(e.target.checked)}
                disabled={isPending}
                className="mt-1 w-4 h-4 accent-orange-600"
              />
              <div className="flex-1">
                <span className="font-semibold text-orange-900 text-sm">
                  強制削除モード（進行中業務のブロックをバイパス）
                </span>
                <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                  APPLIED/SCHEDULED/WORKING/COMPLETED_PENDING の応募や未応答オファーがある場合でも削除を強行します。
                  施設側の業務履歴からテストデータが消える可能性あり。
                  <strong>未退勤の勤怠は強制モードでもブロックされます。</strong>
                </p>
              </div>
            </label>
            {forceMode && (
              <div className="mt-3 pl-6">
                <label className="block text-xs font-medium text-orange-900 mb-1">
                  追加確認: 「<strong>強制削除</strong>」と入力
                </label>
                <input
                  type="text"
                  value={forceConfirmText}
                  onChange={(e) => setForceConfirmText(e.target.value)}
                  disabled={isPending}
                  placeholder="強制削除"
                  className="w-full px-3 py-2 border border-orange-400 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                削除中...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                {forceMode ? '強制削除を実行' : '完全削除を実行'}
              </>
            )}
          </button>
        </div>

        {result && (
          <div
            className={`mt-6 p-4 rounded-md border ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {result.success ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-800">削除完了</p>
                </div>
                {result.deletedUser && (
                  <div className="text-sm text-green-800 space-y-1">
                    <p>
                      ユーザー: ID={result.deletedUser.id}, {result.deletedUser.name}（
                      {result.deletedUser.email}）
                    </p>
                    {result.counts && (
                      <ul className="list-disc pl-5 mt-2">
                        <li>応募レコード: {result.counts.applications} 件（cascade 削除）</li>
                        <li>ブックマーク: {result.counts.bookmarks} 件（cascade 削除）</li>
                        <li>メッセージ: {result.counts.messages} 件（cascade 削除）</li>
                        <li>レビュー: {result.counts.reviews} 件（cascade 削除）</li>
                        <li>勤怠: {result.counts.attendances} 件（cascade 削除）</li>
                        <li>
                          オファー求人の target_worker_id クリア:{' '}
                          {result.counts.offeredJobsCleared} 件
                        </li>
                        <li>
                          JobWorkDate カウンター調整:{' '}
                          {result.counts.workDateCountersAdjusted} 件
                        </li>
                        <li>
                          Facility 評価再計算: {result.counts.facilityRatingsRecalculated} 件
                        </li>
                        <li>
                          労働条件通知書トークン削除: {result.counts.laborDocTokensDeleted} 件
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="font-semibold text-red-800">
                    {result.blockers ? '削除不可（進行中業務あり）' : 'エラー'}
                  </p>
                </div>
                <p className="text-sm text-red-800">{result.message}</p>
                {result.blockers && result.blockers.length > 0 && (
                  <ul className="list-disc pl-5 mt-2 text-sm text-red-800">
                    {result.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
