'use client';

import { useState, useRef, useCallback, InputHTMLAttributes } from 'react';
import { formatKatakana, formatKatakanaWithSpace } from '@/utils/inputValidation';

interface KatakanaInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * iOSのIME入力問題に対応したカタカナ入力コンポーネント
 *
 * 問題: iOSではIME入力中（変換確定前）にonChangeが発火し、
 * formatKatakanaによる変換がIMEのcomposition状態と干渉して
 * 「勝手に文字が入力される」問題が発生する。
 *
 * 解決策: onCompositionStart/Endを使用してIME入力中は
 * 変換処理をスキップし、入力確定後にのみ変換を行う。
 */
export function KatakanaInput({ value, onChange, ...props }: KatakanaInputProps) {
  // IME入力中かどうかを追跡
  const isComposingRef = useRef(false);
  // ローカルの入力値（IME入力中は変換せずに保持）
  const [localValue, setLocalValue] = useState(value);

  // 外部からの値変更に追従
  if (value !== localValue && !isComposingRef.current) {
    setLocalValue(value);
  }

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    // IME入力確定時にカタカナ変換を適用
    const convertedValue = formatKatakana(e.currentTarget.value);
    setLocalValue(convertedValue);
    onChange(convertedValue);
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isComposingRef.current) {
      // IME入力中は変換せずにそのまま表示
      setLocalValue(newValue);
    } else {
      // 通常入力時（英数字直接入力など）は即座に変換
      const convertedValue = formatKatakana(newValue);
      setLocalValue(convertedValue);
      onChange(convertedValue);
    }
  }, [onChange]);

  return (
    <input
      {...props}
      type="text"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
}

/**
 * スペース付きカタカナ入力コンポーネント（口座名義用）
 * KatakanaInputと同様のIME対応を行い、スペースを許容する
 */
export function KatakanaWithSpaceInput({ value, onChange, ...props }: KatakanaInputProps) {
  const isComposingRef = useRef(false);
  const [localValue, setLocalValue] = useState(value);

  if (value !== localValue && !isComposingRef.current) {
    setLocalValue(value);
  }

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const convertedValue = formatKatakanaWithSpace(e.currentTarget.value);
    setLocalValue(convertedValue);
    onChange(convertedValue);
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isComposingRef.current) {
      setLocalValue(newValue);
    } else {
      const convertedValue = formatKatakanaWithSpace(newValue);
      setLocalValue(convertedValue);
      onChange(convertedValue);
    }
  }, [onChange]);

  return (
    <input
      {...props}
      type="text"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  );
}
