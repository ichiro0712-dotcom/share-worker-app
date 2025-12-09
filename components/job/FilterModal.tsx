'use client';

import { useState } from 'react';
import { X, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

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
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}

const prefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
  '沖縄県'
];

const cities: Record<string, string[]> = {
  '東京都': ['千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区', '江東区', '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区', '杉並区', '豊島区', '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区'],
  '神奈川県': ['横浜市', '川崎市', '相模原市', '横須賀市', '平塚市', '鎌倉市', '藤沢市', '小田原市', '茅ヶ崎市', '逗子市', '三浦市', '秦野市', '厚木市', '大和市', '伊勢原市', '海老名市', '座間市', '南足柄市', '綾瀬市'],
  '大阪府': ['大阪市', '堺市', '岸和田市', '豊中市', '池田市', '吹田市', '泉大津市', '高槻市', '貝塚市', '守口市', '枚方市', '茨木市', '八尾市', '泉佐野市', '富田林市', '寝屋川市', '河内長野市', '松原市', '大東市', '和泉市', '箕面市', '柏原市', '羽曳野市', '門真市', '摂津市', '高石市', '藤井寺市', '東大阪市', '泉南市', '四條畷市', '交野市', '大阪狭山市', '阪南市'],
};

const serviceTypes = [
  '特別養護老人ホーム',
  '有料老人ホーム',
  'グループホーム',
  'サービス付き高齢者向け住宅',
  'デイサービス',
  'デイケア',
  '訪問介護',
  '訪問入浴',
  '訪問看護',
  '小規模多機能型居宅介護',
  '看護小規模多機能型居宅介護',
  '定期巡回・随時対応型訪問介護看護',
  '夜間対応型訪問介護',
  'ショートステイ（短期入所生活介護）',
  'ショートステイ（短期入所療養介護）',
  '居宅介護支援施設',
  '地域包括支援センター',
  '福祉用具貸与・販売',
  '軽費老人ホーム',
  '養護老人ホーム',
  '介護老人保健施設',
  '介護医療院',
  '障がい者支援施設',
  '就労継続支援',
  '就労移行支援',
  '生活介護',
  '共同生活援助',
  '病院 (療養)',
];

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

export function FilterModal({ isOpen, onClose, onApply }: FilterModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
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
  });

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
    });
  };

  const handleApply = () => {
    onApply(filters);
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">都道府県を選択</option>
                {prefectures.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>

              {filters.prefecture && cities[filters.prefecture] && (
                <select
                  value={filters.city}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">市区町村を選択</option>
                  {cities[filters.prefecture].map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              )}
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
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            リセット
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
                {serviceTypes.map((type) => (
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
