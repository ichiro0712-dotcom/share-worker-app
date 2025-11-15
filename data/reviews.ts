import { Review } from '@/types/review';

export const reviews: Review[] = [
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
  }
];

// 実際には100件のレビューデータを含める
// 施設ごとに複数のレビューを割り当てる
