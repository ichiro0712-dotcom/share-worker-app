'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AIPage() {
    const [inputs, setInputs] = useState({
        facilityCount: '',
        jobCount: '',
        workerCount: '',
        matchingPeriod: '',
        matchingCount: ''
    });
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = () => {
        setLoading(true);
        // ダミー実装：2秒後にダミーデータを表示
        setTimeout(() => {
            setResult({
                predictedFacilityCount: inputs.facilityCount || Math.floor(Math.random() * 100 + 50),
                predictedJobCount: inputs.jobCount || Math.floor(Math.random() * 500 + 200),
                predictedWorkerCount: inputs.workerCount || Math.floor(Math.random() * 1000 + 500),
                predictedMatchingPeriod: inputs.matchingPeriod || (Math.random() * 24 + 12).toFixed(1),
                predictedMatchingCount: inputs.matchingCount || Math.floor(Math.random() * 300 + 100),
                confidence: (Math.random() * 20 + 70).toFixed(1)
            });
            setLoading(false);
        }, 2000);
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">マッチング最適化AI</h1>
                    <p className="text-slate-500">過去データから将来の指標を予測します</p>
                </div>
                <Link
                    href="/system-admin/analytics"
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                >
                    戻る
                </Link>
            </div>

            {/* 未実装の警告 */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">LLM接続が未実装です</span>
                </div>
                <p className="mt-1 text-sm text-amber-700">
                    現在はダミーデータを表示しています。将来的にはLLM APIと接続して実際の予測を行います。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 入力フォーム */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">入力パラメータ</h2>
                    <p className="text-sm text-slate-500 mb-4">
                        予測したい項目は空欄にし、既知の項目を入力してください。
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                施設数
                            </label>
                            <input
                                type="number"
                                value={inputs.facilityCount}
                                onChange={e => setInputs(prev => ({ ...prev, facilityCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                求人数
                            </label>
                            <input
                                type="number"
                                value={inputs.jobCount}
                                onChange={e => setInputs(prev => ({ ...prev, jobCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ワーカー数
                            </label>
                            <input
                                type="number"
                                value={inputs.workerCount}
                                onChange={e => setInputs(prev => ({ ...prev, workerCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                マッチング期間（時間）
                            </label>
                            <input
                                type="number"
                                value={inputs.matchingPeriod}
                                onChange={e => setInputs(prev => ({ ...prev, matchingPeriod: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                マッチング数
                            </label>
                            <input
                                type="number"
                                value={inputs.matchingCount}
                                onChange={e => setInputs(prev => ({ ...prev, matchingCount: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="空欄で予測"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handlePredict}
                        disabled={loading}
                        className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50"
                    >
                        {loading ? '予測中...' : '予測する'}
                    </button>
                </div>

                {/* 結果表示 */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">予測結果</h2>

                    {!result ? (
                        <div className="text-center py-12 text-slate-400">
                            パラメータを入力して「予測する」をクリックしてください
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測施設数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedFacilityCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測求人数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedJobCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測ワーカー数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedWorkerCount}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測マッチング期間</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedMatchingPeriod}時間
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">予測マッチング数</div>
                                <div className="text-xl font-bold text-slate-800">
                                    {result.predictedMatchingCount}
                                </div>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-lg">
                                <div className="text-xs text-indigo-500">予測信頼度</div>
                                <div className="text-xl font-bold text-indigo-600">
                                    {result.confidence}%
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
