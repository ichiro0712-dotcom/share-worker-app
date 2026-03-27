'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneNumberInput } from '@/components/ui/PhoneNumberInput';
import { isValidPhoneNumber } from '@/utils/inputValidation';
import toast from 'react-hot-toast';

interface SmsVerificationProps {
  /** 電話番号の値 */
  phoneNumber: string;
  /** 電話番号変更のコールバック */
  onPhoneNumberChange: (phone: string) => void;
  /** 認証成功時のコールバック（JWTトークンを返す） */
  onVerified: (token: string) => void;
  /** 初期状態で認証済みとして表示するか */
  initialVerified?: boolean;
  /** 無効化 */
  disabled?: boolean;
  /** エラー表示（親フォームからのバリデーション） */
  showError?: boolean;
  /** エラーメッセージ（親フォームからのバリデーション） */
  errorMessage?: string;
  /** 入力フィールドのclassName */
  inputClassName?: string;
}

type VerificationState = 'input' | 'codeSent' | 'verified';

// 再送信クールダウン（秒）
const RESEND_COOLDOWN_SECONDS = 60;

export function SmsVerification({
  phoneNumber,
  onPhoneNumberChange,
  onVerified,
  initialVerified = false,
  disabled = false,
  showError = false,
  errorMessage,
  inputClassName,
}: SmsVerificationProps) {
  const [state, setState] = useState<VerificationState>(initialVerified ? 'verified' : 'input');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 認証済みの電話番号を追跡
  const verifiedPhoneRef = useRef<string>(initialVerified ? phoneNumber : '');
  // SMS送信先の電話番号を追跡（codeSent状態でのリセット用）
  const sentPhoneRef = useRef<string>('');

  // initialVerified の変更を追跡
  useEffect(() => {
    if (initialVerified) {
      setState('verified');
      verifiedPhoneRef.current = phoneNumber;
    }
  }, [initialVerified, phoneNumber]);

  // 電話番号が変更されたら認証状態をリセット
  useEffect(() => {
    // 認証済み状態からのリセット
    if (verifiedPhoneRef.current && phoneNumber !== verifiedPhoneRef.current) {
      setState('input');
      setCode('');
      setVerifyError(null);
      verifiedPhoneRef.current = '';
      sentPhoneRef.current = '';
    }
    // コード送信済み状態からのリセット（番号を変えたら入力状態に戻す）
    if (sentPhoneRef.current && phoneNumber !== sentPhoneRef.current) {
      setState('input');
      setCode('');
      setVerifyError(null);
      sentPhoneRef.current = '';
    }
  }, [phoneNumber]);

  // クールダウンタイマー
  useEffect(() => {
    if (cooldownSeconds > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [cooldownSeconds]);

  // 認証コード送信
  const handleSendCode = useCallback(async () => {
    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error('有効な電話番号を入力してください');
      return;
    }

    setIsSending(true);
    setVerifyError(null);

    try {
      const response = await fetch('/api/sms/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'SMS送信に失敗しました');
        return;
      }

      setState('codeSent');
      setCode('');
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      sentPhoneRef.current = phoneNumber;
      toast.success('認証コードを送信しました');
    } catch {
      toast.error('SMS送信中にエラーが発生しました');
    } finally {
      setIsSending(false);
    }
  }, [phoneNumber]);

  // 認証コード検証
  const handleVerifyCode = useCallback(async () => {
    if (!code || code.length < 4) {
      setVerifyError('認証コードを入力してください');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const response = await fetch('/api/sms/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code }),
      });

      const data = await response.json();

      if (!data.success) {
        setVerifyError(data.error || '認証に失敗しました');
        return;
      }

      // 認証成功
      setState('verified');
      verifiedPhoneRef.current = phoneNumber;
      onVerified(data.verificationToken);
      toast.success('電話番号の認証が完了しました');
    } catch {
      setVerifyError('認証処理中にエラーが発生しました');
    } finally {
      setIsVerifying(false);
    }
  }, [code, phoneNumber, onVerified]);

  // 認証コード入力のハンドラ（数字のみ許可）
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setVerifyError(null);
  }, []);

  // 再送信
  const handleResend = useCallback(() => {
    if (cooldownSeconds > 0) return;
    handleSendCode();
  }, [cooldownSeconds, handleSendCode]);

  const defaultInputClass = 'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary border-gray-300';
  const phoneInputClass = inputClassName || defaultInputClass;

  return (
    <div className="space-y-3">
      {/* 電話番号入力 */}
      <div>
        <PhoneNumberInput
          value={phoneNumber}
          onChange={onPhoneNumberChange}
          placeholder="09012345678"
          className={phoneInputClass}
          disabled={disabled || state === 'verified'}
          readOnly={state === 'verified'}
        />
        {showError && errorMessage && (
          <p className="text-red-500 text-xs mt-1">{errorMessage}</p>
        )}
      </div>

      {/* 認証コード送信ボタン（入力状態） */}
      {state === 'input' && (
        <div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={disabled || isSending || !isValidPhoneNumber(phoneNumber)}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                送信中...
              </span>
            ) : (
              '認証コードを送信'
            )}
          </button>
          <p className="text-xs text-gray-500 mt-1">※SMSで認証コードが届きます</p>
        </div>
      )}

      {/* 認証コード入力（コード送信済み状態） */}
      {state === 'codeSent' && (
        <div className="space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800 mb-2">
              <span className="font-medium">{phoneNumber}</span> に認証コードを送信しました
            </p>
            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={handleCodeChange}
                placeholder="認証コード（6桁）"
                maxLength={6}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
                disabled={isVerifying}
              />
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isVerifying || code.length < 4}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isVerifying ? '確認中...' : '確認'}
              </button>
            </div>
            {verifyError && (
              <p className="text-red-500 text-xs mt-2">{verifyError}</p>
            )}
          </div>

          {/* 再送信・電話番号変更 */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldownSeconds > 0 || isSending}
              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {cooldownSeconds > 0 ? `再送信（${cooldownSeconds}秒後）` : '認証コードを再送信'}
            </button>
            <button
              type="button"
              onClick={() => {
                setState('input');
                setCode('');
                setVerifyError(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              電話番号を変更
            </button>
          </div>
        </div>
      )}

      {/* 認証済み状態 */}
      {state === 'verified' && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">電話番号認証済み</span>
          {!initialVerified && (
            <button
              type="button"
              onClick={() => {
                setState('input');
                verifiedPhoneRef.current = '';
              }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
            >
              変更する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
