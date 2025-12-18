'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Printer, Download } from 'lucide-react';

export default function AttendanceQRPage() {
  const { admin, isAdminLoggedIn } = useAuth();
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [facilityName, setFacilityName] = useState<string>('');

  useEffect(() => {
    if (!isAdminLoggedIn) {
      router.push('/admin/login');
      return;
    }

    if (!admin?.facilityId) {
      return;
    }

    // 施設情報を取得（ここでは仮で施設IDを使用）
    setFacilityName(`施設 ${admin.facilityId}`);

    // QRコードのデータを生成
    // 形式: attendance:{facilityId}:{timestamp}
    const timestamp = Date.now();
    const qrData = `attendance:${admin.facilityId}:${timestamp}`;

    // QRコードを生成
    QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrDataUrl);
  }, [admin, isAdminLoggedIn, router]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `attendance-qr-facility-${admin?.facilityId}.png`;
    link.click();
  };

  if (!isAdminLoggedIn || !admin) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 画面表示用 */}
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          出退勤QRコード
        </h1>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex flex-col items-center">
            <p className="text-gray-600 mb-4">
              ワーカーはこのQRコードをスキャンして出退勤を記録します
            </p>

            {qrDataUrl && (
              <div className="bg-white p-6 rounded-xl border-2 border-gray-200 inline-block mb-6">
                <img
                  src={qrDataUrl}
                  alt="出退勤QRコード"
                  className="w-96 h-96"
                />
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 mb-6 w-full max-w-md">
              <p className="text-sm text-gray-500 mb-1">施設名</p>
              <p className="text-lg font-medium text-gray-800">
                {facilityName}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-3 bg-[#66cc99] hover:bg-[#55bb88] text-white font-medium rounded-lg transition-colors"
              >
                <Printer className="w-5 h-5" />
                印刷する
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
                ダウンロード
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 mb-2">使い方</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>このQRコードを印刷または保存してください</li>
            <li>施設の受付や休憩室など、ワーカーが見やすい場所に掲示してください</li>
            <li>ワーカーは出勤時・退勤時にスマートフォンでQRコードをスキャンします</li>
            <li>出退勤記録は自動的に保存されます</li>
          </ol>
        </div>
      </div>

      {/* 印刷用 */}
      <div className="hidden print:block">
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            出退勤QRコード
          </h1>
          <p className="text-xl text-gray-600 mb-8">{facilityName}</p>

          {qrDataUrl && (
            <div className="border-4 border-gray-300 p-8">
              <img
                src={qrDataUrl}
                alt="出退勤QRコード"
                className="w-[500px] h-[500px]"
              />
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-lg text-gray-700 font-medium">
              スマートフォンでQRコードをスキャンして
            </p>
            <p className="text-lg text-gray-700 font-medium">
              出退勤を記録してください
            </p>
          </div>
        </div>
      </div>

      {/* 印刷用スタイル */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
