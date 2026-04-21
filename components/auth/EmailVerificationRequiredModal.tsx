'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  email: string;
  onClose: () => void;
}

// サーバー側クールダウン（email-verification.ts の RESEND_COOLDOWN_MINUTES = 5分）と揃える
const CLIENT_COOLDOWN_MS = 5 * 60_000;

export function EmailVerificationRequiredModal({ open, email, onClose }: Props) {
  const [isSending, setIsSending] = useState(false);
  const [sentOnce, setSentOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0); // クライアント側の連打防止
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // open/email 変更時に状態リセット
  useEffect(() => {
    if (!open) return;
    setSentOnce(false);
    setErrorMessage(null);
    setCooldownRemaining(0);
  }, [open, email]);

  // ESC & 初期フォーカス
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // 開いた直後に閉じるボタンへフォーカス
    setTimeout(() => closeBtnRef.current?.focus(), 10);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // cooldown カウントダウン
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const t = setTimeout(() => setCooldownRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldownRemaining]);

  if (!open) return null;

  const handleResend = async () => {
    if (isSending || !email || cooldownRemaining > 0) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      // 現在のページを認証完了後の戻り先として送信
      // （メールリンククリック後、このページに戻って応募を続けられる）
      const returnUrl =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : null;
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, returnUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '認証メールを再送しました');
        setSentOnce(true);
        setCooldownRemaining(Math.ceil(CLIENT_COOLDOWN_MS / 1000));
      } else {
        // サーバー側クールダウン等のエラーはインラインで表示
        setErrorMessage(data.error || '再送に失敗しました');
      }
    } catch {
      setErrorMessage('再送中にネットワークエラーが発生しました');
    } finally {
      setIsSending(false);
    }
  };

  const buttonLabel = (() => {
    if (isSending) return '送信中...';
    if (cooldownRemaining > 0) {
      const min = Math.floor(cooldownRemaining / 60);
      const sec = cooldownRemaining % 60;
      return `再送可能まで ${min}:${String(sec).padStart(2, '0')}`;
    }
    if (sentOnce) return '認証メールを再送する';
    return '認証メールを送信する';
  })();

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verify-modal-title"
    >
      <div
        className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="email-verify-modal-title" className="text-lg font-bold text-gray-800">
            メール認証が必要です
          </h3>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-gray-400 text-2xl leading-none px-2"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          求人への応募にはメールアドレスの認証が必要です。
          <br />
          登録時に <span className="font-semibold">{email}</span> 宛にお送りした認証メールのリンクをクリックしてください。
        </p>
        <p className="text-xs text-gray-500 mb-4">
          メールが見つからない場合は、迷惑メールフォルダもご確認ください。
        </p>

        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || cooldownRemaining > 0}
            className="w-full py-3 rounded-full bg-[#2AADCF] text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buttonLabel}
          </button>
          <Link
            href="/mypage/profile"
            className="text-center text-sm text-[#2AADCF] underline"
            onClick={onClose}
          >
            メールアドレスを変更する
          </Link>
        </div>
      </div>
    </div>
  );
}
