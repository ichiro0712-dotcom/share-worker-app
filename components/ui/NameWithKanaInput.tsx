'use client';

import { useRef, useCallback, useEffect } from 'react';
import { hiraganaToKatakana } from '@/utils/inputValidation';

interface NameWithKanaInputProps {
  value: string;
  onChange: (value: string) => void;
  onKanaChange: (kana: string) => void;
  kanaValue: string;
  className?: string;
  placeholder?: string;
}

/**
 * AutoKana方式のふりがな自動入力input
 *
 * 仕組み:
 * 1. IME入力開始（compositionStart）→ バッファリセット
 * 2. IME入力中（compositionUpdate）→ ひらがなの読みを保存（漢字候補では上書きしない）
 * 3. IME確定（compositionEnd）→ 保存したひらがなをカタカナに変換してカナフィールドに追記
 *
 * ポイント:
 * - compositionUpdateでは最初に取得できるひらがなを保持し、
 *   スペースキーで漢字候補に変わった後は上書きしない
 * - 漢字入力フィールド自体は普通のinputとして動作
 */
export function NameWithKanaInput({
  value,
  onChange,
  onKanaChange,
  kanaValue,
  className,
  placeholder,
}: NameWithKanaInputProps) {
  const isComposingRef = useRef(false);
  // ひらがなの読みを保持（漢字候補で上書きしない）
  const hiraganaReadingRef = useRef('');
  const prevValueLengthRef = useRef(value.length);

  useEffect(() => {
    prevValueLengthRef.current = value.length;
  }, [value]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    hiraganaReadingRef.current = '';
  }, []);

  const handleCompositionUpdate = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    const data = e.data || '';
    // ひらがなが含まれている場合のみバッファを更新
    // スペースキーで漢字候補に切り替わった後は上書きしない
    const hasHiragana = /[\u3041-\u3096]/.test(data);
    if (hasHiragana) {
      hiraganaReadingRef.current = data;
    }
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;

    const reading = hiraganaReadingRef.current;
    if (reading) {
      const katakana = hiraganaToKatakana(reading);
      onKanaChange(kanaValue + katakana);
    }
    hiraganaReadingRef.current = '';
  }, [kanaValue, onKanaChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newLength = newValue.length;
    const prevLength = prevValueLengthRef.current;

    // IME変換中でないときに文字が減った = BackspaceやDelete
    if (!isComposingRef.current && newLength < prevLength) {
      const deletedCount = prevLength - newLength;
      if (kanaValue.length > 0) {
        const newKana = kanaValue.slice(0, Math.max(0, kanaValue.length - deletedCount));
        onKanaChange(newKana);
      }
    }

    prevValueLengthRef.current = newLength;
    onChange(newValue);
  }, [onChange, onKanaChange, kanaValue]);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionUpdate={handleCompositionUpdate}
      onCompositionEnd={handleCompositionEnd}
      className={className}
      placeholder={placeholder}
    />
  );
}
