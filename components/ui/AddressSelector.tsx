'use client';

import { useState, useMemo, useCallback } from 'react';
import { PREFECTURES } from '@/src/lib/analytics-constants';
import { CITIES_BY_PREFECTURE } from '@/constants/japan-cities';
import { X, Loader2 } from 'lucide-react';
import { PostalCodeInput } from './PostalCodeInput';

interface AddressSelectorProps {
    prefecture: string;
    city: string;
    addressLine?: string;
    building?: string;
    postalCode?: string;
    onChange: (data: {
        prefecture: string;
        city: string;
        addressLine?: string;
        building?: string;
        postalCode?: string;
    }) => void;
    showPostalCode?: boolean;
    showBuilding?: boolean;
    required?: boolean;
    showErrors?: boolean; // バリデーションエラー表示用
}

// 郵便番号APIレスポンス型
interface ZipCodeResult {
    address1: string; // 都道府県
    address2: string; // 市区町村
    address3: string; // 町域
}

export default function AddressSelector({
    prefecture,
    city,
    addressLine = '',
    building = '',
    postalCode = '',
    onChange,
    showPostalCode = true,
    showBuilding = true,
    required = false,
    showErrors = false
}: AddressSelectorProps) {
    const [citySearch, setCitySearch] = useState('');
    const [isSearchingPostalCode, setIsSearchingPostalCode] = useState(false);
    const [postalCodeError, setPostalCodeError] = useState('');

    // 郵便番号から住所を検索
    const searchAddressByPostalCode = useCallback(async (zipCode: string) => {
        // ハイフンを除去して数字のみに
        const cleanZipCode = zipCode.replace(/[-\s]/g, '');

        // 7桁でない場合は検索しない
        if (cleanZipCode.length !== 7 || !/^\d{7}$/.test(cleanZipCode)) {
            setPostalCodeError('');
            return;
        }

        setIsSearchingPostalCode(true);
        setPostalCodeError('');

        try {
            // zipcloud API（無料・CORS対応）
            const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZipCode}`);
            const data = await response.json();

            if (data.status === 200 && data.results && data.results.length > 0) {
                const result: ZipCodeResult = data.results[0];

                // 住所情報を更新
                onChange({
                    prefecture: result.address1,
                    city: result.address2,
                    addressLine: result.address3 || addressLine,
                    building,
                    postalCode: zipCode
                });
                setCitySearch('');
                setPostalCodeError('');
            } else {
                setPostalCodeError('該当する住所が見つかりませんでした');
            }
        } catch (error) {
            console.error('郵便番号検索エラー:', error);
            setPostalCodeError('住所の検索に失敗しました');
        } finally {
            setIsSearchingPostalCode(false);
        }
    }, [addressLine, building, onChange]);

    // 郵便番号変更時のハンドラー
    const handlePostalCodeChange = useCallback((value: string) => {
        // 郵便番号を更新
        onChange({ prefecture, city, addressLine, building, postalCode: value });
        setPostalCodeError('');
    }, [prefecture, city, addressLine, building, onChange]);

    // 郵便番号入力完了時のハンドラー（7桁入力時に住所検索）
    const handlePostalCodeComplete = useCallback((value: string) => {
        searchAddressByPostalCode(value);
    }, [searchAddressByPostalCode]);

    // 選択された都道府県の市区町村リスト
    const availableCities = useMemo(() => {
        if (!prefecture) return [];
        return CITIES_BY_PREFECTURE[prefecture] || [];
    }, [prefecture]);

    // 検索フィルター
    const filteredCities = useMemo(() => {
        if (!citySearch) return availableCities.slice(0, 50); // 初期表示は50件まで
        return availableCities.filter(c =>
            c.toLowerCase().includes(citySearch.toLowerCase())
        );
    }, [availableCities, citySearch]);

    const handlePrefectureChange = (newPref: string) => {
        onChange({
            prefecture: newPref,
            city: '', // 都道府県変更時は市区町村リセット
            addressLine,
            building,
            postalCode
        });
        setCitySearch('');
    };

    const handleCityChange = (newCity: string) => {
        onChange({
            prefecture,
            city: newCity,
            addressLine,
            building,
            postalCode
        });
    };

    return (
        <div className="space-y-4">
            {/* 郵便番号 */}
            {showPostalCode && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        郵便番号
                        <span className="ml-2 text-xs text-slate-500 font-normal">
                            ※入力すると住所が自動入力されます
                        </span>
                    </label>
                    <div className="flex items-center gap-2">
                        <PostalCodeInput
                            value={postalCode}
                            onChange={handlePostalCodeChange}
                            onComplete={handlePostalCodeComplete}
                            className="w-full max-w-[200px] px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                            placeholder="123-4567"
                        />
                        {isSearchingPostalCode && (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        )}
                    </div>
                    {postalCodeError && (
                        <p className="mt-1 text-xs text-red-500">{postalCodeError}</p>
                    )}
                </div>
            )}

            {/* 都道府県 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    都道府県 {required && <span className="text-red-500">*</span>}
                </label>
                <select
                    value={prefecture}
                    onChange={e => handlePrefectureChange(e.target.value)}
                    className={`w-full px-2 py-1.5 text-sm border rounded-lg ${showErrors && required && !prefecture ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                    required={required}
                >
                    <option value="">選択してください</option>
                    {PREFECTURES.map(pref => (
                        <option key={pref} value={pref}>{pref}</option>
                    ))}
                </select>
                {showErrors && required && !prefecture && (
                    <p className="text-red-500 text-xs mt-1">都道府県を選択してください</p>
                )}
            </div>

            {/* 市区町村 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    市区町村 {required && <span className="text-red-500">*</span>}
                    {!prefecture && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">
                            ※先に都道府県を選択してください
                        </span>
                    )}
                </label>
                {prefecture ? (
                    <>
                        {/* 選択済み表示 */}
                        {city && (
                            <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded">
                                    {city}
                                    <button
                                        type="button"
                                        onClick={() => handleCityChange('')}
                                        className="hover:text-indigo-900"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            </div>
                        )}
                        {!city && (
                            <>
                                <input
                                    type="text"
                                    value={citySearch}
                                    onChange={e => setCitySearch(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-sm border rounded-lg mb-2 ${showErrors && required && !city ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                                    placeholder="市区町村を検索..."
                                />
                                <div className={`flex flex-wrap gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto ${showErrors && required && !city ? 'border-red-500' : 'border-slate-300'}`}>
                                    {filteredCities.length === 0 ? (
                                        <span className="text-sm text-slate-400">
                                            {citySearch ? '検索結果がありません' : '市区町村がありません'}
                                        </span>
                                    ) : (
                                        filteredCities.map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => handleCityChange(c)}
                                                className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                                            >
                                                {c}
                                            </button>
                                        ))
                                    )}
                                </div>
                                {showErrors && required && !city && (
                                    <p className="text-red-500 text-xs mt-1">市区町村を選択してください</p>
                                )}
                                {availableCities.length > 50 && !citySearch && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {availableCities.length}件中50件表示。検索で絞り込めます
                                    </p>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <input
                        type="text"
                        disabled
                        className={`w-full px-2 py-1.5 text-sm border rounded-lg bg-slate-50 text-slate-400 ${showErrors && required && !city ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="都道府県を先に選択"
                    />
                )}
            </div>

            {/* 町名・番地 */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    町名・番地
                </label>
                <input
                    type="text"
                    value={addressLine}
                    onChange={e => onChange({ prefecture, city, addressLine: e.target.value, building, postalCode })}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                    placeholder="例: ●●町1-2-3"
                />
            </div>

            {/* 建物名 */}
            {showBuilding && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        建物名・部屋番号
                    </label>
                    <input
                        type="text"
                        value={building}
                        onChange={e => onChange({ prefecture, city, addressLine, building: e.target.value, postalCode })}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg"
                        placeholder="例: ○○マンション 101号室"
                    />
                </div>
            )}
        </div>
    );
}
