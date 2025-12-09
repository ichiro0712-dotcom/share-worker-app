'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAnalyticsRegions, createAnalyticsRegion, updateAnalyticsRegion, deleteAnalyticsRegion, RegionData } from '@/src/lib/analytics-actions';
import { PREFECTURES } from '@/src/lib/analytics-constants';
import { CITIES_BY_PREFECTURE } from '@/constants/japan-cities';
import Link from 'next/link';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';

// 都道府県ごとの市区町村データ型
type PrefectureCities = Record<string, string[]>;

export default function RegionsPage() {
    const [regions, setRegions] = useState<RegionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // フォームデータ
    const [name, setName] = useState('');
    const [prefectureCities, setPrefectureCities] = useState<PrefectureCities>({});

    // ステップ1: 都道府県選択
    const [selectedPrefecture, setSelectedPrefecture] = useState<string>('');

    // ステップ2: 市区町村選択
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [citySearch, setCitySearch] = useState('');

    // 選択した都道府県の市区町村リスト
    const availableCities = useMemo(() => {
        if (!selectedPrefecture) return [];
        return CITIES_BY_PREFECTURE[selectedPrefecture] || [];
    }, [selectedPrefecture]);

    // 検索フィルター
    const filteredCities = useMemo(() => {
        if (!citySearch) return availableCities;
        return availableCities.filter(city =>
            city.toLowerCase().includes(citySearch.toLowerCase())
        );
    }, [availableCities, citySearch]);

    const fetchRegions = async () => {
        setLoading(true);
        try {
            const data = await getAnalyticsRegions();
            setRegions(data);
        } catch (error) {
            console.error('Failed to fetch regions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegions();
    }, []);

    // 都道府県選択時のリセット
    useEffect(() => {
        setSelectedCities([]);
        setSelectAll(false);
        setCitySearch('');
    }, [selectedPrefecture]);

    // 「全て」選択の処理
    useEffect(() => {
        if (selectAll) {
            setSelectedCities([]);
        }
    }, [selectAll]);

    const resetForm = () => {
        setName('');
        setPrefectureCities({});
        setSelectedPrefecture('');
        setSelectedCities([]);
        setSelectAll(false);
        setCitySearch('');
    };

    const handleAddPrefecture = () => {
        if (!selectedPrefecture) return;

        setPrefectureCities(prev => ({
            ...prev,
            [selectedPrefecture]: selectAll ? [] : [...selectedCities]
        }));

        // リセット
        setSelectedPrefecture('');
        setSelectedCities([]);
        setSelectAll(false);
        setCitySearch('');
    };

    const handleRemovePrefecture = (pref: string) => {
        setPrefectureCities(prev => {
            const newData = { ...prev };
            delete newData[pref];
            return newData;
        });
    };

    const handleEditPrefecture = (pref: string) => {
        const cities = prefectureCities[pref];
        setSelectedPrefecture(pref);
        if (cities.length === 0) {
            setSelectAll(true);
            setSelectedCities([]);
        } else {
            setSelectAll(false);
            setSelectedCities(cities);
        }
        // 一旦削除して再追加できるようにする
        handleRemovePrefecture(pref);
    };

    const toggleCity = (city: string) => {
        if (selectAll) return;
        setSelectedCities(prev =>
            prev.includes(city)
                ? prev.filter(c => c !== city)
                : [...prev, city]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (Object.keys(prefectureCities).length === 0) {
            alert('少なくとも1つの都道府県を追加してください');
            return;
        }

        try {
            const data = {
                name,
                prefectureCities
            };
            if (editingId) {
                await updateAnalyticsRegion(editingId, data);
            } else {
                await createAnalyticsRegion(data);
            }
            setShowForm(false);
            setEditingId(null);
            resetForm();
            fetchRegions();
        } catch (error) {
            console.error('Failed to save region:', error);
        }
    };

    const handleEdit = (region: RegionData) => {
        setEditingId(region.id);
        setName(region.name);
        setPrefectureCities(region.prefectureCities);
        setSelectedPrefecture('');
        setSelectedCities([]);
        setSelectAll(false);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('この地域を削除しますか？')) return;
        try {
            await deleteAnalyticsRegion(id);
            fetchRegions();
        } catch (error) {
            console.error('Failed to delete region:', error);
        }
    };

    // 登録済み都道府県を除外
    const availablePrefectures = useMemo(() => {
        const registered = Object.keys(prefectureCities);
        return PREFECTURES.filter(p => !registered.includes(p));
    }, [prefectureCities]);

    // 表示用: 都道府県と市区町村の文字列
    const formatPrefectureCities = (data: PrefectureCities) => {
        return Object.entries(data).map(([pref, cities]) => {
            if (cities.length === 0) {
                return `${pref}: 全て`;
            }
            return `${pref}: ${cities.join(', ')}`;
        });
    };

    return (
        <div className="p-8">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">地域登録</h1>
                    <p className="text-slate-500">アナリティクスで使用する地域を登録します</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/system-admin/analytics"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                    >
                        戻る
                    </Link>
                    <button
                        onClick={() => {
                            setShowForm(true);
                            setEditingId(null);
                            resetForm();
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                    >
                        新規登録
                    </button>
                </div>
            </div>

            {/* フォーム */}
            {showForm && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">
                        {editingId ? '地域を編集' : '新規地域登録'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        {/* 地域タイトル */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                地域タイトル
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                placeholder="例: 関東エリア"
                                required
                            />
                        </div>

                        {/* 登録済みエリア */}
                        {Object.keys(prefectureCities).length > 0 && (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    登録済みエリア
                                </label>
                                <div className="space-y-2">
                                    {Object.entries(prefectureCities).map(([pref, cities]) => (
                                        <div
                                            key={pref}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                        >
                                            <div className="flex-1">
                                                <span className="font-medium text-slate-800">{pref}</span>
                                                <span className="text-slate-500 ml-2">
                                                    {cities.length === 0 ? '全て' : cities.join(', ')}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditPrefecture(pref)}
                                                    className="p-1 text-slate-500 hover:text-indigo-600"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePrefecture(pref)}
                                                    className="p-1 text-slate-500 hover:text-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ステップ1: 都道府県選択 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ① 都道府県を選択
                            </label>
                            <div className="flex flex-wrap gap-2 p-3 border border-slate-300 rounded-lg max-h-40 overflow-y-auto">
                                {availablePrefectures.map(pref => (
                                    <button
                                        key={pref}
                                        type="button"
                                        onClick={() => setSelectedPrefecture(pref)}
                                        className={`px-2 py-1 text-xs rounded transition ${selectedPrefecture === pref
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {pref}
                                    </button>
                                ))}
                                {availablePrefectures.length === 0 && (
                                    <span className="text-sm text-slate-400">
                                        全ての都道府県が登録済みです
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ステップ2: 市区町村選択 */}
                        {selectedPrefecture && (
                            <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    ② 市区町村を選択（{selectedPrefecture}）
                                </label>

                                {/* 「全て」チェックボックス */}
                                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={e => setSelectAll(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="font-medium text-slate-800">全て（{selectedPrefecture}全域）</span>
                                </label>

                                {!selectAll && (
                                    <>
                                        {/* 検索 */}
                                        <input
                                            type="text"
                                            value={citySearch}
                                            onChange={e => setCitySearch(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2"
                                            placeholder="市区町村を検索..."
                                        />

                                        {/* 選択済み表示 */}
                                        {selectedCities.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {selectedCities.map(city => (
                                                    <span
                                                        key={city}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded"
                                                    >
                                                        {city}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCity(city)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* 市区町村リスト */}
                                        <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                            {filteredCities.map(city => (
                                                <button
                                                    key={city}
                                                    type="button"
                                                    onClick={() => toggleCity(city)}
                                                    className={`px-2 py-1 text-xs rounded transition ${selectedCities.includes(city)
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {city}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {availableCities.length}件中 {selectedCities.length}件選択中
                                        </p>
                                    </>
                                )}

                                {/* 追加ボタン */}
                                <button
                                    type="button"
                                    onClick={handleAddPrefecture}
                                    disabled={!selectAll && selectedCities.length === 0}
                                    className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    この都道府県を追加
                                </button>
                            </div>
                        )}

                        {/* 送信ボタン */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                            <button
                                type="submit"
                                disabled={Object.keys(prefectureCities).length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingId ? '更新' : '登録'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
                            >
                                キャンセル
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 一覧 */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : regions.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    登録された地域はありません
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-slate-200">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">地域タイトル</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">対象エリア</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {regions.map(region => (
                                <tr key={region.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                                        {region.name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                        <div className="space-y-1">
                                            {formatPrefectureCities(region.prefectureCities).map((line, idx) => (
                                                <div key={idx}>{line}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleEdit(region)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                                        >
                                            編集
                                        </button>
                                        <button
                                            onClick={() => handleDelete(region.id)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
