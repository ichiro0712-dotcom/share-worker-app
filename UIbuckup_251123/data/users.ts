import { User } from '@/types/user';

// テスト用ユーザーデータ
export const users: User[] = [
  {
    id: 1,
    email: 'test1@example.com',
    password: 'password123', // 本番環境ではハッシュ化が必要
    name: '田中 花子',
    age: '30代',
    gender: '女性',
    occupation: '看護師',
    phone: '090-1234-5678',
  },
  {
    id: 2,
    email: 'test2@example.com',
    password: 'password123',
    name: '佐藤 太郎',
    age: '20代',
    gender: '男性',
    occupation: '介護福祉士',
    phone: '090-9876-5432',
  },
  {
    id: 3,
    email: 'test3@example.com',
    password: 'password123',
    name: '鈴木 一郎',
    age: '40代',
    gender: '男性',
    occupation: '理学療法士',
    phone: '090-5555-6666',
  },
];
