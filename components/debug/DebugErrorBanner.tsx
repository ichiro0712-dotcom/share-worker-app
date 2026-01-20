'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { X, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// デバッグモードフラグ - 開発環境でのみ有効
const DEBUG_MODE = process.env.NODE_ENV === 'development';

interface DebugError {
  id: string;
  type: 'save' | 'update' | 'delete' | 'fetch' | 'upload' | 'other';
  operation: string;
  message: string;
  details?: string;
  stack?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

interface DebugErrorContextType {
  showDebugError: (error: {
    type: DebugError['type'];
    operation: string;
    message: string;
    details?: string;
    stack?: string;
    context?: Record<string, unknown>;
  }) => void;
  clearDebugError: (id: string) => void;
  clearAllDebugErrors: () => void;
  errors: DebugError[];
}

const DebugErrorContext = createContext<DebugErrorContextType | null>(null);

export function useDebugError() {
  const context = useContext(DebugErrorContext);
  if (!context) {
    // デバッグモードがオフの場合やProviderがない場合はno-opを返す
    return {
      showDebugError: () => {},
      clearDebugError: () => {},
      clearAllDebugErrors: () => {},
      errors: [],
    };
  }
  return context;
}

// ヘルパー関数: エラーオブジェクトからデバッグ情報を抽出
export function extractDebugInfo(error: unknown): { message: string; details?: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error.name,
      stack: error.stack,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: obj.message as string || JSON.stringify(error),
      details: obj.code as string || obj.type as string,
    };
  }
  return { message: String(error) };
}

function DebugErrorItem({ error, onClose }: { error: DebugError; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const typeLabels: Record<DebugError['type'], string> = {
    save: '保存',
    update: '更新',
    delete: '削除',
    fetch: '取得',
    upload: 'アップロード',
    other: 'その他',
  };

  const typeColors: Record<DebugError['type'], string> = {
    save: 'bg-red-500',
    update: 'bg-orange-500',
    delete: 'bg-purple-500',
    fetch: 'bg-blue-500',
    upload: 'bg-yellow-500',
    other: 'bg-gray-500',
  };

  const copyToClipboard = async () => {
    const text = JSON.stringify({
      type: error.type,
      operation: error.operation,
      message: error.message,
      details: error.details,
      stack: error.stack,
      context: error.context,
      timestamp: error.timestamp.toISOString(),
    }, null, 2);

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 text-white rounded-lg shadow-xl border border-red-500 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-red-900/50">
        <Bug className="w-4 h-4 text-red-400" />
        <span className={`px-2 py-0.5 text-xs rounded ${typeColors[error.type]}`}>
          {typeLabels[error.type]}
        </span>
        <span className="text-sm font-medium flex-grow truncate">{error.operation}</span>
        <span className="text-xs text-gray-400">
          {error.timestamp.toLocaleTimeString('ja-JP')}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-white/10 rounded"
          title={expanded ? '折りたたむ' : '展開'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          onClick={copyToClipboard}
          className="p-1 hover:bg-white/10 rounded"
          title="コピー"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded"
          title="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* メッセージ */}
      <div className="px-3 py-2 border-t border-gray-700">
        <p className="text-sm text-red-300">{error.message}</p>
        {error.details && (
          <p className="text-xs text-gray-400 mt-1">詳細: {error.details}</p>
        )}
      </div>

      {/* 展開時の詳細 */}
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-950">
          {error.stack && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">スタックトレース:</p>
              <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono bg-black/50 p-2 rounded">
                {error.stack}
              </pre>
            </div>
          )}
          {error.context && Object.keys(error.context).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">コンテキスト:</p>
              <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono bg-black/50 p-2 rounded">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DebugErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<DebugError[]>([]);

  const showDebugError = useCallback((error: Omit<DebugError, 'id' | 'timestamp'>) => {
    if (!DEBUG_MODE) return;

    const id = Math.random().toString(36).substring(7);
    const newError: DebugError = {
      ...error,
      id,
      timestamp: new Date(),
    };

    // コンソールにも出力
    console.group(`🐛 Debug Error: ${error.operation}`);
    console.error('Message:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.stack) console.error('Stack:', error.stack);
    if (error.context) console.error('Context:', error.context);
    console.groupEnd();

    setErrors((prev) => [newError, ...prev]);
  }, []);

  const clearDebugError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
  }, []);

  const clearAllDebugErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // デバッグモードがオフの場合はバナーを表示しない
  if (!DEBUG_MODE) {
    return (
      <DebugErrorContext.Provider value={{ showDebugError, clearDebugError, clearAllDebugErrors, errors: [] }}>
        {children}
      </DebugErrorContext.Provider>
    );
  }

  return (
    <DebugErrorContext.Provider value={{ showDebugError, clearDebugError, clearAllDebugErrors, errors }}>
      {children}

      {/* ヘッダー固定のデバッグバナー */}
      {errors.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[99999] p-2 space-y-2 max-h-[50vh] overflow-y-auto bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-white text-sm font-bold flex items-center gap-2">
              <Bug className="w-4 h-4 text-red-400" />
              デバッグエラー ({errors.length}件)
            </span>
            {errors.length > 1 && (
              <button
                onClick={clearAllDebugErrors}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                すべてクリア
              </button>
            )}
          </div>
          <div className="space-y-2 max-w-4xl mx-auto">
            {errors.map((error) => (
              <DebugErrorItem
                key={error.id}
                error={error}
                onClose={() => clearDebugError(error.id)}
              />
            ))}
          </div>
        </div>
      )}
    </DebugErrorContext.Provider>
  );
}
