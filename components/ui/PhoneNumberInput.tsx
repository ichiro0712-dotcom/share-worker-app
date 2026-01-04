'use client';

import { useState, useRef, useCallback, useEffect, InputHTMLAttributes } from 'react';
import { formatPhoneNumber } from '@/utils/inputValidation';

interface PhoneNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * IME入力問題に対応した電話番号入力コンポーネント
 *
 * 問題: 電話番号入力でformatPhoneNumber（ハイフン自動挿入）を
 * リアルタイムで適用すると、IME入力中に干渉して
 * 「勝手に文字が入力される」「カーソルが飛ぶ」問題が発生する。
 *
 * 解決策:
 * 1. onCompositionStart/Endを使用してIME入力中はフォーマット処理をスキップ
 * 2. onBlur時にもフォーマットを適用（ライブ変換の取りこぼし対策）
 * 3. 変換後の値が同じ場合はonChangeを呼ばない（無限ループ防止）
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
