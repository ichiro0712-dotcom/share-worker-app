export interface Review {
  id: number;
  facilityId: number;
  age: string;
  gender: string;
  occupation: string;
  period: string;
  rating: number;
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
