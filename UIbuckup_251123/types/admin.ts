export interface FacilityAdmin {
  id: number;
  email: string;
  password: string;
  facilityId: number;
  name: string;
  phone?: string;
  role: 'admin';
}
