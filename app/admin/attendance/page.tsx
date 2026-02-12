'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { regenerateQRCode } from '@/src/lib/actions/attendance-admin';

interface FacilityData {
  id: number;
  facility_name: string;
  emergency_attendance_code: string | null;
  qr_secret_token: string | null;
  qr_generated_at: string | null;
}

export default function AttendanceQRPrintPage() {
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [contactQrDataUrl, setContactQrDataUrl] = useState<string>('');
  const [facilityName, setFacilityName] = useState<string>('');
  const [emergencyCode, setEmergencyCode] = useState<string>('');
  const [showEmergencyNumber, setShowEmergencyNumber] = useState<boolean>(true);
  const [isReissuing, setIsReissuing] = useState<boolean>(false);

  // QRコードを生成する関数
  const generateQR = useCallback(async (facilityId: number, token: string) => {
    // QRコードデータ: facility:{施設ID}:{トークン}
    const qrData = `attendance:${facilityId}:${token}`;

    const dataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    setQrDataUrl(dataUrl);
  }, []);

  useEffect(() => {
    if (isAdminLoading) return;

    if (!isAdmin) {
      router.push('/admin/login');
      return;
    }

    if (!admin?.facilityId) {
      return;
    }

    // 施設情報を取得
    const fetchFacility = async () => {
      try {
        console.log('[AttendanceQR] Fetching facility, adminFacilityId:', admin.facilityId);
        const response = await fetch(`/api/admin/facility?facilityId=${admin.facilityId}`);
        console.log('[AttendanceQR] Response status:', response.status);
        if (response.ok) {
          const facility: FacilityData = await response.json();
          console.log('[AttendanceQR] Facility data:', facility);
          console.log('[AttendanceQR] Emergency code from API:', facility.emergency_attendance_code);
          setFacilityName(facility.facility_name || `施設 ${admin.facilityId}`);
          setEmergencyCode(facility.emergency_attendance_code || '----');

          // QRコードを生成
          if (facility.qr_secret_token) {
            await generateQR(admin.facilityId, facility.qr_secret_token);
          } else {
            // トークンがない場合は施設IDのみでQRコードを生成（後方互換性）
            const timestamp = Date.now();
            const qrData = `attendance:${admin.facilityId}:${timestamp}`;
            const dataUrl = await QRCode.toDataURL(qrData, {
              width: 200,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF',
              },
            });
            setQrDataUrl(dataUrl);
          }
        } else {
          setFacilityName(`施設 ${admin.facilityId}`);
          setEmergencyCode('----');
        }
      } catch (error) {
        console.error('Failed to fetch facility:', error);
        setFacilityName(`施設 ${admin.facilityId}`);
        setEmergencyCode('----');
      }
    };

    fetchFacility();

    // お問い合わせQRコードを生成
    QRCode.toDataURL('https://share-worker-app.vercel.app/contact', {
      width: 100,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setContactQrDataUrl);
  }, [admin, isAdmin, isAdminLoading, router, generateQR]);

  const handlePrint = () => {
    window.print();
  };

  const handleReissue = async () => {
    if (!admin?.facilityId || isReissuing) return;

    const confirmed = window.confirm(
      'QRコードを再発行しますか？\n\n※緊急時出退勤番号は変更されません。\n※再発行すると、古いQRコードは使用できなくなります。'
    );

    if (!confirmed) return;

    setIsReissuing(true);
    try {
      const result = await regenerateQRCode(admin.facilityId);

      if (result.success && result.qrToken) {
        await generateQR(admin.facilityId, result.qrToken);
        alert('QRコードを再発行しました');
      } else {
        alert(result.message || 'QRコードの再発行に失敗しました');
      }
    } catch (error) {
      console.error('Failed to reissue QR code:', error);
      alert('QRコードの再発行に失敗しました');
    } finally {
      setIsReissuing(false);
    }
  };

  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin || !admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white print:min-h-0">
      {/* 印刷可能エリア */}
      <div id="print-area" className="print-area bg-white max-w-4xl mx-auto print:max-w-none print:m-0">
        {/* 施設名ヘッダー + ロゴ */}
        <div className="relative py-4 border-b-2 border-[#66cc99]">
          {/* 右上ロゴ（印刷時のみ表示） */}
          <div className="hidden print:block absolute top-2 right-4">
            <span className="text-xl font-bold text-[#66cc99]">+タスタス</span>
          </div>
          {/* 施設名（中央） */}
          <h1 className="text-2xl font-bold text-[#66cc99] text-center">{facilityName}</h1>
        </div>

        {/* メインコンテンツ - 2カラム */}
        <div className="grid grid-cols-2 gap-0 border-b">
          {/* 左側: QRコード */}
          <div className="p-6 border-r flex flex-col items-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">出退勤QRコード</h2>

            {qrDataUrl && (
              <div className="border-4 border-[#e6b422] p-4 mb-4">
                <img
                  src={qrDataUrl}
                  alt="出退勤QRコード"
                  className="w-48 h-48"
                />
              </div>
            )}

            <p className="text-sm text-gray-600 mb-2">
              緊急時出退勤番号：<span className="font-bold">{showEmergencyNumber ? emergencyCode : '****'}</span>
            </p>

            {/* トグル */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setShowEmergencyNumber(!showEmergencyNumber)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  showEmergencyNumber ? 'bg-[#66cc99]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    showEmergencyNumber ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-gray-600 whitespace-nowrap">出退勤番号を印刷する</span>
            </div>

            {/* 再発行ボタン */}
            <button
              onClick={handleReissue}
              disabled={isReissuing}
              className="print:hidden text-sm text-[#e6b422] border border-[#e6b422] rounded px-4 py-2 hover:bg-[#e6b422] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReissuing ? '再発行中...' : 'QRコードを再発行'}
            </button>

            <p className="print:hidden text-xs text-gray-500 mt-2 text-center">
              ※緊急時出退勤番号は<br />変更されません
            </p>
          </div>

          {/* 右側: 出退勤方法 */}
          <div className="p-6 bg-[#fff8e6]">
            <h2 className="text-lg font-bold text-gray-800 mb-4">出退勤方法（+タスタスアプリ）</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#e6b422] text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <p className="font-bold text-gray-800">ログイン</p>
                  <p className="text-sm text-gray-600">+タスタスアプリからログイン</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#e6b422] text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <p className="font-bold text-gray-800">仕事管理画面</p>
                  <p className="text-sm text-gray-600">画面下部のメニューから選択</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#e6b422] text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <p className="font-bold text-gray-800">出勤/退勤</p>
                  <p className="text-sm text-gray-600">画面右上の「出勤or退勤」をタップ</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[#e6b422] text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <p className="font-bold text-gray-800">QRコード読取</p>
                  <p className="text-sm text-gray-600">カメラ起動後に左のQRコードを読取</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 勤怠変更申請の説明 */}
        <div className="p-6 border-b">
          <p className="font-bold text-gray-800 mb-1">下記の場合必ず勤怠変更申請が必要です</p>
          <p className="text-sm text-gray-600 mb-4">退勤後に画面の案内にしたがって勤怠変更申請を提出してください</p>

          <div className="grid grid-cols-2 gap-6">
            {/* 左側: テーブル */}
            <div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="border-b-2 border-gray-300 py-2 text-left"></th>
                    <th className="border-b-2 border-gray-300 py-2 text-center">QRコードの読み取り</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">遅刻・早退</td>
                    <td className="py-2 text-center font-bold">必要</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">前残業・後残業・時間変更</td>
                    <td className="py-2 text-center font-bold">必要</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">読み取りエラー</td>
                    <td className="py-2 text-center">不要</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-700">携帯が利用できない</td>
                    <td className="py-2 text-center">不要</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-700">番号での出退勤</td>
                    <td className="py-2 text-center">不要</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 右側: 説明 */}
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-bold text-gray-800">遅刻・早退</p>
                <p className="text-gray-600">実際に出勤or退勤された時間に読み取り</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">前残業・後残業・時間変更</p>
                <p className="text-gray-600">残業後、退勤された時間で読み取り</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">読み取りエラー・携帯が利用できない場合</p>
                <p className="text-gray-600">後ほど利用できる環境で勤怠変更申請を提出</p>
              </div>
              <div>
                <p className="font-bold text-gray-800">読み取り忘れ</p>
                <p className="text-gray-600">出勤時：気付いたタイミングで読み取り<br />退勤時：後ほど勤怠変更申請を提出</p>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-6 bg-[#3a3a4a] text-white flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-[#66cc99] mb-2">+タスタスよりワーカーの皆様へ</h3>
            <p className="text-sm mb-2">本日はご勤務くださり誠にありがとうございます</p>
            <p className="text-sm">
              ご不明な点がありましたら、+タスタスアプリのマイページもしくは右のQRコードから「お問い合わせ」をご覧ください
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <p className="text-sm mb-2">お問い合わせ</p>
            {contactQrDataUrl && (
              <img
                src={contactQrDataUrl}
                alt="お問い合わせQRコード"
                className="w-20 h-20 bg-white p-1"
              />
            )}
          </div>
        </div>

        {/* 印刷ボタン（印刷時は非表示） */}
        <div className="print:hidden p-6 flex justify-center bg-gray-100">
          <button
            onClick={handlePrint}
            className="px-12 py-3 bg-[#3a7bbf] hover:bg-[#2a6baf] text-white font-medium rounded transition-colors"
          >
            印刷
          </button>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style jsx global>{`
        @media print {
          /* 印刷時は全ての要素を非表示にする */
          body * {
            visibility: hidden;
          }

          /* print-areaとその子要素のみ表示 */
          #print-area,
          #print-area * {
            visibility: visible;
          }

          /* print-areaを印刷ページの先頭に配置 */
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }

          /* 背景色を印刷 */
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }

          #print-area,
          #print-area * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* print:hidden クラスは非表示 */
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
    </div>
  );
}
