export interface Facility {
  id: number;
  name: string;
  type: string; // デイサービス、特養など
  corporationName: string;
  address: string;
  phoneNumber: string;
  lat: number;
  lng: number;
  rating: number; // 平均評価
  reviewCount: number;
  image: string;
}
