'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Upload, X, Eye, User } from 'lucide-react';
import Image from 'next/image';

export default function FacilityPage() {
  const { admin, isAdmin } = useAuth();

  // 法人情報
  const [corporateInfo, setCorporateInfo] = useState({
    name: '株式会社ケアテック',
    representativeLastName: '山田',
    representativeFirstName: '太郎',
    phone: '03-1234-5678',
    prefecture: '東京都',
    city: '渋谷区',
    addressDetail: '恵比寿1-2-3 恵比寿ビル5F',
    email: 'info@caretech.co.jp',
    contactPersonLastName: '佐藤',
    contactPersonFirstName: '花子',
  });

  // 事業所情報
  const [facilityInfo, setFacilityInfo] = useState({
    name: 'ケアテック恵比寿',
    serviceType: '訪問介護',
  });

  // 責任者情報
  const [managerInfo, setManagerInfo] = useState({
    lastName: '斉藤',
    firstName: '健一',
    photo: null as File | null,
    photoPreview: '',
    greeting: `はじめまして、施設長の斉藤です。
当施設では、利用者様一人ひとりに寄り添ったケアを心がけております。
明るく働きやすい職場づくりを目指しておりますので、ぜひ一緒に働きましょう！`,
  });

  // 担当者情報
  const [staffInfo, setStaffInfo] = useState({
    sameAsManager: false,
    lastName: '田中',
    firstName: '美咲',
    phone: '080-1234-5678',
    emergencyContact: `担当不在の場合は、電話口の者に伝言をお願いいたします。
誰も出ない場合は、下記番号にお電話くださいませ。
大東（ダイトウ）：080-7441-7699`,
    emails: ['tanaka@caretech.co.jp'],
  });

  // 服装情報
  const [dresscodeInfo, setDresscodeInfo] = useState({
    items: [] as string[],
    images: [] as File[],
  });

  const dresscodeOptions = [
    '制服貸与', '私服', '動きやすい服装', 'スニーカー', '靴下', 'エプロン',
    'ナースシューズ', '上履き', 'スクラブ', '白衣', 'ポロシャツ', 'ジャージ',
    '髪型自由', '髪色自由', 'ネイルOK', 'ピアスOK', '髭OK', 'タトゥーOK（隠せる範囲）',
  ];

  // アクセス情報
  const [accessInfo, setAccessInfo] = useState({
    stations: [
      { name: '恵比寿駅', minutes: 5 },
    ] as { name: string; minutes: number }[],
    accessDescription: '恵比寿駅東口より徒歩5分、明治通り沿い',
    transportation: [] as string[],
    parking: '',
    transportationNote: '',
    mapLat: 35.6465,
    mapLng: 139.7102,
  });

  const transportationOptions = ['車', 'バイク', '自転車', '公共交通機関（電車・バス・徒歩）'];
  const parkingOptions = [
    '選択してください',
    'あり（無料）',
    'あり（有料）',
    'なし（近隣コインパーキング）',
  ];

  // 受動喫煙防止対策
  const [smokingInfo, setSmokingInfo] = useState({
    measure: '',
    workInSmokingArea: '',
  });

  const smokingMeasures = [
    '選択してください',
    '敷地内禁煙',
    '敷地内禁煙（屋外に喫煙場所設置）',
    '屋内禁煙',
    '屋内原則禁煙（喫煙専用室あり）',
    '屋内原則禁煙（加熱式たばこ専用喫煙室あり）',
    '屋内原則禁煙（喫煙可の宿泊室あり）',
  ];

  // サービス種別
  const serviceTypes = [
    '特別養護老人ホーム',
    '介護老人保健施設',
    '介護付き有料老人ホーム',
    '住宅型有料老人ホーム',
    'サービス付き高齢者向け住宅',
    '認知症対応型共同生活介護',
    '短期入所生活介護',
    '通所介護',
    '通所リハビリテーション',
    '小規模多機能型居宅介護',
    '看護小規模多機能型居宅介護',
    '訪問介護',
    '訪問入浴介護',
    '訪問看護',
    '定期巡回・随時対応型訪問介護看護',
    '軽費老人ホーム',
    '養護老人ホーム',
    '居宅介護支援',
    '地域包括支援センター',
    '障がい者支援施設',
    '障がい者グループホーム',
    '放課後等デイサービス',
    '介護医療院',
    '福祉用具貸与・販売',
    '病院 (回復期リハ)',
    '病院 (地域包括ケア)',
    '病院 (急性期一般)',
    '病院 (療養)',
    '病院 (医療療養)',
    '病院 (精神)',
    '病院 (障がい・特殊疾患)',
    '病院 (外来)',
    '病院 (ICU/HCU)',
    '病院 (OPE室)',
    'クリニック',
    '有床クリニック',
    '検診センター',
    '自費サービス',
    '病院 (緩和ケア病棟)',
    '保育園',
    '薬局',
    '病院 (薬剤課)',
  ];

  // 都道府県リスト
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  // 市区町村データ（都道府県ごと）
  const citiesByPrefecture: { [key: string]: string[] } = {
    '東京都': [
      '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区', '江東区',
      '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区', '杉並区', '豊島区',
      '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区',
      '八王子市', '立川市', '武蔵野市', '三鷹市', '青梅市', '府中市', '昭島市', '調布市',
      '町田市', '小金井市', '小平市', '日野市', '東村山市', '国分寺市', '国立市', '福生市',
      '狛江市', '東大和市', '清瀬市', '東久留米市', '武蔵村山市', '多摩市', '稲城市', '羽村市',
      'あきる野市', '西東京市'
    ],
    '神奈川県': [
      '横浜市鶴見区', '横浜市神奈川区', '横浜市西区', '横浜市中区', '横浜市南区', '横浜市保土ケ谷区',
      '横浜市磯子区', '横浜市金沢区', '横浜市港北区', '横浜市戸塚区', '横浜市港南区', '横浜市旭区',
      '横浜市緑区', '横浜市瀬谷区', '横浜市栄区', '横浜市泉区', '横浜市青葉区', '横浜市都筑区',
      '川崎市川崎区', '川崎市幸区', '川崎市中原区', '川崎市高津区', '川崎市多摩区', '川崎市宮前区', '川崎市麻生区',
      '相模原市緑区', '相模原市中央区', '相模原市南区',
      '横須賀市', '平塚市', '鎌倉市', '藤沢市', '小田原市', '茅ヶ崎市', '逗子市', '三浦市',
      '秦野市', '厚木市', '大和市', '伊勢原市', '海老名市', '座間市', '南足柄市', '綾瀬市'
    ],
    '大阪府': [
      '大阪市都島区', '大阪市福島区', '大阪市此花区', '大阪市西区', '大阪市港区', '大阪市大正区',
      '大阪市天王寺区', '大阪市浪速区', '大阪市西淀川区', '大阪市東淀川区', '大阪市東成区', '大阪市生野区',
      '大阪市旭区', '大阪市城東区', '大阪市阿倍野区', '大阪市住吉区', '大阪市東住吉区', '大阪市西成区',
      '大阪市淀川区', '大阪市鶴見区', '大阪市住之江区', '大阪市平野区', '大阪市北区', '大阪市中央区',
      '堺市堺区', '堺市中区', '堺市東区', '堺市西区', '堺市南区', '堺市北区', '堺市美原区',
      '岸和田市', '豊中市', '池田市', '吹田市', '泉大津市', '高槻市', '貝塚市', '守口市',
      '枚方市', '茨木市', '八尾市', '泉佐野市', '富田林市', '寝屋川市', '河内長野市', '松原市',
      '大東市', '和泉市', '箕面市', '柏原市', '羽曳野市', '門真市', '摂津市', '高石市',
      '藤井寺市', '東大阪市', '泉南市', '四條畷市', '交野市', '大阪狭山市', '阪南市'
    ]
  };

  // 初回自動送信メッセージ
  const [welcomeMessage, setWelcomeMessage] = useState({
    text: `[ワーカー名字]様

この度は、[事業所名]の求人にご応募いただき、誠にありがとうございます。
施設長の[事業所責任者名字]と申します。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたしますので、
どうぞよろしくお願いいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
皆様とお会いできることを楽しみにしております。`,
    showPreview: false,
  });

  const handleManagerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManagerInfo({
        ...managerInfo,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handleManagerPhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleManagerPhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      const file = files[0];
      setManagerInfo({
        ...managerInfo,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handleDresscodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDresscodeInfo({
      ...dresscodeInfo,
      images: [...dresscodeInfo.images, ...files],
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      setDresscodeInfo({
        ...dresscodeInfo,
        images: [...dresscodeInfo.images, ...files],
      });
    }
  };

  const removeDresscodeImage = (index: number) => {
    setDresscodeInfo({
      ...dresscodeInfo,
      images: dresscodeInfo.images.filter((_, i) => i !== index),
    });
  };

  const addEmail = () => {
    if (staffInfo.emails.length < 10) {
      setStaffInfo({
        ...staffInfo,
        emails: [...staffInfo.emails, ''],
      });
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...staffInfo.emails];
    newEmails[index] = value;
    setStaffInfo({
      ...staffInfo,
      emails: newEmails,
    });
  };

  const removeEmail = (index: number) => {
    if (staffInfo.emails.length > 1) {
      setStaffInfo({
        ...staffInfo,
        emails: staffInfo.emails.filter((_, i) => i !== index),
      });
    }
  };

  const addStation = () => {
    if (accessInfo.stations.length < 3) {
      setAccessInfo({
        ...accessInfo,
        stations: [...accessInfo.stations, { name: '', minutes: 0 }],
      });
    }
  };

  const updateStation = (index: number, field: 'name' | 'minutes', value: string | number) => {
    const newStations = [...accessInfo.stations];
    newStations[index] = { ...newStations[index], [field]: value };
    setAccessInfo({
      ...accessInfo,
      stations: newStations,
    });
  };

  const removeStation = (index: number) => {
    if (accessInfo.stations.length > 1) {
      setAccessInfo({
        ...accessInfo,
        stations: accessInfo.stations.filter((_, i) => i !== index),
      });
    }
  };

  const previewWelcomeMessage = () => {
    return welcomeMessage.text
      .replace(/\[ワーカー名字\]/g, '田中')
      .replace(/\[事業所責任者名字\]/g, managerInfo.lastName)
      .replace(/\[事業所名\]/g, facilityInfo.name);
  };

  const handleSave = () => {
    alert('保存しました');
  };

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">法人・事業所情報</h1>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-5">

            {/* 法人情報 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">法人情報</h2>
              </div>
              <div className="p-5 space-y-3">
                {/* 法人名と代表者名を一列に */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      法人名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={corporateInfo.name}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      代表者名 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={corporateInfo.representativeLastName}
                        onChange={(e) => setCorporateInfo({ ...corporateInfo, representativeLastName: e.target.value })}
                        placeholder="姓"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={corporateInfo.representativeFirstName}
                        onChange={(e) => setCorporateInfo({ ...corporateInfo, representativeFirstName: e.target.value })}
                        placeholder="名"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 住所を都道府県、市区町村、その他住所に分けて２列目に */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    住所 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    <select
                      value={corporateInfo.prefecture}
                      onChange={(e) => {
                        setCorporateInfo({ ...corporateInfo, prefecture: e.target.value, city: '' });
                      }}
                      className="col-span-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">選択</option>
                      {prefectures.map((pref) => (
                        <option key={pref} value={pref}>
                          {pref}
                        </option>
                      ))}
                    </select>
                    <select
                      value={corporateInfo.city}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, city: e.target.value })}
                      disabled={!corporateInfo.prefecture}
                      className="col-span-2 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">
                        {corporateInfo.prefecture ? '選択してください' : '都道府県を選択してください'}
                      </option>
                      {corporateInfo.prefecture && citiesByPrefecture[corporateInfo.prefecture]?.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={corporateInfo.addressDetail}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, addressDetail: e.target.value })}
                      placeholder="その他住所"
                      className="col-span-3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 担当者名、電話番号、メールアドレスを一列に */}
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当者名 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={corporateInfo.contactPersonLastName}
                        onChange={(e) => setCorporateInfo({ ...corporateInfo, contactPersonLastName: e.target.value })}
                        placeholder="姓"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={corporateInfo.contactPersonFirstName}
                        onChange={(e) => setCorporateInfo({ ...corporateInfo, contactPersonFirstName: e.target.value })}
                        placeholder="名"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      代表電話番号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={corporateInfo.phone}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, phone: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={corporateInfo.email}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, email: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 事業所情報・担当者 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">事業所情報・担当者</h2>
              </div>
              <div className="p-5 space-y-3">
                {/* 事業所名とサービス種別を一列に */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      事業所名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={facilityInfo.name}
                      onChange={(e) => setFacilityInfo({ ...facilityInfo, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サービス種別 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={facilityInfo.serviceType}
                      onChange={(e) => setFacilityInfo({ ...facilityInfo, serviceType: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">選択してください</option>
                      {serviceTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 責任者情報 */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">責任者</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        氏名 <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3 max-w-md">
                        <input
                          type="text"
                          value={managerInfo.lastName}
                          onChange={(e) => setManagerInfo({ ...managerInfo, lastName: e.target.value })}
                          placeholder="姓"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <input
                          type="text"
                          value={managerInfo.firstName}
                          onChange={(e) => setManagerInfo({ ...managerInfo, firstName: e.target.value })}
                          placeholder="名"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        顔写真
                      </label>
                      <div className="flex items-center gap-4">
                        {/* 円形の写真プレビュー */}
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                            {managerInfo.photoPreview ? (
                              <Image
                                src={managerInfo.photoPreview}
                                alt="責任者写真"
                                width={96}
                                height={96}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-12 h-12 text-gray-400" />
                            )}
                          </div>
                          {managerInfo.photoPreview && (
                            <button
                              onClick={() => setManagerInfo({ ...managerInfo, photo: null, photoPreview: '' })}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* 小さなドラッグ&ドロップエリア */}
                        <div
                          onDragOver={handleManagerPhotoDragOver}
                          onDrop={handleManagerPhotoDrop}
                          className="flex-1 max-w-xs border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer"
                        >
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-xs text-gray-600 mb-1">
                            画像をドラッグ&ドロップ
                          </p>
                          <p className="text-xs text-gray-500 mb-2">または</p>
                          <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            <Upload className="w-3 h-3" />
                            ファイルを選択
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleManagerPhotoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        挨拶文
                      </label>
                      <textarea
                        value={managerInfo.greeting}
                        onChange={(e) => setManagerInfo({ ...managerInfo, greeting: e.target.value })}
                        rows={5}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 担当者情報 */}
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">担当者</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={staffInfo.sameAsManager}
                          onChange={(e) => setStaffInfo({ ...staffInfo, sameAsManager: e.target.checked })}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">責任者と同じ</span>
                      </label>
                    </div>

                    {!staffInfo.sameAsManager && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          氏名 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3 max-w-md">
                          <input
                            type="text"
                            value={staffInfo.lastName}
                            onChange={(e) => setStaffInfo({ ...staffInfo, lastName: e.target.value })}
                            placeholder="姓"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <input
                            type="text"
                            value={staffInfo.firstName}
                            onChange={(e) => setStaffInfo({ ...staffInfo, firstName: e.target.value })}
                            placeholder="名"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        担当電話番号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={staffInfo.phone}
                        onChange={(e) => setStaffInfo({ ...staffInfo, phone: e.target.value })}
                        className="w-full max-w-xs px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        緊急連絡先
                      </label>
                      <textarea
                        value={staffInfo.emergencyContact}
                        onChange={(e) => setStaffInfo({ ...staffInfo, emergencyContact: e.target.value })}
                        rows={3}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="担当不在の場合は、電話口の者に伝言をお願いいたします。&#10;誰も出ない場合は、下記番号にお電話くださいませ。&#10;大東（ダイトウ）：080-7441-7699"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        担当メールアドレス <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2">
                        {staffInfo.emails.map((email, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => updateEmail(index, e.target.value)}
                              placeholder={index === 0 ? 'メインアドレス（必須）' : `サブアドレス ${index}`}
                              className="flex-1 max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            {index > 0 && (
                              <button
                                onClick={() => removeEmail(index)}
                                className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {staffInfo.emails.length < 10 && (
                          <button
                            onClick={addEmail}
                            className="text-sm text-primary hover:text-primary-dark"
                          >
                            + メールアドレスを追加
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* アクセス */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">アクセス</h2>
              </div>
              <div className="p-5 space-y-3">
                {/* 最寄駅 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最寄駅 <span className="text-gray-500 text-xs">(最大3つまで)</span>
                  </label>
                  <div className="space-y-2">
                    {accessInfo.stations.map((station, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={station.name}
                          onChange={(e) => updateStation(index, 'name', e.target.value)}
                          placeholder="駅名を入力"
                          className="flex-1 max-w-xs px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">から</span>
                        <input
                          type="number"
                          value={station.minutes || ''}
                          onChange={(e) => updateStation(index, 'minutes', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          min="0"
                          className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">分</span>
                        {accessInfo.stations.length > 1 && (
                          <button
                            onClick={() => removeStation(index)}
                            className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {accessInfo.stations.length < 3 && (
                      <button
                        onClick={addStation}
                        className="text-sm text-primary hover:text-primary-dark"
                      >
                        + 駅を追加
                      </button>
                    )}
                  </div>
                </div>

                {/* アクセス説明 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    アクセス <span className="text-gray-500 text-xs">(40文字以内)</span>
                  </label>
                  <input
                    type="text"
                    value={accessInfo.accessDescription}
                    onChange={(e) => setAccessInfo({ ...accessInfo, accessDescription: e.target.value })}
                    maxLength={40}
                    placeholder="例：恵比寿駅東口より徒歩5分、明治通り沿い"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* 移動可能な通勤手段 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    移動可能な通勤手段
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {transportationOptions.map((option) => (
                      <label key={option} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={accessInfo.transportation.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAccessInfo({
                                ...accessInfo,
                                transportation: [...accessInfo.transportation, option],
                              });
                            } else {
                              setAccessInfo({
                                ...accessInfo,
                                transportation: accessInfo.transportation.filter((item) => item !== option),
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 敷地内駐車場 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    敷地内駐車場
                  </label>
                  <select
                    value={accessInfo.parking}
                    onChange={(e) => setAccessInfo({ ...accessInfo, parking: e.target.value })}
                    className="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {parkingOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 交通手段の備考 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    交通手段の備考
                  </label>
                  <textarea
                    value={accessInfo.transportationNote}
                    onChange={(e) => setAccessInfo({ ...accessInfo, transportationNote: e.target.value })}
                    rows={3}
                    placeholder="例：車通勤の場合は事前に申請が必要です"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* マップ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    マップ
                  </label>
                  <div className="space-y-2">
                    <div className="w-full h-64 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <p className="text-sm mb-2">Google Maps プレビュー</p>
                        <p className="text-xs">住所: {corporateInfo.prefecture}{corporateInfo.city}{corporateInfo.addressDetail}</p>
                        <p className="text-xs">座標: {accessInfo.mapLat}, {accessInfo.mapLng}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => alert('マップピンの調整機能は開発中です')}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      マップピンを調整
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 服装・受動喫煙防止対策・初回自動送信メッセージ */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">その他の設定</h2>
              </div>
              <div className="p-5 space-y-3">
                {/* 服装 */}
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">服装</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      服装サンプル画像
                    </label>
                    <div className="space-y-2">
                      {dresscodeInfo.images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {dresscodeInfo.images.map((file, index) => (
                            <div key={index} className="relative aspect-video">
                              <Image
                                src={URL.createObjectURL(file)}
                                alt={`服装サンプル${index + 1}`}
                                fill
                                className="object-cover rounded-lg border border-gray-200"
                              />
                              <button
                                onClick={() => removeDresscodeImage(index)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                      >
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-1">
                          画像をドラッグ&ドロップ
                        </p>
                        <p className="text-xs text-gray-500 mb-2">または</p>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                          <Upload className="w-4 h-4" />
                          ファイルを選択
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleDresscodeImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 受動喫煙防止対策 */}
                <div className="border-b border-gray-200 pb-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">受動喫煙防止対策</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        受動喫煙防止対策措置
                      </label>
                      <select
                        value={smokingInfo.measure}
                        onChange={(e) => setSmokingInfo({ ...smokingInfo, measure: e.target.value })}
                        className="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {smokingMeasures.map((measure) => (
                          <option key={measure} value={measure}>
                            {measure}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        喫煙可能エリアでの作業
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="workInSmokingArea"
                            value="有り"
                            checked={smokingInfo.workInSmokingArea === '有り'}
                            onChange={(e) => setSmokingInfo({ ...smokingInfo, workInSmokingArea: e.target.value })}
                            className="border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">有り</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="workInSmokingArea"
                            value="無し"
                            checked={smokingInfo.workInSmokingArea === '無し'}
                            onChange={(e) => setSmokingInfo({ ...smokingInfo, workInSmokingArea: e.target.value })}
                            className="border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">無し</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 初回自動送信メッセージ */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">初回自動送信メッセージ</h3>
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                      <p className="mb-1.5">
                        設定しておくと、ワーカーが初めて当事業所に応募した際に、ウェルカムメッセージが自動送信されます。
                        ワーカーの初回勤務の不安を軽減することで、キャンセルが発生しにくくなります。
                      </p>
                      <p className="mb-1.5">
                        また、メッセージ本文中では、送信時に変換される以下の変数を利用することができます。
                      </p>
                      <ul className="space-y-0.5 ml-4 text-xs">
                        <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[ワーカー名字]</code> ワーカーの名字（例: 山田）に変換されます</li>
                        <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[事業所責任者名字]</code> 事業所責任者の名字（例: 斉藤）に変換されます</li>
                        <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[事業所名]</code> 事業所名（例: カイテク事業所）に変換されます</li>
                      </ul>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        メッセージ本文
                      </label>
                      <textarea
                        value={welcomeMessage.text}
                        onChange={(e) => setWelcomeMessage({ ...welcomeMessage, text: e.target.value })}
                        rows={8}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                      />
                    </div>

                    <button
                      onClick={() => setWelcomeMessage({ ...welcomeMessage, showPreview: !welcomeMessage.showPreview })}
                      className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark"
                    >
                      <Eye className="w-4 h-4" />
                      {welcomeMessage.showPreview ? 'プレビューを閉じる' : 'プレビューを表示'}
                    </button>

                    {welcomeMessage.showPreview && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-1.5">プレビュー</h4>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm">
                          {previewWelcomeMessage()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="flex justify-end gap-3 pb-6">
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
