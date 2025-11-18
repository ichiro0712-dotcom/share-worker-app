import { Review } from '@/types/review';

export const reviews: Review[] = [
  // 施設ID: 26 のレビュー
  {
    id: 1,
    facilityId: 26,
    age: '30代',
    gender: '男性',
    occupation: '介護福祉士',
    period: '1ヶ月以内',
    rating: 5,
    goodPoints: '島の雰囲気がとても良く、スタッフの方々も温かく迎えてくれました。施設も新しく清潔で、働きやすい環境でした。',
    improvements: '交通の便がやや不便で、島への移動に時間がかかります。もう少し交通費の補助があると助かります。',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 2,
    facilityId: 26,
    age: '40代',
    gender: '女性',
    occupation: '看護師',
    period: '3ヶ月以内',
    rating: 4,
    goodPoints: '利用者の方々との距離が近く、やりがいのある仕事でした。休日には美しいビーチでリフレッシュできました。',
    improvements: 'Wi-Fi環境が弱く、連絡が取りにくい時がありました。通信環境の改善を期待します。',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  },

  // 施設ID: 1 のレビュー（テスト用に10件追加）
  {
    id: 3,
    facilityId: 1,
    age: '20代',
    gender: '女性',
    occupation: '介護福祉士',
    period: '1ヶ月以内',
    rating: 5,
    goodPoints: 'スタッフの雰囲気が良く、楽しく働けました。利用者様も穏やかな方が多かったです。',
    improvements: 'レクリエーションの準備時間が少し足りないと感じました。',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 4,
    facilityId: 1,
    age: '30代',
    gender: '男性',
    occupation: '看護師',
    period: '3ヶ月以内',
    rating: 4,
    goodPoints: '職場環境が良く、働きやすかったです。研修制度も充実していました。',
    improvements: '夜勤が多く、体力的にきついと感じることがありました。',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 5,
    facilityId: 1,
    age: '40代',
    gender: '女性',
    occupation: '介護福祉士',
    period: '6ヶ月以内',
    rating: 5,
    goodPoints: '利用者様一人一人に寄り添ったケアができる環境でした。チームワークも抜群です。',
    improvements: '特にありません。大変満足しています。',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 6,
    facilityId: 1,
    age: '20代',
    gender: '男性',
    occupation: '理学療法士',
    period: '1ヶ月以内',
    rating: 3,
    goodPoints: '施設は綺麗で設備も整っていました。',
    improvements: 'コミュニケーションがもう少し取りやすい環境だと良いと思います。',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 7,
    facilityId: 1,
    age: '50代',
    gender: '女性',
    occupation: '看護師',
    period: '1年以上',
    rating: 5,
    goodPoints: '長期で働いていますが、スタッフ間の連携が素晴らしく、安心して仕事ができます。',
    improvements: '駐車場がもう少し広いと助かります。',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 8,
    facilityId: 1,
    age: '30代',
    gender: '女性',
    occupation: '介護福祉士',
    period: '3ヶ月以内',
    rating: 4,
    goodPoints: '利用者様が明るく、やりがいを感じられる職場です。研修も充実しています。',
    improvements: 'シフトの融通がもう少し効くと嬉しいです。',
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 9,
    facilityId: 1,
    age: '20代',
    gender: '女性',
    occupation: '作業療法士',
    period: '1ヶ月以内',
    rating: 2,
    goodPoints: '施設の設備は良かったです。',
    improvements: '業務量が多く、休憩時間が十分に取れませんでした。人員配置の見直しが必要だと思います。',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 10,
    facilityId: 1,
    age: '40代',
    gender: '男性',
    occupation: '介護福祉士',
    period: '6ヶ月以内',
    rating: 4,
    goodPoints: '職場の雰囲気が良く、相談しやすい環境でした。給与も良かったです。',
    improvements: '記録業務がやや多いと感じました。',
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 11,
    facilityId: 1,
    age: '30代',
    gender: '女性',
    occupation: '看護師',
    period: '3ヶ月以内',
    rating: 5,
    goodPoints: '医療体制がしっかりしており、安心して働けました。スタッフ教育も徹底されています。',
    improvements: '特にありません。',
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 12,
    facilityId: 1,
    age: '20代',
    gender: '男性',
    occupation: '介護福祉士',
    period: '1ヶ月以内',
    rating: 3,
    goodPoints: '新人でも丁寧に指導してもらえました。',
    improvements: 'マニュアルがわかりにくい部分があり、慣れるまで時間がかかりました。',
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  }
];
