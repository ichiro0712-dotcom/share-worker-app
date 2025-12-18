'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileText, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CertificateData {
  workerId: number;
  workerName: string;
  qualifications: string[];
  qualificationCertificates: Record<string, string>;
}

export default function WorkerCertificatesPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(params.id);
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const loadCertificates = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/workers/${workerId}/certificates`);
        if (!response.ok) {
          throw new Error('資格証明書の取得に失敗しました');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Failed to load certificates:', err);
        setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadCertificates();
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

  const certificates = Object.entries(data.qualificationCertificates || {});

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
          <h1 className="text-lg font-bold text-gray-900">資格証明書</h1>
          <p className="text-sm text-gray-500">{data.workerName}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        {/* 保有資格一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">保有資格</h2>
          {data.qualifications.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.qualifications.map((qual, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg"
                >
                  {qual}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">資格情報なし</p>
          )}
        </div>

        {/* 資格証明書一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">資格証明書画像</h2>
          {certificates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.map(([qualification, imageUrl]) => (
                <div
                  key={qualification}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      {qualification}
                    </h3>
                  </div>
                  <div className="p-4">
                    {imageUrl ? (
                      <div className="space-y-3">
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={imageUrl}
                            alt={`${qualification}の証明書`}
                            className="w-full h-48 object-contain bg-gray-100 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-center py-8 text-gray-400 text-sm">
                            画像を読み込めませんでした
                          </div>
                        </a>
                        <div className="flex gap-2">
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            新しいタブで開く
                          </a>
                          <a
                            href={imageUrl}
                            download
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        証明書画像が登録されていません
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                資格証明書画像は登録されていません
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
