export interface Review {
  id: number;
  facilityId: number;
  age: string; // 30代など
  gender: string; // 男性、女性
  occupation: string; // 介護福祉士など
  period: string; // 1ヶ月以内など
  rating: number; // 1-5
  goodPoints: string;
  improvements: string;
  createdAt: string;
}

export interface ReviewStats {
  totalRating: number;
  totalCount: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}
