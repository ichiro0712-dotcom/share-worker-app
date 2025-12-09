'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSystemWorkers, geocodeAddress } from '@/src/lib/system-actions';
import { Search, Filter, Eye, Ban, ChevronDown, X, ArrowUpDown, Users, MapPin, Star, Briefcase } from 'lucide-react';
import { PREFECTURES, QUALIFICATION_OPTIONS } from '@/constants/job';
import { getCitiesByPrefecture, Prefecture } from '@/constants/prefectureCities';

interface Worker {
    id: number;
    name: string;
    email: string;
    phone_number: string | null;
    created_at: Date;
    qualifications: string[];
    profile_image: string | null;
    prefecture: string | null;
    city: string | null;
    gender: string | null;
    birth_date: Date | null;
    isSuspended: boolean;
    age: number | null;
    avgRating: number | null;
    reviewCount: number;
    totalWorkCount: number;
    distance: number | null;
}

type SortField = 'created_at' | 'name' | 'prefecture' | 'totalWorkCount' | 'avgRating' | 'reviewCount';
type SortOrder = 'asc' | 'desc';

export default function SystemAdminWorkersPage() {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // フィルター状態
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
    const [prefectureFilter, setPrefectureFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [qualificationFilter, setQualificationFilter] = useState('');

    // 距離検索
    const [distanceSearchEnabled, setDistanceSearchEnabled] = useState(false);
    const [distanceAddress, setDistanceAddress] = useState('');
    const [distanceKm, setDistanceKm] = useState(10);
    const [distanceCoords, setDistanceCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [geocodingLoading, setGeocodingLoading] = useState(false);

    // 市区町村リスト
    const [cityOptions, setCityOptions] = useState<string[]>([]);

    // ソート状態
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // 都道府県が変更されたら市区町村リストを更新
    useEffect(() => {
        if (prefectureFilter) {
            const cities = getCitiesByPrefecture(prefectureFilter as Prefecture);
            setCityOptions(cities);
            setCityFilter(''); // 都道府県を変更したら市区町村をリセット
        } else {
            setCityOptions([]);
            setCityFilter('');
        }
    }, [prefectureFilter]);

    const fetchWorkers = async () => {
        setLoading(true);
        try {
            const filters: any = {
                status: statusFilter,
                prefecture: prefectureFilter || undefined,
                city: cityFilter || undefined,
                qualification: qualificationFilter || undefined,
            };

            // 距離検索が有効で座標がある場合
            if (distanceSearchEnabled && distanceCoords) {
                filters.distanceFrom = {
                    lat: distanceCoords.lat,
                    lng: distanceCoords.lng,
                    maxDistance: distanceKm,
                };
            }

            const data = await getSystemWorkers(page, 20, search, sortField, sortOrder, filters);
            setWorkers(data.workers);
            setTotalPages(data.totalPages);
            setTotalCount(data.total);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkers();
    }, [page, sortField, sortOrder, distanceCoords, distanceSearchEnabled]); // Added distanceCoords and distanceSearchEnabled to dependencies

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchWorkers();
    };

    const handleApplyFilters = async () => {
        setPage(1);
        // 距離検索が有効で住所が入力されている場合、座標を取得
        if (distanceSearchEnabled && distanceAddress.trim() && !distanceCoords) {
            setGeocodingLoading(true);
            try {
                const coords = await geocodeAddress(distanceAddress);
                if (coords) {
                    setDistanceCoords(coords);
                } else {
                    alert('住所から座標を取得できませんでした。より詳細な住所を入力してください。');
                    setGeocodingLoading(false);
                    return;
                }
            } catch (error) {
                console.error('Geocoding error:', error);
                alert('ジオコーディングに失敗しました');
                setGeocodingLoading(false);
                return;
            } finally {
                setGeocodingLoading(false);
            }
        }
        fetchWorkers();
        setShowFilters(false);
    };

    const handleResetFilters = () => {
        setStatusFilter('all');
        setPrefectureFilter('');
        setCityFilter('');
        setQualificationFilter('');
        setDistanceSearchEnabled(false);
        setDistanceAddress('');
        setDistanceCoords(null);
        setDistanceKm(10);
        setPage(1);
        setTimeout(() => fetchWorkers(), 0);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const activeFilterCount = [
        statusFilter !== 'all',
        prefectureFilter !== '',
        cityFilter !== '',
        qualificationFilter !== '',
        distanceSearchEnabled && distanceCoords !== null,
    ].filter(Boolean).length;

    const SortButton = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 hover:text-indigo-600 transition-colors ${sortField === field ? 'text-indigo-600 font-semibold' : ''
                }`}
        >
            {label}
            <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'opacity-100' : 'opacity-50'}`} />
        </button>
    );

    // 評価の星を表示
    const renderRating = (rating: number | null) => {
        if (rating === null) return <span className="text-slate-400 text-xs">評価なし</span>;
        return (
            <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium text-slate-700">{rating.toFixed(1)}</span>
            </div>
        );
    };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Users className="w-7 h-7 text-indigo-600" />
                        ワーカー管理
                    </h1>
                    <p className="text-slate-500">登録ワーカーの一覧・管理</p>
                </div>
                <div className="text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-lg">
                    全 <span className="font-bold text-slate-800">{totalCount}</span> 名
                </div>
            </div>

            {/* 検索・フィルター */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                <div className="flex gap-4 flex-wrap">
                    <form onSubmit={handleSearch} className="flex-1 min-w-[300px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ID、名前、メールアドレス、電話番号で検索"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </form>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${showFilters || activeFilterCount > 0
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        詳細フィルター
                        {activeFilterCount > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* フィルターパネル */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* ステータス */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">すべて</option>
                                    <option value="active">有効</option>
                                    <option value="suspended">停止中</option>
                                </select>
                            </div>

                            {/* 都道府県 */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">都道府県</label>
                                <select
                                    value={prefectureFilter}
                                    onChange={(e) => setPrefectureFilter(e.target.value)}
                                    disabled={distanceSearchEnabled}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    <option value="">すべて</option>
                                    {PREFECTURES.map((pref) => (
                                        <option key={pref} value={pref}>{pref}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 市区町村 */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">市区町村</label>
                                <select
                                    value={cityFilter}
                                    onChange={(e) => setCityFilter(e.target.value)}
                                    disabled={!prefectureFilter || distanceSearchEnabled}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    <option value="">すべて</option>
                                    {cityOptions.map((city) => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 資格 */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">保有資格</label>
                                <select
                                    value={qualificationFilter}
                                    onChange={(e) => setQualificationFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">すべて</option>
                                    {QUALIFICATION_OPTIONS.map((q) => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 距離検索セクション */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="distanceSearch"
                                    checked={distanceSearchEnabled}
                                    onChange={(e) => {
                                        setDistanceSearchEnabled(e.target.checked);
                                        if (e.target.checked) {
                                            // 距離検索有効時は都道府県・市区町村フィルターをクリア
                                            setPrefectureFilter('');
                                            setCityFilter('');
                                        } else {
                                            setDistanceCoords(null);
                                        }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="distanceSearch" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                    <MapPin className="w-4 h-4 text-indigo-500" />
                                    距離検索を有効にする
                                </label>
                            </div>

                            {distanceSearchEnabled && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">基準住所</label>
                                        <input
                                            type="text"
                                            placeholder="例: 東京都渋谷区渋谷1-1-1"
                                            value={distanceAddress}
                                            onChange={(e) => {
                                                setDistanceAddress(e.target.value);
                                                // 住所が変更されたら座標をリセット
                                                setDistanceCoords(null);
                                            }}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        {distanceCoords && (
                                            <div className="mt-1 text-xs text-green-600">
                                                ✓ 座標取得済み（{distanceCoords.lat.toFixed(4)}, {distanceCoords.lng.toFixed(4)}）
                                            </div>
                                        )}
                                        <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                            ※現在国土地理院APIを利用しています。精度向上には有料のGoogle Geocoding APIが必要です
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">距離（km）</label>
                                        <select
                                            value={distanceKm}
                                            onChange={(e) => setDistanceKm(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            {[1, 3, 5, 10, 15, 20, 30].map(km => (
                                                <option key={km} value={km}>{km}km以内</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={handleResetFilters}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                リセット
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                適用
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* アクティブフィルター表示 */}
            {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-xs text-slate-500">フィルター:</span>
                    {statusFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            {statusFilter === 'active' ? '有効' : '停止中'}
                            <button onClick={() => { setStatusFilter('all'); fetchWorkers(); }}>
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {prefectureFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            {prefectureFilter}
                            <button onClick={() => { setPrefectureFilter(''); setCityFilter(''); fetchWorkers(); }}>
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {cityFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            {cityFilter}
                            <button onClick={() => { setCityFilter(''); fetchWorkers(); }}>
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {qualificationFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            {qualificationFilter}
                            <button onClick={() => { setQualificationFilter(''); fetchWorkers(); }}>
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {distanceSearchEnabled && distanceCoords && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            <MapPin className="w-3 h-3" />
                            {distanceKm}km以内
                            <button onClick={() => { setDistanceSearchEnabled(false); setDistanceCoords(null); fetchWorkers(); }}>
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}

            {/* テーブル */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4">ワーカー</th>
                            <th className="px-6 py-4">年齢 / 性別</th>
                            <th className="px-6 py-4">
                                {distanceSearchEnabled && distanceCoords ? '距離' : <SortButton field="prefecture" label="地域" />}
                            </th>
                            <th className="px-6 py-4">評価</th>
                            <th className="px-6 py-4">勤務回数</th>
                            <th className="px-6 py-4">資格</th>
                            <th className="px-6 py-4 text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        読み込み中...
                                    </div>
                                </td>
                            </tr>
                        ) : workers.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="w-12 h-12 text-slate-300" />
                                        <p>ワーカーが見つかりません</p>
                                        {activeFilterCount > 0 && (
                                            <button
                                                onClick={handleResetFilters}
                                                className="text-indigo-600 hover:underline text-sm"
                                            >
                                                フィルターをリセット
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            workers.map((worker) => (
                                <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                                {worker.profile_image ? (
                                                    <img src={worker.profile_image} alt={worker.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-slate-500 font-bold">{worker.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{worker.name}</div>
                                                <div className="text-xs text-slate-500">ID: {worker.id}</div>
                                                {worker.isSuspended && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium mt-0.5">
                                                        <Ban className="w-2.5 h-2.5" />
                                                        停止中
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-700">
                                            {worker.age !== null ? `${worker.age}歳` : '-'}
                                            {worker.gender && ` / ${worker.gender}`}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {distanceSearchEnabled && distanceCoords && worker.distance !== null ? (
                                            <div className="flex items-center gap-1 text-sm">
                                                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="font-medium text-indigo-700">{worker.distance.toFixed(1)}km</span>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-600">
                                                {worker.prefecture}{worker.city && ` ${worker.city}`}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {renderRating(worker.avgRating)}
                                        {worker.reviewCount > 0 && (
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                ({worker.reviewCount}件)
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm text-slate-700">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-medium">{worker.totalWorkCount}</span>
                                            <span className="text-slate-400">回</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {worker.qualifications.slice(0, 2).map((q, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full">
                                                    {q}
                                                </span>
                                            ))}
                                            {worker.qualifications.length > 2 && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">
                                                    +{worker.qualifications.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/system-admin/workers/${worker.id}`}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-medium"
                                        >
                                            <Eye className="w-4 h-4" />
                                            詳細
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-sm"
                        >
                            最初
                        </button>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-sm"
                        >
                            前へ
                        </button>
                        <span className="px-4 py-1 text-slate-600 font-medium">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-sm"
                        >
                            次へ
                        </button>
                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-sm"
                        >
                            最後
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
