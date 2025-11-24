import { getJobs } from '@/src/lib/actions';
import { JobListClient } from '@/components/job/JobListClient';

export default async function JobListPage() {
  const jobsData = await getJobs();

  // DBのデータをフロントエンドの型に変換（既に文字列化済み）
  const jobs = jobsData.map((job) => ({
    id: job.id,
    status: job.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
    facilityId: job.facility_id,
    title: job.title,
    workDate: job.work_date.split('T')[0],
    startTime: job.start_time,
    endTime: job.end_time,
    breakTime: job.break_time,
    wage: job.wage,
    hourlyWage: job.hourly_wage,
    deadline: job.deadline,
    tags: job.tags,
    address: job.address,
    access: job.access,
    recruitmentCount: job.recruitment_count,
    appliedCount: job.applied_count,
    transportationFee: job.transportation_fee,
    overview: job.overview,
    workContent: job.work_content,
    requiredQualifications: job.required_qualifications,
    requiredExperience: job.required_experience,
    dresscode: job.dresscode,
    belongings: job.belongings,
    managerName: job.manager_name,
    managerMessage: job.manager_message || '',
    managerAvatar: job.manager_avatar || '👤',
    images: job.images,
    // モック用のフィールド（後で削除予定）
    badges: [],
    otherConditions: [],
    mapImage: '/images/map-placeholder.png',
    transportMethods: [],
    parking: false,
    accessDescription: job.access,
  }));

  const facilities = jobsData.map((job) => ({
    id: job.facility.id,
    name: job.facility.facility_name,
    corporationName: job.facility.corporation_name,
    type: job.facility.facility_type,
    address: job.facility.address,
    lat: job.facility.lat,
    lng: job.facility.lng,
    phoneNumber: job.facility.phone_number,
    description: job.facility.description || '',
    images: job.facility.images,
    rating: job.facility.rating,
    reviewCount: job.facility.review_count,
  }));

  return <JobListClient jobs={jobs} facilities={facilities} />;
}
