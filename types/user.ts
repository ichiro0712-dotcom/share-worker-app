export interface User {
  id: number;
  email: string;
  password: string; // 本番環境ではハッシュ化が必要
  name: string;
  age: string;
  gender: string;
  occupation: string;
  phone?: string;
}
