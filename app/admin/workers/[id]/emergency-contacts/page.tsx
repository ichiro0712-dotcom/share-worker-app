'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Phone, User, MapPin, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface EmergencyContactData {
  workerId: number;
  workerName: string;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  emergencyAddress: string | null;
}

export default function WorkerEmergencyContactsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [data, setData] = useState<EmergencyContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadEmergencyContacts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/workers/${workerId}/emergency-contacts`);
        if (!response.ok) {
          throw new Error('緊急連絡先の取得に失敗しました');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load emergency contacts:', err);
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadEmergencyContacts();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  if (loading || isAdminLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">ワーカーが見つかりません</p>
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  const hasEmergencyContact = data.emergencyName || data.emergencyPhone || data.emergencyRelation || data.emergencyAddress;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">緊急連絡先</h1>
          <p className="text-sm text-gray-500">{data.workerName}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {hasEmergencyContact ? (
            <div className="divide-y divide-gray-100">
              {/* 氏名 */}
              <div className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">氏名</div>
                  <div className="text-sm font-medium text-gray-900">
                    {data.emergencyName || <span className="text-gray-400">未登録</span>}
                  </div>
                </div>
              </div>

              {/* 続柄 */}
              <div className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">続柄</div>
                  <div className="text-sm font-medium text-gray-900">
                    {data.emergencyRelation || <span className="text-gray-400">未登録</span>}
                  </div>
                </div>
              </div>

              {/* 電話番号 */}
              <div className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">電話番号</div>
                  {data.emergencyPhone ? (
                    <a
                      href={`tel:${data.emergencyPhone}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {data.emergencyPhone}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">未登録</span>
                  )}
                </div>
              </div>

              {/* 住所 */}
              <div className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">住所</div>
                  <div className="text-sm font-medium text-gray-900">
                    {data.emergencyAddress || <span className="text-gray-400">未登録</span>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                緊急連絡先が登録されていません
              </p>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href={`/admin/workers/${workerId}`}
            className="text-blue-500 hover:underline text-sm"
          >
            ← ワーカー詳細に戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
