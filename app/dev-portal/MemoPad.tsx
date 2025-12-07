'use client';

import { useState, useEffect } from 'react';
import { PenTool } from 'lucide-react';

export function MemoPad() {
    const [memo, setMemo] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('dev-portal-memo');
        if (saved) setMemo(saved);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setMemo(newValue);
        localStorage.setItem('dev-portal-memo', newValue);
    };

    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-3">
                <PenTool className="w-4 h-4 text-pink-600" />
                開発メモ
            </h2>
            <div className="relative">
                <textarea
                    value={memo}
                    onChange={handleChange}
                    className="w-full h-48 p-3 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-y text-gray-700 bg-gray-50 placeholder-gray-400"
                    placeholder="一時的なメモとしてご利用ください..."
                />
                <div className="text-[10px] text-gray-400 mt-1 text-right">
                    LocalStorageに自動保存
                </div>
            </div>
        </div>
    );
}
