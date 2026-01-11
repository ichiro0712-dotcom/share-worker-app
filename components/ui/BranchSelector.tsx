'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// 支店データ型（APIレスポンスに合わせる）
interface Branch {
  code: string;
  name: string;
  kana: string;  // カタカナ
  hira: string;  // ひらがな
}

interface BranchSelectorProps {
  bankCode: string | null; // 選択された銀行コード
  value: { code: string; name: string } | null;
  onChange: (branch: { code: string; name: string } | null) => void;
  required?: boolean;
  showErrors?: boolean;
  disabled?: boolean;
  /** 既存データ（コードなし）の名前表示用 */
  legacyName?: string;
}

export default function BranchSelector({
  bankCode,
  value,
  onChange,
  required = false,
  showErrors = false,
  disabled = false,
  legacyName = '',
}: BranchSelectorProps) {
  // 既存データ表示モード（コードなしで名前だけある場合）
  const [showLegacy, setShowLegacy] = useState(!!legacyName && !value);
  const [searchQuery, setSearchQuery] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  // 外部API検索関連
  const [showApiSearchHint, setShowApiSearchHint] = useState(false);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [apiSearched, setApiSearched] = useState(false);
  // 初期表示用支店リスト（銀行選択時に取得）
  const [initialBranches, setInitialBranches] = useState<Branch[]>([]);

  // 銀行コードが変更されたら初期支店リストを取得
  useEffect(() => {
    if (!bankCode) {
      setBranches([]);
      setInitialBranches([]);
      setShowApiSearchHint(false);
      setApiSearched(false);
      return;
    }

    const fetchInitialBranches = async () => {
      setIsLoading(true);
      setError('');
      setShowApiSearchHint(false);
      setApiSearched(false);

      try {
        const response = await fetch(`/api/bank/${bankCode}/branches?limit=50`);
        if (response.ok) {
          const data = await response.json();
          const branchList = data.branches || [];
          setInitialBranches(branchList);
          setBranches(branchList);
        } else {
          setError('支店一覧の取得に失敗しました');
        }
      } catch (err) {
        console.error('支店取得エラー:', err);
        setError('支店一覧の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialBranches();
  }, [bankCode]);

  // サーバーサイド支店検索API呼び出し
  const searchBranches = useCallback(async (query: string) => {
    if (!bankCode) return;

    if (!query) {
      // 検索クエリがない場合は初期リストを表示
      setBranches(initialBranches);
      setShowApiSearchHint(false);
      setApiSearched(false);
      return;
    }

    setIsSearching(true);
    setError('');
    setShowApiSearchHint(false);
    setApiSearched(false);

    try {
      const response = await fetch(`/api/bank/${bankCode}/branches?q=${encodeURIComponent(query)}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
        setShowApiSearchHint(data.showApiSearchHint || false);
      } else {
        setError('検索に失敗しました');
      }
    } catch (err) {
      console.error('支店検索エラー:', err);
      setError('検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  }, [bankCode, initialBranches]);

  // 外部API検索
  const searchBranchesFromExternalApi = async () => {
    if (!bankCode || !searchQuery) return;

    setIsSearchingApi(true);
    setError('');

    try {
      const response = await fetch(`/api/bank/${bankCode}/branches?q=${encodeURIComponent(searchQuery)}&source=api&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
        setApiSearched(true);
        setShowApiSearchHint(false);
        if (data.branches?.length === 0) {
          setError('外部データベースでも見つかりませんでした。');
        }
      } else {
        setError('外部検索に失敗しました');
      }
    } catch (err) {
      console.error('外部API検索エラー:', err);
      setError('外部検索に失敗しました');
    } finally {
      setIsSearchingApi(false);
    }
  };

  // デバウンス検索（useEffect + setTimeout）
  useEffect(() => {
    const timer = setTimeout(() => {
      searchBranches(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchBranches]);

  // 支店選択
  const handleSelectBranch = (branch: Branch) => {
    onChange({ code: branch.code, name: branch.name });
    setSearchQuery('');
    setShowApiSearchHint(false);
    setApiSearched(false);
  };

  // 選択解除
  const handleClear = () => {
    onChange(null);
  };

  // 銀行未選択時
  if (!bankCode) {
    return (
      <div className="space-y-2">
        <input
          type="text"
          disabled
          className={`w-full px-3 py-2 text-sm border rounded-lg bg-slate-50 text-slate-400 ${
            showErrors && required ? 'border-red-500' : 'border-slate-200'
          }`}
          placeholder="先に銀行を選択してください"
        />
        {showErrors && required && (
          <p className="text-red-500 text-xs">支店を選択してください</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 選択済み表示 */}
      {value && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm rounded-lg">
            <MapPin className="w-4 h-4" />
            {value.name}
            <span className="text-xs text-emerald-500">({value.code})</span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:text-emerald-900 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </span>
        </div>
      )}

      {/* 既存データ表示（コードなしで名前だけある場合） */}
      {!value && showLegacy && legacyName && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 text-sm rounded-lg">
            <MapPin className="w-4 h-4" />
            {legacyName}
            <span className="text-xs text-amber-500">（既存データ）</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => setShowLegacy(false)}
                className="hover:text-amber-900 ml-1 text-xs underline"
              >
                変更する
              </button>
            )}
          </span>
        </div>
      )}

      {/* 検索入力 */}
      {!value && !showLegacy && !disabled && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg ${
                showErrors && required && !value
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-300'
              }`}
              placeholder="支店名で検索..."
              disabled={isLoading}
            />
            {(isLoading || isSearching || isSearchingApi) && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>

          {/* エラー表示 */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* 外部API検索ボタン */}
          {showApiSearchHint && !isSearchingApi && searchQuery && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 mb-2">
                支店名が見つかりませんでした。
              </p>
              <button
                type="button"
                onClick={searchBranchesFromExternalApi}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Search className="w-4 h-4" />
                最新情報を検索
              </button>
            </div>
          )}

          {/* 外部APIでも見つからない場合の問い合わせ案内 */}
          {apiSearched && branches.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 mb-2">
                支店名を再度ご確認ください。見つからない場合は運営までお問い合わせください。
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1 text-sm text-amber-700 underline hover:text-amber-900"
              >
                お問い合わせはこちら
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* 支店リスト */}
          <div className={`border rounded-lg max-h-48 overflow-y-auto ${
            showErrors && required && !value ? 'border-red-500' : 'border-slate-300'
          }`}>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">支店一覧を取得中...</span>
              </div>
            ) : branches.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {searchQuery
                  ? (showApiSearchHint ? '最新情報を検索してください' : '検索結果がありません')
                  : initialBranches.length === 0
                  ? '支店情報がありません'
                  : '支店を検索してください'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {!searchQuery && initialBranches.length > 50 && (
                  <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                    50件表示中（検索で絞り込み可能）
                  </div>
                )}
                {branches.map((branch) => (
                  <button
                    key={branch.code}
                    type="button"
                    onClick={() => handleSelectBranch(branch)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700">{branch.name}</span>
                    <span className="text-xs text-slate-400">{branch.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* バリデーションエラー */}
          {showErrors && required && !value && (
            <p className="text-red-500 text-xs">支店を選択してください</p>
          )}
        </>
      )}

      {/* disabled状態で未選択 */}
      {!value && disabled && (
        <input
          type="text"
          disabled
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400"
          placeholder="支店を選択してください"
        />
      )}
    </div>
  );
}
