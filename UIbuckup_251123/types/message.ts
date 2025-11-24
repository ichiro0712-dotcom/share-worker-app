export interface Message {
  id: number;
  from_user_id?: number;
  to_user_id?: number;
  from_facility_id?: number;
  to_facility_id?: number;
  application_id: number;   // どのマッチングに関するメッセージか
  content: string;
  read_at?: string;
  created_at: string;
}
