'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, MapPin } from 'lucide-react';

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
}

export default function BranchSelector({
  bankCode,
  value,
  onChange,
  required = false,
  showErrors = false,
  disabled = false,
}: BranchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 銀行コードが変更されたら支店リストを取得
  useEffect(() => {
    if (!bankCode) {
      setBranches([]);
      setFilteredBranches([]);
      return;
    }

    const fetchBranches = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/bank/${bankCode}/branches?limit=200`);
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
          setFilteredBranches((data.branches || []).slice(0, 50));
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

    fetchBranches();
  }, [bankCode]); // onChangeを依存配列から削除

  // 検索フィルタリング（漢字・カタカナ・ひらがな・コード全て対応）
  const filterBranches = useCallback((query: string) => {
    if (!query) {
      setFilteredBranches(branches.slice(0, 50));
      return;
    }

    const filtered = branches.filter(
      (branch) =>
        branch.name.includes(query) ||  // 漢字名
        branch.kana.includes(query) ||  // カタカナ
        branch.hira.includes(query) ||  // ひらがな
        branch.code.includes(query)     // 支店コード
    );
    setFilteredBranches(filtered);
  }, [branches]);

  // デバウンスフィルタリング（useEffect + setTimeout）
  useEffect(() => {
    const timer = setTimeout(() => {
      filterBranches(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, filterBranches]);

  // 支店選択
  const handleSelectBranch = (branch: Branch) => {
    onChange({ code: branch.code, name: branch.name });
    setSearchQuery('');
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

      {/* 検索入力 */}
      {!value && !disabled && (
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
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>

          {/* エラー表示 */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
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
            ) : filteredBranches.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                {searchQuery
                  ? '検索結果がありません'
                  : branches.length === 0
                  ? '支店情報がありません'
                  : '支店を検索してください'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {!searchQuery && branches.length > 50 && (
                  <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                    {branches.length}件中50件表示（検索で絞り込み可能）
                  </div>
                )}
                {filteredBranches.map((branch) => (
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
