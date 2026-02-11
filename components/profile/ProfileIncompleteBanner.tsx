'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getMissingProfileFields } from '@/src/lib/actions';

/**
 * プロフィール未入力リマインドバナー
 * 表示条件:
 * - ログイン済みのワーカー
 * - 応募に必要なプロフィール項目に未入力がある
 * - 閉じボタンなし（完成するまで常時表示）
 */
export function ProfileIncompleteBanner() {
  const { data: session } = useSession();
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const result = await getMissingProfileFields();
        setMissingFields(result.missingFields);
        setMissingCount(result.missingCount);
      } catch (error) {
        console.error('[ProfileIncompleteBanner] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session?.user?.id]);

  // ログインしていない、ロード中、またはプロフィール完成済みの場合は非表示
  if (!session?.user?.id || loading || missingCount === 0) return null;

  // 表示する未入力項目（最大3つ + "など"）
  const displayFields = missingFields.slice(0, 3).join('、');
  const hasMore = missingFields.length > 3;

  return (
    <Link
      href="/mypage/profile"
      className="block bg-amber-50 border-b border-amber-200 px-4 py-2.5 hover:bg-amber-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            応募に必要なプロフィールが未入力です
          </p>
          <p className="text-xs text-amber-600 truncate">
            {displayFields}{hasMore ? ` など${missingCount}項目` : ` (${missingCount}項目)`}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
      </div>
    </Link>
  );
}
