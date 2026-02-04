'use client';

import { useState, useEffect } from 'react';

type Genre = {
  prefix: string;
  name: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (prefix: string, genreName: string) => void;
  onOpenGenreEdit: () => void;
};

export default function GenreSelectModal({ isOpen, onClose, onSelect, onOpenGenreEdit }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchGenres();
    }
  }, [isOpen]);

  const fetchGenres = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lp-code-genres');
      const data = await res.json();
      if (data.genres) {
        setGenres(data.genres);
      }
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">コードジャンルを選択</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-rose-500 border-t-transparent" />
            </div>
          ) : genres.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ジャンルがありません
            </div>
          ) : (
            <div className="space-y-2">
              {genres.map((genre) => (
                <button
                  key={genre.prefix}
                  onClick={() => onSelect(genre.prefix, genre.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-8 bg-gray-100 group-hover:bg-rose-100 rounded flex items-center justify-center">
                    <code className="text-xs font-mono font-semibold text-gray-600 group-hover:text-rose-600">
                      {genre.prefix}
                    </code>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-rose-700">
                      {genre.name}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={() => {
              onClose();
              onOpenGenreEdit();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            コードジャンル編集
          </button>
        </div>
      </div>
    </div>
  );
}
