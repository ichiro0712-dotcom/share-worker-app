import { PrismaClient, JobStatus, WorkerStatus, ReviewStatus, ReviewerType, BookmarkType, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// パスワードをハッシュ化するヘルパー関数
const hashPassword = (password: string) => bcrypt.hashSync(password, 10);

// ========================================
// 定数データ
// ========================================

// 施設種別
const facilityTypes = [
  'デイサービス',
  '訪問介護',
  '特別養護老人ホーム',
  'グループホーム',
  '有料老人ホーム',
  '介護老人保健施設',
  '小規模多機能型居宅介護',
  'サービス付き高齢者向け住宅',
  'ショートステイ',
  '訪問看護',
];

// 名字リスト
const lastNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '松本', '井上', '木村'];
// 名前リスト
const firstNames = {
  male: ['太郎', '一郎', '健太', '大輔', '翔太', '拓也', '直樹', '和也', '雄介', '俊介'],
  female: ['花子', '美咲', '由美', '恵子', '理恵', '直子', '麻衣', '綾', '沙織', '優子'],
};

// 資格リスト
const qualifications = [
  '介護福祉士',
  '初任者研修',
  '実務者研修',
  '正看護師',
  '准看護師',
  'ケアマネージャー',
  '社会福祉士',
  'ホームヘルパー2級',
];

// 都道府県と市区町村
const addressData = [
  { pref: '東京都', cities: ['新宿区', '渋谷区', '世田谷区', '練馬区', '杉並区', '豊島区', '中野区', '板橋区', '北区', '足立区'] },
  { pref: '神奈川県', cities: ['横浜市港北区', '横浜市青葉区', '川崎市中原区', '川崎市高津区', '相模原市中央区', '藤沢市', '茅ヶ崎市'] },
  { pref: '埼玉県', cities: ['さいたま市大宮区', 'さいたま市浦和区', '川口市', '所沢市', '越谷市', '草加市', '春日部市'] },
  { pref: '千葉県', cities: ['千葉市中央区', '船橋市', '柏市', '松戸市', '市川市', '浦安市', '習志野市'] },
];

// 法人名パターン
const corporationPatterns = ['社会福祉法人', '医療法人', '株式会社', '合同会社', 'NPO法人'];
const corporationNames = ['ひかり', 'あおぞら', 'さくら', 'みどり', 'ゆうわ', 'けやき', 'つばさ', 'はなみずき', 'あすなろ', 'わかば'];

// 画像URL
const facilityImages = [
  '/images/facilities/facility1.jpg',
  '/images/facilities/facility2.jpg',
  '/images/facilities/facility3.jpg',
  '/images/anken.png',
];

// ========================================
// ユーティリティ関数
// ========================================
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 日付関連
const today = new Date();
function addDays(days: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(hours: number): Date {
  return new Date(today.getTime() + hours * 60 * 60 * 1000);
}

function subtractDays(days: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
}

// ========================================
// メイン処理
// ========================================
async function main() {
  console.log('🌱 完全版シードデータの投入を開始します...');

  // ========================================
  // 1. ユーザー（ワーカー）の作成 - 10名
  // ========================================
  console.log('\n👤 ユーザー（ワーカー）を作成中...');

  const usersData = [
    // プロフィール充実ユーザー
    {
      email: 'yamada@example.com',
      password_hash: hashPassword('password123'),
      name: '山田 太郎',
      birth_date: new Date('1985-05-15'),
      phone_number: '090-1234-5678',
      profile_image: '/images/users/user1.svg',
      qualifications: ['介護福祉士', '実務者研修'],
    },
    {
      email: 'sato@example.com',
      password_hash: hashPassword('password123'),
      name: '佐藤 花子',
      birth_date: new Date('1990-08-20'),
      phone_number: '090-2345-6789',
      profile_image: '/images/users/user2.svg',
      qualifications: ['正看護師', 'ケアマネージャー'],
    },
    {
      email: 'suzuki@example.com',
      password_hash: hashPassword('password123'),
      name: '鈴木 一郎',
      birth_date: new Date('1988-03-10'),
      phone_number: '090-3456-7890',
      profile_image: '/images/users/user3.svg',
      qualifications: ['介護福祉士'],
    },
    // プロフィール一部空白のユーザー
    {
      email: 'takahashi@example.com',
      password_hash: hashPassword('password123'),
      name: '高橋 美咲',
      birth_date: new Date('1995-11-25'),
      phone_number: '090-4567-8901',
      profile_image: null,
      qualifications: ['初任者研修'],
    },
    {
      email: 'tanaka@example.com',
      password_hash: hashPassword('password123'),
      name: '田中 健太',
      birth_date: null,
      phone_number: '090-5678-9012',
      profile_image: null,
      qualifications: ['実務者研修', '初任者研修'],
    },
    // 資格なし新人ユーザー
    {
      email: 'ito@example.com',
      password_hash: hashPassword('password123'),
      name: '伊藤 直子',
      birth_date: new Date('2000-01-05'),
      phone_number: '090-6789-0123',
      profile_image: '/images/users/user6.jpg',
      qualifications: [],
    },
    // 経験豊富なベテラン
    {
      email: 'watanabe@example.com',
      password_hash: hashPassword('password123'),
      name: '渡辺 大輔',
      birth_date: new Date('1975-07-18'),
      phone_number: '090-7890-1234',
      profile_image: '/images/users/user7.jpg',
      qualifications: ['介護福祉士', 'ケアマネージャー', '社会福祉士'],
    },
    {
      email: 'yamamoto@example.com',
      password_hash: hashPassword('password123'),
      name: '山本 理恵',
      birth_date: new Date('1992-04-30'),
      phone_number: '090-8901-2345',
      profile_image: '/images/users/user8.jpg',
      qualifications: ['准看護師', '実務者研修'],
    },
    {
      email: 'nakamura@example.com',
      password_hash: hashPassword('password123'),
      name: '中村 翔太',
      birth_date: new Date('1998-09-12'),
      phone_number: '090-9012-3456',
      profile_image: null,
      qualifications: ['初任者研修'],
    },
    {
      email: 'kobayashi@example.com',
      password_hash: hashPassword('password123'),
      name: '小林 麻衣',
      birth_date: new Date('1993-12-08'),
      phone_number: '090-0123-4567',
      profile_image: '/images/users/user10.jpg',
      qualifications: ['介護福祉士', '正看護師'],
    },
  ];

  const createdUsers = [];
  for (const userData of usersData) {
    const user = await prisma.user.create({ data: userData });
    createdUsers.push(user);
  }
  console.log(`✅ ${createdUsers.length}名のユーザーを作成しました`);

  // ========================================
  // 2. 施設の作成 - 15施設
  // ========================================
  console.log('\n🏢 施設を作成中...');

  const facilitiesData = [
    {
      corporation_name: '社会福祉法人ひかり会',
      facility_name: 'ひかり介護センター',
      facility_type: 'デイサービス',
      address: '東京都新宿区西新宿1-2-3',
      lat: 35.6896,
      lng: 139.6921,
      phone_number: '03-1234-5678',
      description: '開設15年の実績があるデイサービスです。明るく家庭的な雰囲気で、利用者様一人ひとりに寄り添ったケアを提供しています。経験豊富なスタッフが多数在籍しており、新人さんへのサポート体制も万全です。',
      images: ['/images/anken.png', '/images/facilities/facility1.jpg'],
      rating: 4.5,
      review_count: 28,
      initial_message: `[ワーカー名字]様

この度は、ひかり介護センターの求人にご応募いただき、誠にありがとうございます。
施設長の田中と申します。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
お会いできることを楽しみにしております。`,
    },
    {
      corporation_name: '医療法人あおぞら会',
      facility_name: 'あおぞら訪問看護ステーション',
      facility_type: '訪問看護',
      address: '東京都渋谷区代々木2-5-6',
      lat: 35.6831,
      lng: 139.7001,
      phone_number: '03-2345-6789',
      description: '地域密着型の訪問看護ステーションです。24時間対応可能で、利用者様の在宅生活を全力でサポートしています。看護師・療法士が連携し、質の高いケアを提供しています。',
      images: ['/images/anken.png'],
      rating: 4.8,
      review_count: 15,
      initial_message: `ご応募ありがとうございます。あおぞら訪問看護ステーションの管理者です。

訪問看護に興味をお持ちいただき嬉しく思います。
当ステーションでは、同行訪問から丁寧に指導いたします。

勤務について何かご質問があればお気軽にどうぞ。`,
    },
    {
      corporation_name: '社会福祉法人さくら福祉会',
      facility_name: 'さくらの里特別養護老人ホーム',
      facility_type: '特別養護老人ホーム',
      address: '神奈川県横浜市港北区日吉1-10-20',
      lat: 35.5534,
      lng: 139.6467,
      phone_number: '045-123-4567',
      description: '定員100名の大型特養です。ユニットケアを導入し、家庭的な雰囲気の中で個別ケアを実践しています。夜勤体制も充実しており、安心して働ける環境です。',
      images: ['/images/anken.png', '/images/facilities/facility2.jpg'],
      rating: 4.2,
      review_count: 42,
      initial_message: null,
    },
    {
      corporation_name: '株式会社みどりケア',
      facility_name: 'グループホームみどりの家',
      facility_type: 'グループホーム',
      address: '東京都世田谷区桜新町3-8-12',
      lat: 35.6298,
      lng: 139.6455,
      phone_number: '03-3456-7890',
      description: '認知症ケア専門のグループホームです。定員18名の小規模で、利用者様と密に関わりながら、その人らしい生活をサポートしています。',
      images: ['/images/anken.png'],
      rating: 4.6,
      review_count: 19,
      initial_message: `この度はご応募ありがとうございます。
グループホームみどりの家では、認知症ケアに興味のある方を歓迎しています。
アットホームな雰囲気で、スタッフ同士の仲も良いのが自慢です！`,
    },
    {
      corporation_name: '医療法人ゆうわ会',
      facility_name: 'ゆうわ老人保健施設',
      facility_type: '介護老人保健施設',
      address: '埼玉県さいたま市大宮区桜木町4-15-8',
      lat: 35.9065,
      lng: 139.6283,
      phone_number: '048-234-5678',
      description: 'リハビリテーションに力を入れている老健施設です。在宅復帰を目標に、医師・看護師・理学療法士・作業療法士・介護士がチームで支援しています。',
      images: ['/images/anken.png', '/images/facilities/facility3.jpg'],
      rating: 4.3,
      review_count: 31,
      initial_message: null,
    },
    {
      corporation_name: '株式会社けやきサービス',
      facility_name: 'けやきデイサービス',
      facility_type: 'デイサービス',
      address: '千葉県船橋市本町5-2-10',
      lat: 35.7014,
      lng: 139.9856,
      phone_number: '047-345-6789',
      description: '機能訓練に特化したデイサービスです。理学療法士による個別機能訓練で、利用者様の身体機能維持・向上をサポートしています。',
      images: ['/images/anken.png'],
      rating: 4.4,
      review_count: 12,
      initial_message: `ご応募いただきありがとうございます！
当施設は機能訓練に力を入れており、リハビリに興味のある方大歓迎です。
未経験の方も丁寧に指導しますので、安心してください。`,
    },
    {
      corporation_name: 'NPO法人つばさ',
      facility_name: 'つばさ小規模多機能ホーム',
      facility_type: '小規模多機能型居宅介護',
      address: '東京都練馬区石神井町7-3-15',
      lat: 35.7435,
      lng: 139.6020,
      phone_number: '03-4567-8901',
      description: '通い・訪問・泊まりを一体的に提供する小規模多機能ホームです。なじみのスタッフが様々な場面で関わり、利用者様の安心につなげています。',
      images: ['/images/anken.png'],
      rating: 4.7,
      review_count: 8,
      initial_message: null,
    },
    {
      corporation_name: '社会福祉法人はなみずき会',
      facility_name: 'はなみずき有料老人ホーム',
      facility_type: '有料老人ホーム',
      address: '神奈川県川崎市中原区新丸子東2-1-5',
      lat: 35.5768,
      lng: 139.6614,
      phone_number: '044-456-7890',
      description: '介護付き有料老人ホームです。入居者様のニーズに合わせた個別ケアを提供し、充実した日々を過ごしていただけるよう努めています。',
      images: ['/images/anken.png', '/images/facilities/facility1.jpg'],
      rating: 4.1,
      review_count: 25,
      initial_message: `ご応募ありがとうございます。
はなみずき有料老人ホームでは、入居者様お一人おひとりに寄り添ったケアを大切にしています。
働きやすい環境づくりにも力を入れていますので、ぜひ一緒に働きましょう。`,
    },
    {
      corporation_name: '株式会社あすなろ介護',
      facility_name: 'あすなろサービス付き高齢者向け住宅',
      facility_type: 'サービス付き高齢者向け住宅',
      address: '東京都杉並区阿佐谷南1-7-8',
      lat: 35.7045,
      lng: 139.6361,
      phone_number: '03-5678-9012',
      description: '自立度の高い方向けのサ高住です。必要に応じた介護サービスを提供しながら、入居者様の自立した生活をサポートしています。',
      images: ['/images/anken.png'],
      rating: 4.0,
      review_count: 9,
      initial_message: null,
    },
    {
      corporation_name: '医療法人わかば会',
      facility_name: 'わかばショートステイ',
      facility_type: 'ショートステイ',
      address: '埼玉県川口市栄町3-5-10',
      lat: 35.8069,
      lng: 139.7240,
      phone_number: '048-567-8901',
      description: 'ご家族のレスパイトケアを支援するショートステイです。短期間でも自宅にいるような安心感を提供できるよう、細やかなケアを心がけています。',
      images: ['/images/anken.png'],
      rating: 4.4,
      review_count: 17,
      initial_message: `この度はご応募いただき、ありがとうございます。
わかばショートステイは、利用者様に安心してお過ごしいただける環境づくりを大切にしています。
勤務についてご質問があれば、お気軽にメッセージください。`,
    },
    // 追加施設
    {
      corporation_name: '社会福祉法人こすもす会',
      facility_name: 'こすもす訪問介護ステーション',
      facility_type: '訪問介護',
      address: '東京都豊島区池袋2-15-8',
      lat: 35.7295,
      lng: 139.7109,
      phone_number: '03-6789-0123',
      description: '池袋エリアを中心に訪問介護サービスを提供しています。利用者様の在宅生活を支え、住み慣れた地域で安心して暮らせるようサポートしています。',
      images: ['/images/anken.png'],
      rating: 4.5,
      review_count: 22,
      initial_message: null,
    },
    {
      corporation_name: '株式会社すみれケア',
      facility_name: 'すみれデイケアセンター',
      facility_type: 'デイサービス',
      address: '千葉県柏市柏5-1-20',
      lat: 35.8617,
      lng: 139.9751,
      phone_number: '04-7890-1234',
      description: 'リハビリ特化型のデイケアセンターです。専門職による機能訓練で、利用者様のQOL向上を目指しています。',
      images: ['/images/anken.png', '/images/facilities/facility2.jpg'],
      rating: 4.6,
      review_count: 14,
      initial_message: `ご応募ありがとうございます！
すみれデイケアセンターでは、利用者様の笑顔を大切にしています。
チームワークの良い職場です。一緒に働けることを楽しみにしています。`,
    },
    {
      corporation_name: '医療法人たんぽぽ会',
      facility_name: 'たんぽぽ病院併設老健',
      facility_type: '介護老人保健施設',
      address: '神奈川県相模原市中央区相模原4-8-15',
      lat: 35.5719,
      lng: 139.3715,
      phone_number: '042-890-1234',
      description: '病院併設の老健施設です。医療連携が強みで、安心してご利用いただけます。看護師・介護士の連携も良好です。',
      images: ['/images/anken.png'],
      rating: 4.2,
      review_count: 30,
      initial_message: null,
    },
    {
      corporation_name: '合同会社ひまわり',
      facility_name: 'ひまわりグループホーム',
      facility_type: 'グループホーム',
      address: '東京都中野区中野5-2-3',
      lat: 35.7078,
      lng: 139.6657,
      phone_number: '03-7890-1234',
      description: '定員18名のアットホームなグループホームです。認知症の方が穏やかに過ごせる環境づくりに力を入れています。',
      images: ['/images/anken.png'],
      rating: 4.8,
      review_count: 11,
      initial_message: `ご応募いただきありがとうございます！
ひまわりグループホームは家庭的な雰囲気が自慢です。
認知症ケアに興味のある方、ぜひお待ちしています！`,
    },
    {
      corporation_name: '株式会社オリーブケア',
      facility_name: 'オリーブ有料老人ホーム',
      facility_type: '有料老人ホーム',
      address: '埼玉県越谷市南越谷1-20-5',
      lat: 35.8782,
      lng: 139.7891,
      phone_number: '048-901-2345',
      description: '2020年オープンの新しい有料老人ホームです。最新設備と快適な環境で、入居者様・スタッフ双方にとって過ごしやすい施設を目指しています。',
      images: ['/images/anken.png', '/images/facilities/facility3.jpg'],
      rating: 4.9,
      review_count: 6,
      initial_message: `この度はご応募ありがとうございます。
オリーブ有料老人ホームは2020年オープンの新しい施設です。
設備も新しく、働きやすい環境です。一緒にこの施設を盛り上げていきましょう！`,
    },
  ];

  const createdFacilities = [];
  for (const facilityData of facilitiesData) {
    const facility = await prisma.facility.create({ data: facilityData });
    createdFacilities.push(facility);
  }
  console.log(`✅ ${createdFacilities.length}施設を作成しました`);

  // ========================================
  // 3. 施設管理者の作成
  // ========================================
  console.log('\n👨‍💼 施設管理者を作成中...');

  // 固定の管理者名リスト（施設ごとに1名）
  const adminNames = [
    '木村 一郎',     // ひかり介護センター
    '山田 健太',     // あおぞら訪問看護ステーション
    '佐藤 大輔',     // さくらの里特別養護老人ホーム
    '田中 直樹',     // グループホームみどりの家
    '高橋 翔太',     // ゆうわ老人保健施設
    '伊藤 和也',     // けやきデイサービス
    '渡辺 雄介',     // つばさ小規模多機能ホーム
    '中村 俊介',     // はなみずき有料老人ホーム
    '小林 拓也',     // あすなろサービス付き高齢者向け住宅
    '加藤 太郎',     // わかばショートステイ
    '吉田 健太',     // こすもす訪問介護ステーション
    '松本 一郎',     // すみれデイケアセンター
    '井上 大輔',     // たんぽぽ病院併設老健
    '山本 直樹',     // ひまわりグループホーム
    '鈴木 翔太',     // オリーブ有料老人ホーム
  ];

  const adminsData = createdFacilities.map((facility, index) => ({
    email: `admin${index + 1}@facility.com`,
    password_hash: hashPassword('password123'),
    facility_id: facility.id,
    name: adminNames[index] || `管理者 ${index + 1}`,
    phone_number: `03-${String(1000 + index).padStart(4, '0')}-${String(1000 + index).padStart(4, '0')}`,
    role: 'admin',
  }));

  for (const adminData of adminsData) {
    await prisma.facilityAdmin.create({ data: adminData });
  }
  console.log(`✅ ${adminsData.length}名の管理者を作成しました`);

  // ========================================
  // 4. 求人テンプレートの作成
  // ========================================
  console.log('\n📝 求人テンプレートを作成中...');

  const templateData = [
    {
      facility_id: createdFacilities[0].id,
      name: '日勤スタッフ（デイサービス）',
      title: '【デイサービス】日勤スタッフ募集',
      start_time: '09:00',
      end_time: '18:00',
      break_time: 60,
      hourly_wage: 1500,
      transportation_fee: 1000,
      recruitment_count: 2,
      qualifications: ['介護福祉士', '介護職員初任者研修'],
      work_content: ['入浴介助(全般)', '食事介助', 'レク・体操', '送迎(運転)'],
      description: 'デイサービスでの日勤業務です。入浴介助、食事介助、レクリエーションなどを担当していただきます。明るく元気に利用者様と接していただける方を募集しています。',
      skills: ['介護経験1年以上', 'コミュニケーション能力'],
      dresscode: ['動きやすい服装', '運動靴'],
      belongings: ['筆記用具', '上履き'],
      images: ['/images/anken.png'],
      notes: '初めての方も丁寧に指導します',
      tags: ['制服貸与', 'SWORKS初心者歓迎', '交通費支給'],
    },
    {
      facility_id: createdFacilities[2].id,
      name: '夜勤専従（特養）',
      title: '【特養】夜勤専従スタッフ募集',
      start_time: '17:00',
      end_time: '09:00',
      break_time: 120,
      hourly_wage: 1800,
      transportation_fee: 1500,
      recruitment_count: 1,
      qualifications: ['介護福祉士'],
      work_content: ['対話・見守り', '排泄介助', '就寝介助', '起床介助'],
      description: '特別養護老人ホームでの夜勤業務です。見守り、排泄介助、就寝介助などを担当していただきます。夜勤経験者の方優遇いたします。',
      skills: ['夜勤経験あり', '介護経験3年以上'],
      dresscode: ['動きやすい服装'],
      belongings: ['筆記用具', '上履き', '仮眠用着替え'],
      images: ['/images/anken.png'],
      notes: '夜勤手当あり。仮眠時間2時間確保',
      tags: ['制服貸与', '交通費支給', '夜勤専従'],
    },
    {
      facility_id: createdFacilities[1].id,
      name: '訪問看護スタッフ（日勤）',
      title: '【訪問看護】日勤スタッフ募集',
      start_time: '08:30',
      end_time: '17:30',
      break_time: 60,
      hourly_wage: 2000,
      transportation_fee: 1200,
      recruitment_count: 2,
      qualifications: ['看護師', '准看護師'],
      work_content: ['バイタル測定', '服薬介助', '記録業務', '利用者家族対応'],
      description: '訪問看護ステーションでのお仕事です。利用者様のご自宅を訪問し、医療的ケアや健康管理を行います。在宅医療に興味のある方、ブランクのある方も歓迎します。',
      skills: ['訪問看護経験者歓迎', '普通自動車免許'],
      dresscode: ['清潔感のある服装', 'スニーカー'],
      belongings: ['筆記用具', '運転免許証', 'マスク'],
      images: ['/images/anken.png'],
      notes: '訪問用の車両は施設で用意します',
      tags: ['ブランク歓迎', '交通費支給', '制服貸与'],
    },
    {
      facility_id: createdFacilities[3].id,
      name: 'グループホーム日勤',
      title: '【グループホーム】日勤介護スタッフ募集',
      start_time: '07:00',
      end_time: '16:00',
      break_time: 60,
      hourly_wage: 1400,
      transportation_fee: 800,
      recruitment_count: 3,
      qualifications: ['介護職員初任者研修', '実務者研修', '介護福祉士'],
      work_content: ['食事介助', '調理', '対話・見守り', 'レク・体操'],
      description: 'アットホームな雰囲気のグループホームです。認知症の方のケアに興味がある方、少人数でじっくり関わりたい方にぴったりのお仕事です。調理補助や生活支援がメインとなります。',
      skills: ['認知症ケア経験者歓迎', '調理補助可能な方'],
      dresscode: ['動きやすい服装', 'エプロン'],
      belongings: ['筆記用具', '上履き', 'エプロン'],
      images: ['/images/anken.png'],
      notes: 'まかない付き。未経験者でも研修制度が充実しています',
      tags: ['制服貸与', 'SWORKS初心者歓迎', '交通費支給'],
    },
    {
      facility_id: createdFacilities[4].id,
      name: '老健リハビリ補助',
      title: '【老健】リハビリ補助スタッフ募集',
      start_time: '09:00',
      end_time: '17:00',
      break_time: 60,
      hourly_wage: 1600,
      transportation_fee: 1000,
      recruitment_count: 2,
      qualifications: ['介護職員初任者研修', '実務者研修', '介護福祉士'],
      work_content: ['機能訓練補助', '移動介助', '食事介助', '入浴介助(全般)'],
      description: '介護老人保健施設でのリハビリ補助業務です。理学療法士・作業療法士と連携し、利用者様の在宅復帰をサポートします。リハビリに興味のある方、身体介護のスキルを磨きたい方におすすめです。',
      skills: ['リハビリに興味がある方', '体力に自信のある方'],
      dresscode: ['動きやすい服装', 'スニーカー'],
      belongings: ['筆記用具', '上履き', '動きやすい服装予備'],
      images: ['/images/anken.png'],
      notes: '医療連携が強みの施設です。スキルアップしたい方歓迎',
      tags: ['制服貸与', '未経験者歓迎', '交通費支給'],
    },
  ];

  for (const template of templateData) {
    await prisma.jobTemplate.create({ data: template });
  }
  console.log(`✅ ${templateData.length}件のテンプレートを作成しました`);

  // ========================================
  // 5. 求人の作成 - 求人ごとに複数の勤務日を設定
  // ========================================
  console.log('\n💼 求人を作成中...');

  const workPatterns = [
    { start: '09:00', end: '18:00', break: '12:00-13:00', type: 'day' },
    { start: '07:00', end: '16:00', break: '12:00-13:00', type: 'day_early' },
    { start: '10:00', end: '19:00', break: '13:00-14:00', type: 'day_late' },
    { start: '17:00', end: '09:00', break: '01:00-02:00', type: 'night' },
    { start: '10:00', end: '14:00', break: 'なし', type: 'short' },
    { start: '08:00', end: '12:00', break: 'なし', type: 'short_morning' },
    { start: '14:00', end: '18:00', break: 'なし', type: 'short_evening' },
  ];

  const createdJobs: any[] = [];
  const createdWorkDates: any[] = [];

  // 15件の求人を作成（各施設1つずつ）、各求人に複数の勤務日を設定
  for (let i = 0; i < 15; i++) {
    const facility = createdFacilities[i];
    const workPattern = workPatterns[i % workPatterns.length];
    const hourlyWage = getRandomInt(1200, 2000);

    // 勤務時間計算
    const startHour = parseInt(workPattern.start.split(':')[0]);
    const endHour = parseInt(workPattern.end.split(':')[0]);
    let workHours = endHour >= startHour ? endHour - startHour : (24 - startHour) + endHour;
    if (workPattern.break !== 'なし') workHours -= 1;

    const wage = hourlyWage * workHours;

    // ステータス設定
    let status: JobStatus;
    if (i < 3) {
      status = 'COMPLETED'; // 完了済み
    } else if (i < 5) {
      status = 'STOPPED'; // 停止中
    } else {
      status = 'PUBLISHED'; // 公開中
    }

    const tags: string[] = [];
    if (workPattern.type === 'night') tags.push('夜勤');
    if (workPattern.type.startsWith('short')) tags.push('短時間');
    if (i % 3 === 0) tags.push('未経験OK');
    if (i % 4 === 0) tags.push('高時給');
    if (facility.facility_type.includes('デイ')) tags.push('デイ');
    if (facility.facility_type.includes('特養')) tags.push('特養');

    const titles = [
      `【${facility.facility_type}】${workPattern.type === 'night' ? '夜勤' : '日勤'}スタッフ募集`,
      `【急募】${facility.facility_name}でのお仕事`,
      `${workPattern.type.startsWith('short') ? '短時間OK！' : ''}介護スタッフ募集`,
    ];

    const recruitmentCount = getRandomInt(1, 5);
    const transportationFee = getRandomInt(500, 1500);

    const job = await prisma.job.create({
      data: {
        facility_id: facility.id,
        template_id: null,
        status: status,
        title: titles[i % titles.length],
        start_time: workPattern.start,
        end_time: workPattern.end,
        break_time: workPattern.break,
        wage: wage,
        hourly_wage: hourlyWage,
        transportation_fee: transportationFee,
        deadline_days_before: getRandomInt(1, 3), // 勤務日の1〜3日前に締切
        tags: tags,
        address: facility.address,
        access: `最寄り駅から徒歩${getRandomInt(3, 15)}分`,
        recruitment_count: recruitmentCount,
        overview: `${facility.facility_name}（${facility.facility_type}）での介護業務です。${i % 3 === 0 ? '未経験の方も歓迎します。' : '経験者優遇。'}丁寧に指導しますので安心してご応募ください。`,
        work_content: ['見守り', '記録業務', '食事介助', '排泄介助', 'レクリエーション'],
        required_qualifications: i % 4 === 0 ? [] : ['介護福祉士', '初任者研修'],
        required_experience: i % 3 === 0 ? ['未経験OK'] : ['実務経験1年以上'],
        dresscode: ['動きやすい服装', '運動靴'],
        belongings: ['筆記用具', '上履き'],
        manager_name: `${getRandomItem(lastNames)} ${getRandomItem(firstNames.male)}`,
        manager_message: `${facility.facility_name}で一緒に働きませんか？お待ちしています！`,
        manager_avatar: getRandomItem(['👨', '👩', '🧑']),
        images: ['/images/anken.png'],
        allow_car: Math.random() > 0.3,
        allow_bike: Math.random() > 0.2,
        allow_bicycle: Math.random() > 0.2,
        allow_public_transit: true,
        has_parking: Math.random() > 0.5,
        no_bathing_assist: Math.random() > 0.6,
        has_driver: Math.random() > 0.8,
        hair_style_free: Math.random() > 0.7,
        nail_ok: Math.random() > 0.85,
        uniform_provided: Math.random() > 0.4,
        inexperienced_ok: i % 3 === 0,
        beginner_ok: Math.random() > 0.4,
        facility_within_5years: Math.random() > 0.85,
      },
    });
    createdJobs.push(job);

    // 各求人に複数の勤務日を作成（5〜15日分）
    const numWorkDates = getRandomInt(5, 15);
    const jobWorkDates: any[] = [];
    const usedDates = new Set<string>();

    for (let d = 0; d < numWorkDates; d++) {
      let workDate: Date;
      let deadline: Date;

      if (status === 'COMPLETED') {
        // 完了済み求人は過去の日付（重複を避けるため連番）
        workDate = subtractDays(7 + d);
        deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - 1);
      } else {
        // 公開中・停止中は将来の日付（重複を避けるため連番）
        workDate = addDays(3 + d);
        deadline = new Date(workDate);
        deadline.setDate(deadline.getDate() - job.deadline_days_before);
      }

      // 日付の重複チェック
      const dateKey = workDate.toISOString().split('T')[0];
      if (usedDates.has(dateKey)) {
        continue;
      }
      usedDates.add(dateKey);

      const workDateRecord = await prisma.jobWorkDate.create({
        data: {
          job_id: job.id,
          work_date: workDate,
          deadline: deadline,
          recruitment_count: recruitmentCount,
          applied_count: 0,
        },
      });
      jobWorkDates.push(workDateRecord);
      createdWorkDates.push({ ...workDateRecord, job_id: job.id, facility_id: facility.id });
    }
  }
  console.log(`✅ ${createdJobs.length}件の求人、${createdWorkDates.length}件の勤務日を作成しました`);

  // ========================================
  // 6. 応募の作成 - 様々なステータス
  // ========================================
  console.log('\n📋 応募を作成中...');

  // 勤務日ベースで応募を作成
  // 完了済み求人（index 0-2）の勤務日を取得
  const completedWorkDates = createdWorkDates.filter(wd => {
    const job = createdJobs.find(j => j.id === wd.job_id);
    return job && job.status === 'COMPLETED';
  });

  // 公開中求人（index 5-14）の勤務日を取得
  const publishedWorkDates = createdWorkDates.filter(wd => {
    const job = createdJobs.find(j => j.id === wd.job_id);
    return job && job.status === 'PUBLISHED';
  });

  const createdApplications: any[] = [];

  // 完了済み勤務日に対する応募（評価完了）
  for (let i = 0; i < Math.min(6, completedWorkDates.length); i++) {
    const workDate = completedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.COMPLETED_RATED,
        worker_review_status: ReviewStatus.COMPLETED,
        facility_review_status: ReviewStatus.COMPLETED,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    // applied_countを更新
    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // 公開中勤務日に対する様々なステータスの応募
  // APPLIED（応募中）
  for (let i = 0; i < 5 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.APPLIED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: '初めて応募させていただきます。よろしくお願いいたします。',
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // SCHEDULED（勤務予定・マッチング成立）
  for (let i = 5; i < 9 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.SCHEDULED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // WORKING（勤務中）
  for (let i = 9; i < 11 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.WORKING,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // COMPLETED_PENDING（完了・評価待ち）
  for (let i = 11; i < 15 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.COMPLETED_PENDING,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });

    await prisma.jobWorkDate.update({
      where: { id: workDate.id },
      data: { applied_count: { increment: 1 } },
    });
  }

  // CANCELLED（キャンセル）
  for (let i = 15; i < 17 && i < publishedWorkDates.length; i++) {
    const workDate = publishedWorkDates[i];
    const user = createdUsers[i % createdUsers.length];

    const application = await prisma.application.create({
      data: {
        work_date_id: workDate.id,
        user_id: user.id,
        status: WorkerStatus.CANCELLED,
        worker_review_status: ReviewStatus.PENDING,
        facility_review_status: ReviewStatus.PENDING,
        message: null,
      },
    });
    createdApplications.push({ ...application, work_date: workDate, facility_id: workDate.facility_id });
  }

  console.log(`✅ ${createdApplications.length}件の応募を作成しました`);

  // ========================================
  // 7. レビューの作成（各施設に15件ずつテストデータ）
  // ========================================
  console.log('\n⭐ レビューを作成中...');

  const reviewComments = {
    good: [
      'とても丁寧に対応していただきました。初めての勤務でも安心して働けました。',
      'スタッフの方々がとても親切で、働きやすい環境でした。',
      '利用者様への対応が素晴らしく、勉強になりました。',
      '設備が整っていて、仕事がしやすかったです。',
      'チームワークが良く、楽しく働けました。',
      '研修がしっかりしていて、安心して業務に臨めました。',
      '明るい雰囲気で、とても居心地が良かったです。',
      '先輩スタッフが丁寧に教えてくれて助かりました。',
      'シフトの融通が利いて、働きやすかったです。',
      '休憩時間もしっかり取れて、無理なく働けました。',
      '利用者様との関わりが多く、やりがいを感じました。',
      '清潔感があり、気持ちよく働ける環境でした。',
      'スタッフ間の連携がしっかりしていて安心でした。',
      '業務の流れがしっかり決まっていて分かりやすかったです。',
      '困ったときにすぐに相談できる雰囲気がありました。',
    ],
    neutral: [
      '普通に働けました。特に問題はありませんでした。',
      '忙しかったですが、やりがいを感じました。',
      '思っていたより大変でしたが、良い経験になりました。',
      '淡々と業務をこなすことができました。',
      '特筆すべき点はありませんが、問題もありませんでした。',
    ],
    improvement: [
      '休憩室がもう少し広いとありがたいです。',
      '駐車場が狭いので、改善されると嬉しいです。',
      '引き継ぎの時間がもう少しあると助かります。',
      '備品がもう少し整っているといいなと思いました。',
      '更衣室がもう少し広いと助かります。',
      '記録システムがもう少し使いやすいといいですね。',
      null,
      null,
      null,
      null,
    ],
    facilityGood: [
      '時間通りに出勤され、利用者様への対応も丁寧でした。またぜひお願いしたいです。',
      '経験豊富で即戦力として活躍していただきました。',
      'コミュニケーション能力が高く、利用者様からも好評でした。',
      '真面目に取り組んでいただき、信頼できる方でした。',
      '笑顔が素敵で、施設の雰囲気が明るくなりました。',
    ],
    facilityImprovement: [
      '記録の書き方をもう少し覚えていただければ完璧です。',
      '積極性がもう少しあると良いと思います。',
      null,
      null,
    ],
  };

  // COMPLETED_RATED の応募に対してレビューを作成（ワーカー→施設、施設→ワーカー両方）
  const ratedApplications = createdApplications.filter(app => app.status === WorkerStatus.COMPLETED_RATED);

  let reviewCount = 0;
  for (const app of ratedApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;

    // ワーカー→施設のレビュー
    const workerRating = getRandomInt(3, 5);
    await prisma.review.create({
      data: {
        facility_id: facility.id,
        user_id: user.id,
        job_id: app.work_date.job_id,
        work_date_id: app.work_date.id,
        application_id: app.id,
        reviewer_type: ReviewerType.WORKER,
        rating: workerRating,
        good_points: workerRating >= 4 ? getRandomItem(reviewComments.good) : getRandomItem(reviewComments.neutral),
        improvements: getRandomItem(reviewComments.improvement),
      },
    });
    reviewCount++;

    // 施設→ワーカーのレビュー
    const facilityRating = getRandomInt(3, 5);
    await prisma.review.create({
      data: {
        facility_id: facility.id,
        user_id: user.id,
        job_id: app.work_date.job_id,
        work_date_id: app.work_date.id,
        application_id: app.id,
        reviewer_type: ReviewerType.FACILITY,
        rating: facilityRating,
        good_points: getRandomItem(reviewComments.facilityGood),
        improvements: getRandomItem(reviewComments.facilityImprovement),
      },
    });
    reviewCount++;
  }

  // 各施設に15件ずつ追加のテストレビューを作成（「さらに10件表示する」機能テスト用）
  // 過去の完了済み求人を新規作成し、それに応募とレビューを紐付ける
  for (let facilityIdx = 0; facilityIdx < createdFacilities.length; facilityIdx++) {
    const facility = createdFacilities[facilityIdx];

    for (let i = 0; i < 15; i++) {
      const user = createdUsers[i % createdUsers.length];
      const workDateValue = subtractDays(getRandomInt(7, 60));

      // 過去の完了済みダミー求人を作成
      const dummyJob = await prisma.job.create({
        data: {
          facility_id: facility.id,
          status: 'COMPLETED',
          title: `【${facility.facility_type}】レビュー用過去求人${facilityIdx * 15 + i + 1}`,
          start_time: '09:00',
          end_time: '18:00',
          break_time: '12:00-13:00',
          wage: 12000,
          hourly_wage: 1500,
          transportation_fee: 1000,
          deadline_days_before: 1,
          tags: ['過去'],
          address: facility.address,
          access: '最寄り駅から徒歩5分',
          recruitment_count: 1,
          overview: 'レビューテストデータ用の過去の求人です',
          work_content: ['介護業務全般'],
          required_qualifications: [],
          required_experience: [],
          dresscode: ['動きやすい服装'],
          belongings: ['筆記用具'],
          manager_name: `${getRandomItem(lastNames)} ${getRandomItem(firstNames.male)}`,
        },
      });

      // 勤務日を作成
      const dummyWorkDate = await prisma.jobWorkDate.create({
        data: {
          job_id: dummyJob.id,
          work_date: workDateValue,
          deadline: subtractDays(getRandomInt(61, 90)),
          recruitment_count: 1,
          applied_count: 1,
        },
      });

      // ダミー応募を作成
      const dummyApp = await prisma.application.create({
        data: {
          work_date_id: dummyWorkDate.id,
          user_id: user.id,
          status: WorkerStatus.COMPLETED_RATED,
          worker_review_status: ReviewStatus.COMPLETED,
          facility_review_status: ReviewStatus.COMPLETED,
        },
      });

      // 評価のばらつきを作る（5:40%, 4:35%, 3:20%, 2:4%, 1:1%）
      let rating: number;
      const rand = Math.random();
      if (rand < 0.01) rating = 1;
      else if (rand < 0.05) rating = 2;
      else if (rand < 0.25) rating = 3;
      else if (rand < 0.60) rating = 4;
      else rating = 5;

      await prisma.review.create({
        data: {
          facility_id: facility.id,
          user_id: user.id,
          job_id: dummyJob.id,
          work_date_id: dummyWorkDate.id,
          application_id: dummyApp.id,
          reviewer_type: ReviewerType.WORKER,
          rating: rating,
          good_points: rating >= 4 ? getRandomItem(reviewComments.good) : getRandomItem(reviewComments.neutral),
          improvements: getRandomItem(reviewComments.improvement),
          created_at: subtractDays(getRandomInt(1, 30)),
        },
      });
      reviewCount++;
    }
  }

  console.log(`✅ ${reviewCount}件のレビューを作成しました（各施設15件のテストデータを含む）`);

  // ========================================
  // 8. メッセージの作成（会話のラリー）
  // ========================================
  console.log('\n💬 メッセージを作成中...');

  // SCHEDULED状態の応募に対してメッセージを作成
  const scheduledApplications = createdApplications.filter(app => app.status === WorkerStatus.SCHEDULED);

  let messageCount = 0;
  for (const app of scheduledApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;
    const job = createdJobs.find(j => j.id === app.work_date.job_id)!;

    const userName = user.name.split(' ')[0];

    // 施設からの初回メッセージ
    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `${userName}様

この度は、${facility.facility_name}の求人にご応募いただき、誠にありがとうございます。
${facility.facility_type}での勤務となります。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
お会いできることを楽しみにしております。`,
        created_at: subtractDays(3),
      },
    });
    messageCount++;

    // ワーカーからの返信
    await prisma.message.create({
      data: {
        from_user_id: user.id,
        to_facility_id: facility.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご連絡ありがとうございます。
${facility.facility_name}でのお仕事、楽しみにしています。

当日は何時頃に到着すればよろしいでしょうか？
また、持ち物で特に必要なものがあれば教えてください。

よろしくお願いいたします。`,
        created_at: subtractDays(2),
      },
    });
    messageCount++;

    // 施設からの返信
    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご質問ありがとうございます。

勤務開始の15分前にお越しください。
持ち物は上履きと筆記用具をお持ちください。
${Math.random() > 0.5 ? '制服は当施設でご用意いたします。' : '動きやすい服装でお越しください。'}

当日お会いできることを楽しみにしております！`,
        created_at: subtractDays(1),
      },
    });
    messageCount++;

    // ワーカーからの最終確認
    await prisma.message.create({
      data: {
        from_user_id: user.id,
        to_facility_id: facility.id,
        application_id: app.id,
        job_id: job.id,
        content: `ご丁寧にありがとうございます。
承知いたしました。

当日、よろしくお願いいたします！`,
        created_at: new Date(),
      },
    });
    messageCount++;
  }

  // WORKING/COMPLETED_PENDING状態の応募にも簡単なメッセージを追加
  const workingApplications = createdApplications.filter(app =>
    app.status === WorkerStatus.WORKING || app.status === WorkerStatus.COMPLETED_PENDING
  );

  for (const app of workingApplications) {
    const user = createdUsers.find(u => u.id === app.user_id)!;
    const facility = createdFacilities.find(f => f.id === app.facility_id)!;
    const job = createdJobs.find(j => j.id === app.work_date.job_id)!;

    await prisma.message.create({
      data: {
        from_facility_id: facility.id,
        to_user_id: user.id,
        application_id: app.id,
        job_id: job.id,
        content: `本日はお忙しい中ありがとうございます。
何かご不明な点があればお気軽にお声がけください。`,
        created_at: new Date(),
      },
    });
    messageCount++;
  }
  console.log(`✅ ${messageCount}件のメッセージを作成しました`);

  // ========================================
  // 9. 通知の作成
  // ========================================
  console.log('\n🔔 通知を作成中...');

  const notifications = [];

  // ワーカー向け通知（Notificationはuser_idのみ対応）
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];

    // 応募承認通知（マッチング成立の代わり）
    if (i < 5) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.APPLICATION_APPROVED,
        title: '応募が承認されました！',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}の求人に応募が承認されました。勤務日をご確認ください。`,
        link: '/my-jobs',
        created_at: subtractDays(getRandomInt(1, 5)),
      });
    }

    // メッセージ受信通知
    if (i < 6) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.NEW_MESSAGE,
        title: '新しいメッセージが届きました',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}からメッセージが届きました。`,
        link: '/messages',
        created_at: subtractDays(getRandomInt(0, 3)),
      });
    }

    // レビュー依頼通知
    if (i < 4) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.REVIEW_REQUEST,
        title: 'レビューをお願いします',
        message: `${createdFacilities[i % createdFacilities.length].facility_name}での勤務が完了しました。施設の評価をお願いします。`,
        link: '/mypage/reviews',
        created_at: subtractDays(getRandomInt(1, 7)),
      });
    }

    // システム通知（勤務リマインダーの代わり）
    if (i < 3) {
      notifications.push({
        user_id: user.id,
        type: NotificationType.SYSTEM,
        title: '明日の勤務のお知らせ',
        message: `明日は${createdFacilities[i % createdFacilities.length].facility_name}での勤務があります。お忘れなく！`,
        link: '/my-jobs',
        created_at: subtractDays(1),
      });
    }
  }

  // 注意: 現在のスキーマではNotificationはuser_idのみ対応のため、施設向け通知は作成しない

  for (const notif of notifications) {
    await prisma.notification.create({ data: notif });
  }
  console.log(`✅ ${notifications.length}件の通知を作成しました`);

  // ========================================
  // 10. ブックマークの作成
  // ========================================
  console.log('\n🔖 ブックマークを作成中...');

  const bookmarks = [];

  // ワーカーが求人をお気に入り登録
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const favJobIndices = getRandomItems(Array.from({ length: 30 }, (_, i) => i + 10), getRandomInt(2, 5));

    for (const idx of favJobIndices) {
      if (createdJobs[idx]) {
        bookmarks.push({
          type: BookmarkType.FAVORITE,
          user_id: user.id,
          target_job_id: createdJobs[idx].id,
        });
      }
    }
  }

  // ワーカーが求人を「あとで見る」
  for (let i = 0; i < 5; i++) {
    const user = createdUsers[i];
    const watchJobIndices = getRandomItems(Array.from({ length: 20 }, (_, i) => i + 20), getRandomInt(1, 3));

    for (const idx of watchJobIndices) {
      if (createdJobs[idx]) {
        bookmarks.push({
          type: BookmarkType.WATCH_LATER,
          user_id: user.id,
          target_job_id: createdJobs[idx].id,
        });
      }
    }
  }

  // ワーカーが施設をお気に入り登録
  for (let i = 0; i < 7; i++) {
    const user = createdUsers[i];
    const favFacilityIndices = getRandomItems(Array.from({ length: createdFacilities.length }, (_, i) => i), getRandomInt(1, 4));

    for (const idx of favFacilityIndices) {
      bookmarks.push({
        type: BookmarkType.FAVORITE,
        user_id: user.id,
        target_facility_id: createdFacilities[idx].id,
      });
    }
  }

  // 施設がワーカーをお気に入り登録
  for (let i = 0; i < 8; i++) {
    const facility = createdFacilities[i];
    const favUserIndices = getRandomItems(Array.from({ length: createdUsers.length }, (_, i) => i), getRandomInt(1, 3));

    for (const idx of favUserIndices) {
      bookmarks.push({
        type: BookmarkType.FAVORITE,
        facility_id: facility.id,
        target_user_id: createdUsers[idx].id,
      });
    }
  }

  for (const bookmark of bookmarks) {
    try {
      await prisma.bookmark.create({ data: bookmark });
    } catch (e) {
      // 重複は無視
    }
  }
  console.log(`✅ ${bookmarks.length}件のブックマークを作成しました`);

  // ========================================
  // 完了
  // ========================================
  console.log('\n========================================');
  console.log('🎉 完全版シードデータの投入が完了しました！');
  console.log('========================================');
  console.log(`
📊 作成されたデータ:
  - ユーザー: ${createdUsers.length}名
  - 施設: ${createdFacilities.length}施設
  - 施設管理者: ${adminsData.length}名
  - 求人テンプレート: ${templateData.length}件
  - 求人: ${createdJobs.length}件
  - 応募: ${createdApplications.length}件
  - レビュー: ${reviewCount}件
  - メッセージ: ${messageCount}件
  - 通知: ${notifications.length}件
  - ブックマーク: ${bookmarks.length}件
  `);
}

main()
  .catch((e) => {
    console.error('❌ シードの実行に失敗しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
