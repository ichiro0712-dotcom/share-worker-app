'use client';

import { useState, useRef, useCallback, useEffect, InputHTMLAttributes } from 'react';
import { formatPhoneNumber } from '@/utils/inputValidation';

interface PhoneNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 電話番号入力コンポーネント
 *
 * - 数字のみを許可（全角数字は自動で半角に変換）
 * - 最大11桁に制限
 * - IME入力にも対応
 */
export function PhoneNumberInput({ value, onChange, onBlur, ...props }: PhoneNumberInputProps) {
  // IME入力中かどうかを追跡
  const isComposingRef = useRef(false);
  // ローカルの入力値
  const [localValue, setLocalValue] = useState(value);
  // 最後にonChangeに渡した値（重複呼び出し防止）
  const lastNotifiedValueRef = useRef(value);

  // 外部からの値変更に追従
  useEffect(() => {
    if (!isComposingRef.current && value !== localValue) {
      setLocalValue(value);
      lastNotifiedValueRef.current = value;
    }
  }, [value, localValue]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const rawValue = e.currentTarget.value;
    const formattedValue = formatPhoneNumber(rawValue);
    setLocalValue(formattedValue);

    if (formattedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = formattedValue;
      onChange(formattedValue);
    }
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isComposingRef.current) {
      // IME入力中はフォーマットせずにそのまま表示
      setLocalValue(newValue);
    } else {
      // 通常入力時は即座にフォーマット
      const formattedValue = formatPhoneNumber(newValue);
      setLocalValue(formattedValue);

      if (formattedValue !== lastNotifiedValueRef.current) {
        lastNotifiedValueRef.current = formattedValue;
        onChange(formattedValue);
      }
    }
  }, [onChange]);

  // blurイベントで最終的なフォーマットを保証
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const rawValue = e.currentTarget.value;
    const formattedValue = formatPhoneNumber(rawValue);

    if (formattedValue !== localValue) {
      setLocalValue(formattedValue);
    }

    if (formattedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = formattedValue;
      onChange(formattedValue);
    }

    onBlur?.(e);
  }, [localValue, onChange, onBlur]);

  return (
    <input
      {...props}
      type="tel"
      inputMode="tel"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
}
