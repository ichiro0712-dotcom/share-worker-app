'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, RefreshCw, CheckCircle, Eye, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function VerifyPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // CATS/L-ad コンバージョンタグ
  useEffect(() => {
    if (window.location.hostname !== 'stg-share-worker.vercel.app') return;

    const gid = 1;
    const sid = "";
    const uid1 = "";
    const uid2 = "";
    const uid3 = "";
    const uid4 = "";
    const uid5 = "";
    const uid6 = "";
    const uid7 = "";
    const uid8 = "";
    const catsPoint = "2";
    const amount = "";
    const uqid = "p18d92c360ebf6x3";
    const trackingUserId = "";
    const firstCookie = document.cookie;
    const catsOptions = {
      fpc_id: "",
      fb: { eventId: "" },
      googleAdsClick: { order_id: "" },
      L_ad: { liff_id: "2009053059-NTgazj13" },
    };

    const script = document.createElement("script");
    script.src = "//tastas.ac01.l-ad.net/ac/p18d92c360ebf6x3/action.js";
    script.id = "ac_p18d92c360ebf6x3";
    script.addEventListener("load", () => {
      (window as any).CATS_GroupAction(
        gid, sid, uid1, uid2, uqid, uid3, uid4, uid5, uid6, uid7, uid8,
        catsPoint, amount, trackingUserId, firstCookie, catsOptions
      );
    });
    document.body.appendChild(script);

    return () => {
      const el = document.getElementById("ac_p18d92c360ebf6x3");
      if (el) el.remove();
    };
  }, []);

  // ローカル開発用: メールプレビュー
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const isDev = process.env.NODE_ENV === 'development';

  const handleResend = async () => {
    if (!email) {
      toast.error('メールアドレスが指定されていません');
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendSuccess(true);
        toast.success('認証メールを再送信しました');
      } else {
        toast.error(data.error || '再送信に失敗しました');
      }
    } catch (error) {
      toast.error('再送信中にエラーが発生しました');
    } finally {
      setIsResending(false);
    }
  };

  const handlePreviewEmail = async () => {
    if (!email) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await fetch(`/api/auth/preview-verification-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error || 'プレビューの取得に失敗しました');
        return;
      }
      if (data.status === 'already_verified') {
        setPreviewError('このユーザーは既にメール認証済みです。');
        return;
      }
      if (data.status === 'no_token') {
        setPreviewError('認証トークンが見つかりません。');
        return;
      }
      setEmailPreviewHtml(data.emailHtml);
      setVerifyUrl(data.verifyUrl);
      setShowEmailPreview(true);
    } catch {
      setPreviewError('プレビューの取得中にエラーが発生しました');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          メールをご確認ください
        </h1>

        <p className="text-gray-600 mb-6">
          ご登録ありがとうございます。
          <br />
          <span className="font-medium text-gray-900">{email || 'ご登録のメールアドレス'}</span>
          <br />
          に認証メールを送信しました。
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold text-blue-900 mb-2">次のステップ</h2>
          <ol className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span>メールボックスを確認してください</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span>「メールアドレスを確認する」ボタンをクリック</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>ログインして求人検索を始めましょう</span>
            </li>
          </ol>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>

        {resendSuccess ? (
          <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
            <CheckCircle className="w-5 h-5" />
            <span>再送信しました</span>
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={isResending || !email}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? '送信中...' : '認証メールを再送信'}
          </button>
        )}

        {/* ローカル開発用: メール内容プレビュー */}
        {isDev && (
          <div className="border-t border-dashed border-orange-300 pt-4 mt-4 mb-4">
            <p className="text-xs text-orange-600 font-medium mb-2">[ 開発用 ] ローカルではメールが送信されません</p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={handlePreviewEmail}
                disabled={previewLoading || !email}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                {previewLoading ? '取得中...' : 'メール内容を表示'}
              </button>
              <Link
                href="/job-list"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                メール認証後のページ
              </Link>
            </div>
            {previewError && (
              <p className="text-red-500 text-xs mt-2">{previewError}</p>
            )}
          </div>
        )}

        <div className="border-t pt-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ログインページへ戻る
          </Link>
        </div>
      </div>

      {/* メールプレビューモーダル */}
      {showEmailPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-orange-800">[ 開発用 ] 認証メール プレビュー</span>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {/* 認証リンク直接アクセスボタン */}
              {verifyUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-green-700 mb-2">このボタンで認証フローをそのままテストできます:</p>
                  <a
                    href={verifyUrl}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    メールアドレスを確認する（認証リンク）
                  </a>
                </div>
              )}
              {/* メールHTML内容 */}
              <div
                className="border rounded-lg p-4"
                dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
