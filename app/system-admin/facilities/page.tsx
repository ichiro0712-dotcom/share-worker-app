'use client';

import { useState, useEffect } from 'react';
import {
    getSystemFacilitiesExtended,
    generateMasqueradeToken,
    geocodeAddress,
    createPendingFacilityWithMasquerade,
    deletePendingFacility
} from '@/src/lib/system-actions';
import { Search, Filter, Building2, LogIn, MapPin, ArrowUpDown, RefreshCw, Plus, X, Mail, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { useSystemAuth } from '@/contexts/SystemAuthContext';
import { PREFECTURES } from '@/constants/job';
import { getCitiesByPrefecture, Prefecture } from '@/constants/prefectureCities';
import { SERVICE_TYPES } from '@/constants/serviceTypes';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

interface Facility {
    id: number;
    facility_name: string;
    corporation_name?: string;
    facility_type: string;
    prefecture: string;
    city: string;
    created_at: Date;
    parentJobCount: number;
    childJobCount: number;
    applicationCount: number;
    matchingCount: number;
    avgApplicationMatchingPeriod: number;
    distance?: number;
    is_pending?: boolean;
}

export default function SystemAdminFacilitiesPage() {
    const { showDebugError } = useDebugError();
    const { admin } = useSystemAuth();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [search, setSearch] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [prefecture, setPrefecture] = useState('');
    const [city, setCity] = useState('');
    const [cityOptions, setCityOptions] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    // Distance Filter
    const [distanceSearchEnabled, setDistanceSearchEnabled] = useState(false);
    const [addressFilter, setAddressFilter] = useState('');
    const [radius, setRadius] = useState(10);
    const [geoLoading, setGeoLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

    // Sort
    const [sort, setSort] = useState('created_at');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    // 新規施設登録モーダル
    const [showNewFacilityModal, setShowNewFacilityModal] = useState(false);
    const [newFacilityForm, setNewFacilityForm] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [creatingFacility, setCreatingFacility] = useState(false);

    // 都道府県が変更されたら市区町村リストを更新
    useEffect(() => {
        if (prefecture) {
            const cities = getCitiesByPrefecture(prefecture as Prefecture);
            setCityOptions(cities);
            setCity(''); // 都道府県を変更したら市区町村をリセット
        } else {
            setCityOptions([]);
            setCity('');
        }
    }, [prefecture]);


    const handleCreateNewFacility = async () => {
        if (!admin) {
            toast.error('管理者情報が取得できません');
            return;
        }

        // バリデーション
        if (!newFacilityForm.email) {
            toast.error('メールアドレスを入力してください');
            return;
        }
        if (!newFacilityForm.password || newFacilityForm.password.length < 8) {
            toast.error('パスワードは8文字以上で入力してください');
            return;
        }
        if (newFacilityForm.password !== newFacilityForm.confirmPassword) {
            toast.error('パスワードが一致しません');
            return;
        }

        setCreatingFacility(true);
        try {
            const result = await createPendingFacilityWithMasquerade(
                admin.adminId,
                newFacilityForm.email,
                newFacilityForm.password
            );

            if (result.success && result.token) {
                toast.success('施設を作成しました。施設管理画面で詳細を入力してください。');
                setShowNewFacilityModal(false);
                setNewFacilityForm({ email: '', password: '', confirmPassword: '' });
                // マスカレードして施設管理画面へ
                window.open(`/admin/masquerade?token=${result.token}&redirect=/admin/facility`, '_blank');
            } else {
                const debugInfo = extractDebugInfo(result.error);
                showDebugError({
                    type: 'save',
                    operation: '仮登録施設作成',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { email: newFacilityForm.email }
                });
                toast.error(result.error || '施設の作成に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'save',
                operation: '仮登録施設作成',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { email: newFacilityForm.email }
            });
            console.error('Create facility error:', error);
            toast.error('施設の作成に失敗しました');
        } finally {
            setCreatingFacility(false);
        }
    };

    // 仮登録状態の施設を削除
    const handleDeletePendingFacility = async (facilityId: number, facilityName: string) => {
        if (!admin) {
            toast.error('管理者情報が取得できません');
            return;
        }

        if (!confirm(`「${facilityName}」を削除しますか？\nこの操作は取り消せません。`)) {
            return;
        }

        try {
            const result = await deletePendingFacility(facilityId, admin.adminId);
            if (result.success) {
                toast.success('施設を削除しました');
                fetchFacilities();
            } else {
                const debugInfo = extractDebugInfo(result.error);
                showDebugError({
                    type: 'delete',
                    operation: '仮登録施設削除',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { facilityId }
                });
                toast.error(result.error || '削除に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'delete',
                operation: '仮登録施設削除',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId }
            });
            console.error('Delete facility error:', error);
            toast.error('削除に失敗しました');
        }
    };

    const fetchFacilities = async () => {
        setLoading(true);
        try {
            let distanceFrom = undefined;
            if (distanceSearchEnabled && currentLocation) {
                distanceFrom = {
                    ...currentLocation,
                    maxDistance: radius
                };
            }

            const data = await getSystemFacilitiesExtended(
                page,
                20,
                search,
                sort,
                order,
                {
                    facilityType: serviceType || undefined,
                    prefecture: prefecture || undefined,
                    city: city || undefined,
                    distanceFrom
                }
            );
            setFacilities(data.facilities as any); // Type cast due to detailed object
            setTotalCount(data.total);
            setTotalPages(data.totalPages);
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'システム管理施設一覧取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { page, search, serviceType, prefecture, city }
            });
            console.error(error);
            toast.error('データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFacilities();
    }, [page, sort, order, currentLocation]); // Trigger fetch on sort/geo change

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchFacilities();
    };

    // フィルターリセット用のトリガー
    const [resetTrigger, setResetTrigger] = useState(0);

    const clearFilters = () => {
        setSearch('');
        setServiceType('');
        setPrefecture('');
        setCity('');
        setDistanceSearchEnabled(false);
        setAddressFilter('');
        setCurrentLocation(null);
        setPage(1);
        // stateが更新された後にfetchするためにトリガーをインクリメント
        setResetTrigger(prev => prev + 1);
    };

    // リセットトリガーが変更されたらfetch（初回は除く）
    useEffect(() => {
        if (resetTrigger > 0) {
            fetchFacilities();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetTrigger]);

    // フィルター適用時のハンドラー（距離検索時はジオコーディングも実行）
    const handleApplyFilters = async () => {
        setPage(1);
        // 距離検索が有効で住所が入力されている場合、座標を取得
        if (distanceSearchEnabled && addressFilter.trim() && !currentLocation) {
            setGeoLoading(true);
            try {
                const result = await geocodeAddress(addressFilter);
                if (result) {
                    setCurrentLocation(result);
                } else {
                    toast.error('住所が見つかりませんでした。より詳細な住所を入力してください。');
                    setGeoLoading(false);
                    return;
                }
            } catch (e) {
                const debugInfo = extractDebugInfo(e);
                showDebugError({
                    type: 'other',
                    operation: 'ジオコーディング(施設検索)',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { address: addressFilter }
                });
                toast.error('ジオコーディングエラー');
                setGeoLoading(false);
                return;
            } finally {
                setGeoLoading(false);
            }
        }
        fetchFacilities();
        setShowFilters(false);
    };

    const handleSort = (key: string) => {
        if (sort === key) {
            setOrder(order === 'asc' ? 'desc' : 'asc');
        } else {
            setSort(key);
            setOrder('desc');
        }
    };

    const handleMasquerade = async (facilityId: number, facilityName: string) => {
        if (!admin) return;
        if (!confirm(`「${facilityName}」の管理者としてログインしますか？`)) return;

        try {
            const token = await generateMasqueradeToken(facilityId, admin.adminId);
            if (token) {
                window.open(`/admin/masquerade?token=${token}`, '_blank');
            }
        } catch (e) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: 'other',
                operation: 'マスカレードトークン生成(施設検索)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId }
            });
            toast.error('ログイン準備に失敗しました');
        }
    };

    // Helper for sort icon
    const SortIcon = ({ column }: { column: string }) => {
        if (sort !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
        return <ArrowUpDown className={`w-3 h-3 text-indigo-500 ml-1 inline ${order === 'asc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">施設管理</h1>
                    <p className="text-slate-500">登録施設の一覧・管理・利用統計</p>
                </div>
                <button
                    onClick={() => setShowNewFacilityModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    新規施設登録
                </button>
            </div>

            {/* Filters Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 mb-6">
                <div className="flex flex-col gap-4">
                    <div className="flex gap-4">
                        <form onSubmit={handleSearch} className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="施設名、法人名、住所、IDで検索"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </form>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Filter className="w-4 h-4" />
                            詳細フィルター
                        </button>
                    </div>

                    {showFilters && (
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">サービス種別</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                >
                                    <option value="">すべて</option>
                                    {SERVICE_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">都道府県</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    value={prefecture}
                                    onChange={(e) => setPrefecture(e.target.value)}
                                    disabled={distanceSearchEnabled}
                                >
                                    <option value="">すべて</option>
                                    {PREFECTURES.map((pref) => (
                                        <option key={pref} value={pref}>{pref}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">市区町村</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    disabled={!prefecture || distanceSearchEnabled}
                                >
                                    <option value="">すべて</option>
                                    {cityOptions.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Distance Filter - チェックボックストグル形式 */}
                            <div className="md:col-span-5 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        id="distanceSearchFacility"
                                        checked={distanceSearchEnabled}
                                        onChange={(e) => {
                                            setDistanceSearchEnabled(e.target.checked);
                                            if (e.target.checked) {
                                                // 距離検索有効時は都道府県・市区町村フィルターをクリア
                                                setPrefecture('');
                                                setCity('');
                                            } else {
                                                setCurrentLocation(null);
                                            }
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="distanceSearchFacility" className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                        <MapPin className="w-4 h-4 text-indigo-500" />
                                        距離検索を有効にする
                                    </label>
                                </div>

                                {distanceSearchEnabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">基準住所</label>
                                            <input
                                                type="text"
                                                placeholder="例: 東京都渋谷区渋谷1-1-1"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={addressFilter}
                                                onChange={(e) => {
                                                    setAddressFilter(e.target.value);
                                                    setCurrentLocation(null);
                                                }}
                                            />
                                            {currentLocation && (
                                                <div className="mt-1 text-xs text-green-600">
                                                    ✓ 座標取得済み（{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}）
                                                </div>
                                            )}
                                            <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                ※現在国土地理院APIを利用しています。精度向上には有料のGoogle Geocoding APIが必要です
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">距離（km）</label>
                                            <select
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={radius}
                                                onChange={(e) => setRadius(Number(e.target.value))}
                                            >
                                                {[1, 3, 5, 10, 15, 20, 30].map(km => (
                                                    <option key={km} value={km}>{km}km以内</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-5 flex justify-end gap-2 mt-2">
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700 hover:bg-slate-50 rounded-lg"
                                >
                                    リセット
                                </button>
                                <button
                                    onClick={handleApplyFilters}
                                    disabled={geoLoading}
                                    className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {geoLoading ? '処理中...' : '適用'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                        <tr>
                            <th className="px-4 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('facility_name')}>
                                施設情報 <SortIcon column="facility_name" />
                            </th>
                            <th className="px-4 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('facility_type')}>
                                種別/エリア <SortIcon column="facility_type" />
                            </th>
                            <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('parentJobCount')}>
                                親求人 <SortIcon column="parentJobCount" />
                            </th>
                            <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('childJobCount')}>
                                子求人 <SortIcon column="childJobCount" />
                            </th>
                            <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('applicationCount')}>
                                応募数 <SortIcon column="applicationCount" />
                            </th>
                            <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('matchingCount')}>
                                マッチング <SortIcon column="matchingCount" />
                            </th>
                            <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('avgApplicationMatchingPeriod')}>
                                平均マッチング時間 <SortIcon column="avgApplicationMatchingPeriod" />
                            </th>
                            {distanceSearchEnabled && currentLocation && (
                                <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('distance')}>
                                    距離 <SortIcon column="distance" />
                                </th>
                            )}
                            <th className="px-4 py-4 text-right">アクション</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                                    読み込み中...
                                </td>
                            </tr>
                        ) : facilities.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Building2 className="w-12 h-12 text-slate-300" />
                                        <p>施設が見つかりません</p>
                                        {(search || serviceType || prefecture || city || distanceSearchEnabled) && (
                                            <button
                                                onClick={clearFilters}
                                                className="text-indigo-600 hover:underline text-sm"
                                            >
                                                フィルターをリセット
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            facilities.map((facility) => (
                                <tr key={facility.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${facility.is_pending ? 'bg-amber-50' : 'bg-indigo-50'}`}>
                                                <Building2 className={`w-5 h-5 ${facility.is_pending ? 'text-amber-500' : 'text-indigo-500'}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 text-sm">{facility.facility_name}</span>
                                                    {facility.is_pending && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            設定中
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">{facility.corporation_name}</div>
                                                <div className="text-xs text-slate-400">ID: {facility.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="inline-flex max-w-min px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full whitespace-nowrap">
                                                {facility.facility_type}
                                            </span>
                                            <div className="text-xs text-slate-500 flex items-center gap-0.5">
                                                <MapPin className="w-3 h-3" />
                                                {facility.prefecture}{facility.city}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="font-medium text-slate-700">{facility.parentJobCount}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="font-medium text-slate-700">{facility.childJobCount}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="font-medium text-slate-700">{facility.applicationCount}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="font-bold text-indigo-600">{facility.matchingCount}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="text-sm text-slate-600">
                                            {facility.avgApplicationMatchingPeriod > 0 ? `${facility.avgApplicationMatchingPeriod.toFixed(1)}h` : '-'}
                                        </span>
                                    </td>
                                    {distanceSearchEnabled && currentLocation && (
                                        <td className="px-4 py-4 text-center">
                                            <span className="text-sm font-medium text-indigo-700">
                                                {facility.distance?.toFixed(1)}km
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="管理者としてログイン"
                                                onClick={() => handleMasquerade(facility.id, facility.facility_name)}
                                            >
                                                <LogIn className="w-4 h-4" />
                                            </button>
                                            {facility.is_pending && (
                                                <button
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="仮登録施設を削除"
                                                    onClick={() => handleDeletePendingFacility(facility.id, facility.facility_name)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
                <div className="text-sm text-slate-500">
                    全 {totalCount} 件中 {(page - 1) * 20 + 1} - {Math.min(page * 20, totalCount)} 件を表示
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        前へ
                    </button>
                    <div className="flex items-center gap-1 px-2">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            // Simple pagination logic for now
                            let p = page;
                            if (totalPages <= 5) p = i + 1;
                            else if (page < 3) p = i + 1;
                            else if (page > totalPages - 2) p = totalPages - 4 + i;
                            else p = page - 2 + i;

                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-sm ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-sm"
                    >
                        次へ
                    </button>
                </div>
            </div>

            {/* 新規施設登録モーダル */}
            {showNewFacilityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewFacilityModal(false)}></div>
                    <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                        <button
                            onClick={() => setShowNewFacilityModal(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-indigo-600" />
                                新規施設登録
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                まず施設管理者のログイン情報を設定してください。
                                その後、施設管理画面で詳細を入力します。
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    メールアドレス <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        value={newFacilityForm.email}
                                        onChange={(e) => setNewFacilityForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="admin@example.com"
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    パスワード <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={newFacilityForm.password}
                                        onChange={(e) => setNewFacilityForm(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="8文字以上"
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    パスワード（確認） <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={newFacilityForm.confirmPassword}
                                        onChange={(e) => setNewFacilityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        placeholder="パスワードを再入力"
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                            <p className="text-xs text-amber-800">
                                <strong>次のステップ：</strong>
                                登録ボタンを押すと、新しいタブで施設管理画面が開きます。
                                そこで法人情報・施設情報・責任者情報などの詳細を入力してください。
                            </p>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowNewFacilityModal(false)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleCreateNewFacility}
                                disabled={creatingFacility}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {creatingFacility ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        作成中...
                                    </>
                                ) : (
                                    '登録して詳細を入力'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
