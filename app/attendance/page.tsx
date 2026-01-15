'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle, XCircle, QrCode as QrCodeIcon, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error';
type AttendanceType = 'check_in' | 'check_out';

export default function AttendanceScanPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanResult, setScanResult] = useState<string>('');
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('check_in');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // カメラ権限をチェック
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((result) => {
        setCameraPermission(result.state as any);
      });
    }

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isAuthenticated, isLoading, router, isScanning]);

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setScanStatus('scanning');

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // QRコードを読み取った
          setScanResult(decodedText);

          // スキャンを停止
          if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
          }

          // QRコードデータを検証
          if (decodedText.startsWith('attendance:')) {
            // Server Actionを呼び出して出退勤を記録
            await handleAttendance(decodedText);
          } else {
            setScanStatus('error');
            toast.error('無効なQRコードです');
            setTimeout(() => setScanStatus('idle'), 3000);
          }
        },
        (errorMessage) => {
          // スキャンエラー（通常のエラーなので無視）
          console.debug('QR scan error:', errorMessage);
        }
      );
    } catch (error) {
      console.error('カメラ起動エラー:', error);
      toast.error('カメラの起動に失敗しました');
      setScanStatus('error');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
        setScanStatus('idle');
      } catch (error) {
        console.error('スキャン停止エラー:', error);
      }
    }
  };

  const handleAttendance = async (qrData: string) => {
    try {
      // QRデータを解析: attendance:{facilityId}:{timestamp}
      const parts = qrData.split(':');
      if (parts.length !== 3 || parts[0] !== 'attendance') {
        throw new Error('Invalid QR format');
      }

      const facilityId = parseInt(parts[1]);

      // 位置情報を取得
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              latitude = position.coords.latitude;
              longitude = position.coords.longitude;
              resolve();
            },
            () => {
              // 位置情報取得失敗時も続行
              resolve();
            }
          );
        });
      }

      // Server Actionを呼び出す（後で実装）
      const response = await fetch('/api/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          facilityId,
          type: attendanceType,
          latitude,
          longitude,
        }),
      });

      if (response.ok) {
        setScanStatus('success');
        toast.success(
          attendanceType === 'check_in' ? '出勤を記録しました' : '退勤を記録しました'
        );
        setTimeout(() => {
          setScanStatus('idle');
          router.push('/');
        }, 2000);
      } else {
        throw new Error('Failed to record attendance');
      }
    } catch (error) {
      console.error('出退勤記録エラー:', error);
      setScanStatus('error');
      toast.error('出退勤の記録に失敗しました');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[#66cc99] text-white p-6">
        <h1 className="text-2xl font-bold mb-2">出退勤記録</h1>
        <p className="text-sm opacity-90">QRコードをスキャンしてください</p>
      </div>

      <div className="max-w-lg mx-auto p-6">
        {/* 出勤/退勤 切り替え */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAttendanceType('check_in')}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                attendanceType === 'check_in'
                  ? 'bg-[#66cc99] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              出勤
            </button>
            <button
              onClick={() => setAttendanceType('check_out')}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                attendanceType === 'check_out'
                  ? 'bg-[#66cc99] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              退勤
            </button>
          </div>
        </div>

        {/* QRリーダー */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {scanStatus === 'idle' && !isScanning && (
            <div className="text-center">
              <div className="mb-6">
                <QrCodeIcon className="w-24 h-24 mx-auto text-gray-300" />
              </div>
              <button
                onClick={startScanning}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#66cc99] hover:bg-[#55bb88] text-white font-medium rounded-lg transition-colors"
              >
                <Camera className="w-5 h-5" />
                QRコードをスキャン
              </button>
            </div>
          )}

          {scanStatus === 'scanning' && (
            <div>
              <div
                id="qr-reader"
                className="rounded-lg overflow-hidden mb-4"
                style={{ width: '100%' }}
              />
              <button
                onClick={stopScanning}
                className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          )}

          {scanStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-800">
                {attendanceType === 'check_in' ? '出勤を記録しました' : '退勤を記録しました'}
              </p>
            </div>
          )}

          {scanStatus === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
              <p className="text-lg font-medium text-gray-800 mb-4">
                記録に失敗しました
              </p>
              <button
                onClick={() => setScanStatus('idle')}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                戻る
              </button>
            </div>
          )}
        </div>

        {/* 使い方 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-bold text-blue-800 mb-2">使い方</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>「出勤」または「退勤」を選択してください</li>
            <li>「QRコードをスキャン」ボタンをタップ</li>
            <li>施設に掲示されているQRコードをカメラでスキャン</li>
            <li>自動的に出退勤が記録されます</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
