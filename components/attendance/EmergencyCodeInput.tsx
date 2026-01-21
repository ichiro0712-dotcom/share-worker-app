'use client';

/**
 * 緊急時出退勤番号入力コンポーネント
 * 4桁の数字を入力し、5回連続エラーでロックされる
 */

import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { EMERGENCY_CODE_MAX_ERRORS } from '@/src/constants/attendance-errors';

interface EmergencyCodeInputProps {
  onSubmit: (code: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  errorCount: number;
  isLocked: boolean;
}

export function EmergencyCodeInput({
  onSubmit,
  onError,
  disabled = false,
  errorCount,
  isLocked,
}: EmergencyCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // 初回レンダリング時に最初の入力欄にフォーカス
    if (!disabled && !isLocked && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [disabled, isLocked]);

  const handleDigitChange = (index: number, value: string) => {
    // 数字のみ許可
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 1) {
      // ペースト対応
      const pastedDigits = numericValue.slice(0, 4).split('');
      const newDigits = [...digits];
      pastedDigits.forEach((digit, i) => {
        if (index + i < 4) {
          newDigits[index + i] = digit;
        }
      });
      setDigits(newDigits);

      // 最後の入力欄にフォーカス
      const lastFilledIndex = Math.min(index + pastedDigits.length - 1, 3);
      inputRefs.current[lastFilledIndex]?.focus();

      // 4桁揃ったら送信
      if (newDigits.every((d) => d !== '')) {
        handleSubmit(newDigits.join(''));
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = numericValue;
    setDigits(newDigits);

    // 次の入力欄にフォーカス
    if (numericValue && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // 4桁揃ったら送信
    if (numericValue && index === 3 && newDigits.every((d) => d !== '')) {
      handleSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (code: string) => {
    if (code.length === 4) {
      onSubmit(code);
      // 入力をクリア
      setDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  if (isLocked) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <Lock className="w-5 h-5" />
          <span className="font-medium">入力がロックされました</span>
        </div>
        <p className="text-sm text-red-600">
          {EMERGENCY_CODE_MAX_ERRORS}回連続で誤った番号が入力されたため、緊急時番号の入力がロックされました。
          施設担当者にお問い合わせください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-2">
        QRコードが読み取れない場合は、緊急時出退勤番号を入力してください
      </div>

      <div className="flex justify-center gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            value={digit}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            className={`
              w-14 h-16 text-center text-2xl font-bold rounded-lg border-2
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${
                disabled
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-gray-300 text-gray-800 focus:border-[#66cc99] focus:ring-[#66cc99]'
              }
            `}
          />
        ))}
      </div>

      {errorCount > 0 && errorCount < EMERGENCY_CODE_MAX_ERRORS && (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>
            番号が一致しません（残り{EMERGENCY_CODE_MAX_ERRORS - errorCount}回）
          </span>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        ※{EMERGENCY_CODE_MAX_ERRORS}回連続で誤入力すると入力欄がロックされます
      </p>
    </div>
  );
}
