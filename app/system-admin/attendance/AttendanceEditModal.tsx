'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle, History } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAttendanceDetail,
  recalculateWage,
  updateAttendanceBySystemAdmin,
  type AttendanceDetailForEdit,
} from '@/src/lib/actions/attendance-system-admin';

type Props = {
  isOpen: boolean;
  attendanceId: number | null;
  onClose: () => void;
  onUpdated: () => void;
};

/** ISO文字列からJST "HH:mm" を取得 */
function toJSTTimeString(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

/** ISO文字列からJST "YYYY/MM/DD" を取得 */
function toJSTDateString(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, '0')}/${String(jst.getUTCDate()).padStart(2, '0')}`;
}

/** 勤務日(ISO) + "HH:mm" → JSTベースのISO文字列を生成 */
function buildJSTDateTime(workDateISO: string, timeStr: string): string {
  const workDate = new Date(workDateISO);
  const [h, m] = timeStr.split(':').map(Number);
  // workDateをJST日付として解釈（+9hしてからUTCゲッターで取得）
  const jstDate = new Date(workDate.getTime() + 9 * 60 * 60 * 1000);
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();
  // JST HH:mm → UTC に変換（-9h）
  const utc = new Date(Date.UTC(year, month, day, h - 9, m, 0, 0));
  return utc.toISOString();
}

/** 終了時刻用: 開始より前なら翌日として組み立て（日跨ぎシフト対応） */
function buildJSTEndDateTime(workDateISO: string, startTimeStr: string, endTimeStr: string): string {
  const startISO = buildJSTDateTime(workDateISO, startTimeStr);
  const endISO = buildJSTDateTime(workDateISO, endTimeStr);
  // 終了が開始より前なら翌日（+24h）
  if (new Date(endISO) <= new Date(startISO)) {
    const endDate = new Date(endISO);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    return endDate.toISOString();
  }
  return endISO;
}

export default function AttendanceEditModal({
  isOpen,
  attendanceId,
  onClose,
  onUpdated,
}: Props) {
  const [detail, setDetail] = useState<AttendanceDetailForEdit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編集フォーム
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [breakTime, setBreakTime] = useState(0);
  const [wage, setWage] = useState(0);
  const [wageManuallySet, setWageManuallySet] = useState(false);
  const [status, setStatus] = useState('CHECKED_OUT');
  const [reason, setReason] = useState('');

  // 自動計算された給与（比較用）
  const [autoCalculatedWage, setAutoCalculatedWage] = useState<number | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!attendanceId) return;
    setLoading(true);
    try {
      const result = await getAttendanceDetail(attendanceId);
      if (result.success && result.data) {
        const d = result.data;
        setDetail(d);
        // フォーム初期値
        if (d.actualStartTime) {
          setActualStart(toJSTTimeString(d.actualStartTime));
        } else if (d.scheduledStartTime) {
          setActualStart(d.scheduledStartTime);
        } else if (d.checkInTime) {
          setActualStart(toJSTTimeString(d.checkInTime));
        }
        if (d.actualEndTime) {
          setActualEnd(toJSTTimeString(d.actualEndTime));
        } else if (d.scheduledEndTime) {
          setActualEnd(d.scheduledEndTime);
        } else if (d.checkOutTime) {
          setActualEnd(toJSTTimeString(d.checkOutTime));
        }
        setBreakTime(d.actualBreakTime ?? d.scheduledBreakTime ?? 0);
        setWage(d.calculatedWage ?? 0);
        setAutoCalculatedWage(d.calculatedWage ?? null);
        setWageManuallySet(false);
        setStatus(d.status);
        setReason('');
      } else {
        toast.error(result.message ?? 'データ取得に失敗しました');
        onClose();
      }
    } catch {
      toast.error('データ取得に失敗しました');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [attendanceId, onClose]);

  useEffect(() => {
    if (isOpen && attendanceId) {
      fetchDetail();
    }
  }, [isOpen, attendanceId, fetchDetail]);

  // Escキーで閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirm) {
          setShowConfirm(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, showConfirm, onClose]);

  const handleRecalculate = async () => {
    if (!detail) return;
    if (!actualStart || !actualEnd) {
      toast.error('開始・終了時刻を入力してください');
      return;
    }
    const startISO = buildJSTDateTime(detail.workDate, actualStart);
    const endISO = buildJSTEndDateTime(detail.workDate, actualStart, actualEnd);
    const result = await recalculateWage(detail.id, startISO, endISO, breakTime);
    if (result.success && result.wage !== undefined) {
      setWage(result.wage);
      setAutoCalculatedWage(result.wage);
      setWageManuallySet(false);
      toast.success(`再計算結果: ¥${result.wage.toLocaleString()}`);
    } else {
      toast.error(result.message ?? '再計算に失敗しました');
    }
  };

  const handleWageChange = (value: number) => {
    setWage(value);
    setWageManuallySet(autoCalculatedWage !== null && value !== autoCalculatedWage);
  };

  const handleSave = async () => {
    if (!detail) return;
    if (!actualStart || !actualEnd) {
      toast.error('開始・終了時刻を入力してください');
      return;
    }
    if (!reason.trim()) {
      toast.error('変更理由を入力してください');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!detail) return;
    setSaving(true);
    setShowConfirm(false);
    try {
      const startISO = buildJSTDateTime(detail.workDate, actualStart);
      const endISO = buildJSTEndDateTime(detail.workDate, actualStart, actualEnd);

      const result = await updateAttendanceBySystemAdmin(detail.id, {
        actualStartTime: startISO,
        actualEndTime: endISO,
        actualBreakTime: breakTime,
        calculatedWage: wage,
        wageManuallySet,
        status,
        reason: reason.trim(),
      });

      if (result.success) {
        toast.success(result.message);
        onUpdated();
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-slate-800">勤怠編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg"
            aria-label="閉じる"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            読み込み中...
          </div>
        ) : detail ? (
          <div className="p-4 space-y-5">
            {/* 基本情報 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">基本情報</h3>
              <div className="grid grid-cols-2 gap-2 text-sm bg-slate-50 rounded-lg p-3">
                <div>
                  <span className="text-slate-400">ワーカー:</span>{' '}
                  <span className="font-medium">{detail.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400">施設:</span>{' '}
                  <span className="font-medium">{detail.facilityName}</span>
                </div>
                <div>
                  <span className="text-slate-400">求人:</span>{' '}
                  <span className="font-medium">{detail.jobTitle}</span>
                </div>
                <div>
                  <span className="text-slate-400">勤務日:</span>{' '}
                  <span className="font-medium">{toJSTDateString(detail.workDate)}</span>
                </div>
                <div>
                  <span className="text-slate-400">打刻:</span>{' '}
                  <span className="font-medium">
                    出勤 {toJSTTimeString(detail.checkInTime)}
                    {detail.checkOutTime ? ` / 退勤 ${toJSTTimeString(detail.checkOutTime)}` : ' / 退勤 未'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">予定:</span>{' '}
                  <span className="font-medium">
                    {detail.scheduledStartTime ?? '-'}〜{detail.scheduledEndTime ?? '-'}
                    {detail.scheduledBreakTime != null ? `（休憩${detail.scheduledBreakTime}分）` : ''}
                  </span>
                </div>
                {detail.hourlyWage && (
                  <div>
                    <span className="text-slate-400">時給:</span>{' '}
                    <span className="font-medium">¥{detail.hourlyWage.toLocaleString()}</span>
                  </div>
                )}
                {detail.transportationFee != null && detail.transportationFee > 0 && (
                  <div>
                    <span className="text-slate-400">交通費:</span>{' '}
                    <span className="font-medium">¥{detail.transportationFee.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </section>

            {/* ステータス */}
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">ステータス</h3>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="CHECKED_IN">出勤中</option>
                <option value="CHECKED_OUT">退勤済み</option>
              </select>
            </section>

            {/* 実績時間 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">実績時間</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">開始</label>
                  <input
                    type="time"
                    value={actualStart}
                    onChange={(e) => setActualStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">終了</label>
                  <input
                    type="time"
                    value={actualEnd}
                    onChange={(e) => setActualEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">休憩（分）</label>
                  <input
                    type="number"
                    min={0}
                    value={breakTime}
                    onChange={(e) => setBreakTime(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* 給与 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">給与</h3>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">確定額（円）</label>
                  <input
                    type="number"
                    min={0}
                    value={wage}
                    onChange={(e) => handleWageChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRecalculate}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 whitespace-nowrap"
                >
                  <RefreshCw className="w-4 h-4 inline mr-1" />
                  再計算
                </button>
              </div>
              {wageManuallySet && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  手動で変更されています（自動計算: ¥{autoCalculatedWage?.toLocaleString()}）
                </p>
              )}
            </section>

            {/* 変更理由 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                変更理由 <span className="text-red-500">*</span>
              </h3>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="変更理由を入力してください（必須）"
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </section>

            {/* 変更申請情報 */}
            {detail.modificationRequest && (
              <section>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">ワーカー変更申請</h3>
                <div className="bg-amber-50 rounded-lg p-3 text-sm space-y-1">
                  <div>
                    <span className="text-slate-400">ステータス:</span>{' '}
                    <span className="font-medium">{detail.modificationRequest.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">申請内容:</span>{' '}
                    {toJSTTimeString(detail.modificationRequest.requestedStartTime)}〜
                    {toJSTTimeString(detail.modificationRequest.requestedEndTime)}
                    （休憩{detail.modificationRequest.requestedBreakTime}分）
                  </div>
                  <div>
                    <span className="text-slate-400">コメント:</span>{' '}
                    {detail.modificationRequest.workerComment}
                  </div>
                  <div>
                    <span className="text-slate-400">金額:</span>{' '}
                    ¥{detail.modificationRequest.originalAmount.toLocaleString()} → ¥{detail.modificationRequest.requestedAmount.toLocaleString()}
                  </div>
                </div>
              </section>
            )}

            {/* 編集履歴 */}
            {detail.editHistories.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1">
                  <History className="w-4 h-4" />
                  編集履歴
                </h3>
                <div className="space-y-2">
                  {detail.editHistories.map((h) => (
                    <div key={h.id} className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                      <div className="text-slate-400">
                        {toJSTDateString(h.createdAt)} {toJSTTimeString(h.createdAt)} - {h.editedBy}
                        {h.wageManuallySet && (
                          <span className="ml-1 text-amber-600">（給与手動設定）</span>
                        )}
                      </div>
                      <div>
                        {h.prevActualStartTime && h.newActualStartTime && (
                          <span className="mr-3">
                            開始: {toJSTTimeString(h.prevActualStartTime)}→{toJSTTimeString(h.newActualStartTime)}
                          </span>
                        )}
                        {h.prevActualEndTime && h.newActualEndTime && (
                          <span className="mr-3">
                            終了: {toJSTTimeString(h.prevActualEndTime)}→{toJSTTimeString(h.newActualEndTime)}
                          </span>
                        )}
                        {h.prevActualBreakTime != null && h.newActualBreakTime != null && (
                          <span className="mr-3">
                            休憩: {h.prevActualBreakTime}→{h.newActualBreakTime}分
                          </span>
                        )}
                        {h.prevCalculatedWage != null && h.newCalculatedWage != null && (
                          <span>
                            給与: ¥{h.prevCalculatedWage.toLocaleString()}→¥{h.newCalculatedWage.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500">理由: {h.reason}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* フッターボタン */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !reason.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-bold text-slate-800 mb-2">変更を保存しますか？</h3>
            <p className="text-sm text-slate-500 mb-4">
              この操作は編集履歴に記録されます。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
