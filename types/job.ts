export interface Job {
  id: number;
  facilityId: number;
  title: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakTime: string; // 例: "12:00-13:00"
  wage: number; // 日給
  hourlyWage: number; // 時給
  deadline: string; // ISO 8601
  tags: string[];
  address: string;
  access: string;
  recruitmentCount: number; // 募集人数
  appliedCount: number; // 応募済み人数
  transportationFee: number;
  overview: string;
  workContent: string[];
  requiredQualifications: string[];
  requiredExperience: string[];
  dresscode: string[];
  belongings: string[];
  otherConditions: string[];
  managerName: string;
  managerMessage: string;
  managerAvatar: string;
  images: string[];
  badges: Array<{ text: string; type: 'yellow' | 'green' }>;
  // アクセス情報
  transportMethods: Array<{ name: string; available: boolean }>;
  parking: boolean;
  accessDescription: string;
  // 地図情報
  mapImage: string;
}
