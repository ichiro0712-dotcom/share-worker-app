'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, Building2 } from 'lucide-react';

// 銀行データ型（APIレスポンスに合わせる）
interface Bank {
  code: string;
  name: string;
  kana?: string;  // カタカナ（検索APIのみ）
  hira?: string;  // ひらがな（検索APIのみ）
}

interface BankSelectorProps {
  value: { code: string; name: string } | null;
  onChange: (bank: { code: string; name: string } | null) => void;
  required?: boolean;
  showErrors?: boolean;
  disabled?: boolean;
  /** 既存データ（コードなし）の名前表示用 */
  legacyName?: string;
}

export default function BankSelector({
  value,
  onChange,
  required = false,
  showErrors = false,
  disabled = false,
  legacyName = '',
}: BankSelectorProps) {
  // 既存データ表示モード（コードなしで名前だけある場合）
  const [showLegacy, setShowLegacy] = useState(!!legacyName && !value);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Bank[]>([]);
  const [majorBanks, setMajorBanks] = useState<Bank[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMajor, setIsLoadingMajor] = useState(true);
  const [error, setError] = useState('');

  // 主要銀行を取得
  useEffect(() => {
    const fetchMajorBanks = async () => {
      try {
        const response = await fetch('/api/bank/major');
        if (response.ok) {
          const data = await response.json();
          setMajorBanks(data.banks || []);
        }
      } catch (err) {
        console.error('主要銀行の取得に失敗:', err);
      } finally {
        setIsLoadingMajor(false);
      }
    };
    fetchMajorBanks();
  }, []);

  // 銀行検索API呼び出し
  const searchBanks = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch(`/api/bank/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.banks || []);
        if (data.banks?.length === 0) {
          setError('該当する銀行が見つかりませんでした');
        }
      } else {
        setError('検索に失敗しました');
      }
    } catch (err) {
      console.error('銀行検索エラー:', err);
      setError('検索に失敗しました');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // デバウンス検索（useEffect + setTimeout）
  useEffect(() => {
    const timer = setTimeout(() => {
      searchBanks(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchBanks]);

  // 銀行選択
  const handleSelectBank = (bank: Bank) => {
    onChange({ code: bank.code, name: bank.name });
    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  // 選択解除
  const handleClear = () => {
    onChange(null);
  };

  // 表示する銀行リスト（検索結果または主要銀行）
  const displayBanks = searchQuery.length >= 2 ? searchResults : majorBanks;

  return (
    <div className="space-y-2">
      {/* 選択済み表示 */}
      {value && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 text-sm rounded-lg">
            <Building2 className="w-4 h-4" />
            {value.name}
            <span className="text-xs text-indigo-500">({value.code})</span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:text-indigo-900 ml-1"
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
            <Building2 className="w-4 h-4" />
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
              placeholder="銀行名で検索（2文字以上）..."
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>

          {/* エラー表示 */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* 銀行リスト */}
          <div className={`border rounded-lg max-h-48 overflow-y-auto ${
            showErrors && required && !value ? 'border-red-500' : 'border-slate-300'
          }`}>
            {isLoadingMajor && !searchQuery ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : displayBanks.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {searchQuery.length >= 2
                  ? '検索結果がありません'
                  : searchQuery.length > 0
                  ? '2文字以上入力してください'
                  : '主要銀行を読み込み中...'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {!searchQuery && (
                  <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                    主要銀行
                  </div>
                )}
                {displayBanks.map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => handleSelectBank(bank)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-700">{bank.name}</span>
                    <span className="text-xs text-slate-400">{bank.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* バリデーションエラー */}
          {showErrors && required && !value && (
            <p className="text-red-500 text-xs">銀行を選択してください</p>
          )}
        </>
      )}

      {/* disabled状態で未選択 */}
      {!value && disabled && (
        <input
          type="text"
          disabled
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400"
          placeholder="銀行を選択してください"
        />
      )}
    </div>
  );
}
