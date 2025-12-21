'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { SERVICE_TYPES } from '@/constants/serviceTypes';
import { PREFECTURES, PREFECTURE_CITIES, type Prefecture } from '@/constants/prefectureCities';
import { geocodeAddress } from '@/src/lib/geocoding';

interface FilterState {
  prefecture: string;
  city: string;
  jobTypes: string[];
  workTimeTypes: string[];
  timeRangeFrom: string;
  timeRangeTo: string;
  minWage: string;
  serviceTypes: string[];
  transportations: string[];
  otherConditions: string[];
  // 距離検索用
  distanceEnabled: boolean;
  distanceAddress: string;
  distanceKm: number;
  distanceLat: number | null;
  distanceLng: number | null;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

// 都道府県と市区町村のデータはprefectureCities.tsからインポート

// serviceTypes imported from constants

const transportations = [
  '車',
  'バイク',
  '自転車',
  '公共交通機関（電車・バス・徒歩）',
  '敷地内駐車場あり',
];

const otherConditionsOptions = [
  '未経験者歓迎',
  'ブランク歓迎',
  '髪型・髪色自由',
  'ネイルOK',
  '制服貸与',
  '車通勤OK',
  '食事補助',
];

const wageOptions = [
  '800円以上',
  '900円以上',
  '1000円以上',
  '1100円以上',
  '1200円以上',
  '1300円以上',
  '1400円以上',
  '1500円以上',
  '1600円以上',
  '1700円以上',
  '1800円以上',
  '1900円以上',
  '2000円以上',
  '2500円以上',
  '3000円以上',
];

const defaultFilters: FilterState = {
  prefecture: '',
  city: '',
  jobTypes: [],
  workTimeTypes: [],
  timeRangeFrom: '',
  timeRangeTo: '',
  minWage: '',
  serviceTypes: [],
  transportations: [],
  otherConditions: [],
  distanceEnabled: false,
  distanceAddress: '',
  distanceKm: 10,
  distanceLat: null,
  distanceLng: null,
};

export function FilterModal({ isOpen, onClose, onApply, initialFilters }: FilterModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters, ...initialFilters });

  // initialFiltersが変更されたらfiltersを更新
  useEffect(() => {
    if (isOpen && initialFilters) {
      setFilters({ ...defaultFilters, ...initialFilters });
      // さらに絞り込むセクションを開く（serviceTypes, transportations, otherConditionsのいずれかがある場合）
      if (
        (initialFilters.serviceTypes && initialFilters.serviceTypes.length > 0) ||
        (initialFilters.transportations && initialFilters.transportations.length > 0) ||
        (initialFilters.otherConditions && initialFilters.otherConditions.length > 0)
      ) {
        setShowAdvanced(true);
      }
    }
  }, [isOpen, initialFilters]);

  // 時間の選択肢を生成 (00:00 から 23:30まで30分刻み)
  const timeOptions: string[] = [];
  for (let i = 0; i < 24; i++) {
    timeOptions.push(`${i.toString().padStart(2, '0')}:00`);
    timeOptions.push(`${i.toString().padStart(2, '0')}:30`);
  }

  const handleCheckboxChange = (
    field: keyof FilterState,
    value: string,
    checked: boolean
  ) => {
    setFilters((prev) => {
      const currentArray = prev[field] as string[];
      return {
        ...prev,
        [field]: checked
          ? [...currentArray, value]
          : currentArray.filter((v) => v !== value),
      };
    });
  };

  const handleReset = () => {
    setFilters({
      prefecture: '',
      city: '',
      jobTypes: [],
      workTimeTypes: [],
      timeRangeFrom: '',
      timeRangeTo: '',
      minWage: '',
      serviceTypes: [],
      transportations: [],
      otherConditions: [],
      distanceEnabled: false,
      distanceAddress: '',
      distanceKm: 10,
      distanceLat: null,
      distanceLng: null,
    });
  };

  // 住所から座標を取得
  const handleGeocodeAddress = async () => {
    if (!filters.distanceAddress.trim()) return;

    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(filters.distanceAddress);
      if (result) {
        setFilters(prev => ({
          ...prev,
          distanceLat: result.lat,
          distanceLng: result.lng,
        }));
      } else {
        alert('住所が見つかりませんでした');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('住所の検索に失敗しました');
    } finally {
      setIsGeocoding(false);
    }
  };

  // 距離検索のバリデーション
  const [validationError, setValidationError] = useState('');

  const handleApply = () => {
    // 距離検索ONで座標未取得の場合はエラー
    if (filters.distanceEnabled && (!filters.distanceLat || !filters.distanceLng)) {
      setValidationError('住所を入力して「検索」ボタンで座標を取得してください');
      return;
    }
    setValidationError('');
    onApply(filters);
    onClose();
  };

  // キャンセル（変更を破棄してモーダルを閉じる）
  const handleCancel = () => {
    // フィルターを初期値に戻す
    setFilters({ ...defaultFilters, ...initialFilters });
    setValidationError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* オーバーレイ */}
        <div
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* モーダルコンテンツ */}
        <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl overflow-y-auto">
          {/* ヘッダー */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold">絞り込み検索</h2>
            <button onClick={onClose}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* フィルター内容 */}
          <div className="p-4 space-y-6">
            {/* 勤務地 */}
            <div>
              <label className="block text-sm font-bold mb-2">勤務地</label>
              <div className="space-y-2">
                <select
                  value={filters.prefecture}
                  onChange={(e) => {
                    setFilters({ ...filters, prefecture: e.target.value, city: '' });
                  }}
                  disabled={filters.distanceEnabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    filters.distanceEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">都道府県を選択</option>
                  {PREFECTURES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>

                {filters.prefecture && PREFECTURE_CITIES[filters.prefecture as Prefecture] && !filters.distanceEnabled && (
                  <select
                    value={filters.city}
                    onChange={(e) =>
                      setFilters({ ...filters, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">市区町村を選択</option>
                    {PREFECTURE_CITIES[filters.prefecture as Prefecture].map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                )}

                {filters.distanceEnabled && (
                  <p className="text-xs text-amber-600">
                    ※ 距離検索ON時は都道府県/市区町村選択は無効です
                  </p>
                )}

                {/* 距離検索 */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.distanceEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setFilters({
                          ...filters,
                          distanceEnabled: enabled,
                          // 距離検索ON時は都道府県・市区町村をクリア
                          prefecture: enabled ? '' : filters.prefecture,
                          city: enabled ? '' : filters.city,
                          // 距離検索OFF時は座標をクリア
                          distanceLat: enabled ? filters.distanceLat : null,
                          distanceLng: enabled ? filters.distanceLng : null,
                        });
                      }}
                      className="w-4 h-4 text-primary rounded border-gray-300"
                    />
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">距離で検索</span>
                  </label>

                  {filters.distanceEnabled && (
                    <div className="mt-3 space-y-3 pl-6">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">基準住所</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={filters.distanceAddress}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                distanceAddress: e.target.value,
                                distanceLat: null,
                                distanceLng: null,
                              })
                            }
                            placeholder="例: 東京都渋谷区渋谷1-1-1"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            type="button"
                            onClick={handleGeocodeAddress}
                            disabled={isGeocoding || !filters.distanceAddress.trim()}
                            className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {isGeocoding ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              '検索'
                            )}
                          </button>
                        </div>
                        {filters.distanceLat && filters.distanceLng && (
                          <p className="mt-1 text-xs text-green-600">
                            ✓ 座標取得済み
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">距離</label>
                        <select
                          value={filters.distanceKm}
                          onChange={(e) =>
                            setFilters({ ...filters, distanceKm: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {[1, 3, 5, 10, 15, 20, 30].map((km) => (
                            <option key={km} value={km}>
                              {km}km以内
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* タイプ */}
            <div>
              <label className="block text-sm font-bold mb-2">タイプ</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.jobTypes.includes('qualified')}
                    onChange={(e) =>
                      handleCheckboxChange('jobTypes', 'qualified', e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">登録した資格で応募できる仕事のみ</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.jobTypes.includes('nursing')}
                    onChange={(e) =>
                      handleCheckboxChange('jobTypes', 'nursing', e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">看護の仕事のみ</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.jobTypes.includes('excludeOrientation')}
                    onChange={(e) =>
                      handleCheckboxChange(
                        'jobTypes',
                        'excludeOrientation',
                        e.target.checked
                      )
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">説明会を除く</span>
                </label>
              </div>
            </div>

            {/* 勤務時間 */}
            <div>
              <label className="block text-sm font-bold mb-2">勤務時間</label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.workTimeTypes.includes('day')}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'workTimeTypes',
                          'day',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm whitespace-nowrap">日勤</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.workTimeTypes.includes('night')}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'workTimeTypes',
                          'night',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm whitespace-nowrap">夜勤</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.workTimeTypes.includes('short')}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'workTimeTypes',
                          'short',
                          e.target.checked
                        )
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm whitespace-nowrap">１日４時間以下</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    時間帯
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={filters.timeRangeFrom}
                      onChange={(e) =>
                        setFilters({ ...filters, timeRangeFrom: e.target.value })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="">開始時間</option>
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm">〜</span>
                    <select
                      value={filters.timeRangeTo}
                      onChange={(e) =>
                        setFilters({ ...filters, timeRangeTo: e.target.value })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="">終了時間</option>
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 時給 */}
            <div>
              <label className="block text-sm font-bold mb-2">時給</label>
              <select
                value={filters.minWage}
                onChange={(e) =>
                  setFilters({ ...filters, minWage: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">選択してください</option>
                {wageOptions.map((wage) => (
                  <option key={wage} value={wage}>
                    {wage}
                  </option>
                ))}
              </select>
            </div>

            {/* さらに絞り込む */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-sm font-bold mb-2"
              >
                <span>さらに絞り込む</span>
                {showAdvanced ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-6 mt-4">
                  {/* サービス種別 */}
                  <div>
                    <label className="block text-sm font-bold mb-2">
                      サービス種別
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowServiceTypeModal(true)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-600">
                        {filters.serviceTypes.length > 0
                          ? `${filters.serviceTypes.length}件選択中`
                          : '選択してください'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    {filters.serviceTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {filters.serviceTypes.map((type) => (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary text-xs rounded"
                          >
                            {type}
                            <button
                              type="button"
                              onClick={() =>
                                handleCheckboxChange('serviceTypes', type, false)
                              }
                              className="hover:text-primary-dark"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 移動手段 */}
                  <div>
                    <label className="block text-sm font-bold mb-2">
                      移動手段
                    </label>
                    <div className="space-y-2">
                      {transportations.map((transport) => (
                        <label key={transport} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={filters.transportations.includes(transport)}
                            onChange={(e) =>
                              handleCheckboxChange(
                                'transportations',
                                transport,
                                e.target.checked
                              )
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{transport}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* その他条件 */}
                  <div>
                    <label className="block text-sm font-bold mb-2">
                      その他条件
                    </label>
                    <div className="space-y-2">
                      {otherConditionsOptions.map((condition) => (
                        <div key={condition}>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={filters.otherConditions.includes(condition)}
                              onChange={(e) =>
                                handleCheckboxChange(
                                  'otherConditions',
                                  condition,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{condition}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
            {/* バリデーションエラー */}
            {validationError && (
              <p className="text-sm text-red-500 text-center">{validationError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors text-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                className="py-3 px-4 text-sm text-gray-500 hover:text-gray-700 transition-colors underline"
              >
                クリア
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                絞り込む
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* サービス種別選択モーダル */}
      {showServiceTypeModal && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowServiceTypeModal(false)}
          />
          <div className="absolute inset-0 bg-white overflow-y-auto">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10">
              <button onClick={() => setShowServiceTypeModal(false)}>
                <X className="w-6 h-6" />
              </button>
              <h2 className="flex-1 text-center text-lg font-bold">サービス種別</h2>
              <div className="w-6"></div>
            </div>

            {/* サービス種別リスト（2列表示） */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {SERVICE_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.serviceTypes.includes(type)}
                      onChange={(e) =>
                        handleCheckboxChange('serviceTypes', type, e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 決定ボタン */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={() => setShowServiceTypeModal(false)}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
