'use client';

import { useState, useRef, useCallback, useEffect, InputHTMLAttributes } from 'react';
import { formatPostalCode } from '@/utils/inputValidation';

interface PostalCodeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** 7桁入力完了時のコールバック（住所自動入力などに使用） */
  onComplete?: (value: string) => void;
}

/**
 * IME入力問題に対応した郵便番号入力コンポーネント
 *
 * 問題: 郵便番号入力でformatPostalCode（ハイフン自動挿入）を
 * リアルタイムで適用すると、IME入力中に干渉して
 * 「勝手に文字が入力される」「カーソルが飛ぶ」問題が発生する。
 *
 * 解決策:
 * 1. onCompositionStart/Endを使用してIME入力中はフォーマット処理をスキップ
 * 2. onBlur時にもフォーマットを適用（ライブ変換の取りこぼし対策）
 * 3. 7桁入力完了時にonCompleteコールバックを呼ぶ
 */
export function PostalCodeInput({ value, onChange, onComplete, onBlur, ...props }: PostalCodeInputProps) {
  // IME入力中かどうかを追跡
  const isComposingRef = useRef(false);
  // ローカルの入力値
  const [localValue, setLocalValue] = useState(value);
  // 最後にonChangeに渡した値（重複呼び出し防止）
  const lastNotifiedValueRef = useRef(value);
  // onCompleteが呼ばれた値を記録（重複防止）
  const lastCompletedValueRef = useRef('');

  // 7桁かどうかをチェックしてonCompleteを呼ぶ
  const checkComplete = useCallback((formattedValue: string) => {
    const digitsOnly = formattedValue.replace(/\D/g, '');
    if (digitsOnly.length === 7 && digitsOnly !== lastCompletedValueRef.current) {
      lastCompletedValueRef.current = digitsOnly;
      onComplete?.(formattedValue);
    }
  }, [onComplete]);

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
    const formattedValue = formatPostalCode(rawValue);
    setLocalValue(formattedValue);

    if (formattedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = formattedValue;
      onChange(formattedValue);
    }

    checkComplete(formattedValue);
  }, [onChange, checkComplete]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isComposingRef.current) {
      // IME入力中はフォーマットせずにそのまま表示
      setLocalValue(newValue);
    } else {
      // 通常入力時は即座にフォーマット
      const formattedValue = formatPostalCode(newValue);
      setLocalValue(formattedValue);

      if (formattedValue !== lastNotifiedValueRef.current) {
        lastNotifiedValueRef.current = formattedValue;
        onChange(formattedValue);
      }

      checkComplete(formattedValue);
    }
  }, [onChange, checkComplete]);

  // blurイベントで最終的なフォーマットを保証
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const rawValue = e.currentTarget.value;
    const formattedValue = formatPostalCode(rawValue);

    if (formattedValue !== localValue) {
      setLocalValue(formattedValue);
    }

    if (formattedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = formattedValue;
      onChange(formattedValue);
    }

    checkComplete(formattedValue);
    onBlur?.(e);
  }, [localValue, onChange, onBlur, checkComplete]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      maxLength={8}
    />
  );
}
