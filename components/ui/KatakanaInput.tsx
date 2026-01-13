'use client';

import { useState, useRef, useCallback, useEffect, InputHTMLAttributes } from 'react';
import { formatKatakana, formatKatakanaWithSpace } from '@/utils/inputValidation';

interface KatakanaInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * iOSのIME入力問題に対応したカタカナ入力コンポーネント
 *
 * 問題: iOSやMacのライブ変換ではIME入力中（変換確定前）にonChangeが発火し、
 * formatKatakanaによる変換がIMEのcomposition状態と干渉して
 * 「勝手に文字が入力される」問題が発生する。
 *
 * 解決策:
 * 1. onCompositionStart/Endを使用してIME入力中は変換処理をスキップ
 * 2. onBlur時にも変換を適用（ライブ変換の取りこぼし対策）
 * 3. useEffectで外部値との同期（レンダリング中の状態更新を回避）
 * 4. 変換後の値が同じ場合はonChangeを呼ばない（無限ループ防止）
 */
export function KatakanaInput({ value, onChange, onBlur, ...props }: KatakanaInputProps) {
  // IME入力中かどうかを追跡
  const isComposingRef = useRef(false);
  // ローカルの入力値（IME入力中は変換せずに保持）
  const [localValue, setLocalValue] = useState(value);
  // 最後にonChangeに渡した値（重複呼び出し防止）
  const lastNotifiedValueRef = useRef(value);

  // 外部からの値変更に追従（useEffectで安全に同期）
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
    // IME入力確定時にカタカナ変換を適用
    const rawValue = e.currentTarget.value;
    const convertedValue = formatKatakana(rawValue);
    setLocalValue(convertedValue);

    // 値が変わった場合のみonChangeを呼ぶ
    if (convertedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = convertedValue;
      onChange(convertedValue);
    }
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

      // 値が変わった場合のみonChangeを呼ぶ
      if (convertedValue !== lastNotifiedValueRef.current) {
        lastNotifiedValueRef.current = convertedValue;
        onChange(convertedValue);
      }
    }
  }, [onChange]);

  // blurイベントで最終的な変換を保証（ライブ変換対策）
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const rawValue = e.currentTarget.value;
    const convertedValue = formatKatakana(rawValue);

    if (convertedValue !== localValue) {
      setLocalValue(convertedValue);
    }

    // 値が変わった場合のみonChangeを呼ぶ
    if (convertedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = convertedValue;
      onChange(convertedValue);
    }

    // 元のonBlurハンドラも呼ぶ
    onBlur?.(e);
  }, [localValue, onChange, onBlur]);

  return (
    <input
      {...props}
      type="text"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
}

/**
 * スペース付きカタカナ入力コンポーネント（口座名義用）
 * KatakanaInputと同様のIME対応を行い、スペースを許容する
 */
export function KatakanaWithSpaceInput({ value, onChange, onBlur, ...props }: KatakanaInputProps) {
  const isComposingRef = useRef(false);
  const [localValue, setLocalValue] = useState(value);
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
    const convertedValue = formatKatakanaWithSpace(rawValue);
    setLocalValue(convertedValue);

    if (convertedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = convertedValue;
      onChange(convertedValue);
    }
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (isComposingRef.current) {
      setLocalValue(newValue);
    } else {
      const convertedValue = formatKatakanaWithSpace(newValue);
      setLocalValue(convertedValue);

      if (convertedValue !== lastNotifiedValueRef.current) {
        lastNotifiedValueRef.current = convertedValue;
        onChange(convertedValue);
      }
    }
  }, [onChange]);

  // blurイベントで最終的な変換を保証（ライブ変換対策）
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const rawValue = e.currentTarget.value;
    const convertedValue = formatKatakanaWithSpace(rawValue);

    if (convertedValue !== localValue) {
      setLocalValue(convertedValue);
    }

    if (convertedValue !== lastNotifiedValueRef.current) {
      lastNotifiedValueRef.current = convertedValue;
      onChange(convertedValue);
    }

    onBlur?.(e);
  }, [localValue, onChange, onBlur]);

  return (
    <input
      {...props}
      type="text"
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  );
}
