'use client';

/**
 * 出退勤リーダーページ
 * QRコードスキャン + 緊急時番号入力対応
 */

import { Suspense, useEffect, useState, useRef, useCallback, Component, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

// Error Boundary for iOS Safari routing issues
class AttendanceErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('AttendanceErrorBoundary caught error:', error);
    // parallelRoutes エラーの場合はリロードで回復
    if (error.message?.includes('parallelRoutes')) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
import { Html5Qrcode } from 'html5-qrcode';
import {
  CheckCircle,
  XCircle,
  QrCode as QrCodeIcon,
  Camera,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EmergencyCodeInput } from '@/components/attendance/EmergencyCodeInput';
import { CheckOutSelector } from '@/components/attendance/CheckOutSelector';
import { AttendanceStatus } from '@/components/attendance/AttendanceStatus';
import { recordAttendance, getCheckInStatus } from '@/src/lib/actions/attendance';
import type {
  AttendanceMethod,
  CheckOutType,
  AttendanceRecordRequest,
  CheckInStatusResponse,
} from '@/src/types/attendance';
import { EMERGENCY_CODE_MAX_ERRORS } from '@/src/constants/attendance-errors';

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error' | 'checkout_select' | 'processing';
type AttendanceType = 'check_in' | 'check_out';

function AttendanceScanPageContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('check_in');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 出勤状態
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatusResponse | null>(null);

  // 緊急番号関連
  const [showEmergencyInput, setShowEmergencyInput] = useState(false);
  const [emergencyErrorCount, setEmergencyErrorCount] = useState(0);
  const [isEmergencyLocked, setIsEmergencyLocked] = useState(false);

  // 退勤選択関連
  const [pendingQrData, setPendingQrData] = useState<{
    facilityId: number;
    qrToken?: string;
    method: AttendanceMethod;
  } | null>(null);
  const [scheduledTime, setScheduledTime] = useState<{
    startTime: string;
    endTime: string;
    breakTime: number;
  } | null>(null);

  // 結果メッセージ
  const [resultMessage, setResultMessage] = useState('');

  // 出勤状態を確認
  const fetchCheckInStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const status = await getCheckInStatus();
      setCheckInStatus(status);

      // 出勤中なら退勤モードに切り替え
      if (status.isCheckedIn) {
        setAttendanceType('check_out');
      }
    } catch (error) {
      console.error('出勤状態の取得に失敗:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    fetchCheckInStatus();

    // ブラウザの戻るボタン対策: ページ離脱時にカメラを停止
    const handleBeforeUnload = () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };

    // popstateイベント（ブラウザの戻る/進むボタン）対策
    const handlePopState = () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setIsScanning(false);
      setScanStatus('idle');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isAuthenticated, isLoading, router, fetchCheckInStatus]);

  // QRコードスキャン開始（状態を変更してDOMを準備）
  const startScanning = () => {
    setIsScanning(true);
    setScanStatus('scanning');
  };

  // DOMが準備された後にスキャナーを初期化
  useEffect(() => {
    if (scanStatus !== 'scanning' || !isScanning) return;

    // DOM要素が確実に存在するまで待機
    const initScanner = async () => {
      // 次のフレームまで待機してDOMの更新を確実にする
      await new Promise(resolve => requestAnimationFrame(resolve));

      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) {
        console.error('QRリーダー要素が見つかりません');
        toast.error('スキャナーの初期化に失敗しました');
        setScanStatus('error');
        setIsScanning(false);
        return;
      }

      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            console.log('[Attendance] QR code scanned:', decodedText);

            // スキャナーを停止（非同期で実行、完了を待たない）
            if (scannerRef.current) {
              scannerRef.current.stop().catch(console.error);
              scannerRef.current = null;
            }
            setIsScanning(false);

            // QRコードデータを検証: attendance:{facilityId}:{secretToken}
            if (decodedText.startsWith('attendance:')) {
              const parts = decodedText.split(':');
              if (parts.length >= 2) {
                const facilityId = parseInt(parts[1]);
                const qrToken = parts[2] || undefined;

                console.log('[Attendance] Valid QR, calling handleQRScan');
                // 非同期処理を開始（コールバックをブロックしない）
                handleQRScan(facilityId, qrToken).catch((error) => {
                  console.error('[Attendance] handleQRScan error:', error);
                  setScanStatus('error');
                  toast.error('出退勤の記録に失敗しました');
                  setTimeout(() => setScanStatus('idle'), 3000);
                });
              } else {
                setScanStatus('error');
                toast.error('無効なQRコードです');
                setTimeout(() => setScanStatus('idle'), 3000);
              }
            } else {
              setScanStatus('error');
              toast.error('無効なQRコードです');
              setTimeout(() => setScanStatus('idle'), 3000);
            }
          },
          (errorMessage) => {
            // スキャン中の一時的なエラーはデバッグログのみ
            if (!errorMessage.includes('No MultiFormat Readers')) {
              console.debug('QR scan error:', errorMessage);
            }
          }
        );
      } catch (error) {
        console.error('カメラ起動エラー:', error);
        toast.error('カメラの起動に失敗しました');
        setScanStatus('error');
        setIsScanning(false);
      }
    };

    initScanner();

    // クリーンアップ
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [scanStatus, isScanning]);

  // スキャン停止
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

  // QRコードスキャン処理
  const handleQRScan = async (facilityId: number, qrToken?: string) => {
    console.log('[Attendance] handleQRScan called', { facilityId, attendanceType });

    if (attendanceType === 'check_in') {
      // 出勤処理
      console.log('[Attendance] Processing check_in');
      await processAttendance({
        type: 'check_in',
        method: 'QR',
        facilityId,
        qrToken,
      });
    } else {
      // 退勤の場合は選択画面を表示
      console.log('[Attendance] Setting checkout_select status');
      setPendingQrData({ facilityId, qrToken, method: 'QR' });
      setScanStatus('checkout_select');
      console.log('[Attendance] checkout_select status set');
    }
  };

  // 緊急番号入力処理
  const handleEmergencyCode = async (code: string) => {
    if (attendanceType === 'check_in') {
      await processAttendance({
        type: 'check_in',
        method: 'EMERGENCY_CODE',
        emergencyCode: code,
      });
    } else {
      // 退勤の場合は選択画面を表示
      setPendingQrData({ facilityId: 0, method: 'EMERGENCY_CODE' });
      setScanStatus('checkout_select');
    }
  };

  // 退勤タイプ選択
  const handleCheckOutTypeSelect = async (checkOutType: CheckOutType) => {
    if (!pendingQrData) return;

    await processAttendance({
      type: 'check_out',
      method: pendingQrData.method,
      facilityId: pendingQrData.facilityId || undefined,
      qrToken: pendingQrData.qrToken,
      checkOutType,
    });
  };

  // 出退勤処理
  const processAttendance = async (
    params: Partial<AttendanceRecordRequest> & { type: 'check_in' | 'check_out' }
  ) => {
    console.log('[Attendance] processAttendance called', params);
    // 処理中状態を表示
    setScanStatus('processing');
    console.log('[Attendance] Status set to processing');

    try {
      // 位置情報を取得
      let latitude: number | undefined;
      let longitude: number | undefined;

      // 位置情報取得（タイムアウト3秒に短縮、iOS Safariでの許可待ちを考慮）
      if (navigator.geolocation) {
        try {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
                resolve();
              },
              () => resolve(), // エラー時も続行
              { timeout: 3000, maximumAge: 60000 } // 3秒タイムアウト、1分以内のキャッシュを許可
            );
          });
        } catch {
          // 位置情報取得失敗時も続行
        }
      }

      console.log('[Attendance] Calling recordAttendance API...');
      const response = await recordAttendance({
        type: params.type,
        method: params.method || 'QR',
        facilityId: params.facilityId,
        qrToken: params.qrToken,
        emergencyCode: params.emergencyCode,
        latitude,
        longitude,
        checkOutType: params.checkOutType,
      });
      console.log('[Attendance] recordAttendance response:', response);

      if (response.success) {
        setScanStatus('success');
        setResultMessage(response.message);
        toast.success(response.message);

        // 緊急番号エラーカウントをリセット
        setEmergencyErrorCount(0);

        // 退勤で勤怠変更申請が必要な場合
        // iOS Safari対策: router.pushではなくwindow.location.hrefを使用
        if (params.type === 'check_out' && response.requiresModification) {
          setTimeout(() => {
            window.location.href = `/attendance/modify?attendanceId=${response.attendanceId}`;
          }, 2000);
        } else {
          setTimeout(() => {
            setScanStatus('idle');
            window.location.href = '/mypage/applications';
          }, 2000);
        }
      } else {
        handleAttendanceError(response.message, params.method);
      }
    } catch (error) {
      console.error('出退勤記録エラー:', error);
      setScanStatus('error');
      toast.error('出退勤の記録に失敗しました');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  // エラーハンドリング
  const handleAttendanceError = (message: string, method?: AttendanceMethod) => {
    if (method === 'EMERGENCY_CODE') {
      const newCount = emergencyErrorCount + 1;
      setEmergencyErrorCount(newCount);

      if (newCount >= EMERGENCY_CODE_MAX_ERRORS) {
        setIsEmergencyLocked(true);
      }
    }

    setScanStatus('error');
    toast.error(message);
    setTimeout(() => setScanStatus('idle'), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">認証情報を確認中...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-[#66cc99] text-white p-6">
        <h1 className="text-2xl font-bold mb-2">出退勤記録</h1>
        <p className="text-sm opacity-90">QRコードをスキャンしてください</p>
      </div>

      <div className="max-w-lg mx-auto p-6">
        {/* 出勤状態表示 */}
        {checkInStatus && <AttendanceStatus status={checkInStatus} />}

        {/* 出勤/退勤 切り替え */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAttendanceType('check_in')}
              disabled={checkInStatus?.isCheckedIn}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                attendanceType === 'check_in'
                  ? 'bg-[#66cc99] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${checkInStatus?.isCheckedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              出勤
            </button>
            <button
              onClick={() => setAttendanceType('check_out')}
              disabled={!checkInStatus?.isCheckedIn}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                attendanceType === 'check_out'
                  ? 'bg-[#66cc99] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${!checkInStatus?.isCheckedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              退勤
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {/* QRリーダー / 退勤選択 */}
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
                style={{ width: '100%', maxHeight: '300px' }}
              />
              <button
                onClick={stopScanning}
                className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                キャンセル
              </button>
            </div>
          )}

          {scanStatus === 'checkout_select' && (
            <CheckOutSelector
              isLate={checkInStatus?.isLate || false}
              usedEmergencyCode={
                checkInStatus?.usedEmergencyCode ||
                pendingQrData?.method === 'EMERGENCY_CODE'
              }
              onSelect={handleCheckOutTypeSelect}
              scheduledTime={scheduledTime || undefined}
            />
          )}

          {scanStatus === 'processing' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#66cc99] border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-gray-800">処理中...</p>
              <p className="text-sm text-gray-500 mt-2">位置情報を取得しています</p>
            </div>
          )}

          {scanStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-gray-800">{resultMessage}</p>
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

        {/* 緊急時番号入力 */}
        {(scanStatus === 'idle' || scanStatus === 'scanning') && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <button
              onClick={() => setShowEmergencyInput(!showEmergencyInput)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-sm text-gray-600">
                QRコードが読み取れない場合
              </span>
              {showEmergencyInput ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showEmergencyInput && (
              <div className="px-4 pb-4 border-t">
                <div className="pt-4">
                  <EmergencyCodeInput
                    onSubmit={handleEmergencyCode}
                    onError={(error) => toast.error(error)}
                    disabled={isScanning}
                    errorCount={emergencyErrorCount}
                    isLocked={isEmergencyLocked}
                  />
                </div>
              </div>
            )}
          </div>
        )}

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

// Suspense + ErrorBoundary でラップしてエクスポート
export default function AttendanceScanPage() {
  const suspenseFallback = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">ページを読み込み中...</div>
    </div>
  );

  const errorFallback = (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <div className="text-red-500">エラーが発生しました</div>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-[#66cc99] text-white rounded-lg"
      >
        再読み込み
      </button>
    </div>
  );

  return (
    <AttendanceErrorBoundary fallback={errorFallback}>
      <Suspense fallback={suspenseFallback}>
        <AttendanceScanPageContent />
      </Suspense>
    </AttendanceErrorBoundary>
  );
}
