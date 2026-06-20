'use client';

import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { getUserApplicationQuota } from '@/src/lib/actions';

interface Quota {
  isBeginner: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * 勤務実績なしワーカーの応募可能件数バナー
 *
 * 仕様: docs/beginner-application-limit-plan-2026-0616.md §4.7
 * カイテク踏襲で「マイページ」に、加えて「仕事管理」画面にも掲出。
 * 初心者期間中のみ表示（worker_review_status='COMPLETED' が1件以上で非表示）。
 */
export function ApplicationQuotaBanner() {
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = await getUserApplicationQuota();
        if (!cancelled) setQuota(q);
      } catch (error) {
        console.error('[ApplicationQuotaBanner] Failed to fetch quota:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quota?.isBeginner) return null;

  return (
    <div className="px-3 pt-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800">
          <div className="font-semibold mb-0.5">
            応募可能件数：あと {quota.remaining} 件
            <span className="text-blue-600 font-normal ml-1">
              （同時応募は最大 {quota.limit} 件まで）
            </span>
          </div>
          <div className="text-blue-700">
            勤務実績のないワーカーは応募件数に上限があります。1件勤務を完了し、施設へのレビューを送信すると上限は解除されます。
          </div>
        </div>
      </div>
    </div>
  );
}
