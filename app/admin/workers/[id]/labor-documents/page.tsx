'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileText, Download, Mail, Calendar, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { getWorkerBasicInfo } from '@/src/lib/actions';
import { getCurrentTime } from '@/utils/debugTime';
import { useAuth } from '@/contexts/AuthContext';

interface WorkerInfo {
  id: number;
  name: string;
  email: string;
  qualifications: string[];
}

interface ApiResponse {
  success?: boolean;
  token?: string;
  downloadUrl?: string;
  expiresAt?: string;
  facilityName?: string;
  message?: string;
  error?: string;
}

export default function WorkerLaborDocumentsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const workerId = parseInt(id);

  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // フォーム状態（デフォルト: 開始=先月の年の1/1、終了=先月末）
  const [startDate, setStartDate] = useState(() => {
    const now = getCurrentTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 先月の1日
    return `${lastMonth.getFullYear()}-01-01`; // 先月が属する年の1/1
  });
  const [endDate, setEndDate] = useState(() => {
    const now = getCurrentTime();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // 先月末
    // toISOString()はUTC変換で日付がずれるため、ローカルタイムで直接フォーマット
    const year = lastMonthEnd.getFullYear();
    const month = String(lastMonthEnd.getMonth() + 1).padStart(2, '0');
    const day = String(lastMonthEnd.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [includeQualifications, setIncludeQualifications] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダル状態
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [apiError, setApiError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    // 管理者のメールアドレスをデフォルトに設定
    setEmail(admin.email || '');

    const loadWorkerInfo = async () => {
      setLoading(true);
      try {
        const data = await getWorkerBasicInfo(workerId, admin.facilityId);
        if (data) {
          setWorkerInfo(data);
        }
      } catch (error) {
        console.error('Failed to load worker info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkerInfo();
  }, [workerId, admin, isAdmin, isAdminLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!startDate || !endDate) {
      alert('期間を指定してください');
      return;
    }

    if (!email) {
      alert('メールアドレスを入力してください');
      return;
    }

    if (!admin) {
      alert('管理者情報が取得できません');
      return;
    }

    setIsSubmitting(true);

    try {
      // APIを呼び出してダウンロードリクエストを作成
      const response = await fetch('/api/admin/labor-documents/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: admin.id,
          facilityId: admin.facilityId,
          workerId,
          startDate,
          endDate,
          includeQualifications,
          email,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'リクエストに失敗しました');
      }

      if (data.success && data.downloadUrl && data.expiresAt) {
        setDownloadUrl(data.downloadUrl);
        const expiry = new Date(data.expiresAt);
        setExpiryDate(`${expiry.toLocaleDateString('ja-JP')} ${expiry.toLocaleTimeString('ja-JP')}`);

        // モーダルで表示するメール内容を生成（施設名を使用）
        const facilityName = data.facilityName || '施設';
        const emailContent = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【+TASTAS】労働条件通知書ダウンロードのご案内
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${facilityName} 様

労働条件通知書のダウンロード準備が完了しました。

■ 対象ワーカー
${workerInfo?.name || ''}

■ 対象期間
${startDate} 〜 ${endDate}

■ 含まれる内容
・労働条件通知書（PDF形式）
${includeQualifications ? '・資格証明書（PNG形式）' : ''}

■ ダウンロードURL
${data.downloadUrl}

※このURLの有効期限は ${expiry.toLocaleDateString('ja-JP')} ${expiry.toLocaleTimeString('ja-JP')} までです（72時間）

■ ファイル形式
ZIP形式（解凍してご利用ください）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
このメールは +TASTAS から自動送信されています。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        setModalContent(emailContent);
        setShowModal(true);
        setIsProcessing(true);

        // ダウンロード準備完了をポーリングでチェック
        checkDownloadStatus(data.token || '');
      }
    } catch (error) {
      console.error('Failed to request labor documents:', error);
      setApiError(error instanceof Error ? error.message : 'エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ダウンロード準備状況をチェック
  const checkDownloadStatus = async (token: string) => {
    if (!token) return;

    const maxAttempts = 60; // 最大5分間チェック
    let attempts = 0;

    const check = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setIsProcessing(false);
        return;
      }

      try {
        const response = await fetch(`/api/download/labor-docs/${token}`, {
          method: 'HEAD',
        });

        const status = response.headers.get('X-Status');

        if (response.status === 200 || status === 'COMPLETED') {
          setIsProcessing(false);
          return;
        }

        if (response.status === 500 || status === 'FAILED') {
          setIsProcessing(false);
          setApiError('ファイル生成に失敗しました');
          return;
        }

        // まだ処理中の場合は5秒後に再チェック
        setTimeout(check, 5000);
      } catch {
        // エラーでも続行
        setTimeout(check, 5000);
      }
    };

    // 3秒後に最初のチェックを開始
    setTimeout(check, 3000);
  };

  if (loading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-2xl mx-auto p-6">
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-500">読み込み中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/admin/workers/${workerId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            ワーカー詳細に戻る
          </Link>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">{workerInfo?.name}さんの労働条件通知書</h1>
              <p className="text-gray-600 text-sm">期間を指定してダウンロードURLを送信</p>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">エラーが発生しました</p>
              <p className="text-red-600 text-sm">{apiError}</p>
            </div>
          </div>
        )}

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 期間指定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                対象期間
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <span className="text-gray-500">〜</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                指定期間内に勤務完了したものが対象になります
              </p>
            </div>

            {/* 資格証明書オプション */}
            <div className="border-t pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeQualifications}
                  onChange={(e) => setIncludeQualifications(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-700">資格証明書も含める</span>
                  <p className="text-xs text-gray-500">ワーカーの登録済み資格証明書（PNG形式）をZIPに含めます</p>
                </div>
              </label>
            </div>

            {/* メールアドレス */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                送信先メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@facility.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* 送信ボタン */}
            <div className="border-t pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    ダウンロードURLを生成
                  </>
                )}
              </button>
            </div>
          </form>

          {/* 注意事項 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">ご注意</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• ダウンロードURLの有効期限は72時間です</li>
              <li>• 出力ファイルはZIP形式です</li>
              <li>• 労働条件通知書はPDF形式、資格証明書はPNG形式で出力されます</li>
              <li>• 処理完了後にメールでURLをお送りします</li>
            </ul>
          </div>
        </div>

        {/* モーダル */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  <h2 className="text-lg font-bold">
                    {isProcessing ? 'ファイル準備中...' : 'ダウンロード準備完了'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {isProcessing ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">PDFとZIPファイルを生成しています...</p>
                    <p className="text-sm text-gray-500 mt-2">しばらくお待ちください</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 font-medium mb-2">ダウンロード準備が完了しました</p>
                      <p className="text-sm text-green-700">
                        有効期限: {expiryDate}
                      </p>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">ダウンロードURL:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={downloadUrl}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(downloadUrl);
                            alert('URLをコピーしました');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          コピー
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                      以下の内容のメールが <strong>{email}</strong> に送信されます：
                    </p>

                    {/* クリック可能なダウンロードリンク */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">▼ ダウンロードリンク（クリックでアクセス可能）</p>
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                      >
                        {downloadUrl}
                      </a>
                    </div>

                    <pre className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono text-gray-800 border">
                      {modalContent}
                    </pre>
                  </>
                )}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  閉じる
                </button>
                {!isProcessing && (
                  <>
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      今すぐダウンロード
                    </a>
                    <button
                      onClick={() => {
                        console.log('[Mock] Email would be sent to:', email);
                        alert(`メール送信をシミュレートしました。\n送信先: ${email}`);
                        setShowModal(false);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      メールで送信
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
