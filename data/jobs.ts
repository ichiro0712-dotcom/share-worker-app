import { Job } from '@/types/job';

// 今日の日付を基準にする
const today = new Date();
const formatDate = (daysFromToday: number) => {
  const date = new Date(today);
  date.setDate(today.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
};

export const jobs: Job[] = [
  {
    id: 1,
    facilityId: 1,
    title: '【駅徒歩9分！】★カイテク初心者・デイサービス経験者歓迎',
    workDate: formatDate(1),
    startTime: '09:00',
    endTime: '16:30',
    breakTime: '12:00-13:00',
    wage: 9250,
    hourlyWage: 1300,
    deadline: new Date(today.getTime() + 22 * 60 * 60 * 1000 + 42 * 60 * 1000).toISOString(),
    tags: ['デイサービス', '介護'],
    address: '東京都杉並区井草3-23-1F',
    access: '西武新宿線「下井草駅」より徒歩9分',
    recruitmentCount: 2,
    appliedCount: 0,
    transportationFee: 5000,
    overview: 'デイサービスでの介護業務全般をお願いします。利用者様の生活サポートや レクリエーション活動のお手伝いをしていただきます。明るく楽しい雰囲気の職場です。',
    workContent: ['対象・見守り', '記録業務', '移乗介助', '排泄介助', '体位変換', '食事介助', '入浴介助', 'レクリエーション', '送迎補助', '環境整備'],
    requiredQualifications: ['介護福祉士', 'または実務者研修修了者'],
    requiredExperience: ['デイサービス経験1年以上歓迎', '未経験の方も歓迎'],
    dresscode: ['動きやすい服装', '上履き持参'],
    belongings: ['筆記用具', '印鑑'],
    otherConditions: [],
    managerName: '田中 花子',
    managerMessage: 'はじめまして！明るく楽しい職場です。未経験の方も丁寧に指導しますので、お気軽にご応募ください！',
    managerAvatar: '👩',
    images: ['/images/placeholder.svg', '/images/placeholder.svg', '/images/placeholder.svg'],
    badges: [{ text: 'カイテク初心者歓迎', type: 'yellow' }],
    transportMethods: [
      { name: '車', available: true },
      { name: 'バイク', available: true },
      { name: '自転車', available: true },
      { name: '電車', available: true },
      { name: 'バス', available: true },
      { name: '徒歩', available: true }
    ],
    parking: true,
    accessDescription: '駅から徒歩圏内で通いやすい立地です。',
    mapImage: '/images/placeholder.svg'
  },
  {
    id: 2,
    facilityId: 2,
    title: '会社説明会｜選べる働き方（正社員 or パート週3回～）｜施設応募で勤務した...',
    workDate: formatDate(1),
    startTime: '10:30',
    endTime: '11:30',
    breakTime: 'なし',
    wage: 2026,
    hourlyWage: 1226,
    deadline: new Date(today.getTime() + 22 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
    tags: ['訪問介護', '介護', '認知症'],
    address: '東京都練馬区上石神井1丁目40-10',
    access: '西武新宿線「上石神井駅」より徒歩6分',
    recruitmentCount: 10,
    appliedCount: 3,
    transportationFee: 3000,
    overview: '訪問介護サービスの会社説明会です。正社員・パート、両方の働き方をご用意しています。ご自身のライフスタイルに合わせてお選びください。',
    workContent: ['身体介護', '生活援助', '服薬確認', '買い物代行', '調理', '掃除', '洗濯'],
    requiredQualifications: ['介護福祉士', 'または初任者研修修了者'],
    requiredExperience: ['経験不問'],
    dresscode: ['私服OK'],
    belongings: ['筆記用具'],
    otherConditions: ['説明会参加のみも歓迎'],
    managerName: '佐藤 一郎',
    managerMessage: '説明会では働き方の詳細をお話しします。質問も大歓迎です！',
    managerAvatar: '👨',
    images: ['/images/placeholder.svg', '/images/placeholder.svg', '/images/placeholder.svg'],
    badges: [],
    transportMethods: [
      { name: '車', available: false },
      { name: 'バイク', available: true },
      { name: '自転車', available: true },
      { name: '電車', available: true },
      { name: 'バス', available: true },
      { name: '徒歩', available: true }
    ],
    parking: false,
    accessDescription: '駅近で通勤便利です。',
    mapImage: '/images/placeholder.svg'
  },
  {
    id: 3,
    facilityId: 3,
    title: '【夜勤専従】特別養護老人ホームでの介護スタッフ',
    workDate: formatDate(2),
    startTime: '17:00',
    endTime: '09:00',
    breakTime: '02:00-03:00',
    wage: 22500,
    hourlyWage: 1500,
    deadline: new Date(today.getTime() + 18 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    tags: ['特養', '夜勤'],
    address: '東京都練馬区豊玉北5-17-11',
    access: '西武池袋線「練馬駅」より徒歩5分',
    recruitmentCount: 1,
    appliedCount: 0,
    transportationFee: 8000,
    overview: '夜勤専従の介護スタッフを募集しています。経験者優遇、高時給です。',
    workContent: ['見守り', '巡回', '排泄介助', '体位変換', '緊急対応', '記録業務', '申し送り'],
    requiredQualifications: ['介護福祉士必須'],
    requiredExperience: ['特養での夜勤経験1年以上'],
    dresscode: ['制服貸与'],
    belongings: ['上履き', '筆記用具'],
    otherConditions: [],
    managerName: '鈴木 太郎',
    managerMessage: '夜勤専従で安定して働きたい方、お待ちしています！',
    managerAvatar: '👨',
    images: ['/images/placeholder.svg', '/images/placeholder.svg', '/images/placeholder.svg'],
    badges: [{ text: '高時給', type: 'green' }],
    transportMethods: [
      { name: '車', available: true },
      { name: 'バイク', available: true },
      { name: '自転車', available: true },
      { name: '電車', available: true },
      { name: 'バス', available: false },
      { name: '徒歩', available: true }
    ],
    parking: true,
    accessDescription: '夜勤帯は駐車場無料です。',
    mapImage: '/images/placeholder.svg'
  }
];

// 残り47件は同様のパターンで作成（文字数制限のため省略）
// 実際の実装では50件すべてを含める
